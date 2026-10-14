import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  SlidersHorizontal,
  ChevronDown,
  X,
  Briefcase,
  Banknote,
  Receipt,
  TrendingUp,
  FolderLock,
  Landmark,
  Sparkles,
  Coins,
  FileText,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { BankAccount, BankTransaction } from '../types';
import { 
  subscribeToBankAccount, 
  subscribeToBankTransactions, 
  setBankBalance, 
  addBankDeposit, 
  exportBankToExcel 
} from '../services/bankStore';
import { fromHalalas, toHalalas, parseAmountInput } from '../utils/currencyUtils';
import { formatTime12Hour, getTodayDateString } from '../utils/dateUtils';

const COMMON_DEPOSIT_SOURCES = [
  { id: 'دفعة مشروع', label: 'دفعة مشروع', icon: Briefcase },
  { id: 'إيداع نقدي', label: 'إيداع نقدي', icon: Banknote },
  { id: 'تحويل من عميل', label: 'تحويل من عميل', icon: ArrowDownLeft },
  { id: 'دفعة مستحقات', label: 'دفعة مستحقات', icon: Receipt },
  { id: 'أرباح واستثمارات', label: 'أرباح واستثمارات', icon: TrendingUp },
  { id: 'استرداد عهدة', label: 'استرداد عهدة', icon: FolderLock },
  { id: 'تمويل بنكي', label: 'تمويل بنكي', icon: Landmark },
  { id: 'أخرى', label: 'أخرى', icon: Sparkles },
];

export const BankAccountPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { success, error: notifyError } = useNotification();
  const timezone = userProfile?.settings?.timezone || 'Asia/Riyadh';

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isSetBalanceModalOpen, setIsSetBalanceModalOpen] = useState(false);

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSource, setDepositSource] = useState(COMMON_DEPOSIT_SOURCES[0].id);
  const [customSource, setCustomSource] = useState('');
  const [depositDescription, setDepositDescription] = useState('');
  const [depositDate, setDepositDate] = useState(() => getTodayDateString(timezone));
  const [depositTime, setDepositTime] = useState(() => 
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
  const [depositNotes, setDepositNotes] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // Set Balance form state
  const [initialBalanceInput, setInitialBalanceInput] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);

  // Clean number formatter without currency suffix
  const formatNumberClean = (halalas: number) => {
    const amount = fromHalalas(halalas);
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Realtime subscriptions
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    const unsubAccount = subscribeToBankAccount(
      currentUser.uid,
      (acc) => {
        setAccount(acc);
        setLoading(false);
      },
      (err) => {
        console.error('Bank account fetch error:', err);
        setLoading(false);
      }
    );

    const unsubTx = subscribeToBankTransactions(
      currentUser.uid,
      (txs) => {
        setTransactions(txs);
      },
      (err) => {
        console.error('Bank transactions fetch error:', err);
      }
    );

    return () => {
      unsubAccount();
      unsubTx();
    };
  }, [currentUser]);

  // Calculations
  const totalDeposits = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [transactions]);

  const totalWithdrawals = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [transactions]);

  const currentBalance = account?.currentBalanceHalalas ?? 0;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = filterType === 'all' || t.type === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.description.toLowerCase().includes(q) ||
        (t.source && t.source.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q));

      return matchType && matchSearch;
    });
  }, [transactions, filterType, searchQuery]);

  // Handle Add Deposit
  const handleAddDeposit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || depositSubmitting) return;

    const amountDecimal = parseAmountInput(depositAmount);
    if (amountDecimal <= 0) {
      notifyError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    const finalSource = depositSource === 'أخرى' && customSource.trim() 
      ? customSource.trim() 
      : depositSource;

    const finalDescription = depositDescription.trim() || finalSource || 'إيداع بنكي';

    setDepositSubmitting(true);
    try {
      await addBankDeposit(currentUser.uid, {
        amountHalalas: toHalalas(amountDecimal),
        source: finalSource,
        description: finalDescription,
        transactionDate: depositDate || getTodayDateString(timezone),
        transactionTime: depositTime || '12:00',
        notes: depositNotes.trim(),
      });

      success('تم إضافة المبلغ وتحديث رصيد البنك بنجاح');
      setIsDepositModalOpen(false);
      // Reset form
      setDepositAmount('');
      setDepositDescription('');
      setCustomSource('');
      setDepositNotes('');
    } catch (err: any) {
      console.error('Error adding bank deposit:', err);
      notifyError(err.message || 'فشل إضافة العملية لحساب البنك');
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Handle Set/Adjust Balance
  const handleSetBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || balanceSubmitting) return;

    const amountDecimal = parseAmountInput(initialBalanceInput);
    if (amountDecimal < 0) {
      notifyError('يرجى إدخال مبلغ صحيح للرصيد');
      return;
    }

    setBalanceSubmitting(true);
    try {
      await setBankBalance(
        currentUser.uid,
        toHalalas(amountDecimal),
        'حساب البنك الرئيسي',
        balanceReason.trim() || undefined
      );

      success('تم حفظ وتحديث رصيد البنك الرئيسي بنجاح');
      setIsSetBalanceModalOpen(false);
      setInitialBalanceInput('');
      setBalanceReason('');
    } catch (err: any) {
      console.error('Error setting bank balance:', err);
      notifyError(err.message || 'فشل تحديث رصيد البنك');
    } finally {
      setBalanceSubmitting(false);
    }
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      exportBankToExcel(account, transactions, userProfile?.displayName || 'المستخدم');
      success('تم تصدير كشف حساب البنك بصيغة Excel بنجاح');
    } catch (err: any) {
      console.error('Excel export error:', err);
      notifyError('فشل تصدير ملف الإكسل');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#17233D] tracking-tight flex items-center gap-2.5">
            <Building2 className="w-8 h-8 text-[#315BEB]" />
            <span>حساب البنك الرئيسي</span>
          </h1>
        </div>

        {/* Action Button: Icon only */}
        <div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsDepositModalOpen(true)}
            className="w-11 h-11 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white shadow-xs flex items-center justify-center transition-all"
            title="إضافة دفعة أو إيداع"
            aria-label="إضافة دفعة"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        </div>
      </div>

      {/* Hero Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Current Balance Card (Clean white card without dark/gradient background) */}
        <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">الرصيد الفعلي الحالي</span>
              <button
                onClick={() => {
                  setInitialBalanceInput(fromHalalas(currentBalance).toString());
                  setIsSetBalanceModalOpen(true);
                }}
                className="text-[11px] font-semibold text-[#315BEB] hover:text-[#2548cb] bg-[#EEF2FF] hover:bg-blue-100/70 px-2.5 py-1 rounded-xl transition-all"
              >
                تعديل الرصيد الأساسي
              </button>
            </div>
            <p className="text-3xl lg:text-4xl font-extrabold font-mono tracking-tight text-[#17233D] mb-2">
              {formatNumberClean(currentBalance)}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>حساب البنك الرئيسي</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              مربوط بالخصم التلقائي
            </span>
          </div>
        </div>

        {/* Total Deposits Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
              <span>إجمالي الإيداعات والدفعات</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-emerald-600 font-mono">
              +{formatNumberClean(totalDeposits)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              جميع المبالغ المودعة والمدفوعات الواردة
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-7 h-7" />
          </div>
        </div>

        {/* Total Withdrawals Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
              <span>إجمالي خصومات المشتريات</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-rose-600 font-mono">
              -{formatNumberClean(totalWithdrawals)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              خصم تلقائي لكل المشتريات المدفوعة من البنك
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث في البيان أو المصدر..."
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
              {filterType === 'all' ? 'جميع حركات البنك' : filterType === 'deposit' ? 'الإيداعات والدفعات' : 'خصومات المشتريات'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base"
              title="تصفية حركات البنك"
            >
              <option value="all">جميع حركات البنك</option>
              <option value="deposit">الإيداعات والدفعات فقط</option>
              <option value="withdrawal">خصومات المشتريات</option>
            </select>
          </label>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#17233D] mb-1">لا توجد حركات مسجلة في حساب البنك</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              قم بتحديد الرصيد الأساسي أو تسجيل أول دفعة/إيداع لمتابعة الرصيد وخصم المشتريات تلقائيًا.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSetBalanceModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 text-[#17233D] font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                تحديد رصيد البنك الأساسي
              </button>
              <button
                onClick={() => setIsDepositModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-[#315BEB] text-white font-semibold text-xs hover:bg-[#2548cb] transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة دفعة للبنك</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Desktop Header */}
            <div className="hidden md:grid grid-cols-12 px-6 py-3.5 bg-slate-50/70 text-xs font-bold text-slate-500">
              <div className="col-span-2">التاريخ والوقت</div>
              <div className="col-span-4">البيان / الوصف</div>
              <div className="col-span-3">مصدر المبلغ (من وين جا)</div>
              <div className="col-span-3 text-left">المبلغ والرصيد بعده</div>
            </div>

            {/* Transaction Rows */}
            {filteredTransactions.map((tx) => {
              const isDeposit = tx.type === 'deposit';
              const isWithdrawal = tx.type === 'withdrawal';
              const isAdjustment = tx.type === 'adjustment';

              return (
                <div
                  key={tx.id}
                  className="p-4 md:px-6 md:py-4 hover:bg-slate-50/70 transition-colors flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-0"
                >
                  {/* Date & Time */}
                  <div className="col-span-2 flex items-center gap-2 text-xs font-mono text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{tx.transactionDate}</span>
                    <span className="text-slate-300">•</span>
                    <span>{formatTime12Hour(tx.transactionTime)}</span>
                  </div>

                  {/* Description & Type Badge */}
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-[#17233D] truncate">
                      {tx.description}
                    </span>
                    {isWithdrawal && (
                      <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-100 font-semibold px-2 py-0.5 rounded-md shrink-0">
                        خصم مشتريات
                      </span>
                    )}
                    {isDeposit && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold px-2 py-0.5 rounded-md shrink-0">
                        إيداع / دفعة
                      </span>
                    )}
                    {isAdjustment && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-semibold px-2 py-0.5 rounded-md shrink-0">
                        تعيين رصيد
                      </span>
                    )}
                  </div>

                  {/* Source (من وين جا) */}
                  <div className="col-span-3 flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-medium">المصدر:</span>
                    <span className="font-semibold text-[#17233D] bg-slate-100 px-2.5 py-1 rounded-lg">
                      {tx.source || 'غير محدد'}
                    </span>
                  </div>

                  {/* Amount & Running Balance */}
                  <div className="col-span-3 text-left">
                    <div className="flex flex-col items-end">
                      <span className={`text-base font-bold font-mono ${
                        isDeposit 
                          ? 'text-emerald-600' 
                          : isWithdrawal 
                          ? 'text-rose-600' 
                          : 'text-[#315BEB]'
                      }`}>
                        {isDeposit ? '+' : isWithdrawal ? '-' : ''}
                        {formatNumberClean(tx.amountHalalas)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        الرصيد بعد العملية: {formatNumberClean(tx.balanceAfterHalalas || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Export Excel Report Action */}
      <div className="flex items-center justify-end pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExportExcel}
          className="px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[#17233D] font-bold text-xs sm:text-sm shadow-xs flex items-center gap-2.5 transition-all"
          title="تصدير كشف حساب البنك كاملاً بصيغة إكسل"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span>تصدير تقرير إكسل لحساب البنك</span>
        </motion.button>
      </div>

      {/* Modal: Add Bank Deposit */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#17233D]">إضافة دفعة أو إيداع للبنك</h3>
                    <p className="text-xs text-slate-400">توثيق المبلغ ومصدر الدفعة في رصيد البنك</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddDeposit} className="space-y-4">
                {/* Amount */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                    <Coins className="w-3.5 h-3.5 text-[#315BEB]" />
                    <span>المبلغ *</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 font-mono text-xl font-bold text-[#17233D] focus:outline-none focus:border-[#315BEB] focus:ring-1 focus:ring-[#315BEB]"
                    dir="ltr"
                  />
                </div>

                {/* Source Selection (من وين جا المبلغ) with distinct enhanced icons */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                    <Landmark className="w-3.5 h-3.5 text-[#315BEB]" />
                    <span>المبلغ من وين جا؟ (المصدر / جهة الدفعة) *</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {COMMON_DEPOSIT_SOURCES.map((src) => {
                      const Icon = src.icon;
                      const isSelected = depositSource === src.id;
                      return (
                        <button
                          type="button"
                          key={src.id}
                          onClick={() => setDepositSource(src.id)}
                          className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all border text-right ${
                            isSelected
                              ? 'bg-[#EEF2FF] border-[#315BEB] text-[#315BEB] shadow-xs'
                              : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#315BEB] text-white' : 'bg-white text-slate-500 border border-slate-200'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="truncate">{src.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {depositSource === 'أخرى' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="حدّد مصدر المبلغ يدويًا..."
                        value={customSource}
                        onChange={(e) => setCustomSource(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#315BEB]"
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#315BEB]" />
                    <span>البيان / تفاصيل الدفعة (اختياري)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: دفعة المرحلة الأولى من مشروع الفيلا"
                    value={depositDescription}
                    onChange={(e) => setDepositDescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#315BEB]"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>التاريخ</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={depositDate}
                      onChange={(e) => setDepositDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#315BEB]"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>الوقت</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={depositTime}
                      onChange={(e) => setDepositTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#315BEB]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>ملاحظات إضافية (اختياري)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="أي ملاحظات أو أرقام حوالات..."
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#315BEB]"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDepositModalOpen(false)}
                    className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddDeposit()}
                    disabled={depositSubmitting}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {depositSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <span>تأكيد إضافة الدفعة</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Set / Adjust Initial Bank Balance */}
      <AnimatePresence>
        {isSetBalanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#315BEB] flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#17233D]">تحديد رصيد البنك الأساسي</h3>
                    <p className="text-xs text-slate-400">حدد الرصيد المتوفر في حسابك البنكي حاليًا</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSetBalanceModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSetBalance} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    الرصيد الفعلي الحالي في البنك *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 font-mono text-2xl font-bold text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    عند تسجيل أي عملية شراء قادمة، سيتم الخصم تلقائيًا من هذا الرصيد.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    سبب التعديل أو ملاحظة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مطابقة الرصيد الفعلي مع تطبيق البنك"
                    value={balanceReason}
                    onChange={(e) => setBalanceReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#315BEB]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSetBalanceModalOpen(false)}
                    className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={balanceSubmitting}
                    className="flex-1 py-3 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white font-bold text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {balanceSubmitting ? 'جاري الحفظ...' : 'حفظ الرصيد'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
