import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  ShoppingCart, 
  ArrowLeftRight, 
  Wallet, 
  Calendar, 
  Clock, 
  Tag, 
  CreditCard, 
  FileText, 
  Edit3, 
  Trash2, 
  Download, 
  ExternalLink,
  AlertCircle,
  User,
  Phone,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Transaction, Custody } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { formatDateArabic, formatTime12Hour } from '../utils/dateUtils';
import { TransactionModal } from '../components/TransactionModal';
import { ReceiptModal } from '../components/ReceiptModal';

export const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { success, error: notifyError } = useNotification();
  
  const timezone = userProfile?.settings?.timezone || 'Asia/Riyadh';
  const numberFormat = userProfile?.settings?.numberFormat || 'english';

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
      success('تم تحديث تفاصيل العملية');
    } catch (err: any) {
      console.error('Update error:', err);
      notifyError('فشل تحديث العملية');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !transaction) return;
    if (!window.confirm(`هل أنت متأكد من حذف العملية "${transaction.description}"؟`)) return;

    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/transactions`, transaction.id));
      success('تم حذف العملية بنجاح');
      navigate(-1);
    } catch (err) {
      console.error('Delete error:', err);
      notifyError('فشل حذف العملية');
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
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[#315BEB] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">جاري تحميل تفاصيل العملية...</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center max-w-lg mx-auto shadow-xs">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#17233D] mb-1">لم يتم العثور على العملية</h3>
        <p className="text-xs text-slate-400 mb-6">قد تكون هذه العملية قد حُذفت أو أن الرابط غير صحيح.</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-2xl bg-[#315BEB] text-white text-xs font-bold"
        >
          العودة إلى اليومية
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header with Back Button and Quick Actions */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-[#17233D] font-bold text-xs py-2 px-3 rounded-2xl hover:bg-slate-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4 text-[#315BEB]" />
          <span>العودة لليومية</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#EEF2FF] hover:bg-blue-100 text-[#315BEB] font-bold text-xs transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل</span>
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        </div>
      </div>

      {/* Main Details Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Card Header with Big Amount & Type Pill */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-50/50 to-[#EEF2FF]/30 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {transaction.type === 'purchase' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[#EEF2FF] text-[#315BEB]">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>مشتريات</span>
                </span>
              )}
              {transaction.type === 'transfer' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>تحويل</span>
                </span>
              )}
              {transaction.type === 'custody' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[#FEF6E9] text-[#D99A32]">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>عهدة مستلمة</span>
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono">
                {formatTime12Hour(transaction.transactionTime)}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-[#17233D]">
              {transaction.description}
            </h1>
          </div>

          <div className="bg-[#17233D] text-white px-6 py-4 rounded-2xl shadow-sm flex flex-col items-start sm:items-end">
            <span className="text-[11px] text-slate-300 font-medium mb-0.5">المبلغ</span>
            <span className="text-2xl font-bold font-mono text-white">
              {formatCurrency(transaction.amountHalalas, numberFormat)}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Date */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-white text-[#315BEB] shadow-xs flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-400 mb-0.5">تاريخ العملية</p>
              <p className="font-bold text-sm text-[#17233D]">{formatDateArabic(transaction.transactionDate)}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{transaction.transactionDate}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-white text-[#315BEB] shadow-xs flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-400 mb-0.5">وقت العملية</p>
              <p className="font-bold text-sm text-[#17233D] font-mono">{formatTime12Hour(transaction.transactionTime)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{transaction.timezone || timezone}</p>
            </div>
          </div>

          {/* Purchase Specifics */}
          {transaction.type === 'purchase' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-white text-[#315BEB] shadow-xs flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-400 mb-0.5">التصنيف</p>
                  <p className="font-bold text-sm text-[#17233D]">
                    {transaction.category ? categoryNames[transaction.category] || transaction.category : 'غير مصنف'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-white text-[#315BEB] shadow-xs flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-400 mb-0.5">مصدر الدفع</p>
                  <p className="font-bold text-sm text-[#17233D]">
                    {transaction.paymentSource === 'custody' ? (
                      <span className="text-[#D99A32]">من عهدة</span>
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
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
                <div>
                  <p className="font-bold text-slate-400 mb-0.5">الطرف المرسل</p>
                  <p className="font-bold text-sm text-[#17233D]">{transaction.senderName || 'غير محدد'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
                <div>
                  <p className="font-bold text-slate-400 mb-0.5">الطرف المستلم</p>
                  <p className="font-bold text-sm text-[#17233D]">{transaction.recipientName || 'غير محدد'}</p>
                </div>
              </div>
            </>
          )}

          {/* Custody Specifics */}
          {transaction.type === 'custody' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#FEF6E9] border border-amber-200/50">
                <div className="w-9 h-9 rounded-xl bg-white text-[#F4AE52] shadow-xs flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-800 mb-0.5">الشخص المسؤول / المستلم</p>
                  <p className="font-bold text-sm text-[#17233D]">{transaction.personName || transaction.senderName || 'غير محدد'}</p>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-[#FEF6E9] border border-amber-200/50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white text-[#F4AE52] shadow-xs flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-800 mb-0.5">رقم جوال المسؤول</p>
                    <p className="font-bold text-sm text-[#17233D] font-mono dir-ltr">{transaction.phoneNumber || 'لا يوجد رقم'}</p>
                  </div>
                </div>

                {transaction.phoneNumber && (
                  <div className="flex items-center gap-1.5 self-center">
                    <a
                      href={`tel:${transaction.phoneNumber}`}
                      className="p-2 rounded-xl bg-white hover:bg-slate-50 text-[#315BEB] border border-amber-200/60 transition-colors"
                      title="اتصال"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${transaction.phoneNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-white hover:bg-slate-50 text-emerald-600 border border-amber-200/60 transition-colors"
                      title="واتساب"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {transaction.senderName && (
                <div className="sm:col-span-2 flex items-start gap-3 p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-white text-[#315BEB] shadow-xs flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-[#315BEB]" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-400 mb-0.5">الجهة المُسلِّمة</p>
                    <p className="font-bold text-sm text-[#17233D]">{transaction.senderName}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Notes */}
        {transaction.notes && (
          <div className="px-6 sm:px-8 pb-6">
            <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-slate-100 text-xs">
              <p className="font-bold text-slate-400 mb-1">ملاحظات</p>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{transaction.notes}</p>
            </div>
          </div>
        )}

        {/* Receipt Section */}
        {transaction.receiptUrl && (
          <div className="px-6 sm:px-8 pb-8">
            <div className="p-4 rounded-2xl border border-slate-100 bg-[#F7F9FC]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-[#17233D] flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#315BEB]" />
                  <span>الإيصال المرفق</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingReceiptUrl(transaction.receiptUrl || null)}
                    className="px-3 py-1.5 rounded-xl bg-[#315BEB] text-white text-xs font-bold hover:bg-[#2548cb] transition-colors"
                  >
                    معاينة
                  </button>
                  <a
                    href={transaction.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div 
                onClick={() => setViewingReceiptUrl(transaction.receiptUrl || null)}
                className="cursor-pointer max-h-60 overflow-hidden rounded-xl bg-white border border-slate-100 p-2 flex items-center justify-center"
              >
                {transaction.receiptUrl.includes('.pdf') ? (
                  <div className="py-6 flex flex-col items-center gap-1 text-slate-500">
                    <FileText className="w-10 h-10 text-[#315BEB]" />
                    <span className="text-xs font-bold">مستند PDF (انقر للعرض)</span>
                  </div>
                ) : (
                  <img
                    src={transaction.receiptUrl}
                    alt="معاينة الإيصال"
                    className="max-h-56 object-contain rounded-lg"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <TransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdate}
        editTransaction={transaction}
        openCustodies={custodies.filter(c => c.status === 'open')}
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
