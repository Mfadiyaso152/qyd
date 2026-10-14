import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShoppingCart, 
  ArrowLeftRight, 
  Wallet, 
  Upload, 
  AlertCircle, 
  Check, 
  FileText, 
  Trash2 
} from 'lucide-react';
import { Transaction, TransactionType, PurchaseCategory, PaymentSource, Custody } from '../types';
import { toHalalas, fromHalalas, parseAmountInput } from '../utils/currencyUtils';
import { getTodayDateString, getCurrentTimeString } from '../utils/dateUtils';
import { storage, isConfigured } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactionData: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, editId?: string) => Promise<void>;
  editTransaction?: Transaction | null;
  openCustodies: Custody[];
  timezone: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editTransaction,
  openCustodies,
  timezone,
}) => {
  const [type, setType] = useState<TransactionType>('purchase');
  const [amountInput, setAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PurchaseCategory>('supplies');
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('bank');
  const [custodyId, setCustodyId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  
  // Custody specific
  const [custodyName, setCustodyName] = useState('');
  const [sourceEntity, setSourceEntity] = useState('');
  const [personName, setPersonName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [transactionDate, setTransactionDate] = useState(getTodayDateString(timezone));
  const [transactionTime, setTransactionTime] = useState(getCurrentTimeString(timezone));
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Idempotency token to prevent duplicate saves on accidental multi-clicks
  const submissionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setAmountInput(String(fromHalalas(editTransaction.amountHalalas)));
      setDescription(editTransaction.description);
      setCategory(editTransaction.category || 'supplies');
      setPaymentSource(editTransaction.paymentSource || 'personal');
      setCustodyId(editTransaction.custodyId || '');
      setSenderName(editTransaction.senderName || '');
      setRecipientName(editTransaction.recipientName || '');
      setPersonName(editTransaction.personName || '');
      setPhoneNumber(editTransaction.phoneNumber || '');
      setTransactionDate(editTransaction.transactionDate);
      setTransactionTime(editTransaction.transactionTime);
      setNotes(editTransaction.notes || '');
      setReceiptUrl(editTransaction.receiptUrl || '');
      if (editTransaction.type === 'custody') {
        setCustodyName(editTransaction.description);
        setSourceEntity(editTransaction.senderName || '');
      }
    } else {
      setType('purchase');
      setAmountInput('');
      setDescription('');
      setCategory('supplies');
      setPaymentSource('personal');
      setCustodyId(openCustodies[0]?.id || '');
      setSenderName('');
      setRecipientName('');
      setCustodyName('');
      setSourceEntity('');
      setPersonName('');
      setPhoneNumber('');
      setTransactionDate(getTodayDateString(timezone));
      setTransactionTime(getCurrentTimeString(timezone));
      setNotes('');
      setReceiptUrl('');
      setReceiptFile(null);
    }
    setError('');
    setIsDirty(false);
    submissionTokenRef.current = null;
  }, [editTransaction, isOpen, timezone, openCustodies]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('حجم الإيصال يجب ألا يتجاوز 5 ميجابايت');
        return;
      }
      setReceiptFile(file);
      setIsDirty(true);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      if (window.confirm('لديك تعديلات غير محفوظة، هل أنت متأكد من الإلغاء؟')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission
    setError('');

    const amount = parseAmountInput(amountInput);
    if (amount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    if (!description.trim() && type !== 'custody') {
      setError('وصف العملية مطلوب');
      return;
    }

    if (type === 'custody' && (!custodyName.trim() || !sourceEntity.trim())) {
      setError('اسم العهدة والجهة المسلِّمة مطلوبان');
      return;
    }

    if (type === 'purchase' && paymentSource === 'custody' && !custodyId) {
      setError('يرجى اختيار العهدة المفتوحة للدفع منها');
      return;
    }

    // Generate unique token for this submission
    submissionTokenRef.current = `${Date.now()}_${Math.random()}`;
    const token = submissionTokenRef.current;

    setLoading(true);

    try {
      let finalReceiptUrl = receiptUrl;
      let finalReceiptStoragePath = editTransaction?.receiptStoragePath || '';

      // Upload receipt if provided
      if (receiptFile) {
        try {
          if (isConfigured && storage) {
            const fileId = `${Date.now()}_${receiptFile.name.replace(/\s+/g, '_')}`;
            const storagePath = `receipts/${fileId}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, receiptFile);
            finalReceiptUrl = await getDownloadURL(storageRef);
            finalReceiptStoragePath = storagePath;
          } else {
            // Local fallback
            finalReceiptUrl = URL.createObjectURL(receiptFile);
            finalReceiptStoragePath = 'local';
          }
        } catch (uploadErr) {
          console.warn('Storage upload note:', uploadErr);
          // If storage bucket is not enabled or restricted, gracefully proceed
          finalReceiptUrl = URL.createObjectURL(receiptFile);
          finalReceiptStoragePath = 'local';
        }
      }

      // Check for concurrent token match
      if (submissionTokenRef.current !== token) return;

      const amountHalalas = toHalalas(amount);
      const finalDesc = type === 'custody' ? custodyName.trim() : description.trim();
      const finalSender = type === 'custody' ? sourceEntity.trim() : senderName.trim();

      // Check custody balance if paying from custody
      if (type === 'purchase' && paymentSource === 'custody' && custodyId) {
        const selectedCustody = openCustodies.find(c => c.id === custodyId);
        if (selectedCustody && amountHalalas > selectedCustody.remainingAmountHalalas) {
          setError(`المبلغ المطلوب (${amount} ر.س) يتجاوز الرصيد المتبقي في العهدة (${fromHalalas(selectedCustody.remainingAmountHalalas)} ر.س)`);
          setLoading(false);
          return;
        }
      }

      await onSave({
        type,
        amountHalalas,
        description: finalDesc,
        category: type === 'purchase' ? category : undefined,
        paymentSource: type === 'purchase' ? paymentSource : undefined,
        custodyId: type === 'purchase' && paymentSource === 'custody' ? custodyId : undefined,
        senderName: type === 'transfer' || type === 'custody' ? finalSender : undefined,
        recipientName: type === 'transfer' ? recipientName.trim() : undefined,
        personName: type === 'custody' ? (personName.trim() || undefined) : undefined,
        phoneNumber: type === 'custody' ? (phoneNumber.trim() || undefined) : undefined,
        transactionDate,
        transactionTime,
        timezone,
        occurredAt: new Date(`${transactionDate}T${transactionTime}:00`).getTime() || Date.now(),
        notes: notes.trim(),
        receiptUrl: finalReceiptUrl,
        receiptStoragePath: finalReceiptStoragePath,
      }, editTransaction?.id);

      onClose();
    } catch (err: any) {
      console.error('Save transaction error:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ العملية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-100 max-h-[92vh]">
        {/* Header matching Image 3 */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-[#17233D]">
            {editTransaction ? 'تعديل العملية' : 'إضافة عملية'}
          </h3>
          <button 
            onClick={handleCloseAttempt}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Segmented Type Selector matching Image 3 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">نوع العملية</label>
            <div className="grid grid-cols-3 gap-2 bg-[#F7F9FC] p-1 rounded-2xl border border-slate-100">
              <button
                type="button"
                onClick={() => { setType('purchase'); setIsDirty(true); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                  type === 'purchase'
                    ? 'bg-white text-[#315BEB] shadow-xs'
                    : 'text-slate-600 hover:text-[#17233D]'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>مشتريات</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('transfer'); setIsDirty(true); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                  type === 'transfer'
                    ? 'bg-white text-[#315BEB] shadow-xs'
                    : 'text-slate-600 hover:text-[#17233D]'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>تحويل</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('custody'); setIsDirty(true); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                  type === 'custody'
                    ? 'bg-white text-[#F4AE52] shadow-xs'
                    : 'text-slate-600 hover:text-[#17233D]'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>عهدة</span>
              </button>
            </div>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ (ريال) *</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => { setAmountInput(e.target.value); setIsDirty(true); }}
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-left font-mono font-bold text-xl text-[#17233D] focus:outline-none focus:border-[#315BEB] focus:ring-1 focus:ring-[#315BEB]"
              />
              <span className="absolute left-4 top-3.5 text-xs font-bold text-slate-400">ر.س</span>
            </div>
          </div>

          {/* Custody Specific: Name, Person, Phone, Source */}
          {type === 'custody' ? (
            <div className="space-y-3.5 p-4 rounded-2xl bg-[#FEF6E9] border border-amber-200/60">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم العهدة أو المشروع *</label>
                <input
                  type="text"
                  placeholder="مثال: عهدة المشتريات اليومية"
                  value={custodyName}
                  onChange={(e) => { setCustodyName(e.target.value); setIsDirty(true); }}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl border border-amber-200 bg-white text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الشخص المسؤول / المستلم *</label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد العتيبي"
                    value={personName}
                    onChange={(e) => { setPersonName(e.target.value); setIsDirty(true); }}
                    required
                    className="w-full px-4 py-2.5 rounded-2xl border border-amber-200 bg-white text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم جوال الشخص *</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="05XXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); setIsDirty(true); }}
                    required
                    className="w-full px-4 py-2.5 rounded-2xl border border-amber-200 bg-white text-sm text-right font-mono text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الجهة المُسلِّمة (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: الإدارة المالية أو الشركة"
                  value={sourceEntity}
                  onChange={(e) => { setSourceEntity(e.target.value); setIsDirty(true); }}
                  className="w-full px-4 py-2.5 rounded-2xl border border-amber-200 bg-white text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الوصف *</label>
              <input
                type="text"
                placeholder="مثال: مستلزمات مكتبية"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                required
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-[#17233D] focus:outline-none focus:border-[#315BEB]"
              />
            </div>
          )}

          {/* Purchase Specific: Category and Source */}
          {type === 'purchase' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F7F9FC] border border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">التصنيف</label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value as PurchaseCategory); setIsDirty(true); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#17233D]"
                >
                  <option value="supplies">مستلزمات</option>
                  <option value="food">طعام</option>
                  <option value="transport">مواصلات</option>
                  <option value="bills">فواتير</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">مصدر الدفع</label>
                <select
                  value={paymentSource}
                  onChange={(e) => { setPaymentSource(e.target.value as PaymentSource); setIsDirty(true); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#17233D]"
                >
                  <option value="bank">حساب البنك الرئيسي (خصم تلقائي)</option>
                  <option value="custody">من عهدة</option>
                  <option value="cash">نقدًا / كاش</option>
                  <option value="personal">شخصي</option>
                </select>
              </div>

              {paymentSource === 'bank' && (
                <div className="sm:col-span-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center gap-2 text-xs text-[#315BEB]">
                  <span className="w-2 h-2 rounded-full bg-[#315BEB] shrink-0" />
                  <span>سيتم خصم المبلغ تلقائيًا من رصيد حساب البنك الرئيسي وتوثيق تفاصيل العملية.</span>
                </div>
              )}

              {paymentSource === 'custody' && (
                <div className="sm:col-span-2 pt-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">اختر العهدة للدفع منها *</label>
                  <select
                    value={custodyId}
                    onChange={(e) => { setCustodyId(e.target.value); setIsDirty(true); }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#17233D]"
                    required
                  >
                    <option value="">-- اختر العهدة المفتوحة --</option>
                    {openCustodies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (المتبقي: {fromHalalas(c.remainingAmountHalalas)} ر.س)
                      </option>
                    ))}
                  </select>
                  {openCustodies.length === 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      لا توجد عُهد مفتوحة حالياً، يرجى إنشاء عهدة أولاً أو اختيار الدفع الشخصي.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transfer Specific */}
          {type === 'transfer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F7F9FC] border border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الطرف المرسل</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد"
                  value={senderName}
                  onChange={(e) => { setSenderName(e.target.value); setIsDirty(true); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-[#17233D]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الطرف المستلم</label>
                <input
                  type="text"
                  placeholder="مثال: المشروع أ"
                  value={recipientName}
                  onChange={(e) => { setRecipientName(e.target.value); setIsDirty(true); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-[#17233D]"
                />
              </div>
            </div>
          )}

          {/* Date & Time Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">التاريخ</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => { setTransactionDate(e.target.value); setIsDirty(true); }}
                className="w-full px-3 py-2 rounded-2xl border border-slate-200 text-xs text-[#17233D] font-mono focus:outline-none focus:border-[#315BEB]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الوقت</label>
              <input
                type="time"
                value={transactionTime}
                onChange={(e) => { setTransactionTime(e.target.value); setIsDirty(true); }}
                className="w-full px-3 py-2 rounded-2xl border border-slate-200 text-xs text-[#17233D] font-mono focus:outline-none focus:border-[#315BEB]"
              />
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات إضافية (اختياري)</label>
            <textarea
              rows={2}
              placeholder="أي تفاصيل أو ملاحظات إضافية..."
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
              className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs text-[#17233D] focus:outline-none focus:border-[#315BEB]"
            />
          </div>

          {/* Receipt Upload matching Image 3 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">إرفاق إيصال</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#315BEB] bg-[#F7F9FC] hover:bg-slate-50 cursor-pointer transition-all text-xs font-semibold text-slate-600">
                <Upload className="w-4 h-4 text-[#315BEB]" />
                <span className="truncate">{receiptFile ? receiptFile.name : 'إرفاق إيصال (صورة أو PDF)'}</span>
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,application/pdf" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>

              {(receiptFile || receiptUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFile(null);
                    setReceiptUrl('');
                    setIsDirty(true);
                  }}
                  className="p-3 text-rose-500 hover:text-rose-700 bg-rose-50 rounded-2xl hover:bg-rose-100 transition-colors"
                  title="إزالة الإيصال"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Submit Action: Full Width Cobalt Blue Button matching Image 3 */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>حفظ العملية</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
