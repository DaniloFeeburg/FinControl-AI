import { create } from 'zustand';
import { Category, Transaction, RecurringRule, Reserve, ReserveTransaction } from './types';
import { v4 as uuidv4 } from 'uuid';

// Mock initial data (Translated)
const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Salário', type: 'INCOME', is_fixed: true, color: '#10b981', icon: 'Wallet' },
  { id: '2', name: 'Moradia', type: 'EXPENSE', is_fixed: true, color: '#f43f5e', icon: 'Home' },
  { id: '3', name: 'Alimentação', type: 'EXPENSE', is_fixed: false, color: '#f59e0b', icon: 'Utensils' },
  { id: '4', name: 'Transporte', type: 'EXPENSE', is_fixed: false, color: '#3b82f6', icon: 'Car' },
  { id: '5', name: 'Freelance', type: 'INCOME', is_fixed: false, color: '#8b5cf6', icon: 'Laptop' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 't1', category_id: '1', amount: 500000, date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0], description: 'Salário Mensal', status: 'PAID', created_at: new Date().toISOString() },
  { id: 't2', category_id: '2', amount: -150000, date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], description: 'Aluguel', status: 'PAID', created_at: new Date().toISOString() },
  { id: 't3', category_id: '3', amount: -8500, date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], description: 'Supermercado', status: 'PAID', created_at: new Date().toISOString() },
];

const INITIAL_RULES: RecurringRule[] = [
  { id: 'r1', category_id: '2', amount: -150000, description: 'Pagamento Aluguel', rrule: 'FREQ=MONTHLY;BYMONTHDAY=5', active: true },
  { id: 'r2', category_id: '1', amount: 500000, description: 'Salário', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1', active: true },
  { id: 'r3', category_id: '4', amount: -20000, description: 'Internet', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15', active: true },
];

const INITIAL_RESERVES: Reserve[] = [
  { 
    id: 'res1', 
    name: 'Reserva de Emergência', 
    target_amount: 1000000, 
    current_amount: 250000, 
    deadline: '2024-12-31',
    history: [
      { id: 'rh1', date: new Date(Date.now() - 86400000 * 20).toISOString(), amount: 250000, type: 'DEPOSIT' }
    ]
  },
  { 
    id: 'res2', 
    name: 'Notebook Novo', 
    target_amount: 300000, 
    current_amount: 50000, 
    deadline: '2024-08-15',
    history: [
      { id: 'rh2', date: new Date(Date.now() - 86400000 * 5).toISOString(), amount: 50000, type: 'DEPOSIT' }
    ]
  },
];

interface AppState {
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  reserves: Reserve[];
  
  // Transactions
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => void;
  updateTransaction: (id: string, t: Partial<Omit<Transaction, 'id' | 'created_at'>>) => void;
  deleteTransaction: (id: string) => void;

  // Categories
  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, c: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;

  // Rules
  addRecurringRule: (r: Omit<RecurringRule, 'id'>) => void;

  // Reserves
  addReserve: (r: Omit<Reserve, 'id' | 'history'>) => void;
  updateReserve: (id: string, r: Partial<Reserve>) => void;
  deleteReserve: (id: string) => void;
  addReserveTransaction: (reserveId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAW') => void;
  
  // Helpers
  getBalance: () => number;
  getAvailableBalance: () => number; // Balance - Reserves
}

export const useStore = create<AppState>((set, get) => ({
  categories: INITIAL_CATEGORIES,
  transactions: INITIAL_TRANSACTIONS,
  recurringRules: INITIAL_RULES,
  reserves: INITIAL_RESERVES,

  // Transaction Actions
  addTransaction: (t) => set((state) => ({
    transactions: [
      { ...t, id: uuidv4(), created_at: new Date().toISOString() },
      ...state.transactions
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })),

  updateTransaction: (id, updatedT) => set((state) => ({
    transactions: state.transactions.map(t => 
      t.id === id ? { ...t, ...updatedT } : t
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })),

  deleteTransaction: (id) => set((state) => ({
    transactions: state.transactions.filter(t => t.id !== id)
  })),

  // Category Actions
  addCategory: (c) => set((state) => ({
    categories: [...state.categories, { ...c, id: uuidv4() }]
  })),

  updateCategory: (id, updatedC) => set((state) => ({
    categories: state.categories.map(c => c.id === id ? { ...c, ...updatedC } : c)
  })),

  deleteCategory: (id) => set((state) => ({
    categories: state.categories.filter(c => c.id !== id)
  })),

  // Rule Actions
  addRecurringRule: (r) => set((state) => ({
    recurringRules: [...state.recurringRules, { ...r, id: uuidv4() }]
  })),

  // Reserve Actions
  addReserve: (r) => set((state) => ({
    reserves: [...state.reserves, { ...r, id: uuidv4(), history: [] }]
  })),

  updateReserve: (id, updatedR) => set((state) => ({
    reserves: state.reserves.map(r => r.id === id ? { ...r, ...updatedR } : r)
  })),

  deleteReserve: (id) => set((state) => ({
    reserves: state.reserves.filter(r => r.id !== id)
  })),

  addReserveTransaction: (reserveId, amount, type) => set((state) => ({
    reserves: state.reserves.map(r => {
      if (r.id !== reserveId) return r;
      
      const newHistoryItem: ReserveTransaction = {
        id: uuidv4(),
        date: new Date().toISOString(),
        amount: amount,
        type: type
      };

      const newCurrentAmount = type === 'DEPOSIT' 
        ? r.current_amount + amount 
        : r.current_amount - amount;

      return {
        ...r,
        current_amount: newCurrentAmount,
        history: [newHistoryItem, ...r.history]
      };
    })
  })),

  // Helpers
  getBalance: () => {
    const { transactions } = get();
    return transactions.reduce((acc, t) => acc + t.amount, 0);
  },

  getAvailableBalance: () => {
    const balance = get().getBalance();
    const reservesTotal = get().reserves.reduce((acc, r) => acc + r.current_amount, 0);
    return balance - reservesTotal;
  }
}));