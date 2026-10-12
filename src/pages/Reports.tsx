/**
 * Reports Page Component
 */
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  ShoppingCart, 
  ArrowLeftRight, 
  ShieldCheck, 
  Filter 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Transaction, CustodyMovement } from '../types';
import { getTodayDateString, getWeekRange, formatDateArabic } from '../utils/dateUtils';
import { formatCurrency, fromHalalas } from '../utils/currencyUtils';
import jsPDF from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
export const Reports: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const timezone = 'Asia/Riyadh';
  const numberFormat = userProfile?.settings.numberFormat || 'arabic';

  const todayStr = getTodayDateString(timezone);
  const [currentDateInWeek, setCurrentDateInWeek] = useState<string>(todayStr);
  const { startDate, endDate, days } = getWeekRange(currentDateInWeek);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [movements, setMovements] = useState<CustodyMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, `users/${currentUser.uid}/transactions`)
      );

      const unsubTx = onSnapshot(q, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
        });
        list.sort((a, b) => b.occurredAt - a.occurredAt);
        setTransactions(list);
        setLoading(false);
      }, (err) => {
        console.error('Reports fetch error:', err);
        setLoading(false);
      });

      const mQuery = query(collection(db, `users/${currentUser.uid}/custodyMovements`));
      const unsubMov = onSnapshot(mQuery, (snapshot) => {
        const list: CustodyMovement[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as CustodyMovement);
        });
        setMovements(list);
      });

      return () => {
        unsubTx();
        unsubMov();
      };
    } catch (err) {
      console.error('Reports subscription error:', err);
      setLoading(false);
    }
  }, [currentUser]);

  // Filter transactions for the week date range [startDate, endDate]
  const periodTransactions = transactions.filter(t => t.transactionDate >= startDate && t.transactionDate <= endDate);
  const filteredReportTransactions = periodTransactions.filter(t => filterType === 'all' || t.type === filterType);

  const totalPurchases = periodTransactions
    .filter(t => t.type === 'purchase')
    .reduce((sum, t) => sum + t.amountHalalas, 0);

  const totalTransfers = periodTransactions
    .filter(t => t.type === 'transfer')
    .reduce((sum, t) => sum + t.amountHalalas, 0);

  const totalCustodiesReceived = periodTransactions
    .filter(t => t.type === 'custody')
    .reduce((sum, t) => sum + t.amountHalalas, 0);

  const periodMovements = movements.filter(m => m.date >= startDate && m.date <= endDate);
  const totalSettlements = periodMovements
    .filter(m => m.type === 'refund')
    .reduce((sum, m) => sum + m.amountHalalas, 0);

  // Daily purchases for chart (7 days)
  const dailyPurchasesMap: { [date: string]: number } = {};
  days.forEach(d => { dailyPurchasesMap[d] = 0; });
  periodTransactions
    .filter(t => t.type === 'purchase')
    .forEach(t => {
      if (dailyPurchasesMap[t.transactionDate] !== undefined) {
        dailyPurchasesMap[t.transactionDate] += t.amountHalalas;
      }
    });

  const dailyPurchasesArray = days.map(d => ({
    date: d,
    label: new Date(d).toLocaleDateString('ar-SA', { weekday: 'short' }),
    amount: dailyPurchasesMap[d]
  }));

  const maxDailyPurchase = Math.max(...dailyPurchasesArray.map(d => d.amount), 1);
  const dailyAverage = totalPurchases / 7;

  // Highest purchase day
  const highestDay = dailyPurchasesArray.reduce((max, curr) => curr.amount > max.amount ? curr : max, dailyPurchasesArray[0]);

  // Category breakdown
  const categoryMap: { [cat: string]: number } = { supplies: 0, food: 0, transport: 0, bills: 0, other: 0 };
  periodTransactions
    .filter(t => t.type === 'purchase' && t.category)
    .forEach(t => {
      if (t.category && categoryMap[t.category] !== undefined) {
        categoryMap[t.category] += t.amountHalalas;
      }
    });

  const categoryNames: { [key: string]: string } = {
    supplies: 'مستلزمات',
    food: 'طعام',
    transport: 'مواصلات',
    bills: 'فواتير',
    other: 'أخرى'
  };

  // Export CSV
  const handleExportCSV = () => {
    let csvContent = '\uFEFFالتاريخ,الوقت,النوع,الوصف,المبلغ (ر.س)\n';
    periodTransactions.forEach(t => {
      csvContent += `"${t.transactionDate}","${t.transactionTime}","${t.type}","${t.description.replace(/"/g, '""')}","${fromHalalas(t.amountHalalas)}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `qayd_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF using jsPDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      // Header title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Qayd Financial Report', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Period: ${startDate} to ${endDate}`, 105, 30, { align: 'center' });
      doc.text(`Total Purchases: ${fromHalalas(totalPurchases)} SAR`, 14, 45);
      doc.text(`Total Transfers: ${fromHalalas(totalTransfers)} SAR`, 14, 52);
      doc.text(`Received Custodies: ${fromHalalas(totalCustodiesReceived)} SAR`, 14, 59);

      const typeMap: Record<string, string> = {
        purchase: 'Purchase',
        transfer: 'Transfer',
        custody: 'Custody'
      };

      const tableData = periodTransactions.map(t => [
        t.transactionDate,
        t.transactionTime,
        typeMap[t.type] || t.type,
        t.description,
        `${fromHalalas(t.amountHalalas)} SAR`
      ]);

      const tableOptions = {
        startY: 70,
        head: [['Date', 'Time', 'Type', 'Description', 'Amount']],
        body: tableData,
        theme: 'grid' as const,
        styles: { font: 'helvetica', fontSize: 10 },
        headStyles: { fillColor: [20, 43, 54] as [number, number, number] }
      };

      if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(tableOptions);
      }

      doc.save(`qayd_report_${startDate}_to_${endDate}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback: trigger print dialog for reliable report generation
      window.print();
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#142B36] mb-1">التقارير الأسبوعية</h2>
          <p className="text-sm text-slate-500">نطاق التقرير: من {startDate} إلى {endDate}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              const d = new Date(currentDateInWeek);
              d.setDate(d.getDate() - 7);
              setCurrentDateInWeek(d.toISOString().split('T')[0]);
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            الأسبوع السابق
          </button>
          <button
            onClick={() => setCurrentDateInWeek(todayStr)}
            className="px-4 py-2 rounded-xl bg-[#367C73] text-white text-sm font-semibold shadow hover:bg-[#2b635b] transition-colors"
          >
            الأسبوع الحالي
          </button>
          <button
            onClick={() => {
              const d = new Date(currentDateInWeek);
              d.setDate(d.getDate() + 7);
              setCurrentDateInWeek(d.toISOString().split('T')[0]);
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            الأسبوع التالي
          </button>
        </div>
      </div>

      {/* Export actions */}
      <div className="flex justify-end no-print">
        <button
          onClick={handleExportCSV}
          className="px-5 py-2.5 rounded-xl bg-[#367C73] text-white font-semibold text-sm hover:bg-[#2b635b] transition-colors flex items-center gap-2 shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>تصدير إكسل (CSV)</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-1">إجمالي المشتريات</p>
          <p className="text-xl font-bold text-[#142B36] font-mono">{formatCurrency(totalPurchases, numberFormat)}</p>
          <p className="text-[11px] text-slate-400 mt-2">المتوسط اليومي: {formatCurrency(dailyAverage, numberFormat)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-1">إجمالي التحويلات</p>
          <p className="text-xl font-bold text-[#142B36] font-mono">{formatCurrency(totalTransfers, numberFormat)}</p>
          <p className="text-[11px] text-slate-400 mt-2">عدد العمليات: {periodTransactions.filter(t => t.type === 'transfer').length}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-1">العهد المستلمة</p>
          <p className="text-xl font-bold text-[#142B36] font-mono">{formatCurrency(totalCustodiesReceived, numberFormat)}</p>
          <p className="text-[11px] text-slate-400 mt-2">التسويات المرتجعة: {formatCurrency(totalSettlements, numberFormat)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-1">أعلى يوم مشتريات</p>
          <p className="text-lg font-bold text-[#367C73]">{highestDay.label}</p>
          <p className="text-sm font-bold font-mono text-slate-700 mt-1">{formatCurrency(highestDay.amount, numberFormat)}</p>
        </div>
      </div>

      {/* Purchases Bar Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg text-[#142B36] mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#367C73]" />
          <span>تطور المشتريات خلال أيام الأسبوع</span>
        </h3>

        <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-4 border-b border-slate-200">
          {dailyPurchasesArray.map((item, idx) => {
            const heightPercent = maxDailyPurchase > 0 ? (item.amount / maxDailyPurchase) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {fromHalalas(item.amount)}
                </span>
                <div 
                  style={{ height: `${Math.max(heightPercent, 6)}%` }}
                  className="w-full max-w-[48px] bg-[#367C73] rounded-t-xl transition-all duration-500 group-hover:bg-[#2b635b]"
                />
                <span className="text-xs font-bold text-slate-600 mt-2">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown & Transactions List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-bold text-lg text-[#142B36]">توزيع المشتريات حسب التصنيف</h3>
          <div className="space-y-3">
            {Object.entries(categoryMap).map(([cat, amount]) => {
              const percent = totalPurchases > 0 ? (amount / totalPurchases) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{categoryNames[cat]}</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(amount, numberFormat)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${percent}%` }}
                      className="h-full bg-[#367C73] rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Transactions List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-[#142B36]">سجل العمليات للفترة</h3>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
            >
              <option value="all">جميع الأنواع</option>
              <option value="purchase">مشتريات</option>
              <option value="transfer">تحويلات</option>
              <option value="custody">عُهد</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 bg-slate-50">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">الوصف</th>
                  <th className="py-3 px-4">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReportTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">لا توجد عمليات في هذه الفترة</td>
                  </tr>
                ) : (
                  filteredReportTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{t.transactionDate}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          t.type === 'purchase' ? 'bg-emerald-50 text-[#367C73]' : t.type === 'transfer' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-[#D99A32]'
                        }`}>
                          {t.type === 'purchase' ? 'مشتريات' : t.type === 'transfer' ? 'تحويل' : 'عهدة'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{t.description}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#142B36]">{formatCurrency(t.amountHalalas, numberFormat)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
