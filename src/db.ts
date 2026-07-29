import type { AppDB, Wallet, Friend, Expense, Settlement, ExpenseFlow, ExpenseType, ExpenseStatus } from './types';

const DB_KEY = 'ledger_app_db_v2';

export const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#F97362', icon: 'food' },
  { name: 'Groceries', color: '#4ADE80', icon: 'groceries' },
  { name: 'Transport', color: '#38BDF8', icon: 'transport' },
  { name: 'Rent', color: '#FBBF24', icon: 'rent' },
  { name: 'Utilities', color: '#A78BFA', icon: 'utilities' },
  { name: 'Entertainment', color: '#F472B6', icon: 'entertainment' },
  { name: 'Shopping', color: '#FB7185', icon: 'shopping' },
  { name: 'Travel', color: '#22D3EE', icon: 'travel' },
  { name: 'Health', color: '#F87171', icon: 'health' },
  { name: 'Income', color: '#34D399', icon: 'income' },
  { name: 'Refund', color: '#2DD4BF', icon: 'refund' },
  { name: 'Other', color: '#94A3B8', icon: 'other' },
];

export const DEFAULT_WALLETS: Wallet[] = [
  { id: 'wal_cash', name: 'Cash', openingBalance: 0, color: '#FBBF24' },
  { id: 'wal_bank', name: 'Bank', openingBalance: 0, color: '#38BDF8' },
  { id: 'wal_upi', name: 'UPI / Wallet', openingBalance: 0, color: '#34D399' },
];

export const FRIEND_PALETTE = [
  '#7B89F5', '#34D399', '#F472B6', '#FBBF24', '#38BDF8',
  '#A78BFA', '#F97362', '#22D3EE', '#FB7185', '#2DD4BF',
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' }, { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' }, { code: 'JPY', symbol: '¥' }, { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' }, { code: 'CNY', symbol: '¥' }, { code: 'SGD', symbol: 'S$' },
  { code: 'AED', symbol: 'د.إ' },
];

export function uid(prefix = 'id'): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function defaultDB(): AppDB {
  const wallets = JSON.parse(JSON.stringify(DEFAULT_WALLETS)) as Wallet[];
  return {
    version: 3,
    friends: [],
    expenses: [],
    settlements: [],
    wallets,
    settings: {
      currency: 'INR',
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      defaultCategory: 'Food',
      defaultStatus: 'paid',
      defaultWalletId: wallets[0].id,
    },
  };
}

export function loadDB(): AppDB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw) as Partial<AppDB>;
    const d = defaultDB();
    const db: AppDB = { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings || {}) } };
    if (!Array.isArray(db.wallets) || db.wallets.length === 0) {
      db.wallets = JSON.parse(JSON.stringify(DEFAULT_WALLETS));
    }
    if (!db.settings.defaultWalletId || !db.wallets.some(w => w.id === db.settings.defaultWalletId)) {
      db.settings.defaultWalletId = db.wallets[0].id;
    }
    const defaultWal = db.settings.defaultWalletId;
    db.expenses.forEach(e => {
      if (!e.flow) e.flow = 'out';
      if (e.type !== 'by_friend' && (!e.walletId || !db.wallets.some(w => w.id === e.walletId))) {
        e.walletId = defaultWal;
      }
    });
    db.version = 3;
    return db;
  } catch (e) {
    console.error('Failed to load DB, starting fresh', e);
    return defaultDB();
  }
}

export function saveDB(db: AppDB): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function expenseFlow(e: Expense): ExpenseFlow {
  return e.flow === 'in' ? 'in' : 'out';
}

export function expenseWalletDelta(e: Expense): number {
  if (e.status === 'unpaid') return 0;
  if (e.type === 'by_friend') return 0;
  const amt = Number(e.amount) || 0;
  return expenseFlow(e) === 'in' ? amt : -amt;
}

export function walletBalance(db: AppDB, walletId: string): number {
  const w = db.wallets.find(x => x.id === walletId);
  if (!w) return 0;
  let bal = Number(w.openingBalance) || 0;
  db.expenses.forEach(e => {
    if (e.walletId === walletId) bal += expenseWalletDelta(e);
  });
  (db.settlements || []).forEach(s => {
    if (s.walletId === walletId) bal += Number(s.amount) || 0;
  });
  return bal;
}

export function totalWalletBalance(db: AppDB): number {
  return db.wallets.reduce((s, w) => s + walletBalance(db, w.id), 0);
}

export function friendBalance(db: AppDB, friendId: string): { owedToMe: number; owedByMe: number; net: number } {
  let owedToMe = 0, owedByMe = 0;
  db.expenses.forEach(e => {
    if (e.friendId !== friendId || e.type === 'personal' || e.settled) return;
    const amt = Number(e.amount) || 0;
    const sign = expenseFlow(e) === 'in' ? -1 : 1;
    if (e.type === 'for_friend') owedToMe += sign * amt;
    else if (e.type === 'by_friend') owedByMe += sign * amt;
  });
  return { owedToMe, owedByMe, net: owedToMe - owedByMe };
}

export function allFriendBalances(db: AppDB) {
  return db.friends
    .map(f => ({ friend: f, ...friendBalance(db, f.id) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export function overallBalance(db: AppDB): { credit: number; debit: number; net: number } {
  let credit = 0, debit = 0;
  db.friends.forEach(f => {
    const b = friendBalance(db, f.id);
    credit += b.owedToMe;
    debit += b.owedByMe;
  });
  return { credit, debit, net: credit - debit };
}

export function personalNetAmount(e: Expense): number {
  if (e.type !== 'personal') return 0;
  const amt = Number(e.amount) || 0;
  return expenseFlow(e) === 'in' ? -amt : amt;
}

export function unsettledExpensesForFriend(db: AppDB, friendId: string): Expense[] {
  return db.expenses
    .filter(e => e.friendId === friendId && e.type !== 'personal' && !e.settled && expenseFlow(e) === 'out')
    .sort((a, b) => b.date.localeCompare(a.date));
}

// CRUD helpers that return new DB state (immutable-ish)
export function addExpense(db: AppDB, data: Partial<Expense>): AppDB {
  const e: Expense = {
    id: uid('exp'),
    description: data.description || 'Untitled expense',
    amount: Number(data.amount) || 0,
    category: data.category || db.settings.defaultCategory,
    date: data.date || todayISO(),
    type: (data.type as ExpenseType) || 'personal',
    flow: data.flow === 'in' ? 'in' : 'out',
    friendId: data.type === 'personal' ? null : (data.friendId || null),
    walletId: data.type === 'by_friend' ? (data.walletId || '') : (data.walletId || db.settings.defaultWalletId || db.wallets[0]?.id),
    status: (data.status as ExpenseStatus) || db.settings.defaultStatus,
    settled: false,
    settlementId: null,
    notes: data.notes || '',
    createdAt: Date.now(),
  };
  return { ...db, expenses: [e, ...db.expenses] };
}

export function updateExpense(db: AppDB, id: string, data: Partial<Expense>): AppDB {
  const expenses = db.expenses.map(e => {
    if (e.id !== id) return e;
    const updated = { ...e, ...data };
    if (updated.flow !== 'in') updated.flow = 'out';
    if (updated.type === 'personal') updated.friendId = null;
    return updated;
  });
  return { ...db, expenses };
}

export function deleteExpense(db: AppDB, id: string): AppDB {
  return { ...db, expenses: db.expenses.filter(x => x.id !== id) };
}

export function addFriend(db: AppDB, data: Partial<Friend>): { db: AppDB; friend: Friend } {
  const friend: Friend = {
    id: uid('frnd'),
    name: data.name || 'Unnamed',
    email: data.email || '',
    phone: data.phone || '',
    notes: data.notes || '',
    color: FRIEND_PALETTE[db.friends.length % FRIEND_PALETTE.length],
    createdAt: Date.now(),
  };
  return { db: { ...db, friends: [...db.friends, friend] }, friend };
}

export function updateFriend(db: AppDB, id: string, data: Partial<Friend>): AppDB {
  return { ...db, friends: db.friends.map(f => f.id === id ? { ...f, ...data } : f) };
}

export function updateCategory(db: AppDB, oldName: string, data: { name: string; color: string; icon?: string }): AppDB {
  const newName = data.name.trim();
  const categories = db.settings.categories.map(c =>
    c.name === oldName ? { name: newName, color: data.color, icon: data.icon } : c
  );
  let expenses = db.expenses;
  let defaultCategory = db.settings.defaultCategory;
  if (newName !== oldName) {
    expenses = expenses.map(e => e.category === oldName ? { ...e, category: newName } : e);
    if (defaultCategory === oldName) defaultCategory = newName;
  }
  return {
    ...db,
    expenses,
    settings: {
      ...db.settings,
      categories,
      defaultCategory,
    },
  };
}

export function deleteFriend(db: AppDB, id: string): AppDB {
  return {
    ...db,
    friends: db.friends.filter(x => x.id !== id),
    expenses: db.expenses.filter(x => x.friendId !== id),
    settlements: db.settlements.filter(x => x.friendId !== id),
  };
}

export function addWallet(db: AppDB, data: Partial<Wallet>): { db: AppDB; wallet: Wallet } {
  const wallet: Wallet = {
    id: uid('wal'),
    name: data.name || 'Wallet',
    openingBalance: Number(data.openingBalance) || 0,
    color: data.color || FRIEND_PALETTE[db.wallets.length % FRIEND_PALETTE.length],
  };
  return { db: { ...db, wallets: [...db.wallets, wallet] }, wallet };
}

export function updateWallet(db: AppDB, id: string, data: Partial<Wallet>): AppDB {
  return {
    ...db,
    wallets: db.wallets.map(w => w.id === id ? { ...w, ...data, openingBalance: data.openingBalance !== undefined ? Number(data.openingBalance) : w.openingBalance } : w),
  };
}

export function deleteWallet(db: AppDB, id: string): AppDB | null {
  if (db.wallets.length <= 1) return null;
  const fallback = db.wallets.find(w => w.id !== id)!;
  return {
    ...db,
    wallets: db.wallets.filter(w => w.id !== id),
    expenses: db.expenses.map(e => e.walletId === id ? { ...e, walletId: fallback.id } : e),
    settlements: (db.settlements || []).map(s => s.walletId === id ? { ...s, walletId: fallback.id, paymentMethod: fallback.name } : s),
    settings: { ...db.settings, defaultWalletId: db.settings.defaultWalletId === id ? fallback.id : db.settings.defaultWalletId },
  };
}

export function recordSettlement(db: AppDB, friendId: string, expenseIds: string[], note: string, walletId?: string): AppDB {
  const exps = db.expenses.filter(e => expenseIds.includes(e.id));
  let owedToMe = 0, owedByMe = 0;
  exps.forEach(e => {
    if (expenseFlow(e) !== 'out') return;
    if (e.type === 'for_friend') owedToMe += Number(e.amount) || 0;
    else if (e.type === 'by_friend') owedByMe += Number(e.amount) || 0;
  });
  const amount = owedToMe - owedByMe;
  const wallet = walletId ? db.wallets.find(w => w.id === walletId) : undefined;
  const s: Settlement = {
    id: uid('stl'),
    friendId, amount,
    date: todayISO(),
    note: note || '',
    expenseIds: expenseIds.slice(),
    createdAt: Date.now(),
    walletId: walletId || undefined,
    paymentMethod: wallet?.name || undefined,
  };
  const expenses = db.expenses.map(e =>
    expenseIds.includes(e.id) ? { ...e, settled: true, settlementId: s.id } : e
  );
  return { ...db, settlements: [s, ...db.settlements], expenses };
}

export function deleteSettlement(db: AppDB, id: string): AppDB {
  const expenses = db.expenses.map(e =>
    e.settlementId === id ? { ...e, settled: false, settlementId: null } : e
  );
  return { ...db, settlements: db.settlements.filter(x => x.id !== id), expenses };
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function seedSampleData(db: AppDB): AppDB {
  let current = db;

  const d = (offsetDays: number): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  };

  const { db: db1, friend: alex } = addFriend(current, { name: 'Alex Rivera', email: 'alex@example.com' });
  current = db1;
  const { db: db2, friend: priya } = addFriend(current, { name: 'Priya Shah', email: 'priya@example.com' });
  current = db2;
  const { db: db3, friend: sam } = addFriend(current, { name: 'Sam Okafor' });
  current = db3;

  const expenses = [
    { description: 'Weekly groceries', amount: 64.20, category: 'Groceries', date: d(-2), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus },
    { description: 'Metro card top-up', amount: 25, category: 'Transport', date: d(-4), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus },
    { description: "Dinner at Otto's", amount: 88, category: 'Food', date: d(-5), type: 'for_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Movie night tickets', amount: 34, category: 'Entertainment', date: d(-6), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Uber to airport', amount: 41.50, category: 'Transport', date: d(-9), type: 'by_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Coffee run', amount: 12.75, category: 'Food', date: d(-10), type: 'for_friend' as ExpenseType, friendId: sam.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Electricity bill', amount: 76, category: 'Utilities', date: d(-12), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus },
    { description: 'Weekend cabin trip', amount: 210, category: 'Travel', date: d(-15), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Groceries for the week', amount: 58.40, category: 'Groceries', date: d(-18), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus },
    { description: 'New headphones', amount: 129, category: 'Shopping', date: d(-20), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus },
    { description: 'Gym membership', amount: 45, category: 'Health', date: d(-22), type: 'personal' as ExpenseType, status: 'unpaid' as ExpenseStatus },
    { description: 'Rent, shared apartment', amount: 900, category: 'Rent', date: d(-25), type: 'by_friend' as ExpenseType, friendId: sam.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Birthday dinner', amount: 96, category: 'Food', date: d(-33), type: 'for_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus },
    { description: 'Streaming subscriptions', amount: 28, category: 'Entertainment', date: d(-40), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus },
    { description: 'Flight tickets split', amount: 340, category: 'Travel', date: d(-48), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus },
  ];

  expenses.forEach(e => { current = addExpense(current, e); });
  return current;
}
