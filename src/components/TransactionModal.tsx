/**
 * Add / Edit Transaction Modal Component
 */
import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, ArrowLeftRight, ShieldCheck, Upload, AlertCircle, Check } from 'lucide-react';
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
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('personal');
  const [custodyId, setCustodyId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  
  // Custody creation specific fields (when type === 'custody' in modal)
  const [custodyName, setCustodyName] = useState('');
  const [sourceEntity, setSourceEntity] = useState('');

  const [transactionDate, setTransactionDate] = useState(getTodayDateString(timezone));
  const [transactionTime, setTransactionTime] = useState(getCurrentTimeString(timezone));
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

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
      setTransactionDate(getTodayDateString(timezone));
      setTransactionTime(getCurrentTimeString(timezone));
      setNotes('');
      setReceiptUrl('');
      setReceiptFile(null);
    }
    setError('');
    setHasChanges(false);
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
      setHasChanges(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseAmountInput(amountInput);
    if (amount <= 0) {
      setError('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }

    if (!description.trim() && type !== 'custody') {
      setError('وصف العملية مطلوب');
      return;
    }

    if (type === 'custody' && (!custodyName.trim() || !sourceEntity.trim())) {
      setError('اسم العهدة والجهة المسلمة مطلوبان');
      return;
    }

    if (paymentSource === 'custody' && !custodyId) {
      setError('يرجى اختيار العهدة المفتوحة خصماً منها');
      return;
    }

    setLoading(true);

    try {
      let finalReceiptUrl = receiptUrl;
      let finalReceiptStoragePath = editTransaction?.receiptStoragePath || '';

      if (receiptFile) {
        if (isConfigured) {
          const fileId = `${Date.now()}_${receiptFile.name}`;
          const storagePath = `receipts/${fileId}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, receiptFile);
          finalReceiptUrl = await getDownloadURL(storageRef);
          finalReceiptStoragePath = storagePath;
        } else {
          finalReceiptUrl = URL.createObjectURL(receiptFile);
          finalReceiptStoragePath = 'local-preview';
        }
      }

      const amountHalalas = toHalalas(amount);
      const finalDesc = type === 'custody' ? custodyName : description;
      const finalSender = type === 'custody' ? sourceEntity : senderName;

      // Check custody balance if paying from custody
      if (type === 'purchase' && paymentSource === 'custody' && custodyId) {
        const selectedCustody = openCustodies.find(c => c.id === custodyId);
        if (selectedCustody && amountHalalas > selectedCustody.remainingAmountHalalas) {
          setError(`المبلغ المطلوب (${amount} ر.س) يتجاوز المتبقي في العهدة (${fromHalalas(selectedCustody.remainingAmountHalalas)} ر.س)`);
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
        recipientName: type === 'transfer' ? recipientName : undefined,
        transactionDate,
        transactionTime,
        timezone,
        occurredAt: new Date(`${transactionDate}T${transactionTime}:00`).getTime(),
        notes,
        receiptUrl: finalReceiptUrl,
        receiptStoragePath: finalReceiptStoragePath,
      }, editTransaction?.id);

      onClose();
    } catch (err: any) {
      console.error('Save transaction error:', err);
      setError(err.message || 'فشل حفظ العملية');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAttempt = () => {
    if (hasChanges) {
      if (window.confirm('لديك تعديلات غير محفوظة. هل تريد الخروج حقاً؟')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#142B36] text-white flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            {editTransaction ? 'تعديل العملية المالية' : 'إضافة عملية جديدة'}
          </h3>
          <button 
            onClick={handleCloseAttempt}
            className="p-2 bg-white/10 hover:bg-rose-500/80 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Transaction Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">نوع العملية</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setType('purchase'); setHasChanges(true); }}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition-all ${
                  type === 'purchase'
                    ? 'bg-[#367C73] text-white border-[#367C73] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>مشتريات</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('transfer'); setHasChanges(true); }}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition-all ${
                  type === 'transfer'
                    ? 'bg-[#367C73] text-white border-[#367C73] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>تحويل</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('custody'); setHasChanges(true); }}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition-all ${
                  type === 'custody'
                    ? 'bg-[#D99A32] text-white border-[#D99A32] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>عهدة جديدة</span>
              </button>
            </div>
          </div>

          {/* Amount and Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">المبلغ (ريال سعودي) *</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => { setAmountInput(e.target.value); setHasChanges(true); }}
                  required
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#367C73] focus:border-transparent text-left font-mono font-bold text-lg"
                />
                <span className="absolute left-4 top-3 text-slate-400 font-semibold text-sm">ر.س</span>
              </div>
            </div>

            {type === 'custody' ? (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم العهدة أو المشروع *</label>
                <input
                  type="text"
                  placeholder="مثال: عهدة مشروع المؤتمر"
                  value={custodyName}
                  onChange={(e) => { setCustodyName(e.target.value); setHasChanges(true); }}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#367C73] focus:border-transparent"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">وصف العملية *</label>
                <input
                  type="text"
                  placeholder="مثال: مستلزمات مكتبية"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#367C73] focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Purchase Specific Fields */}
          {type === 'purchase' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => { setCategory(e.target.value as PurchaseCategory); setHasChanges(true); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    <option value="supplies">مستلزمات</option>
                    <option value="food">طعام</option>
                    <option value="transport">مواصلات</option>
                    <option value="bills">فواتير</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">مصدر الدفع</label>
                  <select
                    value={paymentSource}
                    onChange={(e) => { setPaymentSource(e.target.value as PaymentSource); setHasChanges(true); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    <option value="personal">شخصي</option>
                    <option value="custody">من عهدة</option>
                  </select>
                </div>
              </div>

              {paymentSource === 'custody' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اختر العهدة المفتوحة *</label>
                  <select
                    value={custodyId}
                    onChange={(e) => { setCustodyId(e.target.value); setHasChanges(true); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    required
                  >
                    <option value="">-- اختر العهدة --</option>
                    {openCustodies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (المتبقي: {fromHalalas(c.remainingAmountHalalas)} ر.س)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Transfer Specific Fields */}
          {type === 'transfer' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم المرسل</label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد محمد"
                    value={senderName}
                    onChange={(e) => { setSenderName(e.target.value); setHasChanges(true); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم المستلم</label>
                  <input
                    type="text"
                    placeholder="مثال: شركة توريدات"
                    value={recipientName}
                    onChange={(e) => { setRecipientName(e.target.value); setHasChanges(true); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                ملاحظة: التحويل يُسجّل في قسم التحويلات ولا يُحسب تلقائيًا كمشتريات.
              </p>
            </div>
          )}

          {/* Custody Creation Specific Fields */}
          {type === 'custody' && (
            <div className="space-y-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الجهة أو الشخص الذي سلّم المبلغ *</label>
                <input
                  type="text"
                  placeholder="مثال: الإدارة المالية"
                  value={sourceEntity}
                  onChange={(e) => { setSourceEntity(e.target.value); setHasChanges(true); }}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <p className="text-xs text-amber-800">
                استلام العهدة يُنشئ رصيداً مستقلاً للمتابعة ولا يُعد شراءً.
              </p>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">التاريخ</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => { setTransactionDate(e.target.value); setHasChanges(true); }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#367C73] focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">الوقت</label>
              <input
                type="time"
                value={transactionTime}
                onChange={(e) => { setTransactionTime(e.target.value); setHasChanges(true); }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#367C73] focus:border-transparent text-sm font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">ملاحظات إضافية (اختياري)</label>
            <textarea
              rows={2}
              placeholder="ملاحظات تفصيلية..."
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setHasChanges(true); }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#367C73] focus:border-transparent text-sm"
            />
          </div>

          {/* Receipt Attachment */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">إرفاق إيصال (صورة أو PDF بحد أقصى 5 ميجابايت)</label>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#367C73] bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all text-sm text-slate-600 font-medium">
                <Upload className="w-5 h-5 text-[#367C73]" />
                <span>{receiptFile ? receiptFile.name : 'اختر ملف الإيصال...'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
              </label>
              {receiptUrl && !receiptFile && (
                <a 
                  href={receiptUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  عرض الحالي
                </a>
              )}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseAttempt}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#367C73] text-white font-semibold hover:bg-[#2b635b] transition-colors shadow-md flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>حفظ العملية</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
