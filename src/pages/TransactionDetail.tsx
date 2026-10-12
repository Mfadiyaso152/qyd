/**
 * Full Transaction Detail Page Component
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  ShoppingCart, 
  ArrowLeftRight, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Tag, 
  CreditCard, 
  FileText, 
  Edit3, 
  Trash2, 
  Download, 
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Transaction, Custody } from '../types';
import { formatCurrency, fromHalalas } from '../utils/currencyUtils';
import { formatDateArabic } from '../utils/dateUtils';
import { TransactionModal } from '../components/TransactionModal';
import { ReceiptModal } from '../components/ReceiptModal';
export const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const timezone = 'Asia/Riyadh';
  const numberFormat = userProfile?.settings.numberFormat || 'arabic';

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [custodies, setCustodies] = useState<Custody[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !id) return;
    setLoading(true);

    const fetchTx = async () => {
      try {
        const txDoc = await getDoc(doc(db, `users/${currentUser.uid}/transactions`, id));
        if (txDoc.exists()) {
          setTransaction({ id: txDoc.id, ...txDoc.data() } as Transaction);
        } else {
          setTransaction(null);
        }
      } catch (err) {
        console.error('Fetch transaction detail error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTx();
  }, [currentUser, id]);

  const handleUpdate = async (data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser || !id) return;

    try {
      const docRef = doc(db, `users/${currentUser.uid}/transactions`, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Date.now(),
      });
      setTransaction(prev => prev ? { ...prev, ...data, updatedAt: Date.now() } : null);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Update error:', err);
      alert('فشل تحديث العملية');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !transaction) return;
    if (!window.confirm(`هل أنت متأكد من حذف العملية "${transaction.description}"؟`)) return;



    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/transactions`, transaction.id));
      navigate(-1);
    } catch (err) {
      console.error('Delete error:', err);
      alert('فشل حذف العملية');
    }
  };

  const categoryNames: Record<string, string> = {
    supplies: 'مستلزمات',
    food: 'طعام',
    transport: 'مواصلات',
    bills: 'فواتير',
    other: 'أخرى',
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-4 border-[#367C73] border-t-transparent rounded-full"
        />
        <p className="text-sm font-semibold text-slate-500">جاري تحميل تفاصيل العملية...</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">لم يتم العثور على العملية</h3>
        <p className="text-sm text-slate-500 mb-6">قد تكون هذه العملية قد حُذفت أو أن الرابط غير صحيح.</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl bg-[#367C73] text-white font-semibold hover:bg-[#2b635b] transition-colors"
        >
          العودة إلى اليومية
        </button>
      </div>
    );
  }

  const linkedCustody = transaction.custodyId ? custodies.find(c => c.id === transaction.custodyId) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-6 pb-24 lg:pb-8"
    >
      {/* Top Bar with Back Button and Quick Actions */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-[#142B36] font-semibold text-sm py-2 px-3 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-[#367C73]" />
          <span>العودة لليومية</span>
        </motion.button>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-[#367C73] hover:text-white text-slate-700 font-semibold text-sm transition-all"
          >
            <Edit3 className="w-4 h-4" />
            <span>تعديل</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 font-semibold text-sm transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف</span>
          </motion.button>
        </div>
      </div>

      {/* Main Details Card */}
      <motion.div 
        layout
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
      >
        {/* Card Header with Big Amount & Type Pill */}
        <div className="p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-[#B9E6CF]/10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              {transaction.type === 'purchase' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-[#367C73]">
                  <ShoppingCart className="w-4 h-4" />
                  <span>مشتريات</span>
                </span>
              )}
              {transaction.type === 'transfer' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>تحويل مالي</span>
                </span>
              )}
              {transaction.type === 'custody' && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-[#D99A32]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>عهدة مالية مستلمة</span>
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono">
                {transaction.transactionTime}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#142B36] tracking-tight">
              {transaction.description}
            </h1>
          </div>

          <div className="bg-[#142B36] text-white px-6 py-4 rounded-2xl shadow-lg flex flex-col items-start md:items-end">
            <span className="text-xs text-slate-300 font-medium mb-1">المبلغ الإجمالي</span>
            <span className="text-2xl lg:text-3xl font-bold font-mono text-[#B9E6CF]">
              {formatCurrency(transaction.amountHalalas, numberFormat)}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 lg:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          {/* Date & Time */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-[#367C73]/10 text-[#367C73] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1">تاريخ العملية</p>
              <p className="font-semibold text-slate-800">{formatDateArabic(transaction.transactionDate)}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{transaction.transactionDate}</p>
            </div>
          </div>

          {/* Time & Timezone */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-[#367C73]/10 text-[#367C73] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1">وقت العملية</p>
              <p className="font-semibold text-slate-800 font-mono">{transaction.transactionTime}</p>
              <p className="text-xs text-slate-500 mt-0.5">{transaction.timezone || timezone}</p>
            </div>
          </div>

          {/* Purchase Specifics */}
          {transaction.type === 'purchase' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#367C73] flex items-center justify-center shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">التصنيف</p>
                  <p className="font-semibold text-slate-800">
                    {transaction.category ? categoryNames[transaction.category] || transaction.category : 'غير مصنف'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#367C73] flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">مصدر الدفع</p>
                  <p className="font-semibold text-slate-800">
                    {transaction.paymentSource === 'custody' ? (
                      <span className="text-[#D99A32]">
                        من عهدة: {linkedCustody?.name || 'عهدة محددة'}
                      </span>
                    ) : (
                      'حساب شخصي'
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Transfer Specifics */}
          {transaction.type === 'transfer' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">المرسل</p>
                  <p className="font-semibold text-slate-800">{transaction.senderName || 'غير محدد'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">المستلم</p>
                  <p className="font-semibold text-slate-800">{transaction.recipientName || 'غير محدد'}</p>
                </div>
              </div>
            </>
          )}

          {/* Custody Specifics */}
          {transaction.type === 'custody' && (
            <div className="md:col-span-2 flex items-start gap-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-[#D99A32] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">الجهة المسلّمة للمبلغ</p>
                <p className="font-semibold text-slate-800">{transaction.senderName || 'الإدارة المالية'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  تم تسجيل هذا المبلغ كعهدة نقدية جديدة للمتابعة والصرف.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notes Section */}
        {transaction.notes && (
          <div className="px-6 lg:px-8 pb-6">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-1">الملاحظات</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{transaction.notes}</p>
            </div>
          </div>
        )}

        {/* Receipt Section */}
        {transaction.receiptUrl && (
          <div className="px-6 lg:px-8 pb-8">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#367C73]" />
                  <span>الإيصال المرفق</span>
                </h3>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewingReceiptUrl(transaction.receiptUrl || null)}
                    className="px-3 py-1.5 rounded-lg bg-[#367C73] text-white text-xs font-semibold hover:bg-[#2b635b] transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>معاينة الإيصال</span>
                  </motion.button>
                  <a
                    href={transaction.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                    title="تنزيل"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Thumbnail / Preview container */}
              <div 
                onClick={() => setViewingReceiptUrl(transaction.receiptUrl || null)}
                className="cursor-pointer max-h-72 overflow-hidden rounded-xl bg-white border border-slate-200 p-2 flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {transaction.receiptUrl.includes('.pdf') ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-slate-500">
                    <FileText className="w-12 h-12 text-[#367C73]" />
                    <span className="text-sm font-semibold">مستند PDF (انقر للمعاينة)</span>
                  </div>
                ) : (
                  <img
                    src={transaction.receiptUrl}
                    alt="معاينة الإيصال"
                    className="max-h-64 object-contain rounded-lg"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Edit Modal */}
      <TransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdate}
        editTransaction={transaction}
        openCustodies={custodies.filter(c => c.status === 'open')}
        timezone={timezone}
      />

      {/* Receipt Viewer Modal */}
      {viewingReceiptUrl && (
        <ReceiptModal
          receiptUrl={viewingReceiptUrl}
          onClose={() => setViewingReceiptUrl(null)}
        />
      )}
    </motion.div>
  );
};
