import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderLock, 
  Plus, 
  Search, 
  RotateCcw, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  ArrowLeft, 
  Calendar, 
  ShoppingCart, 
  AlertCircle, 
  X,
  MoreVertical,
  Trash2,
  User,
  Phone,
  MessageSquare,
  Edit3
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
import { Custody, CustodyMovement, Transaction } from '../types';
import { formatCurrency, fromHalalas, toHalalas, parseAmountInput } from '../utils/currencyUtils';
import { getTodayDateString, getCurrentTimeString, formatDateArabic } from '../utils/dateUtils';
import { TransactionModal } from '../components/TransactionModal';

export const Custodies: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { success, error: notifyError } = useNotification();
  const timezone = userProfile?.settings?.timezone || 'Asia/Riyadh';
  const numberFormat = userProfile?.settings?.numberFormat || 'english';

  const [custodies, setCustodies] = useState<Custody[]>([]);
  const [movements, setMovements] = useState<CustodyMovement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selected custody for deep detail view (matching Image 3 "تفاصيل العهدة")
  const [selectedCustodyId, setSelectedCustodyId] = useState<string | null>(null);

  // New custody modal
  const [isAddCustodyOpen, setIsAddCustodyOpen] = useState(false);
  const [newCustodyName, setNewCustodyName] = useState('');
  const [newCustodyPerson, setNewCustodyPerson] = useState('');
  const [newCustodyPhone, setNewCustodyPhone] = useState('');
  const [newCustodySource, setNewCustodySource] = useState('');
  const [newCustodyAmount, setNewCustodyAmount] = useState('');
  const [newCustodyNotes, setNewCustodyNotes] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Quick Edit Custody Modal
  const [editingCustody, setEditingCustody] = useState<Custody | null>(null);
  const [editCustodyName, setEditCustodyName] = useState('');
  const [editPersonName, setEditPersonName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Refund / Settlement Modal
  const [refundCustody, setRefundCustody] = useState<Custody | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDesc, setRefundDesc] = useState('إعادة المتبقي للجهة');
  const [refundLoading, setRefundLoading] = useState(false);

  // Add purchase from custody modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // Listeners
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const cQuery = query(collection(db, `users/${currentUser.uid}/custodies`));
      const unsubCustodies = onSnapshot(cQuery, (snap) => {
        const list: Custody[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Custody));
        setCustodies(list);
        setLoading(false);
      }, (err) => {
        console.error('Custodies error:', err);
        setLoading(false);
      });

      const mQuery = query(collection(db, `users/${currentUser.uid}/custodyMovements`));
      const unsubMovements = onSnapshot(mQuery, (snap) => {
        const list: CustodyMovement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as CustodyMovement));
        setMovements(list);
      });

      const tQuery = query(collection(db, `users/${currentUser.uid}/transactions`));
      const unsubTx = onSnapshot(tQuery, (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Transaction));
        setTransactions(list);
      });

      return () => {
        unsubCustodies();
        unsubMovements();
        unsubTx();
      };
    } catch (err) {
      console.error('Custodies subscription error:', err);
      setLoading(false);
    }
  }, [currentUser]);

  // Tab filtered
  const openCustodies = useMemo(() => custodies.filter(c => c.status === 'open'), [custodies]);
  const closedCustodies = useMemo(() => custodies.filter(c => c.status === 'closed'), [custodies]);

  const displayCustodies = useMemo(() => {
    const target = activeTab === 'open' ? openCustodies : closedCustodies;
    return target.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sourceEntity.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeTab, openCustodies, closedCustodies, searchQuery]);

  // Selected Custody Details
  const selectedCustody = useMemo(() => {
    return custodies.find(c => c.id === selectedCustodyId) || null;
  }, [custodies, selectedCustodyId]);

  // Movements and Transactions linked to selected custody
  const selectedCustodyTransactions = useMemo(() => {
    if (!selectedCustodyId) return [];
    return transactions.filter(t => t.custodyId === selectedCustodyId);
  }, [transactions, selectedCustodyId]);

  const selectedCustodyRefunds = useMemo(() => {
    if (!selectedCustodyId) return [];
    return movements.filter(m => m.custodyId === selectedCustodyId && m.type === 'refund');
  }, [movements, selectedCustodyId]);

  const selectedSpentAmount = useMemo(() => {
    return selectedCustodyTransactions.reduce((sum, t) => sum + t.amountHalalas, 0);
  }, [selectedCustodyTransactions]);

  const selectedRefundedAmount = useMemo(() => {
    return selectedCustodyRefunds.reduce((sum, m) => sum + m.amountHalalas, 0);
  }, [selectedCustodyRefunds]);

  // Handle Create New Custody
  const handleCreateCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || addLoading) return;

    const amount = parseAmountInput(newCustodyAmount);
    if (amount <= 0) {
      notifyError('يرجى إدخال مبلغ استلام صحيح');
      return;
    }

    if (!newCustodyName.trim()) {
      notifyError('اسم العهدة أو المشروع مطلوب');
      return;
    }

    if (!newCustodyPerson.trim()) {
      notifyError('اسم الشخص المسؤول عن العهدة مطلوب');
      return;
    }

    setAddLoading(true);
    const now = Date.now();
    const amountHalalas = toHalalas(amount);
    const todayDate = getTodayDateString(timezone);

    try {
      // 1. Create Custody record in Cloud Firestore under user's private collection
      const custodyRef = collection(db, `users/${currentUser.uid}/custodies`);
      const created = await addDoc(custodyRef, {
        userId: currentUser.uid,
        name: newCustodyName.trim(),
        personName: newCustodyPerson.trim(),
        phoneNumber: newCustodyPhone.trim(),
        sourceEntity: newCustodySource.trim() || 'الإدارة المالية',
        initialAmountHalalas: amountHalalas,
        remainingAmountHalalas: amountHalalas,
        status: 'open',
        notes: newCustodyNotes.trim(),
        createdAt: now,
      });

      // 2. Also record in Transactions as 'custody' type so it appears in Daily Ledger!
      const txRef = collection(db, `users/${currentUser.uid}/transactions`);
      await addDoc(txRef, {
        userId: currentUser.uid,
        type: 'custody',
        amountHalalas,
        description: newCustodyName.trim(),
        senderName: newCustodySource.trim() || 'الإدارة المالية',
        personName: newCustodyPerson.trim(),
        phoneNumber: newCustodyPhone.trim(),
        transactionDate: todayDate,
        transactionTime: getCurrentTimeString(timezone),
        timezone,
        occurredAt: now,
        createdAt: now,
        updatedAt: now,
        notes: newCustodyNotes.trim(),
      });

      // 3. Movement record
      const movRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
      await addDoc(movRef, {
        userId: currentUser.uid,
        custodyId: created.id,
        type: 'receive',
        amountHalalas,
        description: 'استلام عهدة أولي',
        date: todayDate,
        createdAt: now,
      });

      success('تم حفظ العهدة بالسحابة بنجاح');
      setIsAddCustodyOpen(false);
      setNewCustodyName('');
      setNewCustodyPerson('');
      setNewCustodyPhone('');
      setNewCustodySource('');
      setNewCustodyAmount('');
      setNewCustodyNotes('');
    } catch (err: any) {
      console.error('Create custody error:', err);
      notifyError(err.message || 'فشل إنشاء العهدة');
    } finally {
      setAddLoading(false);
    }
  };

  // Handle Edit Custody Details (Person Name, Phone, Title)
  const handleUpdateCustodyDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustody || !currentUser || editSaving) return;

    if (!editCustodyName.trim()) {
      notifyError('اسم العهدة مطلوب');
      return;
    }
    if (!editPersonName.trim()) {
      notifyError('اسم الشخص المسؤول مطلوب');
      return;
    }

    setEditSaving(true);
    try {
      const custodyRef = doc(db, `users/${currentUser.uid}/custodies`, editingCustody.id);
      await updateDoc(custodyRef, {
        name: editCustodyName.trim(),
        personName: editPersonName.trim(),
        phoneNumber: editPhoneNumber.trim(),
      });

      success('تم تحديث بيانات العهدة والشخص المسؤول بنجاح');
      setEditingCustody(null);
    } catch (err: any) {
      console.error('Update custody error:', err);
      notifyError('فشل تحديث بيانات العهدة');
    } finally {
      setEditSaving(false);
    }
  };

  // Handle Refund / Settlement Submit
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundCustody || !currentUser || refundLoading) return;

    const amount = parseAmountInput(refundAmount);
    if (amount <= 0) {
      notifyError('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }

    const amountHalalas = toHalalas(amount);
    if (amountHalalas > refundCustody.remainingAmountHalalas) {
      notifyError(`المبلغ المطلوب يتجاوز المتبقي (${fromHalalas(refundCustody.remainingAmountHalalas)} ر.س)`);
      return;
    }

    setRefundLoading(true);
    const now = Date.now();
    const newRemaining = refundCustody.remainingAmountHalalas - amountHalalas;

    try {
      // 1. Update Custody remaining balance
      const custodyRef = doc(db, `users/${currentUser.uid}/custodies`, refundCustody.id);
      await updateDoc(custodyRef, {
        remainingAmountHalalas: newRemaining,
      });

      // 2. Record Custody Movement
      const movRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
      await addDoc(movRef, {
        userId: currentUser.uid,
        custodyId: refundCustody.id,
        type: 'refund',
        amountHalalas,
        description: refundDesc.trim() || 'إعادة مبلغ للجهة',
        date: getTodayDateString(timezone),
        createdAt: now,
      });

      success('تم تسجيل إعادة المبلغ بنجاح');
      setRefundCustody(null);
      setRefundAmount('');
    } catch (err: any) {
      console.error('Refund error:', err);
      notifyError('فشل تسجيل إعادة المبلغ');
    } finally {
      setRefundLoading(false);
    }
  };

  // Close Custody (Only when remaining is 0)
  const handleCloseCustody = async (custody: Custody) => {
    if (!currentUser) return;
    if (custody.remainingAmountHalalas > 0) {
      notifyError('لا يمكن إغلاق العهدة ولديها رصيد متبقي. يرجى تصفير الرصيد أولاً.');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من إغلاق عهدة "${custody.name}" نهائياً؟`)) return;

    try {
      const custodyRef = doc(db, `users/${currentUser.uid}/custodies`, custody.id);
      await updateDoc(custodyRef, {
        status: 'closed',
        closedAt: Date.now(),
      });
      success('تم إغلاق العهدة بنجاح');
      if (selectedCustodyId === custody.id) {
        setSelectedCustodyId(null);
      }
    } catch (err: any) {
      console.error('Close custody error:', err);
      notifyError('فشل إغلاق العهدة');
    }
  };

  // Delete custody (Only if no movements)
  const handleDeleteCustody = async (custody: Custody) => {
    if (!currentUser) return;
    const linkedTx = transactions.filter(t => t.custodyId === custody.id);
    if (linkedTx.length > 0) {
      notifyError('لا يمكن حذف عهدة مرتبطة بعمليات مشتريات. يمكنك إغلاقها بدلاً من ذلك.');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف عهدة "${custody.name}"؟`)) return;

    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/custodies`, custody.id));
      success('تم حذف العهدة بنجاح');
      if (selectedCustodyId === custody.id) {
        setSelectedCustodyId(null);
      }
    } catch (err: any) {
      console.error('Delete custody error:', err);
      notifyError('فشل حذف العهدة');
    }
  };

  // If viewing detailed screen (Image 3 "تفاصيل العهدة")
  if (selectedCustody) {
    return (
      <div className="space-y-6">
        {/* Header with Back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCustodyId(null)}
              className="p-2 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-[#17233D] hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#17233D]">{selectedCustody.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                الجهة: {selectedCustody.sourceEntity} • تم الإنشاء في {new Date(selectedCustody.createdAt).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCustody.status === 'open' ? (
              <span className="px-3 py-1 bg-[#EEF2FF] text-[#315BEB] font-bold text-xs rounded-full">
                عهدة مفتوحة
              </span>
            ) : (
              <span className="px-3 py-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-full">
                عهدة مغلقة
              </span>
            )}
          </div>
        </div>

        {/* Custodian Details Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center font-bold text-lg shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">المسؤول عن العهدة:</span>
                <span className="text-base font-bold text-[#17233D]">
                  {selectedCustody.personName || 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-semibold">رقم الجوال:</span>
                <span className="text-sm font-mono font-semibold text-[#17233D] dir-ltr">
                  {selectedCustody.phoneNumber || 'لا يوجد رقم'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {selectedCustody.phoneNumber && (
              <>
                <a
                  href={`tel:${selectedCustody.phoneNumber}`}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#315BEB] font-semibold text-xs flex items-center gap-1.5 border border-slate-200 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>اتصال</span>
                </a>
                <a
                  href={`https://wa.me/${selectedCustody.phoneNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center gap-1.5 border border-emerald-200 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>واتساب</span>
                </a>
              </>
            )}
            <button
              onClick={() => {
                setEditingCustody(selectedCustody);
                setEditCustodyName(selectedCustody.name);
                setEditPersonName(selectedCustody.personName || '');
                setEditPhoneNumber(selectedCustody.phoneNumber || '');
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-[#315BEB] hover:bg-slate-100 transition-colors"
              title="تعديل بيانات العهدة والمسؤول"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Summary Stats matching Image 3 "تفاصيل العهدة" */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* المستلم */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <p className="text-xs font-semibold text-slate-400 mb-1">المبلغ المستلم</p>
            <p className="text-2xl font-bold text-[#315BEB] font-mono">
              {formatCurrency(selectedCustody.initialAmountHalalas, numberFormat)}
            </p>
          </div>

          {/* المصروف */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <p className="text-xs font-semibold text-slate-400 mb-1">المصروف</p>
            <p className="text-2xl font-bold text-[#17233D] font-mono">
              {formatCurrency(selectedSpentAmount, numberFormat)}
            </p>
          </div>

          {/* المتبقي (Amber) */}
          <div className="bg-white p-5 rounded-2xl border border-amber-200/60 bg-gradient-to-br from-white to-amber-50/20 shadow-xs">
            <p className="text-xs font-semibold text-amber-800 mb-1">المتبقي</p>
            <p className="text-2xl font-bold text-[#F4AE52] font-mono">
              {formatCurrency(selectedCustody.remainingAmountHalalas, numberFormat)}
            </p>
          </div>

          {/* المعاد */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <p className="text-xs font-semibold text-slate-400 mb-1">المعاد</p>
            <p className="text-2xl font-bold text-slate-700 font-mono">
              {formatCurrency(selectedRefundedAmount, numberFormat)}
            </p>
          </div>
        </div>

        {/* Action Buttons matching Image 3 */}
        {selectedCustody.status === 'open' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPurchaseModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white font-semibold text-sm shadow-sm flex items-center gap-2 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>تسجيل مشتريات</span>
            </button>

            <button
              onClick={() => setRefundCustody(selectedCustody)}
              className="px-5 py-2.5 rounded-2xl bg-[#FEF6E9] hover:bg-amber-100 text-[#D99A32] font-semibold text-sm border border-amber-200 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة مبلغ</span>
            </button>

            <button
              onClick={() => handleCloseCustody(selectedCustody)}
              disabled={selectedCustody.remainingAmountHalalas > 0}
              className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-rose-600 font-semibold text-sm transition-all disabled:opacity-40"
              title={selectedCustody.remainingAmountHalalas > 0 ? 'يجب تصفير المتبقي أولاً لإغلاق العهدة' : 'إغلاق العهدة'}
            >
              إغلاق العهدة
            </button>
          </div>
        )}

        {/* Linked Operations Table matching Image 3 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-base text-[#17233D]">عمليات العهدة</h3>
          </div>

          {selectedCustodyTransactions.length === 0 && selectedCustodyRefunds.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              لا توجد عمليات صرف أو إعادة مسجلة على هذه العهدة حتى الآن.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Header */}
              <div className="grid grid-cols-12 px-6 py-3 bg-slate-50 text-xs font-bold text-slate-500">
                <div className="col-span-3">التاريخ</div>
                <div className="col-span-6">الوصف</div>
                <div className="col-span-3 text-left">المبلغ</div>
              </div>

              {/* Purchases */}
              {selectedCustodyTransactions.map((tx) => (
                <div key={tx.id} className="grid grid-cols-12 px-6 py-3.5 items-center hover:bg-slate-50 text-sm">
                  <div className="col-span-3 font-mono text-xs text-slate-500">{tx.transactionDate}</div>
                  <div className="col-span-6 font-semibold text-[#17233D]">{tx.description}</div>
                  <div className="col-span-3 text-left font-mono font-bold text-[#17233D]">
                    {formatCurrency(tx.amountHalalas, numberFormat)}
                  </div>
                </div>
              ))}

              {/* Refunds */}
              {selectedCustodyRefunds.map((mov) => (
                <div key={mov.id} className="grid grid-cols-12 px-6 py-3.5 items-center bg-amber-50/20 hover:bg-amber-50/40 text-sm">
                  <div className="col-span-3 font-mono text-xs text-slate-500">{mov.date}</div>
                  <div className="col-span-6 font-semibold text-amber-800 flex items-center gap-2">
                    <span className="text-xs bg-amber-100 px-2 py-0.5 rounded-full font-bold">إعادة مبلغ</span>
                    <span>{mov.description}</span>
                  </div>
                  <div className="col-span-3 text-left font-mono font-bold text-amber-700">
                    {formatCurrency(mov.amountHalalas, numberFormat)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Purchase from custody modal */}
        {isPurchaseModalOpen && (
          <TransactionModal
            isOpen={isPurchaseModalOpen}
            onClose={() => setIsPurchaseModalOpen(false)}
            onSave={async (data) => {
              if (!currentUser) return;
              const now = Date.now();
              const newTxRef = collection(db, `users/${currentUser.uid}/transactions`);
              const docRef = await addDoc(newTxRef, {
                ...data,
                type: 'purchase',
                paymentSource: 'custody',
                custodyId: selectedCustody.id,
                userId: currentUser.uid,
                createdAt: now,
                updatedAt: now,
              });

              // Deduct remaining
              const cRef = doc(db, `users/${currentUser.uid}/custodies`, selectedCustody.id);
              await updateDoc(cRef, {
                remainingAmountHalalas: Math.max(0, selectedCustody.remainingAmountHalalas - data.amountHalalas),
              });

              // Record movement
              const movRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
              await addDoc(movRef, {
                userId: currentUser.uid,
                custodyId: selectedCustody.id,
                type: 'purchase',
                amountHalalas: data.amountHalalas,
                description: data.description,
                transactionId: docRef.id,
                date: data.transactionDate,
                createdAt: now,
              });

              success('تم تسجيل المشتريات من العهدة بنجاح');
            }}
            openCustodies={[selectedCustody]}
            timezone={timezone}
          />
        )}

        {/* Refund Modal */}
        {refundCustody && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-base text-[#17233D]">إعادة مبلغ للجهة</h3>
                <button onClick={() => setRefundCustody(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRefundSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ المعاد (ر.س) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 font-mono font-bold text-lg text-[#17233D]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    المتبقي الحالي: {fromHalalas(refundCustody.remainingAmountHalalas)} ر.س
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">وصف الإعادة</label>
                  <input
                    type="text"
                    value={refundDesc}
                    onChange={(e) => setRefundDesc(e.target.value)}
                    className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs text-[#17233D]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundCustody(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={refundLoading}
                    className="px-5 py-2 rounded-xl bg-[#315BEB] text-white text-xs font-bold hover:bg-[#2548cb] transition-colors"
                  >
                    {refundLoading ? 'جاري التأكيد...' : 'تأكيد الإعادة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Custodies List View matching Image 3 "العُهد"
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#17233D] tracking-tight">العُهد</h1>
        </div>

        <button
          onClick={() => setIsAddCustodyOpen(true)}
          className="px-5 py-2.5 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white font-semibold text-sm shadow-sm flex items-center gap-2 transition-all min-h-[44px]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>إضافة عهدة</span>
        </button>
      </div>

      {/* Tabs and Search Bar matching Image 3 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs">
        {/* Tabs: العُهد المفتوحة (X) vs العُهد المغلقة (Y) */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('open')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'open'
                ? 'bg-[#EEF2FF] text-[#315BEB] border border-blue-200'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            العُهد المفتوحة ({openCustodies.length})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'closed'
                ? 'bg-[#EEF2FF] text-[#315BEB] border border-blue-200'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            العُهد المغلقة ({closedCustodies.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الجهة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#315BEB]"
          />
        </div>
      </div>

      {/* Custodies Cards Grid matching Image 3 */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">جاري تحميل العُهد...</div>
      ) : displayCustodies.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-16 text-center">
          <FolderLock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#17233D] mb-1">لا توجد عُهد في هذا القسم</h3>
          <p className="text-xs text-slate-400 mb-6">
            {activeTab === 'open' 
              ? 'يمكنك إضافة عهدة تشغيلية أو مشروع جديدة ومتابعة مصروفاتها.' 
              : 'العُهد التي تم تصفيرها وإغلاقها تظهر هنا.'}
          </p>
          {activeTab === 'open' && (
            <button
              onClick={() => setIsAddCustodyOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-[#315BEB] text-white text-xs font-bold"
            >
              إضافة أول عهدة
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayCustodies.map((custody) => {
            // Calculate spent amount
            const linkedTx = transactions.filter(t => t.custodyId === custody.id);
            const spent = linkedTx.reduce((sum, t) => sum + t.amountHalalas, 0);

            return (
              <div
                key={custody.id}
                onClick={() => setSelectedCustodyId(custody.id)}
                className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs hover:shadow-sm hover:border-blue-200 transition-all cursor-pointer flex flex-col justify-between group"
              >
                {/* Top card info */}
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EEF2FF] text-[#315BEB] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FolderLock className="w-5 h-5" />
                    </div>
                    {custody.status === 'closed' && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        مغلقة
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-[#17233D] group-hover:text-[#315BEB] transition-colors truncate">
                    {custody.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {custody.sourceEntity}
                  </p>
                </div>

                {/* 3 Stats matching Image 3: المستلم | المصروف | المتبقي */}
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">المستلم</span>
                    <span className="font-mono font-bold text-xs text-[#315BEB] mt-0.5 block truncate">
                      {formatCurrency(custody.initialAmountHalalas, numberFormat)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">المصروف</span>
                    <span className="font-mono font-bold text-xs text-[#17233D] mt-0.5 block truncate">
                      {formatCurrency(spent, numberFormat)}
                    </span>
                  </div>

                  <div className="bg-[#FEF6E9] p-1.5 rounded-xl border border-amber-200/50">
                    <span className="text-[10px] text-amber-800 block font-bold">المتبقي</span>
                    <span className="font-mono font-bold text-xs text-[#F4AE52] mt-0.5 block truncate">
                      {formatCurrency(custody.remainingAmountHalalas, numberFormat)}
                    </span>
                  </div>
                </div>
                {/* Custodian Person Info Badge if present */}
                {(custody.personName || custody.phoneNumber) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                      <User className="w-3.5 h-3.5 text-[#315BEB] shrink-0" />
                      <span className="font-semibold truncate">{custody.personName || 'مسؤول غير محدد'}</span>
                    </div>
                    {custody.phoneNumber && (
                      <a
                        href={`tel:${custody.phoneNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[11px] text-[#315BEB] hover:text-[#2548cb] flex items-center gap-1 shrink-0 bg-[#EEF2FF] hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors"
                        title="اتصال بالمسؤول"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{custody.phoneNumber}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Custody Modal */}
      {isAddCustodyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-[#17233D]">إضافة عهدة جديدة</h3>
              <button onClick={() => setIsAddCustodyOpen(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustody} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">اسم العهدة أو المشروع *</label>
                <input
                  type="text"
                  placeholder="مثال: عهدة المشتريات اليومية"
                  value={newCustodyName}
                  onChange={(e) => setNewCustodyName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">اسم الشخص المسؤول *</label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد العتيبي"
                    value={newCustodyPerson}
                    onChange={(e) => setNewCustodyPerson(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">رقم جوال الشخص *</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="05XXXXXXXX"
                    value={newCustodyPhone}
                    onChange={(e) => setNewCustodyPhone(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-right font-mono text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الجهة المُسلِّمة (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: الإدارة المالية أو الشركة"
                  value={newCustodySource}
                  onChange={(e) => setNewCustodySource(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ المستلم (ر.س) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={newCustodyAmount}
                  onChange={(e) => setNewCustodyAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 font-mono font-bold text-lg text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات حول العهدة أو الشروط..."
                  value={newCustodyNotes}
                  onChange={(e) => setNewCustodyNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustodyOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-2xl bg-[#315BEB] text-white text-xs font-bold hover:bg-[#2548cb] transition-colors"
                >
                  {addLoading ? 'جاري الحفظ بالسحابة...' : 'حفظ العهدة بالسحابة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Edit Custody Modal */}
      {editingCustody && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-[#17233D]">تعديل بيانات العهدة والمسؤول</h3>
              <button onClick={() => setEditingCustody(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustodyDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">اسم العهدة أو المشروع *</label>
                <input
                  type="text"
                  value={editCustodyName}
                  onChange={(e) => setEditCustodyName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">اسم الشخص المسؤول *</label>
                <input
                  type="text"
                  value={editPersonName}
                  onChange={(e) => setEditPersonName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">رقم جوال الشخص *</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-right font-mono text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustody(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2.5 rounded-2xl bg-[#315BEB] text-white text-xs font-bold hover:bg-[#2548cb] transition-colors"
                >
                  {editSaving ? 'جاري التحديث...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
