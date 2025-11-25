import { create } from 'zustand';
import { Category, Transaction, RecurringRule, Reserve, ReserveTransaction } from './types';

// API URL - in production it will be relative, or we can use an env var
// If the backend is on the same host/port (e.g. via Nginx proxy), use relative path.
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface AppState {
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  reserves: Reserve[];
  
  loading: boolean;
  error: string | null;

  // Initialization
  fetchAllData: () => Promise<void>;

  // Transactions
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (id: string, t: Partial<Omit<Transaction, 'id' | 'created_at'>>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Categories
  addCategory: (c: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, c: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Rules
  addRecurringRule: (r: Omit<RecurringRule, 'id'>) => Promise<void>;

  // Reserves
  addReserve: (r: Omit<Reserve, 'id' | 'history'>) => Promise<void>;
  updateReserve: (id: string, r: Partial<Reserve>) => Promise<void>;
  deleteReserve: (id: string) => Promise<void>;
  addReserveTransaction: (reserveId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAW') => Promise<void>;
  
  // Helpers
  getBalance: () => number;
  getAvailableBalance: () => number;
}

export const useStore = create<AppState>((set, get) => ({
  categories: [],
  transactions: [],
  recurringRules: [],
  reserves: [],
  loading: false,
  error: null,

  fetchAllData: async () => {
    set({ loading: true, error: null });
    try {
      const [cats, trans, rules, res] = await Promise.all([
        fetch(`${API_URL}/categories`).then(r => r.json()),
        fetch(`${API_URL}/transactions`).then(r => r.json()),
        fetch(`${API_URL}/recurring_rules`).then(r => r.json()),
        fetch(`${API_URL}/reserves`).then(r => r.json())
      ]);
      set({
        categories: cats,
        transactions: trans,
        recurringRules: rules,
        reserves: res,
        loading: false
      });
    } catch (err) {
      console.error(err);
      set({ error: 'Failed to fetch data', loading: false });
    }
  },

  addTransaction: async (t) => {
    try {
        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t)
        });
        if (!response.ok) throw new Error('Failed to add transaction');
        const newTransaction = await response.json();
        set((state) => ({
            transactions: [newTransaction, ...state.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }));
    } catch (err) {
        console.error(err);
    }
  },

  updateTransaction: async (id, updatedT) => {
      try {
          const response = await fetch(`${API_URL}/transactions/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedT)
          });
          if (!response.ok) throw new Error('Failed to update transaction');
          const savedTransaction = await response.json();
          set((state) => ({
              transactions: state.transactions.map(t =>
                  t.id === id ? savedTransaction : t
              ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          }));
      } catch (err) {
          console.error(err);
      }
  },

  deleteTransaction: async (id) => {
      try {
          const response = await fetch(`${API_URL}/transactions/${id}`, {
              method: 'DELETE'
          });
          if (!response.ok) throw new Error('Failed to delete transaction');
          set((state) => ({
              transactions: state.transactions.filter(t => t.id !== id)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  addCategory: async (c) => {
      try {
          const response = await fetch(`${API_URL}/categories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(c)
          });
          if (!response.ok) throw new Error('Failed to add category');
          const newCategory = await response.json();
          set((state) => ({
              categories: [...state.categories, newCategory]
          }));
      } catch (err) {
          console.error(err);
      }
  },

  updateCategory: async (id, updatedC) => {
      // Note: Backend might need full object for PUT, but let's assume it handles partial or we merge.
      // My backend implementation uses create schema which needs all fields.
      // So I should fetch the category first or merge it in frontend.
      // Since I have the state, I can merge it.
      const currentCategory = get().categories.find(c => c.id === id);
      if (!currentCategory) return;

      const merged = { ...currentCategory, ...updatedC };
      // Remove id from merged if it's there, as backend expects Create schema
      const { id: _, ...payload } = merged;

      try {
          const response = await fetch(`${API_URL}/categories/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Failed to update category');
          const savedCategory = await response.json();
          set((state) => ({
              categories: state.categories.map(c => c.id === id ? savedCategory : c)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  deleteCategory: async (id) => {
      try {
          const response = await fetch(`${API_URL}/categories/${id}`, {
              method: 'DELETE'
          });
          if (!response.ok) throw new Error('Failed to delete category');
          set((state) => ({
              categories: state.categories.filter(c => c.id !== id)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  addRecurringRule: async (r) => {
      try {
          const response = await fetch(`${API_URL}/recurring_rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r)
          });
          if (!response.ok) throw new Error('Failed to add rule');
          const newRule = await response.json();
          set((state) => ({
              recurringRules: [...state.recurringRules, newRule]
          }));
      } catch (err) {
          console.error(err);
      }
  },

  addReserve: async (r) => {
      try {
          const response = await fetch(`${API_URL}/reserves`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r)
          });
          if (!response.ok) throw new Error('Failed to add reserve');
          const newReserve = await response.json();
          set((state) => ({
              reserves: [...state.reserves, newReserve]
          }));
      } catch (err) {
          console.error(err);
      }
  },

  updateReserve: async (id, updatedR) => {
      const currentReserve = get().reserves.find(r => r.id === id);
      if (!currentReserve) return;
      const merged = { ...currentReserve, ...updatedR };
      const { id: _, history: __, ...payload } = merged; // Remove id and history

      try {
          const response = await fetch(`${API_URL}/reserves/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Failed to update reserve');
          const savedReserve = await response.json();
          set((state) => ({
              reserves: state.reserves.map(r => r.id === id ? savedReserve : r)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  deleteReserve: async (id) => {
      try {
          const response = await fetch(`${API_URL}/reserves/${id}`, {
              method: 'DELETE'
          });
          if (!response.ok) throw new Error('Failed to delete reserve');
          set((state) => ({
              reserves: state.reserves.filter(r => r.id !== id)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  addReserveTransaction: async (reserveId, amount, type) => {
      try {
          const response = await fetch(`${API_URL}/reserves/${reserveId}/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount, type })
          });
          if (!response.ok) throw new Error('Failed to add reserve transaction');
          const updatedReserve = await response.json();
          set((state) => ({
              reserves: state.reserves.map(r => r.id === reserveId ? updatedReserve : r)
          }));
      } catch (err) {
          console.error(err);
      }
  },

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
