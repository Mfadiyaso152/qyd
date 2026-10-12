export type TransactionType = 'purchase' | 'transfer' | 'custody';

export type PurchaseCategory = 'food' | 'transport' | 'supplies' | 'bills' | 'other';

export type PaymentSource = 'personal' | 'custody';

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
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  settings: UserSettings;
}
