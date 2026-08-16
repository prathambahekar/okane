export interface Category {
  name: string;
  color: string;
  icon?: string;
}

export interface Wallet {
  id: string;
  name: string;
  openingBalance: number;
  currentBalance?: number;
  color: string;
}

export type ContactType = 'friend' | 'vendor' | 'subscription';

export interface Friend {
  id: string;
  name: string;
  notes: string;
  color: string;
  createdAt: number;
  type?: ContactType;
  category?: string;
  billingCycle?:
    | 'monthly'
    | 'yearly'
    | 'quarterly'
    | 'half_yearly'
    | 'weekly'
    | 'biweekly'
    | 'daily'
    | 'one_time'
    | 'custom'
    | string;
  defaultAmount?: number;
  website?: string;
  avatarNumber?: string;
}

export type Contact = Friend;

export type ExpenseFlow = 'in' | 'out';
export type ExpenseType = 'personal' | 'for_friend' | 'by_friend';
export type ExpenseStatus = 'paid' | 'unpaid' | 'unsettled';

export interface Expense {
  id: string;
  groupId?: string | null;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: ExpenseType;
  flow: ExpenseFlow;
  friendId: string | null;
  vendorId?: string | null;
  walletId: string;
  status: ExpenseStatus;
  settled: boolean;
  settlementId: string | null;
  notes: string;
  createdAt: number;
  originalAmount?: number;
  originalDate?: string;
  settledAmount?: number;
  parentExpenseId?: string | null;
  vendorSettled?: boolean;
  vendorSettlementId?: string | null;
  vendorSettledAmount?: number;
}

export interface SettlementPartialBreakdownItem {
  originalAmount: number;
  settledAmount: number;
  remainingAmount: number;
}

export interface Settlement {
  id: string;
  friendId: string;
  amount: number;
  date: string;
  note: string;
  expenseIds: string[];
  createdAt: number;
  walletId?: string;
  paymentMethod?: string;
  originalTotal?: number;
  remainingAmount?: number;
  partialBreakdown?: Record<string, SettlementPartialBreakdownItem>;
}

export interface Settings {
  currency: string;
  categories: Category[];
  defaultCategory: string;
  defaultStatus: ExpenseStatus;
  defaultWalletId: string;
  enableAIAssistant?: boolean;
  enableEnvelopes?: boolean;
  enableAutopay?: boolean;
  enableDevSQLConsole?: boolean;
  enableSplitTrips?: boolean;
  enableSampleData?: boolean;
  enableUserGuide?: boolean;
  enableAutoUpdate?: boolean;
  installedVersion?: string;
  lastUpdateCheck?: string;
  defaultAiEngine?: 'offline' | 'online';
  devMode?: boolean;
  colorMode?: 'light' | 'dark';
  accent?: string;
  customAccentColor?: string;
  sidebarCollapsed?: boolean;
  enableAnimations?: boolean;
  performanceMode?: boolean;
  enableReportBugCard?: boolean;
  enablePerformanceCard?: boolean;
}

export type RecurringKind = 'autopay' | 'quick_log';
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom_days' | 'custom_months';

export interface RecurringRule {
  id: string;
  title: string;
  kind: RecurringKind; // 'autopay' for subscriptions / fixed bills, 'quick_log' for daily / frequent items
  amount: number;
  category: string;
  walletId: string;
  type: ExpenseType; // 'personal' | 'for_friend' | 'by_friend'
  flow: ExpenseFlow; // 'out' | 'in'
  friendId?: string | null;
  frequency: FrequencyType;
  intervalValue?: number; // e.g. 2 for "every 2 months", 3 for "every 3 days"
  
  startDate: string; // ISO date YYYY-MM-DD
  nextDueDate?: string; // ISO date YYYY-MM-DD (for autopay)
  autoDeduct?: boolean;
  lastDeductedDate?: string | null;
  
  lastLoggedDate?: string | null; // for quick log items
  status: 'active' | 'paused';
  notes?: string;
  createdAt: number;
}

export interface Envelope {
  id: string;
  walletId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  color?: string;
  icon?: string;
  targetDate?: string;
  notes?: string;
  createdAt: number;
}

export interface AppDB {
  version: number;
  friends: Friend[];
  expenses: Expense[];
  settlements: Settlement[];
  wallets: Wallet[];
  envelopes?: Envelope[];
  settings: Settings;
  recurringRules?: RecurringRule[];
  activeTrip?: Trip | null;
  tripHistory?: Trip[];
  presetGroups?: TripGroup[];
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
  | 'settings'
  | 'recurring'
  | 'split-trips'
  | 'dev-sql';

export interface TripMember {
  id: string;
  name: string;
}

export interface TripExpense {
  id: string;
  description: string;
  amount: number;
  paidByMemberId: string;
  splitMode: 'equal' | 'custom';
  splitMemberIds: string[];
  customSplits?: Record<string, number>;
  createdAt: number;
  date: string;
}

export interface TripGroup {
  id: string;
  name: string;
  memberNames: string[];
}

export interface Trip {
  id: string;
  name: string;
  groupName: string;
  members: TripMember[];
  expenses: TripExpense[];
  status: 'active' | 'archived';
  createdAt: number;
  archivedAt?: number;
}

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
