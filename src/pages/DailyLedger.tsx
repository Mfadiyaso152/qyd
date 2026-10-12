import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  Search, 
  ShoppingCart, 
  ArrowLeftRight, 
  ShieldCheck, 
  FileText, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Eye, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, isConfigured } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Transaction, Custody, CustodyMovement } from '../types';
import { getTodayDateString, getYesterdayDateString, formatDateArabic } from '../utils/dateUtils';
import { formatCurrency, fromHalalas } from '../utils/currencyUtils';
import { TransactionModal } from '../components/TransactionModal';
import { ReceiptModal } from '../components/ReceiptModal';


export const DailyLedger: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const timezone = 'Asia/Riyadh';
  const numberFormat = userProfile?.settings.numberFormat || 'arabic';

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString(timezone));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [custodies, setCustodies] = useState<Custody[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Midnight check & auto-refresh for current day view
  useEffect(() => {
    const timer = setInterval(() => {
      const currentToday = getTodayDateString(timezone);
      if (selectedDate === getTodayDateString(timezone) && selectedDate !== currentToday) {
        setSelectedDate(currentToday);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [selectedDate, timezone]);

  // Fetch transactions and custodies from Firestore or Dev Store
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);



    try {
      // Transactions query for selectedDate
      const txQuery = query(
        collection(db, `users/${currentUser.uid}/transactions`),
        where('transactionDate', '==', selectedDate)
      );

      const unsubTx = onSnapshot(txQuery, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
        });
        list.sort((a, b) => b.occurredAt - a.occurredAt);
        setTransactions(list);
        setLoading(false);
      }, (err) => {
        console.error('Transactions fetch error:', err);
        setLoading(false);
      });

      // Custodies query
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

  // Calculate totals for today
  const totalPurchases = transactions
    .filter(t => t.type === 'purchase')
    .reduce((sum, t) => sum + t.amountHalalas, 0);

  const totalTransfers = transactions
    .filter(t => t.type === 'transfer')
    .reduce((sum, t) => sum + t.amountHalalas, 0);

  const totalCustodiesReceived = transactions
    .filter(t => t.type === 'custody')
    .reduce((sum, t) => sum + t.amountHalalas, 0);

  const openCustodies = custodies.filter(c => c.status === 'open');
  const totalOpenCustodyRemaining = openCustodies.reduce((sum, c) => sum + c.remainingAmountHalalas, 0);

  // Save transaction handler (Create or Update)
  const handleSaveTransaction = async (data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, editId?: string) => {
    if (!currentUser) return;



    try {
      const now = Date.now();
      if (editId) {
        // Update existing transaction
        const docRef = doc(db, `users/${currentUser.uid}/transactions`, editId);
        await updateDoc(docRef, {
          ...data,
          updatedAt: now,
        });

        // If it was a custody creation, update linked custody if needed
      } else {
        // Create new transaction
        const newTxRef = collection(db, `users/${currentUser.uid}/transactions`);
        const docRef = await addDoc(newTxRef, {
          ...data,
          userId: currentUser.uid,
          createdAt: now,
          updatedAt: now,
        });

        // If type is custody, also create a custody document
        if (data.type === 'custody') {
          const custodyRef = collection(db, `users/${currentUser.uid}/custodies`);
          await addDoc(custodyRef, {
            userId: currentUser.uid,
            name: data.description,
            sourceEntity: data.senderName || 'غير محدد',
            initialAmountHalalas: data.amountHalalas,
            remainingAmountHalalas: data.amountHalalas,
            status: 'open',
            createdAt: now,
          });
        }

        // If type is purchase from custody, deduct from custody remaining balance
        if (data.type === 'purchase' && data.paymentSource === 'custody' && data.custodyId) {
          const custodyDocRef = doc(db, `users/${currentUser.uid}/custodies`, data.custodyId);
          const targetCustody = custodies.find(c => c.id === data.custodyId);
          if (targetCustody) {
            const newRemaining = targetCustody.remainingAmountHalalas - data.amountHalalas;
            await updateDoc(custodyDocRef, {
              remainingAmountHalalas: Math.max(0, newRemaining)
            });

            // Also record custody movement
            const movementRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
            await addDoc(movementRef, {
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
      }
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      throw new Error(err.message || 'فشل حفظ العملية في قاعدة البيانات');
    }
  };

  // Delete transaction
  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!currentUser) return;
    if (!window.confirm(`هل أنت متأكد من حذف العملية "${tx.description}"؟`)) return;



    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/transactions`, tx.id));

      // If it was a purchase from custody, restore custody balance
      if (tx.type === 'purchase' && tx.paymentSource === 'custody' && tx.custodyId) {
        const targetCustody = custodies.find(c => c.id === tx.custodyId);
        if (targetCustody) {
          const custodyDocRef = doc(db, `users/${currentUser.uid}/custodies`, tx.custodyId);
          await updateDoc(custodyDocRef, {
            remainingAmountHalalas: targetCustody.remainingAmountHalalas + tx.amountHalalas
          });
        }
      }
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert('فشل حذف العملية');
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.senderName && t.senderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (t.recipientName && t.recipientName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header & Date controls */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
      >
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Calendar className="w-4 h-4 text-[#367C73]" />
            <span>{formatDateArabic(selectedDate)}</span>
          </div>
          <h2 className="text-2xl font-bold text-[#142B36]">اليومية</h2>
        </div>

        {/* Date Quick Controls & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedDate(getTodayDateString(timezone))}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedDate === getTodayDateString(timezone)
                ? 'bg-[#367C73] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            اليوم
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedDate(getYesterdayDateString(timezone))}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              selectedDate === getYesterdayDateString(timezone)
                ? 'bg-[#367C73] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            أمس
          </motion.button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-medium focus:ring-2 focus:ring-[#367C73]"
          />

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
            className="px-5 py-2.5 rounded-xl bg-[#367C73] text-white font-semibold hover:bg-[#2b635b] transition-all shadow-md flex items-center gap-2 text-sm ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عملية</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Purchases Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">المشتريات</p>
            <p className="text-xl font-bold text-[#142B36] font-mono">{formatCurrency(totalPurchases, numberFormat)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#367C73] flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Transfers Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">التحويلات</p>
            <p className="text-xl font-bold text-[#142B36] font-mono">{formatCurrency(totalTransfers, numberFormat)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Received Custodies Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">العهد المستلمة اليوم</p>
            <p className="text-xl font-bold text-[#142B36] font-mono">{formatCurrency(totalCustodiesReceived, numberFormat)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#D99A32] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      <div className="mt-4">
        {/* Full-width Summary / Add Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
          className="w-full bg-white p-6 rounded-3xl shadow-sm border border-amber-200 bg-gradient-to-br from-white to-amber-50/30 flex items-center justify-between"
        >
          <div className="text-right">
            <p className="text-xs font-bold text-amber-800 mb-1">المتبقي في العُهد المفتوحة</p>
            <p className="text-2xl font-bold text-[#D99A32] font-mono">{formatCurrency(totalOpenCustodyRemaining, numberFormat)}</p>
            <span className="text-[10px] text-slate-500 block mt-0.5">اضغط لإضافة عملية جديدة</span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#142B36] to-[#367C73] text-white flex items-center justify-center shadow-lg">
            <Plus className="w-8 h-8" />
          </div>
        </motion.button>
      </div>


      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            placeholder="بحث في الوصف أو الأطراف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#367C73] focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'all' ? 'bg-[#142B36] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            جميع العمليات
          </button>
          <button
            onClick={() => setTypeFilter('purchase')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'purchase' ? 'bg-[#367C73] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            مشتريات
          </button>
          <button
            onClick={() => setTypeFilter('transfer')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'transfer' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            تحويلات
          </button>
          <button
            onClick={() => setTypeFilter('custody')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'custody' ? 'bg-[#D99A32] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            عُهد
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="font-bold text-base text-[#142B36] flex items-center gap-2">
            <span>عمليات اليوم</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {filteredTransactions.length}
            </span>
          </h3>
          <span className="text-xs text-slate-400">انقر على أي عملية لعرض تفاصيلها الكاملة</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-8 h-8 border-3 border-[#367C73] border-t-transparent rounded-full"
            />
            <span className="text-sm">جاري تحميل العمليات...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">لا توجد عمليات مسجلة في هذا اليوم</h3>
            <p className="text-sm text-slate-500 mb-6">ابدأ بتسجيل أول عملية مالية لهذا اليوم بكل سهولة.</p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
              className="px-5 py-2.5 rounded-xl bg-[#367C73] text-white font-semibold hover:bg-[#2b635b] transition-all shadow-md flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول عملية</span>
            </motion.button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {filteredTransactions.map((tx, idx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  whileHover={{ scale: 1.008, x: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/transaction/${tx.id}`)}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50/80 hover:border-[#367C73]/40 cursor-pointer transition-all shadow-xs flex items-center justify-between gap-3 group"
                >
                  {/* Right Side: Type Icon + Title (العنوان) + Time */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                      tx.type === 'purchase'
                        ? 'bg-emerald-50 text-[#367C73]'
                        : tx.type === 'transfer'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-[#D99A32]'
                    }`}>
                      {tx.type === 'purchase' && <ShoppingCart className="w-5 h-5" />}
                      {tx.type === 'transfer' && <ArrowLeftRight className="w-5 h-5" />}
                      {tx.type === 'custody' && <ShieldCheck className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-base truncate group-hover:text-[#367C73] transition-colors">
                          {tx.description}
                        </h4>
                        {tx.receiptUrl && (
                          <span className="w-2 h-2 rounded-full bg-[#367C73] shrink-0" title="يحتوي على إيصال مرفق" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="font-mono">{tx.transactionTime}</span>
                        <span>•</span>
                        <span>
                          {tx.type === 'purchase' ? 'مشتريات' : tx.type === 'transfer' ? 'تحويل' : 'عهدة'}
                        </span>
                        {tx.paymentSource === 'custody' && (
                          <span className="text-amber-700 font-medium">
                            (من عهدة)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left Side: Amount (المبلغ) + Navigation Chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <span className="font-mono font-bold text-lg text-[#142B36] group-hover:text-[#367C73] transition-colors">
                        {formatCurrency(tx.amountHalalas, numberFormat)}
                      </span>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-[#367C73] group-hover:-translate-x-1 transition-all" />
                  </div>
                </motion.div>
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

      {/* Receipt Viewer Modal */}
      {viewingReceiptUrl && (
        <ReceiptModal
          receiptUrl={viewingReceiptUrl}
          onClose={() => setViewingReceiptUrl(null)}
        />
      )}
    </div>
  );
};
