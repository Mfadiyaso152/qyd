/**
 * Data Store Service for Qayd
 * Supports both Cloud Firestore and local Developer Demo mode seamlessly.
 */
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { Transaction, Custody, CustodyMovement } from '../types';
import { getTodayDateString } from '../utils/dateUtils';

export const DEV_USER_ID = 'dev-demo-user-123';

// Empty initial state - NO FAKE DATA
const getInitialSeedData = () => {
  return { 
    transactions: [] as Transaction[], 
    custodies: [] as Custody[], 
    movements: [] as CustodyMovement[] 
  };
};

// Clean any old demo data from previous runs if any
if (typeof window !== 'undefined') {
  try {
    const existingTxs = localStorage.getItem('qayd_dev_transactions');
    if (existingTxs && existingTxs.includes('demo-tx-1')) {
      localStorage.removeItem('qayd_dev_transactions');
      localStorage.removeItem('qayd_dev_custodies');
      localStorage.removeItem('qayd_dev_movements');
    }
  } catch {
    // Ignore storage issues
  }
}

// Local storage management for dev demo mode
function getDevStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setDevStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Local storage write error:', err);
  }
}

// In-memory / localStorage subscribers
type Listener = () => void;
const subscribers: Set<Listener> = new Set();
function notifySubscribers() {
  subscribers.forEach(cb => cb());
}

export function subscribeDevStore(callback: Listener) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getDevTransactions(): Transaction[] {
  const seed = getInitialSeedData();
  const txs = getDevStorage<Transaction[]>('qayd_dev_transactions', seed.transactions);
  return txs;
}

export function getDevCustodies(): Custody[] {
  const seed = getInitialSeedData();
  return getDevStorage<Custody[]>('qayd_dev_custodies', seed.custodies);
}

export function getDevMovements(): CustodyMovement[] {
  const seed = getInitialSeedData();
  return getDevStorage<CustodyMovement[]>('qayd_dev_movements', seed.movements);
}

export async function saveDevTransaction(
  data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  editId?: string
): Promise<void> {
  const txs = getDevTransactions();
  const custodies = getDevCustodies();
  const movements = getDevMovements();
  const now = Date.now();

  if (editId) {
    const updated = txs.map(t => {
      if (t.id === editId) {
        return {
          ...t,
          ...data,
          updatedAt: now,
        };
      }
      return t;
    });
    setDevStorage('qayd_dev_transactions', updated);
  } else {
    const newTxId = `demo-tx-${Date.now()}`;
    const newTx: Transaction = {
      ...data,
      id: newTxId,
      userId: DEV_USER_ID,
      createdAt: now,
      updatedAt: now,
    };
    txs.unshift(newTx);
    setDevStorage('qayd_dev_transactions', txs);

    // If type is custody, create custody
    if (data.type === 'custody') {
      const newCustody: Custody = {
        id: `demo-custody-${Date.now()}`,
        userId: DEV_USER_ID,
        name: data.description,
        sourceEntity: data.senderName || 'الجهة المالية',
        initialAmountHalalas: data.amountHalalas,
        remainingAmountHalalas: data.amountHalalas,
        status: 'open',
        createdAt: now,
      };
      custodies.push(newCustody);
      setDevStorage('qayd_dev_custodies', custodies);

      movements.push({
        id: `demo-mov-${Date.now()}`,
        userId: DEV_USER_ID,
        custodyId: newCustody.id,
        type: 'receive',
        amountHalalas: data.amountHalalas,
        description: 'استلام أولي',
        date: data.transactionDate,
        createdAt: now,
      });
      setDevStorage('qayd_dev_movements', movements);
    }

    // If purchase from custody, deduct balance
    if (data.type === 'purchase' && data.paymentSource === 'custody' && data.custodyId) {
      const targetCustody = custodies.find(c => c.id === data.custodyId);
      if (targetCustody) {
        targetCustody.remainingAmountHalalas = Math.max(0, targetCustody.remainingAmountHalalas - data.amountHalalas);
        setDevStorage('qayd_dev_custodies', custodies);

        movements.push({
          id: `demo-mov-${Date.now()}`,
          userId: DEV_USER_ID,
          custodyId: data.custodyId,
          type: 'purchase',
          amountHalalas: data.amountHalalas,
          description: data.description,
          transactionId: newTxId,
          date: data.transactionDate,
          createdAt: now,
        });
        setDevStorage('qayd_dev_movements', movements);
      }
    }
  }

  notifySubscribers();
}

export async function deleteDevTransaction(tx: Transaction): Promise<void> {
  let txs = getDevTransactions();
  txs = txs.filter(t => t.id !== tx.id);
  setDevStorage('qayd_dev_transactions', txs);

  // Restore custody balance if needed
  if (tx.type === 'purchase' && tx.paymentSource === 'custody' && tx.custodyId) {
    const custodies = getDevCustodies();
    const target = custodies.find(c => c.id === tx.custodyId);
    if (target) {
      target.remainingAmountHalalas += tx.amountHalalas;
      setDevStorage('qayd_dev_custodies', custodies);
    }
  }

  notifySubscribers();
}

export async function refundDevCustody(
  custodyId: string,
  amountHalalas: number,
  description: string,
  date: string
): Promise<void> {
  const custodies = getDevCustodies();
  const movements = getDevMovements();
  const target = custodies.find(c => c.id === custodyId);
  if (!target) return;

  target.remainingAmountHalalas = Math.max(0, target.remainingAmountHalalas - amountHalalas);
  setDevStorage('qayd_dev_custodies', custodies);

  movements.push({
    id: `demo-mov-${Date.now()}`,
    userId: DEV_USER_ID,
    custodyId,
    type: 'refund',
    amountHalalas,
    description,
    date,
    createdAt: Date.now(),
  });
  setDevStorage('qayd_dev_movements', movements);

  notifySubscribers();
}

export async function closeDevCustody(custodyId: string): Promise<void> {
  const custodies = getDevCustodies();
  const target = custodies.find(c => c.id === custodyId);
  if (target) {
    target.status = 'closed';
    target.closedAt = Date.now();
    setDevStorage('qayd_dev_custodies', custodies);
    notifySubscribers();
  }
}

export async function deleteDevCustody(custodyId: string): Promise<void> {
  let custodies = getDevCustodies();
  custodies = custodies.filter(c => c.id !== custodyId);
  setDevStorage('qayd_dev_custodies', custodies);
  notifySubscribers();
}
