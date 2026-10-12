import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  ShoppingCart, 
  ArrowLeftRight, 
  ShieldCheck, 
  Plus, 
  Clock 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Transaction } from '../types';
import { getTodayDateString, formatDateArabic } from '../utils/dateUtils';
import { formatCurrency, fromHalalas } from '../utils/currencyUtils';
export const DaysRecord: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const timezone = 'Asia/Riyadh';
  const numberFormat = userProfile?.settings.numberFormat || 'arabic';

  const todayStr = getTodayDateString(timezone);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  
  // Current calendar view month/year
  const [currentYear, setCurrentYear] = useState<number>(() => parseInt(todayStr.split('-')[0]));
  const [currentMonth, setCurrentMonth] = useState<number>(() => parseInt(todayStr.split('-')[1]) - 1);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, `users/${currentUser.uid}/transactions`)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
        });
        list.sort((a, b) => b.occurredAt - a.occurredAt);
        setAllTransactions(list);
        setLoading(false);
      }, (err) => {
        console.error('All transactions fetch error:', err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Days record error:', err);
      setLoading(false);
    }
  }, [currentUser]);

  // Days with transactions set for quick badge lookup
  const datesWithTransactions = new Set(allTransactions.map(t => t.transactionDate));

  // Generate month days grid
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    
    // First day of month weekday
    const firstDayOfWeek = date.getDay(); // 0 = Sunday
    // Pad previous month days for calendar alignment
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({ dateStr, dayNum, isCurrentMonth: false });
    }

    // Current month days
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      const m = String(month + 1).padStart(2, '0');
      const d = String(i).padStart(2, '0');
      const dateStr = `${year}-${m}-${d}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: true });
    }

    return days;
  };

  const calendarDays = getDaysInMonth(currentYear, currentMonth);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  // Transactions for selected date
  const selectedDayTransactions = allTransactions.filter(t => t.transactionDate === selectedDate);
  const selectedDayPurchases = selectedDayTransactions.filter(t => t.type === 'purchase').reduce((s, t) => s + t.amountHalalas, 0);
  const selectedDayTransfers = selectedDayTransactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amountHalalas, 0);

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#142B36]">سجل الأيام</h2>
        </div>
        <button
          onClick={() => setSelectedDate(todayStr)}
          className="px-4 py-2 rounded-xl bg-[#367C73] text-white text-sm font-semibold shadow hover:bg-[#2b635b] transition-colors"
        >
          الانتقال لليوم الحالي
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Card */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#142B36]">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-3">
            <span>السبت</span>
            <span>الأحد</span>
            <span>الإثنين</span>
            <span>الثلاثاء</span>
            <span>الأربعاء</span>
            <span>الخميس</span>
            <span>الجمعة</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {calendarDays.map((day, idx) => {
              const hasTx = datesWithTransactions.has(day.dateStr);
              const isSelected = day.dateStr === selectedDate;
              const isToday = day.dateStr === todayStr;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`
                    h-11 rounded-xl flex flex-col items-center justify-center relative transition-all text-sm
                    ${!day.isCurrentMonth ? 'text-slate-300' : 'text-slate-800'}
                    ${isSelected 
                      ? 'bg-[#367C73] text-white font-bold shadow-md' 
                      : isToday 
                        ? 'border-2 border-[#367C73] font-bold bg-[#367C73]/5' 
                        : 'hover:bg-slate-100'
                    }
                  `}
                >
                  <span>{day.dayNum}</span>
                  {hasTx && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#367C73] absolute bottom-1.5" />
                  )}
                  {hasTx && isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B9E6CF] absolute bottom-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#367C73]" />
              <span>يوم يحتوي عمليات</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-[#367C73]" />
              <span>اليوم الحالي</span>
            </div>
          </div>
        </div>

        {/* Selected Day Transactions Panel */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
            <div>
              <h3 className="font-bold text-xl text-[#142B36]">{formatDateArabic(selectedDate)}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {selectedDayTransactions.length} عملية مسجلة في هذا اليوم
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left">
                <span className="text-xs text-slate-500 block">مشتريات اليوم:</span>
                <span className="font-mono font-bold text-[#367C73]">{formatCurrency(selectedDayPurchases, numberFormat)}</span>
              </div>
            </div>
          </div>

          {/* Transactions list for selected day */}
          <div className="flex-1 overflow-y-auto space-y-2.5">
            {selectedDayTransactions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-slate-600">لا توجد عمليات في هذا اليوم</p>
                <p className="text-xs text-slate-400 mt-1">الأيام الخالية تظهر بحالة فارغة دون إنشاء سجلات وهمية.</p>
              </div>
            ) : (
              <AnimatePresence>
                {selectedDayTransactions.map((tx, idx) => (
                  <motion.div 
                    key={tx.id} 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    whileHover={{ scale: 1.01, x: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/transaction/${tx.id}`)}
                    className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 cursor-pointer flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 group-hover:scale-105 transition-transform ${
                        tx.type === 'purchase' ? 'bg-[#367C73]' : tx.type === 'transfer' ? 'bg-blue-600' : 'bg-[#D99A32]'
                      }`}>
                        {tx.type === 'purchase' ? <ShoppingCart className="w-5 h-5" /> : tx.type === 'transfer' ? <ArrowLeftRight className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 text-sm group-hover:text-[#367C73] transition-colors">{tx.description}</h4>
                        <p className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{tx.transactionTime}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#142B36] group-hover:text-[#367C73]">
                        {formatCurrency(tx.amountHalalas, numberFormat)}
                      </span>
                      <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-[#367C73] transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
