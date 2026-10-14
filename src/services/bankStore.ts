import { db } from './firebase';
import { 
  doc, 
  collection, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { BankAccount, BankTransaction } from '../types';
import * as XLSX from 'xlsx';
import { fromHalalas } from '../utils/currencyUtils';

const DEFAULT_BANK_DOC = 'main';

/**
 * Subscribe to the user's main bank account document.
 */
export const subscribeToBankAccount = (
  userId: string, 
  onUpdate: (account: BankAccount | null) => void,
  onError?: (err: any) => void
) => {
  const docRef = doc(db, `users/${userId}/bankAccount`, DEFAULT_BANK_DOC);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as BankAccount);
    } else {
      onUpdate(null);
    }
  }, onError);
};

/**
 * Subscribe to the bank transactions (movements).
 */
export const subscribeToBankTransactions = (
  userId: string,
  onUpdate: (transactions: BankTransaction[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, `users/${userId}/bankTransactions`);
  // Subscribe and sort in-memory to prevent composite index blocking
  return onSnapshot(colRef, (snap) => {
    const list: BankTransaction[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as BankTransaction);
    });
    list.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
    onUpdate(list);
  }, onError);
};

/**
 * Set or adjust the main bank account starting/current balance.
 */
export const setBankBalance = async (
  userId: string, 
  newBalanceHalalas: number, 
  accountName: string = 'حساب البنك الرئيسي',
  reason?: string
) => {
  const now = Date.now();
  const docRef = doc(db, `users/${userId}/bankAccount`, DEFAULT_BANK_DOC);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    // Initial bank setup
    const newAccount: BankAccount = {
      userId,
      accountName,
      initialBalanceHalalas: newBalanceHalalas,
      currentBalanceHalalas: newBalanceHalalas,
      updatedAt: now,
    };
    await setDoc(docRef, newAccount);

    // Add initial adjustment record
    const colRef = collection(db, `users/${userId}/bankTransactions`);
    await addDoc(colRef, {
      userId,
      type: 'adjustment',
      amountHalalas: newBalanceHalalas,
      source: 'افتتاحي',
      description: 'تعيين الرصيد الافتتاحي للبنك',
      transactionDate: new Date().toISOString().split('T')[0],
      transactionTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      occurredAt: now,
      balanceAfterHalalas: newBalanceHalalas,
      notes: reason || 'تحديد رصيد البنك الأساسي',
      createdAt: now,
    });
  } else {
    // Update balance
    const existing = snap.data() as BankAccount;
    const diff = newBalanceHalalas - existing.currentBalanceHalalas;

    await updateDoc(docRef, {
      accountName,
      currentBalanceHalalas: newBalanceHalalas,
      updatedAt: now,
    });

    // Record adjustment
    const colRef = collection(db, `users/${userId}/bankTransactions`);
    await addDoc(colRef, {
      userId,
      type: 'adjustment',
      amountHalalas: Math.abs(diff),
      source: 'تعديل رصيد',
      description: diff >= 0 ? 'تعديل رصيد البنك (زيادة)' : 'تعديل رصيد البنك (تخفيض)',
      transactionDate: new Date().toISOString().split('T')[0],
      transactionTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      occurredAt: now,
      balanceAfterHalalas: newBalanceHalalas,
      notes: reason || 'تعديل يدوي للرصيد الأساسي',
      createdAt: now,
    });
  }
};

/**
 * Add a deposit or money-in operation to the bank account.
 */
export const addBankDeposit = async (
  userId: string,
  params: {
    amountHalalas: number;
    source: string; // من وين جا المبلغ (دفعة مشروع، إيداع، إلخ)
    description: string;
    transactionDate: string;
    transactionTime: string;
    notes?: string;
  }
) => {
  const now = Date.now();
  const docRef = doc(db, `users/${userId}/bankAccount`, DEFAULT_BANK_DOC);
  const snap = await getDoc(docRef);

  let currentBalance = 0;
  if (snap.exists()) {
    currentBalance = (snap.data() as BankAccount).currentBalanceHalalas || 0;
  }

  const newBalance = currentBalance + params.amountHalalas;

  // 1. Update bank balance
  await setDoc(docRef, {
    userId,
    accountName: snap.exists() ? (snap.data() as BankAccount).accountName : 'حساب البنك الرئيسي',
    initialBalanceHalalas: snap.exists() ? (snap.data() as BankAccount).initialBalanceHalalas : 0,
    currentBalanceHalalas: newBalance,
    updatedAt: now,
  }, { merge: true });

  // 2. Add bank movement transaction
  const colRef = collection(db, `users/${userId}/bankTransactions`);
  const [y, m, d] = params.transactionDate.split('-').map(Number);
  const [hh, mm] = (params.transactionTime || '12:00').split(':').map(Number);
  const occurredAt = new Date(y, m - 1, d, hh, mm).getTime() || now;

  const docAdded = await addDoc(colRef, {
    userId,
    type: 'deposit',
    amountHalalas: params.amountHalalas,
    source: params.source,
    description: params.description,
    transactionDate: params.transactionDate,
    transactionTime: params.transactionTime,
    occurredAt,
    balanceAfterHalalas: newBalance,
    notes: params.notes || '',
    createdAt: now,
  });

  return docAdded.id;
};

/**
 * Deduct a purchase automatically from the bank account.
 */
export const deductBankPurchase = async (
  userId: string,
  params: {
    amountHalalas: number;
    description: string;
    transactionDate: string;
    transactionTime: string;
    relatedTransactionId: string;
  }
) => {
  const now = Date.now();
  const docRef = doc(db, `users/${userId}/bankAccount`, DEFAULT_BANK_DOC);
  const snap = await getDoc(docRef);

  let currentBalance = 0;
  if (snap.exists()) {
    currentBalance = (snap.data() as BankAccount).currentBalanceHalalas || 0;
  }

  const newBalance = currentBalance - params.amountHalalas;

  await setDoc(docRef, {
    userId,
    accountName: snap.exists() ? (snap.data() as BankAccount).accountName : 'حساب البنك الرئيسي',
    initialBalanceHalalas: snap.exists() ? (snap.data() as BankAccount).initialBalanceHalalas : 0,
    currentBalanceHalalas: newBalance,
    updatedAt: now,
  }, { merge: true });

  // Add bank movement record
  const colRef = collection(db, `users/${userId}/bankTransactions`);
  const [y, m, d] = params.transactionDate.split('-').map(Number);
  const [hh, mm] = (params.transactionTime || '12:00').split(':').map(Number);
  const occurredAt = new Date(y, m - 1, d, hh, mm).getTime() || now;

  await addDoc(colRef, {
    userId,
    type: 'withdrawal',
    amountHalalas: params.amountHalalas,
    source: 'خصم مشتريات',
    description: `شراء: ${params.description}`,
    transactionDate: params.transactionDate,
    transactionTime: params.transactionTime,
    occurredAt,
    balanceAfterHalalas: newBalance,
    relatedTransactionId: params.relatedTransactionId,
    createdAt: now,
  });
};

/**
 * Restore bank balance when a purchase paid via bank is deleted or reverted.
 */
export const revertBankPurchase = async (
  userId: string,
  amountHalalas: number,
  relatedTransactionId: string
) => {
  const now = Date.now();
  const docRef = doc(db, `users/${userId}/bankAccount`, DEFAULT_BANK_DOC);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    const currentBalance = (snap.data() as BankAccount).currentBalanceHalalas || 0;
    const newBalance = currentBalance + amountHalalas;
    await updateDoc(docRef, {
      currentBalanceHalalas: newBalance,
      updatedAt: now,
    });
  }
};

/**
 * Export full bank account report to Excel (.xlsx).
 */
export const exportBankToExcel = (
  account: BankAccount | null,
  transactions: BankTransaction[],
  userName: string = 'المستخدم'
) => {
  const wb = XLSX.utils.book_new();

  // Prepare metadata header rows
  const headerData = [
    ['منصة قَيد - كشف حساب البنك الرئيسي'],
    [`اسم الحساب:`, account?.accountName || 'حساب البنك الرئيسي'],
    [`صاحب الحساب:`, userName],
    [`تاريخ استخراج التقرير:`, new Date().toLocaleDateString('ar-SA')],
    [`الرصيد الفعلي الحالي:`, `${fromHalalas(account?.currentBalanceHalalas || 0)} ر.س`],
    [], // empty row
    [
      'التاريخ',
      'الوقت',
      'نوع العملية',
      'مصدر المبلغ / من وين جا',
      'البيان / الوصف',
      'المبلغ الوارد / إيداع (ر.س)',
      'المبلغ المنصرف / شراء (ر.س)',
      'الرصيد بعد العملية (ر.س)',
      'الملاحظات'
    ]
  ];

  // Prepare data rows (chronological for bank statement)
  const sorted = [...transactions].sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));

  const rows = sorted.map((tx) => {
    const isDeposit = tx.type === 'deposit';
    const isWithdrawal = tx.type === 'withdrawal';
    const isAdjustment = tx.type === 'adjustment';

    const typeLabel = isDeposit ? 'إيداع / دفعة' : isWithdrawal ? 'خصم مشتريات' : 'تعديل رصيد';
    const depositAmount = isDeposit ? fromHalalas(tx.amountHalalas) : (isAdjustment ? fromHalalas(tx.amountHalalas) : '-');
    const withdrawalAmount = isWithdrawal ? fromHalalas(tx.amountHalalas) : '-';

    return [
      tx.transactionDate,
      tx.transactionTime,
      typeLabel,
      tx.source || 'غير محدد',
      tx.description,
      depositAmount,
      withdrawalAmount,
      fromHalalas(tx.balanceAfterHalalas || 0),
      tx.notes || ''
    ];
  });

  const fullSheetData = [...headerData, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(fullSheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Date
    { wch: 10 }, // Time
    { wch: 16 }, // Type
    { wch: 22 }, // Source (من وين جا)
    { wch: 32 }, // Description
    { wch: 20 }, // Deposit
    { wch: 20 }, // Withdrawal
    { wch: 20 }, // Balance After
    { wch: 28 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'كشف حساب البنك');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `كشف_حساب_البنك_الرئيسي_${todayStr}.xlsx`);
};
