import { create } from 'zustand';
import { Category, Transaction, RecurringRule, Reserve, ReserveTransaction, User } from './types';

// API URL - in production it will be relative, or we can use an env var
// If the backend is on the same host/port (e.g. via Nginx proxy), use relative path.
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;

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

const getAuthHeaders = (token: string | null) => {
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  categories: [],
  transactions: [],
  recurringRules: [],
  reserves: [],
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) throw new Error('Falha no login');
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        set({ token: data.access_token, isAuthenticated: true });

        await get().checkAuth();
    } catch (err: any) {
        set({ error: err.message, loading: false });
        throw err;
    }
  },

  register: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        if (!response.ok) throw new Error('Falha no registro');
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        set({ token: data.access_token, isAuthenticated: true });

        await get().checkAuth();
    } catch (err: any) {
        set({ error: err.message, loading: false });
        throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, categories: [], transactions: [], recurringRules: [], reserves: [] });
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        });
        if (!response.ok) {
            get().logout();
            return;
        }
        const user = await response.json();
        set({ user, isAuthenticated: true });
        await get().fetchAllData();
    } catch (err) {
        get().logout();
    }
  },

  fetchAllData: async () => {
    const { isAuthenticated, token } = get();
    if (!isAuthenticated || !token) return;

    set({ loading: true, error: null });
    try {
      const headers = getAuthHeaders(token);
      const [cats, trans, rules, res] = await Promise.all([
        fetch(`${API_URL}/categories`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/transactions`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/recurring_rules`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/reserves`, { headers }).then(r => r.json())
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
        const token = get().token;
        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: getAuthHeaders(token),
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
          const token = get().token;
          const response = await fetch(`${API_URL}/transactions/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
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
          const token = get().token;
          const response = await fetch(`${API_URL}/transactions/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
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
          const token = get().token;
          const response = await fetch(`${API_URL}/categories`, {
              method: 'POST',
              headers: getAuthHeaders(token),
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
      const currentCategory = get().categories.find(c => c.id === id);
      if (!currentCategory) return;

      const merged = { ...currentCategory, ...updatedC };
      const { id: _, ...payload } = merged;

      try {
          const token = get().token;
          const response = await fetch(`${API_URL}/categories/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
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
          const token = get().token;
          const response = await fetch(`${API_URL}/categories/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
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
          const token = get().token;
          const response = await fetch(`${API_URL}/recurring_rules`, {
              method: 'POST',
              headers: getAuthHeaders(token),
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
          const token = get().token;
          const response = await fetch(`${API_URL}/reserves`, {
              method: 'POST',
              headers: getAuthHeaders(token),
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
      const { id: _, history: __, ...payload } = merged;

      try {
          const token = get().token;
          const response = await fetch(`${API_URL}/reserves/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
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
          const token = get().token;
          const response = await fetch(`${API_URL}/reserves/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
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
          const token = get().token;
          const response = await fetch(`${API_URL}/reserves/${reserveId}/transactions`, {
              method: 'POST',
              headers: getAuthHeaders(token),
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
