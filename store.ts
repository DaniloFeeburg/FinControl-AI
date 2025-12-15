import { create } from 'zustand';
import { Category, Transaction, RecurringRule, Reserve, ReserveTransaction, User, CreditCard } from './types';

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
  creditCards: CreditCard[];
  
  loading: boolean;
  error: string | null;

  // Initialization
  fetchAllData: () => Promise<void>;

  // Transactions
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (id: string, t: Partial<Omit<Transaction, 'id' | 'created_at'>>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Categories
  addCategory: (c: Omit<Category, 'id'>) => Promise<Category | undefined>;
  updateCategory: (id: string, c: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Rules
  addRecurringRule: (r: Omit<RecurringRule, 'id'>) => Promise<void>;
  updateRecurringRule: (id: string, r: Partial<Omit<RecurringRule, 'id'>>) => Promise<void>;
  deleteRecurringRule: (id: string) => Promise<void>;

  // Reserves
  addReserve: (r: Omit<Reserve, 'id' | 'history'>) => Promise<void>;
  updateReserve: (id: string, r: Partial<Reserve>) => Promise<void>;
  deleteReserve: (id: string) => Promise<void>;
  addReserveTransaction: (reserveId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAW') => Promise<void>;

  // Credit Cards
  addCreditCard: (c: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCreditCard: (id: string, c: Partial<Omit<CreditCard, 'id'>>) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;
  
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

// Helper function to handle fetch with 401 interception
const authorizedFetch = async (url: string, options: RequestInit, logout: () => void) => {
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            logout();
            throw new Error('Sessão expirada');
        }
        return response;
    } catch (error) {
        throw error;
    }
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  categories: [],
  transactions: [],
  recurringRules: [],
  reserves: [],
  creditCards: [],
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
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.detail || 'Falha no login');
        }
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
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.detail || 'Falha no registro');
        }
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
    localStorage.clear(); // Clear all data as requested
    set({ user: null, token: null, isAuthenticated: false, categories: [], transactions: [], recurringRules: [], reserves: [], creditCards: [] });
    // Force reload to clear any memory states if needed, or just redirect
    window.location.hash = '#/login';
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) return;

    try {
        const response = await authorizedFetch(`${API_URL}/auth/me`, {
            method: 'POST',
            headers: getAuthHeaders(token)
        }, get().logout);

        if (!response.ok) {
             // If we get here, it wasn't a 401 (caught by authorizedFetch), but some other error
             get().logout();
             return;
        }
        const user = await response.json();
        set({ user, isAuthenticated: true });
        await get().fetchAllData();
    } catch (err) {
        // If authorizedFetch throws 401, it calls logout.
        // We catch here to avoid unhandled promise rejection.
        console.error("Check auth failed", err);
    }
  },

  fetchAllData: async () => {
    const { isAuthenticated, token } = get();
    if (!isAuthenticated || !token) return;

    set({ loading: true, error: null });
    try {
      const headers = getAuthHeaders(token);
      const authFetch = (url: string) => authorizedFetch(url, { headers }, get().logout).then(r => r.json());

      const [cats, trans, rules, res, cards] = await Promise.all([
        authFetch(`${API_URL}/categories`),
        authFetch(`${API_URL}/transactions`),
        authFetch(`${API_URL}/recurring_rules`),
        authFetch(`${API_URL}/reserves`),
        authFetch(`${API_URL}/credit_cards`)
      ]);
      set({
        categories: cats,
        transactions: trans,
        recurringRules: rules,
        reserves: res,
        creditCards: cards,
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
        const response = await authorizedFetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(t)
        }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/transactions/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
              body: JSON.stringify(updatedT)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/transactions/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/categories`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify(c)
          }, get().logout);
          if (!response.ok) throw new Error('Failed to add category');
          const newCategory = await response.json();
          set((state) => ({
              categories: [...state.categories, newCategory]
          }));
          return newCategory;
      } catch (err) {
          console.error(err);
          return undefined;
      }
  },

  updateCategory: async (id, updatedC) => {
      const currentCategory = get().categories.find(c => c.id === id);
      if (!currentCategory) return;

      const merged = { ...currentCategory, ...updatedC };
      const { id: _, ...payload } = merged;

      try {
          const token = get().token;
          const response = await authorizedFetch(`${API_URL}/categories/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
              body: JSON.stringify(payload)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/categories/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/recurring_rules`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify(r)
          }, get().logout);
          if (!response.ok) throw new Error('Failed to add rule');
          const newRule = await response.json();
          set((state) => ({
              recurringRules: [...state.recurringRules, newRule]
          }));
      } catch (err) {
          console.error(err);
      }
  },

  updateRecurringRule: async (id, updatedR) => {
    const currentRule = get().recurringRules.find(r => r.id === id);
    if (!currentRule) return;

    const merged = { ...currentRule, ...updatedR };
    const { id: _, ...payload } = merged;

    try {
      const token = get().token;
      const response = await authorizedFetch(`${API_URL}/recurring_rules/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload)
      }, get().logout);

      if (!response.ok) throw new Error('Failed to update rule');
      const savedRule = await response.json();

      set((state) => ({
        recurringRules: state.recurringRules.map(r => r.id === id ? savedRule : r)
      }));
    } catch (err) {
      console.error(err);
    }
  },

  deleteRecurringRule: async (id) => {
    try {
      const token = get().token;
      const response = await authorizedFetch(`${API_URL}/recurring_rules/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      }, get().logout);

      if (!response.ok) throw new Error('Failed to delete rule');

      set((state) => ({
        recurringRules: state.recurringRules.filter(r => r.id !== id)
      }));
    } catch (err) {
      console.error(err);
    }
  },

  addReserve: async (r) => {
      try {
          const token = get().token;
          const response = await authorizedFetch(`${API_URL}/reserves`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify(r)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/reserves/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
              body: JSON.stringify(payload)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/reserves/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
          }, get().logout);
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
          const response = await authorizedFetch(`${API_URL}/reserves/${reserveId}/transactions`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify({ amount, type })
          }, get().logout);
          if (!response.ok) throw new Error('Failed to add reserve transaction');
          const updatedReserve = await response.json();
          set((state) => ({
              reserves: state.reserves.map(r => r.id === reserveId ? updatedReserve : r)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  addCreditCard: async (c) => {
      try {
          const token = get().token;
          const response = await authorizedFetch(`${API_URL}/credit_cards`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify(c)
          }, get().logout);
          if (!response.ok) throw new Error('Failed to add credit card');
          const newCard = await response.json();
          set((state) => ({
              creditCards: [...state.creditCards, newCard]
          }));
      } catch (err) {
          console.error(err);
      }
  },

  updateCreditCard: async (id, updatedC) => {
      const currentCard = get().creditCards.find(c => c.id === id);
      if (!currentCard) return;

      const merged = { ...currentCard, ...updatedC };
      const { id: _, ...payload } = merged;

      try {
          const token = get().token;
          const response = await authorizedFetch(`${API_URL}/credit_cards/${id}`, {
              method: 'PUT',
              headers: getAuthHeaders(token),
              body: JSON.stringify(payload)
          }, get().logout);
          if (!response.ok) throw new Error('Failed to update credit card');
          const savedCard = await response.json();
          set((state) => ({
              creditCards: state.creditCards.map(c => c.id === id ? savedCard : c)
          }));
      } catch (err) {
          console.error(err);
      }
  },

  deleteCreditCard: async (id) => {
      try {
          const token = get().token;
          const response = await authorizedFetch(`${API_URL}/credit_cards/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(token)
          }, get().logout);
          if (!response.ok) throw new Error('Failed to delete credit card');
          set((state) => ({
              creditCards: state.creditCards.filter(c => c.id !== id)
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
