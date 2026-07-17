export interface Category {
  name: string;
  color: string;
}

export interface Wallet {
  id: string;
  name: string;
  openingBalance: number;
  color: string;
}

export interface Friend {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  color: string;
  createdAt: number;
}

export type ExpenseFlow = 'in' | 'out';
export type ExpenseType = 'personal' | 'for_friend' | 'by_friend';
export type ExpenseStatus = 'paid' | 'unpaid' | 'unsettled';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: ExpenseType;
  flow: ExpenseFlow;
  friendId: string | null;
  walletId: string;
  status: ExpenseStatus;
  settled: boolean;
  settlementId: string | null;
  notes: string;
  createdAt: number;
}

export interface Settlement {
  id: string;
  friendId: string;
  amount: number;
  date: string;
  note: string;
  expenseIds: string[];
  createdAt: number;
}

export interface Settings {
  currency: string;
  categories: Category[];
  defaultCategory: string;
  defaultStatus: ExpenseStatus;
  defaultWalletId: string;
}

export interface AppDB {
  version: number;
  friends: Friend[];
  expenses: Expense[];
  settlements: Settlement[];
  wallets: Wallet[];
  settings: Settings;
}

export interface FriendBalance {
  friend: Friend;
  owedToMe: number;
  owedByMe: number;
  net: number;
}

export type ViewName =
  | 'dashboard'
  | 'expenses'
  | 'wallets'
  | 'friends'
  | 'friend-detail'
  | 'settlements'
  | 'analytics'
  | 'settings';

export interface ExpenseFilters {
  search: string;
  category: string;
  friend: string;
  status: string;
  type: string;
  flow: string;
  wallet: string;
  sort: string;
}
