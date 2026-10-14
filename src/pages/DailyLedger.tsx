import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  Search, 
  ShoppingCart, 
  ArrowLeftRight, 
  Wallet, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Paperclip,
  FolderLock,
  User,
  Phone,
  Layers,
  Building2,
  CalendarDays,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { Transaction, Custody, CustodyMovement, PurchaseCategory, BankAccount } from '../types';
import { 
  subscribeToBankAccount, 
  deductBankPurchase, 
  revertBankPurchase 
} from '../services/bankStore';
import { 
  getTodayDateString, 
  getYesterdayDateString, 
  formatDateArabic, 
  formatTime12Hour,
  getSurroundingWeekDays 
} from '../utils/dateUtils';
import { formatCurrency, fromHalalas } from '../utils/currencyUtils';
import { TransactionModal } from '../components/TransactionModal';
import { ReceiptModal } from '../components/ReceiptModal';

export const DailyLedger: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { success, error: notifyError } = useNotification();
  
  const timezone = userProfile?.settings?.timezone || 'Asia/Riyadh';
  const numberFormat = userProfile?.settings?.numberFormat || 'english';

  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString(timezone));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [custodies, setCustodies] = useState<Custody[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // In-memory cache for instant switching between days without loading flicker
  const txCacheRef = useRef<Record<string, Transaction[]>>({});

  // Bank account subscription
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToBankAccount(currentUser.uid, (acc) => {
      setBankAccount(acc);
    });
    return () => unsub();
  }, [currentUser]);

  // Track if user was originally on today's date for midnight rollover
  const isWatchingTodayRef = useRef(true);
  useEffect(() => {
    isWatchingTodayRef.current = selectedDate === getTodayDateString(timezone);
  }, [selectedDate, timezone]);

  // Midnight checker & tab visibility listener
  useEffect(() => {
    const checkMidnight = () => {
      const currentToday = getTodayDateString(timezone);
      if (isWatchingTodayRef.current && selectedDate !== currentToday) {
        setSelectedDate(currentToday);
      }
    };

    const interval = setInterval(checkMidnight, 30000); // Check every 30 seconds
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkMidnight();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedDate, timezone]);

  // Fetch transactions and custodies for selectedDate
  useEffect(() => {
    if (!currentUser) return;

    // Check if we have cached data for this day to show immediately
    if (txCacheRef.current[selectedDate]) {
      setTransactions(txCacheRef.current[selectedDate]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const txQuery = query(
        collection(db, `users/${currentUser.uid}/transactions`),
        where('transactionDate', '==', selectedDate)
      );

      const unsubTx = onSnapshot(txQuery, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
        });
        // Sort descending by time
        list.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
        txCacheRef.current[selectedDate] = list;
        setTransactions(list);
        setLoading(false);
      }, (err) => {
        console.error('Transactions fetch error:', err);
        setLoading(false);
      });

      // Custodies listener
      const custodyQuery = query(
        collection(db, `users/${currentUser.uid}/custodies`)
      );

      const unsubCustody = onSnapshot(custodyQuery, (snapshot) => {
        const list: Custody[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Custody);
        });
        setCustodies(list);
      }, (err) => {
        console.error('Custodies fetch error:', err);
      });

      return () => {
        unsubTx();
        unsubCustody();
      };
    } catch (err) {
      console.error('Firestore subscription error:', err);
      setLoading(false);
    }
  }, [currentUser, selectedDate]);

  // Calculations for selected date
  const totalPurchases = useMemo(() => {
    return transactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [transactions]);

  const totalTransfers = useMemo(() => {
    return transactions
      .filter(t => t.type === 'transfer')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [transactions]);

  const totalCustodiesReceived = useMemo(() => {
    return transactions
      .filter(t => t.type === 'custody')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [transactions]);

  // Open Custodies total remaining (Independent balance card)
  const openCustodies = useMemo(() => custodies.filter(c => c.status === 'open'), [custodies]);
  const totalOpenCustodiesRemaining = useMemo(() => {
    return openCustodies.reduce((sum, c) => sum + c.remainingAmountHalalas, 0);
  }, [openCustodies]);

  // Date strip days
  const stripDays = useMemo(() => {
    return getSurroundingWeekDays(selectedDate, 7);
  }, [selectedDate]);

  // Stepper functions
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d - 1);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + 1);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);
  };

  // Save Transaction (Add or Edit)
  const handleSaveTransaction = async (
    data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, 
    editId?: string
  ) => {
    if (!currentUser) return;
    const now = Date.now();

    try {
      if (editId) {
        // Update transaction
        const docRef = doc(db, `users/${currentUser.uid}/transactions`, editId);
        await updateDoc(docRef, {
          ...data,
          updatedAt: now,
        });
        success('تم تحديث العملية بنجاح');
      } else {
        // Create transaction
        const newTxRef = collection(db, `users/${currentUser.uid}/transactions`);
        const docRef = await addDoc(newTxRef, {
          ...data,
          userId: currentUser.uid,
          createdAt: now,
          updatedAt: now,
        });

        // If custody received, create new custody record
        if (data.type === 'custody') {
          const custodyRef = collection(db, `users/${currentUser.uid}/custodies`);
          const createdCustody = await addDoc(custodyRef, {
            userId: currentUser.uid,
            name: data.description,
            personName: data.personName || data.senderName || '',
            phoneNumber: data.phoneNumber || '',
            sourceEntity: data.senderName || 'الإدارة المالية',
            initialAmountHalalas: data.amountHalalas,
            remainingAmountHalalas: data.amountHalalas,
            status: 'open',
            notes: data.notes || '',
            createdAt: now,
          });

          // Create custody initial movement
          const movRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
          await addDoc(movRef, {
            userId: currentUser.uid,
            custodyId: createdCustody.id,
            type: 'receive',
            amountHalalas: data.amountHalalas,
            description: 'استلام عهدة أولي',
            date: data.transactionDate,
            createdAt: now,
          });
        }

        // If purchase from custody, deduct from remaining balance
        if (data.type === 'purchase' && data.paymentSource === 'custody' && data.custodyId) {
          const targetCustody = custodies.find(c => c.id === data.custodyId);
          if (targetCustody) {
            const custodyDocRef = doc(db, `users/${currentUser.uid}/custodies`, data.custodyId);
            const newRemaining = Math.max(0, targetCustody.remainingAmountHalalas - data.amountHalalas);
            await updateDoc(custodyDocRef, {
              remainingAmountHalalas: newRemaining,
            });

            // Add movement record
            const movRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
            await addDoc(movRef, {
              userId: currentUser.uid,
              custodyId: data.custodyId,
              type: 'purchase',
              amountHalalas: data.amountHalalas,
              description: data.description,
              transactionId: docRef.id,
              date: data.transactionDate,
              createdAt: now,
            });
          }
        }

        // If purchase from bank (default for purchases), automatically deduct from main bank balance!
        if (data.type === 'purchase' && (data.paymentSource === 'bank' || !data.paymentSource)) {
          await deductBankPurchase(currentUser.uid, {
            amountHalalas: data.amountHalalas,
            description: data.description,
            transactionDate: data.transactionDate,
            transactionTime: data.transactionTime,
            relatedTransactionId: docRef.id,
          });
        }

        success('تمت إضافة العملية بنجاح');
      }
    } catch (err: any) {
      console.error('Save transaction error:', err);
      notifyError(err.message || 'فشل حفظ العملية');
      throw err;
    }
  };

  // Delete transaction with custody and bank balance adjustment
  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!currentUser) return;
    if (!window.confirm(`هل أنت متأكد من حذف العملية "${tx.description}"؟`)) return;

    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/transactions`, tx.id));

      // Restore custody remaining if it was paid from custody
      if (tx.type === 'purchase' && tx.paymentSource === 'custody' && tx.custodyId) {
        const targetCustody = custodies.find(c => c.id === tx.custodyId);
        if (targetCustody) {
          const custodyDocRef = doc(db, `users/${currentUser.uid}/custodies`, tx.custodyId);
          await updateDoc(custodyDocRef, {
            remainingAmountHalalas: targetCustody.remainingAmountHalalas + tx.amountHalalas,
          });
        }
      }

      // Restore bank balance if it was paid from bank
      if (tx.type === 'purchase' && (tx.paymentSource === 'bank' || !tx.paymentSource)) {
        await revertBankPurchase(currentUser.uid, tx.amountHalalas, tx.id);
      }

      success('تم حذف العملية بنجاح');
    } catch (err: any) {
      console.error('Delete transaction error:', err);
      notifyError('فشل حذف العملية');
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.senderName && t.senderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.recipientName && t.recipientName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter]);

  const todayStr = getTodayDateString(timezone);
  const yesterdayStr = getYesterdayDateString(timezone);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#17233D] tracking-tight">اليومية</h1>
        </div>

        {/* Primary "+ إضافة عملية" Button */}
        <div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white font-semibold text-sm shadow-sm flex items-center gap-2 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة عملية</span>
          </motion.button>
        </div>
      </div>

      {/* Week Day Strip with "عرض المزيد" at slot 7 */}
      <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center justify-between gap-1.5 min-w-[480px]">
          {stripDays.slice(0, 6).map((d) => {
            const isSelected = d.dateStr === selectedDate;
            const isToday = d.dateStr === todayStr;

            return (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDate(d.dateStr)}
                className={`flex-1 py-2 px-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isSelected 
                    ? 'bg-[#315BEB] text-white shadow-xs font-bold' 
                    : isToday 
                    ? 'bg-[#EEF2FF] text-[#315BEB] font-bold border border-blue-200' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-sm font-mono">{d.dayNum}</span>
                <span className={`text-[11px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {d.dayName}
                </span>
              </button>
            );
          })}

          {/* Button: "عرض المزيد" in place of the 7th slot */}
          <button
            type="button"
            onClick={() => navigate('/days')}
            className="flex-1 py-2 px-3 rounded-xl flex flex-col items-center justify-center transition-all bg-[#F7F9FC] hover:bg-[#EEF2FF] text-slate-600 hover:text-[#315BEB] border border-slate-200/80 group"
            title="الانتقال لسجل الأيام"
          >
            <CalendarDays className="w-4 h-4 text-[#315BEB] group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold mt-1 text-[#315BEB] whitespace-nowrap">
              عرض المزيد
            </span>
          </button>
        </div>
      </div>

      {/* Single Collapsible "التفاصيل" Rectangle Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
        {/* Clickable Header: ONLY "التفاصيل" and toggle icon */}
        <button
          type="button"
          onClick={() => setIsDetailsExpanded(prev => !prev)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-right hover:bg-slate-50/80 transition-colors focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#17233D]">التفاصيل</h3>
          </div>

          <div className={`p-1.5 rounded-xl bg-slate-100 text-slate-600 transition-transform duration-200 ${isDetailsExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>

        {/* Expandable Content */}
        <AnimatePresence>
          {isDetailsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-slate-100"
            >
              <div className="p-4 sm:p-6 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1: المشتريات */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">المشتريات</p>
                    <p className="text-xl font-bold text-[#17233D] font-mono">
                      {formatCurrency(totalPurchases, numberFormat)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                </div>

                {/* 2: التحويلات */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">التحويلات</p>
                    <p className="text-xl font-bold text-[#17233D] font-mono">
                      {formatCurrency(totalTransfers, numberFormat)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                </div>

                {/* 3: العهد المستلمة */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">العهد المستلمة اليوم</p>
                    <p className="text-xl font-bold text-[#17233D] font-mono">
                      {formatCurrency(totalCustodiesReceived, numberFormat)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#FEF6E9] text-[#F4AE52] flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>

                {/* 4: المتبقي في العهد المفتوحة */}
                <div className="bg-white p-4 rounded-xl border border-amber-200/70 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1">المتبقي في العُهد</p>
                    <p className="text-xl font-bold text-[#17233D] font-mono">
                      {formatCurrency(totalOpenCustodiesRemaining, numberFormat)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#FEF6E9] text-[#F4AE52] flex items-center justify-center">
                    <FolderLock className="w-5 h-5" />
                  </div>
                </div>

                {/* 5: رصيد حساب البنك الرئيسي */}
                <div 
                  onClick={() => navigate('/bank')}
                  className="bg-white p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/40 shadow-xs flex items-center justify-between cursor-pointer hover:border-[#315BEB] transition-all group"
                  title="الانتقال إلى كشف حساب البنك الرئيسي"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#315BEB] mb-1">
                      <span>رصيد البنك الرئيسي</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-xl font-bold text-[#17233D] font-mono group-hover:text-[#315BEB] transition-colors">
                      {formatCurrency(bankAccount?.currentBalanceHalalas ?? 0, numberFormat)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالوصف أو الطرف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-[#315BEB] focus:ring-1 focus:ring-[#315BEB] bg-slate-50/50"
          />
        </div>

        {/* Filter Trigger / Native Device Selector */}
        <div className="relative shrink-0">
          <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#EEF2FF] border border-blue-200 text-[#315BEB] font-bold text-xs cursor-pointer hover:bg-blue-100/70 transition-colors shadow-xs select-none">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">
              {typeFilter === 'all' ? 'جميع العمليات' : typeFilter === 'purchase' ? 'مشتريات' : typeFilter === 'transfer' ? 'تحويلات' : 'عُهد'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base"
              title="تصفية نوع العمليات"
            >
              <option value="all">جميع العمليات</option>
              <option value="purchase">مشتريات</option>
              <option value="transfer">تحويلات</option>
              <option value="custody">عُهد</option>
            </select>
          </label>
        </div>
      </div>

      {/* Transactions List / Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#315BEB] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">جاري تحميل العمليات...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#17233D] mb-1">لا توجد عمليات مسجلة في هذا اليوم</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              ابدأ بتسجيل أول عملية مالية لهذا اليوم لمتابعة حساباتك ومصروفاتك بكل دقة.
            </p>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setIsModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-2xl bg-[#315BEB] text-white font-semibold text-sm hover:bg-[#2548cb] transition-colors shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول عملية</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 px-6 py-3.5 bg-slate-50/70 text-xs font-bold text-slate-500">
              <div className="col-span-2">الوقت</div>
              <div className="col-span-5">الوصف</div>
              <div className="col-span-2 text-center">النوع</div>
              <div className="col-span-2 text-left">المبلغ</div>
              <div className="col-span-1 text-center">خيارات</div>
            </div>

            {/* Rows / Mobile Cards */}
            <AnimatePresence>
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 md:px-6 md:py-4 hover:bg-slate-50/80 transition-colors flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-0 cursor-pointer group"
                  onClick={() => navigate(`/transaction/${tx.id}`)}
                >
                  {/* Time */}
                  <div className="col-span-2 flex items-center gap-2 text-xs font-mono text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatTime12Hour(tx.transactionTime)}</span>
                  </div>

                  {/* Description & Receipt Indicator */}
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-[#17233D] group-hover:text-[#315BEB] transition-colors truncate">
                      {tx.description}
                    </span>
                    {tx.receiptUrl && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingReceiptUrl(tx.receiptUrl!);
                        }}
                        className="p-1 text-slate-400 hover:text-[#315BEB] rounded-lg transition-colors shrink-0"
                        title="عرض الإيصال المرفق"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {tx.paymentSource === 'custody' && (
                      <span className="text-[10px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full shrink-0">
                        من عهدة
                      </span>
                    )}
                    {tx.type === 'custody' && tx.personName && (
                      <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-200/60 font-medium px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-[#F4AE52]" />
                        <span>{tx.personName}</span>
                      </span>
                    )}
                  </div>

                  {/* Type Badge */}
                  <div className="col-span-2 flex justify-start md:justify-center">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1 ${
                      tx.type === 'purchase'
                        ? 'bg-[#EEF2FF] text-[#315BEB]'
                        : tx.type === 'transfer'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-[#FEF6E9] text-[#D99A32]'
                    }`}>
                      {tx.type === 'purchase' && 'مشتريات'}
                      {tx.type === 'transfer' && 'تحويل'}
                      {tx.type === 'custody' && 'عهدة'}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2 text-right md:text-left">
                    <span className="font-bold text-base font-mono text-[#17233D] group-hover:text-[#315BEB] transition-colors">
                      {formatCurrency(tx.amountHalalas, numberFormat)}
                    </span>
                  </div>

                  {/* Options Menu */}
                  <div className="col-span-1 flex justify-end md:justify-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === tx.id ? null : tx.id)}
                      className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === tx.id && (
                      <div className="absolute left-0 top-10 w-36 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-20 animate-fadeIn text-xs font-semibold">
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            setEditingTransaction(tx);
                            setIsModalOpen(true);
                          }}
                          className="w-full px-3 py-2 text-right hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#315BEB]" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            handleDeleteTransaction(tx);
                          }}
                          className="w-full px-3 py-2 text-right hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        editTransaction={editingTransaction}
        openCustodies={openCustodies}
        timezone={timezone}
      />

      {/* Receipt Modal */}
      {viewingReceiptUrl && (
        <ReceiptModal
          receiptUrl={viewingReceiptUrl}
          onClose={() => setViewingReceiptUrl(null)}
        />
      )}
    </div>
  );
};
