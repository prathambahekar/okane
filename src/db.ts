import type { AppDB, Wallet, Friend, Expense, Settlement, ExpenseFlow, ExpenseType, ExpenseStatus, RecurringRule, FrequencyType } from './types';

const DB_KEY = 'ledger_app_db_v2';

export function computeNextDueDate(currentDateISO: string, frequency: FrequencyType, intervalValue: number = 1): string {
  const parts = currentDateISO.split('-').map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = parts[1] || (new Date().getMonth() + 1);
  const d = parts[2] || new Date().getDate();
  const dt = new Date(y, m - 1, d);
  const val = Math.max(1, intervalValue || 1);

  switch (frequency) {
    case 'daily':
      dt.setDate(dt.getDate() + val);
      break;
    case 'weekly':
      dt.setDate(dt.getDate() + (7 * val));
      break;
    case 'monthly':
      dt.setMonth(dt.getMonth() + val);
      break;
    case 'custom_days':
      dt.setDate(dt.getDate() + val);
      break;
    case 'custom_months':
      dt.setMonth(dt.getMonth() + val);
      break;
  }
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function defaultSampleRecurringRules(walletId: string): RecurringRule[] {
  const t = todayISO();
  return [
    {
      id: 'rec_netflix',
      title: 'Netflix Subscription',
      kind: 'autopay',
      amount: 199,
      category: 'Entertainment',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'monthly',
      intervalValue: 1,
      startDate: t,
      nextDueDate: t, // Due today for immediate testing
      autoDeduct: false,
      status: 'active',
      notes: 'Monthly standard HD plan',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'rec_tiffin',
      title: 'Daily Tiffin Service',
      kind: 'quick_log',
      amount: 80,
      category: 'Food',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'daily',
      intervalValue: 1,
      startDate: t,
      status: 'active',
      notes: 'Lunch tiffin box',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'rec_recharge',
      title: 'Mobile Recharge (2 Months)',
      kind: 'quick_log',
      amount: 479,
      category: 'Utilities',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'custom_months',
      intervalValue: 2,
      startDate: t,
      status: 'active',
      notes: 'Prepaid 84 days pack',
      createdAt: Date.now() - 86400000,
    }
  ];
}

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
    recurringRules: defaultSampleRecurringRules(wallets[0].id),
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

    if (!Array.isArray(db.recurringRules) || db.recurringRules.length === 0) {
      db.recurringRules = defaultSampleRecurringRules(defaultWal);
    }

    db.expenses.forEach(e => {
      if (!e.flow) e.flow = 'out';
      if (e.type !== 'by_friend' && (!e.walletId || !db.wallets.some(w => w.id === e.walletId))) {
        e.walletId = defaultWal;
      }
    });

    // Migrate un-grouped split expenses (e.g. "Poha" & "Poha (Friend share)")
    const processedIds = new Set<string>();
    db.expenses.forEach((e1) => {
      if (e1.groupId || processedIds.has(e1.id)) return;
      if (e1.type === 'for_friend' && e1.description.includes('(Friend share)')) {
        const baseDesc = e1.description.replace(/\s*\(Friend share\)$/i, '').trim();
        const match = db.expenses.find(e2 =>
          e2.id !== e1.id &&
          !e2.groupId &&
          !processedIds.has(e2.id) &&
          e2.type === 'personal' &&
          e2.category === e1.category &&
          e2.date === e1.date &&
          (e2.description.trim() === baseDesc || e2.description.trim() === e1.description.trim()) &&
          Math.abs((e2.createdAt || 0) - (e1.createdAt || 0)) < 120000
        );
        if (match) {
          const newGrpId = uid('grp');
          e1.groupId = newGrpId;
          e1.description = baseDesc;
          match.groupId = newGrpId;
          match.description = baseDesc;
          processedIds.add(e1.id);
          processedIds.add(match.id);
        }
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
    groupId: data.groupId || null,
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

export function deleteExpenseGroup(db: AppDB, groupId: string): AppDB {
  return { ...db, expenses: db.expenses.filter(x => x.groupId !== groupId) };
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

export function addRecurringRule(db: AppDB, data: Partial<RecurringRule>): AppDB {
  const walId = data.walletId || db.settings.defaultWalletId || db.wallets[0]?.id || 'wal_cash';
  const start = data.startDate || todayISO();
  const rule: RecurringRule = {
    id: uid('rec'),
    title: data.title?.trim() || 'Untitled Recurring',
    kind: data.kind || 'quick_log',
    amount: Number(data.amount) || 0,
    category: data.category || db.settings.defaultCategory,
    walletId: walId,
    type: (data.type as ExpenseType) || 'personal',
    flow: data.flow === 'in' ? 'in' : 'out',
    friendId: data.type === 'personal' ? null : (data.friendId || null),
    frequency: data.frequency || 'monthly',
    intervalValue: Math.max(1, Number(data.intervalValue) || 1),
    startDate: start,
    nextDueDate: data.nextDueDate || start,
    autoDeduct: Boolean(data.autoDeduct),
    status: data.status === 'paused' ? 'paused' : 'active',
    notes: data.notes || '',
    createdAt: Date.now(),
  };
  return {
    ...db,
    recurringRules: [rule, ...(db.recurringRules || [])],
  };
}

export function updateRecurringRule(db: AppDB, id: string, data: Partial<RecurringRule>): AppDB {
  const rules = (db.recurringRules || []).map(r => {
    if (r.id !== id) return r;
    const updated = { ...r, ...data };
    if (data.amount !== undefined) updated.amount = Number(data.amount) || 0;
    if (data.intervalValue !== undefined) updated.intervalValue = Math.max(1, Number(data.intervalValue) || 1);
    return updated;
  });
  return { ...db, recurringRules: rules };
}

export function deleteRecurringRule(db: AppDB, id: string): AppDB {
  return {
    ...db,
    recurringRules: (db.recurringRules || []).filter(r => r.id !== id),
  };
}

export function triggerAutopayDeduct(db: AppDB, ruleId: string, customDate?: string, customWalletId?: string): { db: AppDB; expense: Expense | null } {
  const rule = (db.recurringRules || []).find(r => r.id === ruleId);
  if (!rule) return { db, expense: null };

  const deductDate = customDate || rule.nextDueDate || todayISO();
  const walletId = customWalletId || rule.walletId;

  const expData: Partial<Expense> = {
    description: rule.title,
    amount: rule.amount,
    category: rule.category,
    walletId: walletId,
    type: rule.type,
    flow: rule.flow,
    friendId: rule.friendId,
    date: deductDate,
    status: rule.type !== 'personal' ? 'unsettled' : 'paid',
    notes: `Autopay Subscription Payment (${rule.title})`,
  };

  const nextDb = addExpense(db, expData);
  const createdExp = nextDb.expenses[0] || null;

  const nextDue = computeNextDueDate(deductDate, rule.frequency, rule.intervalValue);
  const updatedRules = (nextDb.recurringRules || []).map(r => {
    if (r.id === ruleId) {
      return {
        ...r,
        lastDeductedDate: deductDate,
        nextDueDate: nextDue,
      };
    }
    return r;
  });

  return {
    db: { ...nextDb, recurringRules: updatedRules },
    expense: createdExp,
  };
}

export function quickLogRecurringRule(db: AppDB, ruleId: string, customDate?: string, customWalletId?: string): { db: AppDB; expense: Expense | null } {
  const rule = (db.recurringRules || []).find(r => r.id === ruleId);
  if (!rule) return { db, expense: null };

  const logDate = customDate || todayISO();
  const walletId = customWalletId || rule.walletId;

  const expData: Partial<Expense> = {
    description: rule.title,
    amount: rule.amount,
    category: rule.category,
    walletId: walletId,
    type: rule.type,
    flow: rule.flow,
    friendId: rule.friendId,
    date: logDate,
    status: rule.type !== 'personal' ? 'unsettled' : 'paid',
    notes: `Quick-logged recurring expense`,
  };

  const nextDb = addExpense(db, expData);
  const createdExp = nextDb.expenses[0] || null;

  const updatedRules = (nextDb.recurringRules || []).map(r => {
    if (r.id === ruleId) {
      return {
        ...r,
        lastLoggedDate: logDate,
      };
    }
    return r;
  });

  return {
    db: { ...nextDb, recurringRules: updatedRules },
    expense: createdExp,
  };
}
