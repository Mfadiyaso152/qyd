import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Plus, 
  Lock, 
  Unlock, 
  RotateCcw, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Check, 
  X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { Custody, CustodyMovement } from '../types';
import { formatCurrency, fromHalalas, toHalalas, parseAmountInput } from '../utils/currencyUtils';
import { getTodayDateString } from '../utils/dateUtils';
export const Custodies: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const timezone = 'Asia/Riyadh';
  const numberFormat = userProfile?.settings.numberFormat || 'arabic';

  const [custodies, setCustodies] = useState<Custody[]>([]);
  const [movements, setMovements] = useState<CustodyMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Refund modal state
  const [refundModalCustody, setRefundModalCustody] = useState<Custody | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [refundDescription, setRefundDescription] = useState<string>('إعادة المتبقي للجهة');
  const [refundError, setRefundError] = useState<string>('');

  // Selected custody for details drawer
  const [selectedCustodyId, setSelectedCustodyId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const custodyQuery = query(collection(db, `users/${currentUser.uid}/custodies`));
      const unsubCustody = onSnapshot(custodyQuery, (snapshot) => {
        const list: Custody[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Custody);
        });
        setCustodies(list);
        setLoading(false);
      }, (err) => {
        console.error('Custody fetch error:', err);
        setLoading(false);
      });

      const movementQuery = query(collection(db, `users/${currentUser.uid}/custodyMovements`));
      const unsubMovement = onSnapshot(movementQuery, (snapshot) => {
        const list: CustodyMovement[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as CustodyMovement);
        });
        setMovements(list);
      }, (err) => {
        console.error('Movements fetch error:', err);
      });

      return () => {
        unsubCustody();
        unsubMovement();
      };
    } catch (err) {
      console.error('Custodies subscription error:', err);
      setLoading(false);
    }
  }, [currentUser]);

  // Handle refund action
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalCustody || !currentUser) return;

    const amount = parseAmountInput(refundAmountInput);
    if (amount <= 0) {
      setRefundError('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }

    const amountHalalas = toHalalas(amount);
    if (amountHalalas > refundModalCustody.remainingAmountHalalas) {
      setRefundError(`المبلغ المطلوب يتجاوز الرصيد المتبقي (${fromHalalas(refundModalCustody.remainingAmountHalalas)} ر.س)`);
      return;
    }

    try {


      const now = Date.now();
      const newRemaining = refundModalCustody.remainingAmountHalalas - amountHalalas;

      // Update custody remaining
      const custodyRef = doc(db, `users/${currentUser.uid}/custodies`, refundModalCustody.id);
      await updateDoc(custodyRef, {
        remainingAmountHalalas: newRemaining,
      });

      // Add movement record
      const movementRef = collection(db, `users/${currentUser.uid}/custodyMovements`);
      await addDoc(movementRef, {
        userId: currentUser.uid,
        custodyId: refundModalCustody.id,
        type: 'refund',
        amountHalalas,
        description: refundDescription,
        date: getTodayDateString(timezone),
        createdAt: now,
      });

      setRefundModalCustody(null);
      setRefundAmountInput('');
    } catch (err: any) {
      console.error('Refund error:', err);
      setRefundError(err.message || 'فشل تسجيل إعادة المبلغ');
    }
  };

  // Close custody
  const handleCloseCustody = async (custody: Custody) => {
    if (!currentUser) return;
    if (custody.remainingAmountHalalas > 0) {
      alert('لا يمكن إغلاق العهدة ولديها رصيد متبقي. يرجى تصفير الرصيد أولاً عبر إعادة المبلغ أو استهلاك العهدة بالكامل.');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من إغلاق عهدة "${custody.name}" نهائياً؟`)) return;

    try {


      const custodyRef = doc(db, `users/${currentUser.uid}/custodies`, custody.id);
      await updateDoc(custodyRef, {
        status: 'closed',
        closedAt: Date.now(),
      });
    } catch (err) {
      console.error('Close custody error:', err);
      alert('فشل إغلاق العهدة');
    }
  };

  // Delete custody (if no movements)
  const handleDeleteCustody = async (custody: Custody) => {
    if (!currentUser) return;
    const custodyMovs = movements.filter(m => m.custodyId === custody.id);
    if (custodyMovs.length > 0) {
      alert('لا يمكن حذف عهدة مرتبطة بحركات مالية أو مشتريات. يمكنك إغلاقها بدلاً من ذلك.');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف عهدة "${custody.name}"؟`)) return;

    try {


      await deleteDoc(doc(db, `users/${currentUser.uid}/custodies`, custody.id));
    } catch (err) {
      console.error('Delete custody error:', err);
      alert('فشل حذف العهدة');
    }
  };

  const openCustodies = custodies.filter(c => c.status === 'open');
  const closedCustodies = custodies.filter(c => c.status === 'closed');

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#142B36] mb-1">إدارة العُهد</h2>
          <p className="text-sm text-slate-500">متابعة العُهد المفتوحة، والمتبقي، وحركات التسوية والإعادة.</p>
        </div>
      </div>

      {/* Open Custodies Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#142B36] flex items-center gap-2">
          <Unlock className="w-5 h-5 text-[#367C73]" />
          <span>العُهد المفتوحة ({openCustodies.length})</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border">جاري تحميل العُهد...</div>
        ) : openCustodies.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            لا توجد عُهد مفتوحة حالياً. يمكنك إنشاء عهدة جديدة من قسم «إضافة عملية».
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {openCustodies.map((custody) => {
              const custodyMovs = movements.filter(m => m.custodyId === custody.id);
              const spentAmount = custodyMovs
                .filter(m => m.type === 'purchase')
                .reduce((sum, m) => sum + m.amountHalalas, 0);
              const refundedAmount = custodyMovs
                .filter(m => m.type === 'refund')
                .reduce((sum, m) => sum + m.amountHalalas, 0);

              const isDetailsOpen = selectedCustodyId === custody.id;

              return (
                <motion.div 
                  key={custody.id} 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col"
                >
                  <div className="p-5 bg-gradient-to-br from-slate-50 to-amber-50/20 border-b border-slate-100 flex items-start justify-between">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-2">
                        عهدة مفتوحة
                      </span>
                      <h4 className="font-bold text-lg text-[#142B36]">{custody.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">الجهة المُسَلّمة: {custody.sourceEntity}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#D99A32]/10 text-[#D99A32] flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="p-5 space-y-3 flex-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">المبلغ المستلم:</span>
                      <span className="font-mono font-bold text-slate-800">{formatCurrency(custody.initialAmountHalalas, numberFormat)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">إجمالي المشتريات:</span>
                      <span className="font-mono font-semibold text-[#367C73]">{formatCurrency(spentAmount, numberFormat)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">المبلغ المعاد:</span>
                      <span className="font-mono font-semibold text-blue-600">{formatCurrency(refundedAmount, numberFormat)}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="font-bold text-slate-700">المتبقي الصافي:</span>
                      <span className="font-mono font-bold text-lg text-[#D99A32]">
                        {formatCurrency(custody.remainingAmountHalalas, numberFormat)}
                      </span>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setRefundModalCustody(custody)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#367C73] text-white text-xs font-semibold hover:bg-[#2b635b] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة مبلغ</span>
                    </button>
                    <button
                      onClick={() => handleCloseCustody(custody)}
                      disabled={custody.remainingAmountHalalas > 0}
                      className="py-2 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors disabled:opacity-40"
                      title="إغلاق العهدة"
                    >
                      إغلاق
                    </button>
                    <button
                      onClick={() => setSelectedCustodyId(isDetailsOpen ? null : custody.id)}
                      className="p-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                      title="عرض التفاصيل والحركات"
                    >
                      {isDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Details Drawer */}
                  {isDetailsOpen && (
                    <div className="p-4 bg-slate-100 border-t border-slate-200 space-y-2 animate-fadeIn text-xs">
                      <p className="font-bold text-slate-700 mb-2">سجل الحركات المرتبطة بالعهدة:</p>
                      {custodyMovs.length === 0 ? (
                        <p className="text-slate-500">لا توجد حركات مسجلة بعد.</p>
                      ) : (
                        custodyMovs.map((m) => (
                          <div key={m.id} className="p-2 bg-white rounded-lg border flex justify-between items-center">
                            <div>
                              <span className={`font-semibold ${m.type === 'purchase' ? 'text-[#367C73]' : 'text-blue-600'}`}>
                                {m.type === 'purchase' ? 'شراء' : 'إعادة مبلغ'}
                              </span>
                              <span className="text-slate-600 mr-2">{m.description}</span>
                            </div>
                            <span className="font-mono font-bold">{formatCurrency(m.amountHalalas, numberFormat)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Closed Custodies Section */}
      {closedCustodies.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h3 className="text-lg font-bold text-slate-600 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-400" />
            <span>العُهد المغلقة ({closedCustodies.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {closedCustodies.map((custody) => (
              <div key={custody.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 opacity-75">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                    عهدة مغلقة
                  </span>
                  <button
                    onClick={() => handleDeleteCustody(custody)}
                    className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
                  >
                    حذف
                  </button>
                </div>
                <h4 className="font-bold text-base text-slate-800">{custody.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">المبلغ الأصلي: {formatCurrency(custody.initialAmountHalalas, numberFormat)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalCustody && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[#142B36]">تسجيل إعادة مبلغ للعهدـة</h3>
              <button 
                onClick={() => setRefundModalCustody(null)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
              <span className="font-bold block mb-1">{refundModalCustody.name}</span>
              المتبقي الحالي: <span className="font-mono font-bold">{formatCurrency(refundModalCustody.remainingAmountHalalas, numberFormat)}</span>
            </div>

            {refundError && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{refundError}</span>
              </div>
            )}

            <form onSubmit={handleRefundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المعاد (ر.س) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف الإعادة</label>
                <input
                  type="text"
                  value={refundDescription}
                  onChange={(e) => setRefundDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundModalCustody(null)}
                  className="px-4 py-2 rounded-xl border text-slate-700 text-sm font-medium hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#367C73] text-white text-sm font-semibold hover:bg-[#2b635b]"
                >
                  تأكيد الإعادة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
