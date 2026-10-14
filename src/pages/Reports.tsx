import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  ShoppingCart, 
  ArrowLeftRight, 
  Wallet, 
  ChevronRight, 
  ChevronLeft,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Transaction, CustodyMovement } from '../types';
import { getTodayDateString, getWeekRange, formatDateArabic } from '../utils/dateUtils';
import { formatCurrency, fromHalalas } from '../utils/currencyUtils';

export const Reports: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const timezone = userProfile?.settings?.timezone || 'Asia/Riyadh';
  const numberFormat = userProfile?.settings?.numberFormat || 'english';
  const weekStart = userProfile?.settings?.weekStart || 'saturday';

  const todayStr = getTodayDateString(timezone);
  const [currentDateInPeriod, setCurrentDateInPeriod] = useState<string>(todayStr);
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');

  const { startDate, endDate, days } = useMemo(() => {
    if (periodType === 'weekly') {
      return getWeekRange(currentDateInPeriod, weekStart);
    } else {
      // Monthly range
      const [y, m] = currentDateInPeriod.split('-').map(Number);
      const totalDays = new Date(y, m, 0).getDate();
      const mStr = String(m).padStart(2, '0');
      const sDate = `${y}-${mStr}-01`;
      const eDate = `${y}-${mStr}-${String(totalDays).padStart(2, '0')}`;
      const mDays: string[] = [];
      for (let i = 1; i <= totalDays; i++) {
        mDays.push(`${y}-${mStr}-${String(i).padStart(2, '0')}`);
      }
      return { startDate: sDate, endDate: eDate, days: mDays };
    }
  }, [currentDateInPeriod, periodType, weekStart]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [movements, setMovements] = useState<CustodyMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const q = query(collection(db, `users/${currentUser.uid}/transactions`));
      const unsubTx = onSnapshot(q, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
        });
        list.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
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
      console.error('Reports error:', err);
      setLoading(false);
    }
  }, [currentUser]);

  // Filter for period
  const periodTransactions = useMemo(() => {
    return transactions.filter(t => t.transactionDate >= startDate && t.transactionDate <= endDate);
  }, [transactions, startDate, endDate]);

  const totalPurchases = useMemo(() => {
    return periodTransactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [periodTransactions]);

  const totalTransfers = useMemo(() => {
    return periodTransactions
      .filter(t => t.type === 'transfer')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [periodTransactions]);

  const totalCustodiesReceived = useMemo(() => {
    return periodTransactions
      .filter(t => t.type === 'custody')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [periodTransactions]);

  const periodMovements = useMemo(() => {
    return movements.filter(m => m.date >= startDate && m.date <= endDate);
  }, [movements, startDate, endDate]);

  const totalSettlements = useMemo(() => {
    return periodMovements
      .filter(m => m.type === 'refund')
      .reduce((sum, m) => sum + m.amountHalalas, 0);
  }, [periodMovements]);

  // Chart data: daily purchases across all days of the period
  const dailyPurchasesMap = useMemo(() => {
    const map: { [d: string]: number } = {};
    days.forEach(d => { map[d] = 0; });
    periodTransactions
      .filter(t => t.type === 'purchase')
      .forEach(t => {
        if (map[t.transactionDate] !== undefined) {
          map[t.transactionDate] += t.amountHalalas;
        }
      });
    return map;
  }, [days, periodTransactions]);

  const dailyPurchasesArray = useMemo(() => {
    return days.map(d => {
      const [year, month, day] = d.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      return {
        dateStr: d,
        dayName: new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(dateObj),
        amount: dailyPurchasesMap[d],
      };
    });
  }, [days, dailyPurchasesMap]);

  const maxDailyPurchase = useMemo(() => {
    return Math.max(...dailyPurchasesArray.map(d => d.amount), 100);
  }, [dailyPurchasesArray]);

  const dailyAverage = totalPurchases / Math.max(days.length, 1);

  // Steppers
  const handlePrevPeriod = () => {
    const [y, m, d] = currentDateInPeriod.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (periodType === 'weekly') {
      dateObj.setDate(dateObj.getDate() - 7);
    } else {
      dateObj.setMonth(dateObj.getMonth() - 1);
    }
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    setCurrentDateInPeriod(`${yStr}-${mStr}-${dStr}`);
  };

  const handleNextPeriod = () => {
    const [y, m, d] = currentDateInPeriod.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (periodType === 'weekly') {
      dateObj.setDate(dateObj.getDate() + 7);
    } else {
      dateObj.setMonth(dateObj.getMonth() + 1);
    }
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    setCurrentDateInPeriod(`${yStr}-${mStr}-${dStr}`);
  };

  // CSV Export with Formula Protection and Arabic UTF-8 BOM
  const handleExportCSV = () => {
    // Formula protection: prepend apostrophe to fields starting with =, +, -, @
    const sanitize = (text: string) => {
      const str = String(text ?? '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str}"`;
      }
      return `"${str}"`;
    };

    let csv = '\uFEFF'; // UTF-8 BOM for Arabic excel
    csv += 'منصة قَيد - تقرير مالي\n';
    csv += `اسم المستخدم,${sanitize(userProfile?.displayName || 'مستخدم')}\n`;
    csv += `الفترة,${sanitize(`من ${startDate} إلى ${endDate}`)}\n`;
    csv += `تاريخ التقرير,${sanitize(getTodayDateString(timezone))}\n\n`;

    csv += 'إجماليات الفترة\n';
    csv += `إجمالي المشتريات,${fromHalalas(totalPurchases)} ر.س\n`;
    csv += `إجمالي التحويلات,${fromHalalas(totalTransfers)} ر.س\n`;
    csv += `العهد المستلمة,${fromHalalas(totalCustodiesReceived)} ر.س\n`;
    csv += `إعادة العهد (التسويات),${fromHalalas(totalSettlements)} ر.س\n\n`;

    csv += 'التاريخ,الوقت,النوع,الوصف,المبلغ (ر.س),الملاحظات\n';
    periodTransactions.forEach(t => {
      const typeLabel = t.type === 'purchase' ? 'مشتريات' : t.type === 'transfer' ? 'تحويل' : 'عهدة';
      csv += `${sanitize(t.transactionDate)},${sanitize(t.transactionTime)},${sanitize(typeLabel)},${sanitize(t.description)},${fromHalalas(t.amountHalalas)},${sanitize(t.notes || '')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qayd_report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header matching Image 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#17233D] tracking-tight">التقارير</h1>
        </div>

        {/* Range Selector Stepper matching Image 3 */}
        <div className="flex items-center gap-2">
          {/* Stepper with Range */}
          <div className="flex items-center bg-white border border-slate-200/80 rounded-2xl p-1 shadow-xs">
            <button
              onClick={handleNextPeriod}
              className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors"
              title="الفترة التالية"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="px-3 text-xs sm:text-sm font-semibold font-mono text-[#17233D]">
              {startDate} — {endDate}
            </span>

            <button
              onClick={handlePrevPeriod}
              className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors"
              title="الفترة السابقة"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Report Header */}
      <div className="hidden print:block p-4 border-b border-slate-200 mb-6 text-right">
        <h1 className="text-2xl font-bold text-black mb-1">منصة قَيد • تقرير العمليات المالية</h1>
        <p className="text-xs text-slate-600">
          المستخدم: {userProfile?.displayName} • الفترة: من {startDate} إلى {endDate} • صدر بتاريخ {getTodayDateString(timezone)}
        </p>
      </div>

      {/* Bar Chart matching Image 3 */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-[#17233D]">
            <BarChart3 className="w-4 h-4 text-[#315BEB]" />
            <span>المشتريات اليومية خلال الفترة</span>
          </div>

          <span className="text-xs font-semibold text-slate-400 font-mono">
            المتوسط اليومي: {formatCurrency(dailyAverage, numberFormat)}
          </span>
        </div>

        {/* Chart Visual */}
        <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
          {dailyPurchasesArray.map((bar, idx) => {
            const heightPercent = maxDailyPurchase > 0 ? (bar.amount / maxDailyPurchase) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-[#315BEB] transition-colors">
                  {bar.amount > 0 ? fromHalalas(bar.amount) : 0}
                </span>
                <div 
                  style={{ height: `${Math.max(heightPercent, 4)}%` }}
                  className="w-full max-w-[48px] bg-[#315BEB] hover:bg-[#2548cb] rounded-t-xl transition-all duration-300"
                />
                <span className="text-xs font-bold text-slate-500 mt-1 select-none">
                  {bar.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Summary Cards matching Image 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* المشتريات */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">المشتريات</p>
            <p className="text-2xl font-bold text-[#17233D] font-mono">
              {formatCurrency(totalPurchases, numberFormat)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* التحويلات */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">التحويلات</p>
            <p className="text-2xl font-bold text-[#17233D] font-mono">
              {formatCurrency(totalTransfers, numberFormat)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>

        {/* حركة العُهد */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">حركة العُهد</p>
            <p className="text-2xl font-bold text-[#17233D] font-mono">
              {formatCurrency(totalCustodiesReceived, numberFormat)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FEF6E9] text-[#F4AE52] flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Detailed Operations Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-[#17233D]">جدول العمليات التفصيلي للفترة</h3>
          <span className="text-xs text-slate-400 font-semibold">{periodTransactions.length} عملية</span>
        </div>

        {periodTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            لا توجد عمليات مسجلة في هذا النطاق الزمني.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الوقت</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">الوصف</th>
                  <th className="py-3 px-4 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-500">{tx.transactionDate}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{tx.transactionTime}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] ${
                        tx.type === 'purchase'
                          ? 'bg-[#EEF2FF] text-[#315BEB]'
                          : tx.type === 'transfer'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-[#FEF6E9] text-[#F4AE52]'
                      }`}>
                        {tx.type === 'purchase' ? 'مشتريات' : tx.type === 'transfer' ? 'تحويل' : 'عهدة'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#17233D]">{tx.description}</td>
                    <td className="py-3.5 px-4 text-left font-mono font-bold text-[#17233D]">
                      {formatCurrency(tx.amountHalalas, numberFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Action Buttons matching Image 3 bottom */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2 no-print">
        <button
          onClick={handleExportCSV}
          className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 text-[#17233D] font-semibold text-xs transition-all shadow-xs flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>تحميل التقرير (Excel / CSV)</span>
        </button>
      </div>
    </div>
  );
};
