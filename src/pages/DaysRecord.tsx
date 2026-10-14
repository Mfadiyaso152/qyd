import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  ShoppingCart, 
  ArrowLeftRight, 
  Wallet, 
  Plus, 
  Clock,
  Moon,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Transaction } from '../types';
import { getTodayDateString, formatDateArabic, formatTime12Hour } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currencyUtils';

export const DaysRecord: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const timezone = userProfile?.settings?.timezone || 'Asia/Riyadh';
  const numberFormat = userProfile?.settings?.numberFormat || 'english';
  const weekStart = userProfile?.settings?.weekStart || 'saturday';

  const todayStr = getTodayDateString(timezone);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [currentYear, setCurrentYear] = useState<number>(() => parseInt(todayStr.split('-')[0]));
  const [currentMonth, setCurrentMonth] = useState<number>(() => parseInt(todayStr.split('-')[1]) - 1);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Midnight check: if viewing today, advance to new day at midnight
  const isWatchingTodayRef = useRef(true);
  useEffect(() => {
    isWatchingTodayRef.current = selectedDate === getTodayDateString(timezone);
  }, [selectedDate, timezone]);

  useEffect(() => {
    const checkMidnight = () => {
      const currentToday = getTodayDateString(timezone);
      if (isWatchingTodayRef.current && selectedDate !== currentToday) {
        setSelectedDate(currentToday);
        setCurrentYear(parseInt(currentToday.split('-')[0]));
        setCurrentMonth(parseInt(currentToday.split('-')[1]) - 1);
      }
    };

    const timer = setInterval(checkMidnight, 30000);
    const handleVis = () => { if (!document.hidden) checkMidnight(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [selectedDate, timezone]);

  // Fetch all transactions (in-memory sort)
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
        list.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
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

  // Days with transactions for dots
  const datesWithTransactions = useMemo(() => {
    return new Set(allTransactions.map(t => t.transactionDate));
  }, [allTransactions]);

  // Calendar month days calculation
  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    const date = new Date(currentYear, currentMonth, 1);
    
    // Day of week index (0 = Sun, 1 = Mon, ..., 6 = Sat)
    let firstDayOfWeek = date.getDay();
    // Normalize according to weekStart
    let startOffset = 0;
    if (weekStart === 'saturday') {
      // Sat = 0, Sun = 1, Mon = 2, Tue = 3, Wed = 4, Thu = 5, Fri = 6
      startOffset = (firstDayOfWeek + 1) % 7;
    } else if (weekStart === 'sunday') {
      startOffset = firstDayOfWeek;
    } else {
      // monday
      startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    }

    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({ dateStr, dayNum, isCurrentMonth: false });
    }

    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      const m = String(currentMonth + 1).padStart(2, '0');
      const d = String(i).padStart(2, '0');
      const dateStr = `${currentYear}-${m}-${d}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: true });
    }

    // Pad remaining to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth, weekStart]);

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
  const selectedDayTransactions = useMemo(() => {
    return allTransactions.filter(t => t.transactionDate === selectedDate);
  }, [allTransactions, selectedDate]);

  const selectedDayTotalPurchases = useMemo(() => {
    return selectedDayTransactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [selectedDayTransactions]);

  // Weekday headers ordered by weekStart
  const weekdayHeaders = useMemo(() => {
    if (weekStart === 'saturday') {
      return ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    } else if (weekStart === 'sunday') {
      return ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    } else {
      return ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
    }
  }, [weekStart]);

  return (
    <div className="space-y-6">
      {/* Top Header with Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-[#17233D] font-bold text-xs sm:text-sm transition-all shadow-xs group"
          >
            <ArrowRight className="w-4 h-4 text-[#315BEB] group-hover:-translate-x-0.5 transition-transform" />
            <span>الرجوع لليومية</span>
          </button>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#17233D] tracking-tight">سجل الأيام</h1>
        </div>

        <button
          onClick={() => {
            setSelectedDate(todayStr);
            setCurrentYear(parseInt(todayStr.split('-')[0]));
            setCurrentMonth(parseInt(todayStr.split('-')[1]) - 1);
          }}
          className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-[#17233D] hover:bg-slate-50 transition-all shadow-xs"
        >
          الانتقال لليوم الحالي
        </button>
      </div>

      {/* Main Grid: Calendar on Right / Selected Day Details on Left (Image 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Card (Takes 7 cols on desktop) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            {/* Month & Nav */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#17233D]">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <div className="flex items-center gap-1.5 bg-[#F7F9FC] p-1 rounded-2xl border border-slate-100">
                <button 
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl hover:bg-white text-slate-600 transition-colors"
                  title="الشهر التالي"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl hover:bg-white text-slate-600 transition-colors"
                  title="الشهر السابق"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-3 select-none">
              {weekdayHeaders.map((w, idx) => (
                <span key={idx}>{w}</span>
              ))}
            </div>

            {/* Calendar Numbers Grid */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {calendarDays.map((day, idx) => {
                const hasTx = datesWithTransactions.has(day.dateStr);
                const isSelected = day.dateStr === selectedDate;
                const isToday = day.dateStr === todayStr;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day.dateStr)}
                    className={`
                      h-12 rounded-2xl flex flex-col items-center justify-center relative transition-all text-sm font-semibold
                      ${!day.isCurrentMonth ? 'text-slate-300' : 'text-[#17233D]'}
                      ${isSelected 
                        ? 'bg-[#315BEB] text-white shadow-xs font-bold' 
                        : isToday 
                        ? 'bg-[#EEF2FF] text-[#315BEB] font-bold border border-blue-200' 
                        : 'hover:bg-slate-50'
                      }
                    `}
                  >
                    <span>{day.dayNum}</span>
                    {hasTx && (
                      <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${isSelected ? 'bg-white' : 'bg-[#315BEB]'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#315BEB]" />
              <span>أيام مسجل بها عمليات</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-200" />
              <span>اليوم الحالي</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details Panel (Takes 5 cols on desktop) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col min-h-[460px]">
          {/* Header */}
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[#17233D]">{formatDateArabic(selectedDate)}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDayTransactions.length} عملية مسجلة
              </p>
            </div>

            {selectedDayTransactions.length > 0 && (
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block font-medium">المشتريات:</span>
                <span className="font-mono font-bold text-sm text-[#315BEB]">
                  {formatCurrency(selectedDayTotalPurchases, numberFormat)}
                </span>
              </div>
            )}
          </div>

          {/* List of Transactions or Empty State */}
          <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
            {selectedDayTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-[#F7F9FC] flex items-center justify-center text-slate-400 mb-3">
                  <Moon className="w-6 h-6 text-slate-300" />
                </div>
                <div className="font-mono text-xs font-bold text-slate-500 mb-1">00:00</div>
                <p className="text-xs text-slate-400">لا توجد عمليات أخرى في هذا اليوم</p>
              </div>
            ) : (
              selectedDayTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => navigate(`/transaction/${tx.id}`)}
                  className="p-3.5 rounded-2xl bg-[#F7F9FC] hover:bg-[#EEF2FF]/60 border border-slate-100 hover:border-blue-100 cursor-pointer flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'purchase'
                        ? 'bg-[#EEF2FF] text-[#315BEB]'
                        : tx.type === 'transfer'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-[#FEF6E9] text-[#F4AE52]'
                    }`}>
                      {tx.type === 'purchase' && <ShoppingCart className="w-4 h-4" />}
                      {tx.type === 'transfer' && <ArrowLeftRight className="w-4 h-4" />}
                      {tx.type === 'custody' && <Wallet className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-[#17233D] group-hover:text-[#315BEB] transition-colors truncate">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                        <span>{formatTime12Hour(tx.transactionTime)}</span>
                        {tx.type === 'custody' && tx.personName && (
                          <span className="font-sans font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded-md">
                            المسؤول: {tx.personName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="font-mono font-bold text-xs text-[#17233D] shrink-0">
                    {formatCurrency(tx.amountHalalas, numberFormat)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Quick Add For this day */}
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 rounded-2xl bg-[#F7F9FC] hover:bg-[#EEF2FF] text-[#315BEB] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>عرض في صفحة اليومية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
