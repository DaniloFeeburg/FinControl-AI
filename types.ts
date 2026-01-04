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
  credit_card_id?: string | null;
  recurring_rule_id?: string | null;
  amount: number; // Stored as integer (cents)
  date: string; // ISO 8601
  description: string;
  status: TransactionStatus;
  created_at: string;
}

export interface RecurringRule {
  id: string;
  category_id: string;
  credit_card_id?: string | null;
  amount: number;
  description: string;
  rrule: string; // Simplified for demo: "FREQ=MONTHLY;BYMONTHDAY=5"
  active: boolean;
  auto_create?: boolean;
  last_execution?: string | null;
  next_execution?: string | null;
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

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  credit_limit: number;
  due_day: number;
  closing_day: number;
  color: string;
  active: boolean;
}

export interface BudgetLimit {
  id: string;
  category_id: string;
  monthly_limit: number;
}

export interface DailyProjection {
  date: string;
  balance: number;
  type: 'historical' | 'projected';
}

// OFX Import Types
export interface OFXTransactionParsed {
  payee: string;
  amount: number;
  date: string;
  memo?: string | null;
  fitid?: string | null;
  check_num?: string | null;
}

export interface OFXAccountInfo {
  account_id: string;
  routing_number?: string | null;
  account_type: string;
  currency: string;
  bank_id?: string | null;
}

export interface ImportTransactionPreview {
  ofx_data: OFXTransactionParsed;
  suggested_category_id?: string | null;
  suggested_description: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  is_duplicate: boolean;
  duplicate_transaction_id?: string | null;
  confidence_score?: number | null;
}

export interface ImportPreviewResponse {
  account_info: OFXAccountInfo;
  transactions: ImportTransactionPreview[];
  total_transactions: number;
  duplicate_count: number;
  new_count: number;
}

export interface ImportConfirmationResponse {
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  transaction_ids: string[];
}
