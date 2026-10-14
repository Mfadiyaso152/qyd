export type TransactionType = 'purchase' | 'transfer' | 'custody';

export type PurchaseCategory = 'food' | 'transport' | 'supplies' | 'bills' | 'other';

export type PaymentSource = 'bank' | 'custody' | 'cash' | 'personal';

export interface BankAccount {
  userId: string;
  accountName: string;
  initialBalanceHalalas: number;
  currentBalanceHalalas: number;
  updatedAt: number;
}

export type BankTransactionType = 'deposit' | 'withdrawal' | 'adjustment';

export interface BankTransaction {
  id: string;
  userId: string;
  type: BankTransactionType;
  amountHalalas: number;
  source: string; // من وين جا المبلغ (دفعة مشروع، إيداع نقدي، تحويل عميل، دفعة مستحقات، إلخ)
  description: string;
  transactionDate: string; // YYYY-MM-DD
  transactionTime: string; // HH:mm
  occurredAt: number;
  balanceAfterHalalas: number;
  relatedTransactionId?: string;
  notes?: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amountHalalas: number;
  description: string;
  category?: PurchaseCategory;
  paymentSource?: PaymentSource;
  custodyId?: string;
  senderName?: string;
  recipientName?: string;
  personName?: string; // اسم الشخص المسؤول أو المستلم
  phoneNumber?: string; // رقم الجوال للتواصل
  transactionDate: string; // YYYY-MM-DD
  transactionTime: string; // HH:mm
  timezone: string;
  occurredAt: number;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  receiptStoragePath?: string;
  receiptUrl?: string;
}

export interface Custody {
  id: string;
  userId: string;
  name: string;
  sourceEntity: string;
  personName?: string; // اسم الشخص المستلم أو المسؤول عن العهدة
  phoneNumber?: string; // رقم جوال الشخص
  initialAmountHalalas: number;
  remainingAmountHalalas: number;
  status: 'open' | 'closed';
  createdAt: number;
  closedAt?: number;
  notes?: string;
}

export interface CustodyMovement {
  id: string;
  userId: string;
  custodyId: string;
  type: 'receive' | 'purchase' | 'refund';
  amountHalalas: number;
  description: string;
  transactionId?: string;
  date: string;
  createdAt: number;
  notes?: string;
}

export interface UserSettings {
  numberFormat: 'arabic' | 'english';
  timezone: string;
  weekStart: 'saturday' | 'sunday' | 'monday';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  settings: UserSettings;
}
