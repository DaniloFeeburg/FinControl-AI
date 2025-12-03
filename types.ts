export type TransactionStatus = 'PAID' | 'PENDING';
export type CategoryType = 'INCOME' | 'EXPENSE';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  is_fixed: boolean;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  category_id: string;
  amount: number; // Stored as integer (cents)
  date: string; // ISO 8601
  description: string;
  status: TransactionStatus;
  created_at: string;
}

export interface RecurringRule {
  id: string;
  category_id: string;
  amount: number;
  description: string;
  rrule: string; // Simplified for demo: "FREQ=MONTHLY;BYMONTHDAY=5"
  active: boolean;
}

export interface ReserveTransaction {
  id: string;
  date: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAW';
}

export interface Reserve {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  history: ReserveTransaction[];
}

export interface DailyProjection {
  date: string;
  balance: number;
  type: 'historical' | 'projected';
}
