import alasql from 'alasql';
import type { AppDB, Wallet, Friend, Expense, Settlement, ExpenseFlow, ExpenseType, ExpenseStatus, RecurringRule, FrequencyType, ContactType, RecurringKind, SettlementPartialBreakdownItem } from './types';

const SQL_STORAGE_KEY = 'okane_sql_database_dump_v1';
const LEGACY_JSON_KEY = 'ledger_app_db_v2';

let isSQLInitialized = false;

export function resetSQLTables() {
  try {
    alasql('DROP TABLE IF EXISTS friends');
    alasql('DROP TABLE IF EXISTS wallets');
    alasql('DROP TABLE IF EXISTS expenses');
    alasql('DROP TABLE IF EXISTS settlements');
    alasql('DROP TABLE IF EXISTS recurring_rules');
    alasql('DROP TABLE IF EXISTS categories');
    alasql('DROP TABLE IF EXISTS settings');
  } catch (err) {
    console.error('Failed to drop SQL tables:', err);
  }
  isSQLInitialized = false;
  initSQLTables();
}

export function initSQLTables() {
  if (isSQLInitialized) return;
  try {
    alasql('CREATE TABLE IF NOT EXISTS friends (id STRING PRIMARY KEY, name STRING, notes STRING, color STRING, createdAt INT, type STRING, category STRING, billingCycle STRING, defaultAmount NUMBER, website STRING, avatarNumber STRING)');
    alasql('CREATE TABLE IF NOT EXISTS wallets (id STRING PRIMARY KEY, name STRING, openingBalance NUMBER, currentBalance NUMBER, color STRING)');
    alasql('CREATE TABLE IF NOT EXISTS expenses (id STRING PRIMARY KEY, groupId STRING, description STRING, amount NUMBER, category STRING, date STRING, type STRING, flow STRING, friendId STRING, walletId STRING, status STRING, settled INT, settlementId STRING, notes STRING, createdAt INT, originalAmount NUMBER, settledAmount NUMBER, parentExpenseId STRING)');
    alasql('CREATE TABLE IF NOT EXISTS settlements (id STRING PRIMARY KEY, friendId STRING, amount NUMBER, date STRING, note STRING, walletId STRING, createdAt INT, expenseIds STRING, originalTotal NUMBER, remainingAmount NUMBER, partialBreakdown STRING)');
    alasql('CREATE TABLE IF NOT EXISTS recurring_rules (id STRING PRIMARY KEY, title STRING, kind STRING, amount NUMBER, category STRING, walletId STRING, friendId STRING, type STRING, flow STRING, frequency STRING, intervalValue INT, startDate STRING, nextDueDate STRING, autoDeduct INT, status STRING, notes STRING, createdAt INT)');
    alasql('CREATE TABLE IF NOT EXISTS categories (name STRING PRIMARY KEY, color STRING, icon STRING)');
    alasql('CREATE TABLE IF NOT EXISTS settings (st_key STRING PRIMARY KEY, st_val STRING)');
    isSQLInitialized = true;
  } catch (err) {
    console.error('Failed to initialize SQL tables:', err);
  }
}

export function splitSQLStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += char;
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed) statements.push(lastTrimmed);

  return statements;
}

export function executeRawSQL(sqlQuery: string): unknown {
  initSQLTables();
  const res = alasql(sqlQuery);

  const upper = sqlQuery.trim().toUpperCase();
  if (
    upper.startsWith('INSERT') ||
    upper.startsWith('UPDATE') ||
    upper.startsWith('DELETE') ||
    upper.startsWith('DROP') ||
    upper.startsWith('ALTER') ||
    upper.startsWith('CREATE') ||
    upper.startsWith('REPLACE') ||
    upper.startsWith('TRUNCATE')
  ) {
    try {
      const updatedDB = loadDBFromSQLTables();
      syncDBToSQLTables(updatedDB);
    } catch (e) {
      console.warn('Error auto-syncing after raw SQL write:', e);
    }
  }

  return res;
}

export function generateSQLDumpString(): string {
  initSQLTables();
  const dump = {
    friends: (alasql('SELECT * FROM friends') as Record<string, unknown>[]) || [],
    wallets: (alasql('SELECT * FROM wallets') as Record<string, unknown>[]) || [],
    expenses: (alasql('SELECT * FROM expenses') as Record<string, unknown>[]) || [],
    settlements: (alasql('SELECT * FROM settlements') as Record<string, unknown>[]) || [],
    recurring_rules: (alasql('SELECT * FROM recurring_rules') as Record<string, unknown>[]) || [],
    categories: (alasql('SELECT * FROM categories') as Record<string, unknown>[]) || [],
    settings: (alasql('SELECT * FROM settings') as Record<string, unknown>[]) || [],
  };

  let sql = `-- OKANE RELATIONAL SQL DATABASE BACKUP
-- Generated: ${new Date().toISOString()}

CREATE TABLE IF NOT EXISTS friends (id TEXT PRIMARY KEY, name TEXT, notes TEXT, color TEXT, createdAt INTEGER, type TEXT, category TEXT, billingCycle TEXT, defaultAmount REAL, website TEXT, avatarNumber TEXT);
CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY, name TEXT, openingBalance REAL, currentBalance REAL, color TEXT);
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, groupId TEXT, description TEXT, amount REAL, category TEXT, date TEXT, type TEXT, flow TEXT, friendId TEXT, walletId TEXT, status TEXT, settled INTEGER, settlementId TEXT, notes TEXT, createdAt INTEGER, originalAmount REAL, settledAmount REAL, parentExpenseId TEXT);
CREATE TABLE IF NOT EXISTS settlements (id TEXT PRIMARY KEY, friendId TEXT, amount REAL, date TEXT, note TEXT, walletId TEXT, createdAt INTEGER, expenseIds TEXT, originalTotal REAL, remainingAmount REAL, partialBreakdown TEXT);
CREATE TABLE IF NOT EXISTS recurring_rules (id TEXT PRIMARY KEY, title TEXT, kind TEXT, amount REAL, category TEXT, walletId TEXT, friendId TEXT, type TEXT, flow TEXT, frequency TEXT, intervalValue INTEGER, startDate TEXT, nextDueDate TEXT, autoDeduct INTEGER, status TEXT, notes TEXT, createdAt INTEGER);
CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY, color TEXT, icon TEXT);
CREATE TABLE IF NOT EXISTS settings (st_key TEXT PRIMARY KEY, st_val TEXT);

`;

  const escapeVal = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v === 'object') {
      return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    }
    return `'${String(v).replace(/'/g, "''")}'`;
  };

  sql += `DELETE FROM friends;\n`;
  dump.friends.forEach(f => {
    sql += `INSERT INTO friends (id, name, notes, color, createdAt, type, category, billingCycle, defaultAmount, website, avatarNumber) VALUES (${escapeVal(f.id)}, ${escapeVal(f.name)}, ${escapeVal(f.notes)}, ${escapeVal(f.color)}, ${escapeVal(f.createdAt)}, ${escapeVal(f.type)}, ${escapeVal(f.category)}, ${escapeVal(f.billingCycle)}, ${escapeVal(f.defaultAmount)}, ${escapeVal(f.website)}, ${escapeVal(f.avatarNumber)});\n`;
  });

  sql += `\nDELETE FROM wallets;\n`;
  dump.wallets.forEach(w => {
    sql += `INSERT INTO wallets (id, name, openingBalance, currentBalance, color) VALUES (${escapeVal(w.id)}, ${escapeVal(w.name)}, ${escapeVal(w.openingBalance)}, ${escapeVal(w.currentBalance ?? w.openingBalance)}, ${escapeVal(w.color)});\n`;
  });

  sql += `\nDELETE FROM expenses;\n`;
  dump.expenses.forEach(e => {
    sql += `INSERT INTO expenses (id, groupId, description, amount, category, date, type, flow, friendId, walletId, status, settled, settlementId, notes, createdAt, originalAmount, settledAmount, parentExpenseId) VALUES (${escapeVal(e.id)}, ${escapeVal(e.groupId)}, ${escapeVal(e.description)}, ${escapeVal(e.amount)}, ${escapeVal(e.category)}, ${escapeVal(e.date)}, ${escapeVal(e.type)}, ${escapeVal(e.flow)}, ${escapeVal(e.friendId)}, ${escapeVal(e.walletId)}, ${escapeVal(e.status)}, ${escapeVal(e.settled)}, ${escapeVal(e.settlementId)}, ${escapeVal(e.notes)}, ${escapeVal(e.createdAt)}, ${escapeVal(e.originalAmount)}, ${escapeVal(e.settledAmount)}, ${escapeVal(e.parentExpenseId)});\n`;
  });

  sql += `\nDELETE FROM settlements;\n`;
  dump.settlements.forEach(s => {
    sql += `INSERT INTO settlements (id, friendId, amount, date, note, walletId, createdAt, expenseIds, originalTotal, remainingAmount, partialBreakdown) VALUES (${escapeVal(s.id)}, ${escapeVal(s.friendId)}, ${escapeVal(s.amount)}, ${escapeVal(s.date)}, ${escapeVal(s.note)}, ${escapeVal(s.walletId)}, ${escapeVal(s.createdAt)}, ${escapeVal(s.expenseIds)}, ${escapeVal(s.originalTotal)}, ${escapeVal(s.remainingAmount)}, ${escapeVal(s.partialBreakdown)});\n`;
  });

  sql += `\nDELETE FROM recurring_rules;\n`;
  dump.recurring_rules.forEach(r => {
    sql += `INSERT INTO recurring_rules (id, title, kind, amount, category, walletId, friendId, type, flow, frequency, intervalValue, startDate, nextDueDate, autoDeduct, status, notes, createdAt) VALUES (${escapeVal(r.id)}, ${escapeVal(r.title)}, ${escapeVal(r.kind)}, ${escapeVal(r.amount)}, ${escapeVal(r.category)}, ${escapeVal(r.walletId)}, ${escapeVal(r.friendId)}, ${escapeVal(r.type)}, ${escapeVal(r.flow)}, ${escapeVal(r.frequency)}, ${escapeVal(r.intervalValue)}, ${escapeVal(r.startDate)}, ${escapeVal(r.nextDueDate)}, ${escapeVal(r.autoDeduct)}, ${escapeVal(r.status)}, ${escapeVal(r.notes)}, ${escapeVal(r.createdAt)});\n`;
  });

  sql += `\nDELETE FROM categories;\n`;
  dump.categories.forEach(c => {
    sql += `INSERT INTO categories (name, color, icon) VALUES (${escapeVal(c.name)}, ${escapeVal(c.color)}, ${escapeVal(c.icon)});\n`;
  });

  sql += `\nDELETE FROM settings;\n`;
  dump.settings.forEach(st => {
    const k = st.st_key ?? st.key ?? st['key'];
    const v = st.st_val ?? st.value ?? st['value'];
    if (k) {
      sql += `INSERT INTO settings (st_key, st_val) VALUES (${escapeVal(k)}, ${escapeVal(v)});\n`;
    }
  });

  return sql;
}

export function splitSqlValues(valuesStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    if (inString) {
      current += char;
      if (char === stringChar) {
        if (valuesStr[i + 1] === stringChar) {
          current += valuesStr[i + 1];
          i++;
        } else {
          inString = false;
        }
      }
    } else {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
}

export function importSQLDumpString(sqlText: string): AppDB {
  resetSQLTables();
  const statements = splitSQLStatements(sqlText);

  statements.forEach(stmt => {
    const q = stmt.trim();
    if (!q) return;
    try {
      alasql(q);
    } catch (err) {
      let handled = false;
      const positionalMatch = q.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s+VALUES\s*\(([\s\S]*)\);?$/i);
      if (positionalMatch) {
        const rawTbl = positionalMatch[1].toLowerCase();
        const targetTable = rawTbl === 'contacts' ? 'friends' : rawTbl;
        try {
          const tableObj = (alasql.tables as Record<string, { columns?: { columnid: string }[] }>)[targetTable];
          const valuesStr = positionalMatch[2];
          const parsedVals = splitSqlValues(valuesStr);
          if (tableObj && tableObj.columns && tableObj.columns.length > 0) {
            const colNames = tableObj.columns.map(c => c.columnid);
            const valCount = parsedVals.length;
            if (valCount <= colNames.length) {
              const colList = colNames.slice(0, valCount).join(', ');
              const newQuery = `INSERT INTO ${targetTable} (${colList}) VALUES (${valuesStr})`;
              alasql(newQuery);
              handled = true;
            } else {
              const colList = colNames.join(', ');
              const trimmedVals = parsedVals.slice(0, colNames.length).join(', ');
              const newQuery = `INSERT INTO ${targetTable} (${colList}) VALUES (${trimmedVals})`;
              alasql(newQuery);
              handled = true;
            }
          }
        } catch (retryErr) {
          console.warn('SQL import positional retry error:', retryErr);
        }
      }
      if (!handled) {
        console.warn('SQL import statement error:', q, err);
      }
    }
  });

  const db = loadDBFromSQLTables();
  syncDBToSQLTables(db);
  return db;
}

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
  '#4F46E5', '#059669', '#D97706', '#2563EB', '#7C3AED',
  '#E11D48', '#0D9488', '#EA580C', '#0284C7', '#475569',
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
  const defaultWal = wallets[0].id;
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
      defaultWalletId: defaultWal,
      enableAIAssistant: true,
      defaultAiEngine: 'offline',
      devMode: false,
      enableDevSQLConsole: true,
      enableSplitTrips: true,
      enableSampleData: false,
      enableUserGuide: false,
      colorMode: (localStorage.getItem('color-mode') as 'light' | 'dark') || 'light',
      accent: localStorage.getItem('accent-color') || 'blue',
      customAccentColor: localStorage.getItem('custom-accent-color') || '#6366f1',
      sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
    },
    recurringRules: [],
  };
}

export function defaultSampleExpenses(walletId: string): Expense[] {
  const d = (offsetDays: number): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  };

  return [
    {
      id: uid('exp'),
      groupId: null,
      description: 'Supermarket Groceries',
      amount: 1450,
      category: 'Groceries',
      date: d(-1),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Restaurant Dinner',
      amount: 850,
      category: 'Food',
      date: d(-2),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 2 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Electricity & Utility Bill',
      amount: 1200,
      category: 'Utilities',
      date: d(-10),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Monthly Tiffin Service',
      amount: 2500,
      category: 'Food',
      date: d(-15),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 15 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Fuel / Petrol',
      amount: 600,
      category: 'Transport',
      date: d(-18),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 18 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Groceries & Household',
      amount: 1800,
      category: 'Groceries',
      date: d(-32),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 32 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Dining Out',
      amount: 1100,
      category: 'Food',
      date: d(-35),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 35 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Internet Bill',
      amount: 999,
      category: 'Utilities',
      date: d(-40),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 40 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'New Clothes & Apparel',
      amount: 2200,
      category: 'Shopping',
      date: d(-45),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 45 * 86400000,
    },
    {
      id: uid('exp'),
      groupId: null,
      description: 'Road Trip Fuel',
      amount: 1500,
      category: 'Travel',
      date: d(-52),
      type: 'personal',
      flow: 'out',
      friendId: null,
      walletId,
      status: 'paid',
      settled: true,
      settlementId: null,
      notes: '',
      createdAt: Date.now() - 52 * 86400000,
    },
  ];
}

export function syncDBToSQLTables(db: AppDB): void {
  resetSQLTables();
  try {
    const safeInsert = (sql: string, params: unknown[]) => {
      try {
        alasql(sql, params);
      } catch (e) {
        console.warn('SQL Insert warning:', e);
      }
    };

    const seenFriends = new Set<string>();
    (db.friends || []).forEach(f => {
      if (!f.id || seenFriends.has(f.id)) return;
      seenFriends.add(f.id);
      safeInsert('INSERT INTO friends (id, name, notes, color, createdAt, type, category, billingCycle, defaultAmount, website, avatarNumber) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
        f.id, f.name, f.notes || '', f.color || '',
        f.createdAt || Date.now(), f.type || 'friend', f.category || null, f.billingCycle || null,
        f.defaultAmount !== undefined ? Number(f.defaultAmount) : null, f.website || '', f.avatarNumber || null
      ]);
    });

    const seenWallets = new Set<string>();
    (db.wallets || []).forEach(w => {
      if (!w.id || seenWallets.has(w.id)) return;
      seenWallets.add(w.id);
      safeInsert('INSERT INTO wallets VALUES (?,?,?,?,?)', [
        w.id, w.name, Number(w.openingBalance) || 0, walletBalance(db, w.id), w.color || ''
      ]);
    });

    const seenExpenses = new Set<string>();
    (db.expenses || []).forEach(e => {
      if (!e.id || seenExpenses.has(e.id)) return;
      seenExpenses.add(e.id);
      safeInsert('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        e.id, e.groupId || null, e.description, Number(e.amount) || 0, e.category, e.date,
        e.type, e.flow, e.friendId || null, e.walletId || null, e.status, e.settled ? 1 : 0,
        e.settlementId || null, e.notes || '', e.createdAt || Date.now(),
        e.originalAmount != null ? Number(e.originalAmount) : null,
        e.settledAmount != null ? Number(e.settledAmount) : null,
        e.parentExpenseId || null
      ]);
    });

    const seenSettlements = new Set<string>();
    (db.settlements || []).forEach(s => {
      if (!s.id || seenSettlements.has(s.id)) return;
      seenSettlements.add(s.id);
      safeInsert('INSERT INTO settlements VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
        s.id, s.friendId, Number(s.amount) || 0, s.date, s.note || '', s.walletId || null,
        s.createdAt || Date.now(), JSON.stringify(s.expenseIds || []),
        s.originalTotal != null ? Number(s.originalTotal) : null,
        s.remainingAmount != null ? Number(s.remainingAmount) : null,
        s.partialBreakdown ? JSON.stringify(s.partialBreakdown) : null
      ]);
    });

    const seenRules = new Set<string>();
    (db.recurringRules || []).forEach(r => {
      if (!r.id || seenRules.has(r.id)) return;
      seenRules.add(r.id);
      safeInsert('INSERT INTO recurring_rules VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        r.id, r.title, r.kind, Number(r.amount) || 0, r.category, r.walletId, r.friendId || null,
        r.type, r.flow, r.frequency, r.intervalValue, r.startDate, r.nextDueDate || r.startDate,
        r.autoDeduct ? 1 : 0, r.status, r.notes || '', r.createdAt || Date.now()
      ]);
    });

    const seenCats = new Set<string>();
    (db.settings?.categories || DEFAULT_CATEGORIES).forEach(c => {
      if (!c.name || seenCats.has(c.name)) return;
      seenCats.add(c.name);
      safeInsert('INSERT INTO categories VALUES (?,?,?)', [c.name, c.color, c.icon || '']);
    });

    if (db.settings) {
      const seenSettingsKeys = new Set<string>();
      Object.entries(db.settings).forEach(([k, v]) => {
        if (!seenSettingsKeys.has(k)) {
          seenSettingsKeys.add(k);
          safeInsert('INSERT INTO settings VALUES (?,?)', [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
        }
      });
      if (db.settings.colorMode) localStorage.setItem('color-mode', db.settings.colorMode);
      if (db.settings.accent) localStorage.setItem('accent-color', db.settings.accent);
      if (db.settings.customAccentColor) localStorage.setItem('custom-accent-color', db.settings.customAccentColor);
      if (db.settings.sidebarCollapsed !== undefined) localStorage.setItem('sidebar_collapsed', String(db.settings.sidebarCollapsed));
      if (db.settings.defaultAiEngine) localStorage.setItem('ai_engine_mode', db.settings.defaultAiEngine);
    }

    const sqlDump = {
      friends: alasql('SELECT * FROM friends'),
      wallets: alasql('SELECT * FROM wallets'),
      expenses: alasql('SELECT * FROM expenses'),
      settlements: alasql('SELECT * FROM settlements'),
      recurring_rules: alasql('SELECT * FROM recurring_rules'),
      categories: alasql('SELECT * FROM categories'),
      settings: alasql('SELECT * FROM settings'),
    };
    localStorage.setItem(SQL_STORAGE_KEY, JSON.stringify(sqlDump));
    localStorage.setItem(LEGACY_JSON_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Error syncing DB to SQL tables:', err);
  }
}

export function loadDBFromSQLTables(): AppDB {
  initSQLTables();
  try {
    const sqlFriends = (alasql('SELECT * FROM friends') as Record<string, unknown>[]) || [];
    const sqlWallets = (alasql('SELECT * FROM wallets') as Record<string, unknown>[]) || [];
    const sqlExpenses = (alasql('SELECT * FROM expenses') as Record<string, unknown>[]) || [];
    const sqlSettlements = (alasql('SELECT * FROM settlements') as Record<string, unknown>[]) || [];
    const sqlRecurring = (alasql('SELECT * FROM recurring_rules') as Record<string, unknown>[]) || [];
    const sqlCategories = (alasql('SELECT * FROM categories') as Record<string, unknown>[]) || [];
    const sqlSettings = (alasql('SELECT * FROM settings') as Record<string, unknown>[]) || [];

    const friends: Friend[] = sqlFriends.map(f => ({
      id: String(f.id),
      name: String(f.name),
      notes: String(f.notes || ''),
      color: String(f.color || '#7B89F5'),
      createdAt: Number(f.createdAt) || Date.now(),
      type: (f.type as ContactType) || 'friend',
      category: f.category ? String(f.category) : undefined,
      billingCycle: f.billingCycle ? String(f.billingCycle) as Friend['billingCycle'] : undefined,
      defaultAmount: f.defaultAmount != null ? Number(f.defaultAmount) : undefined,
      website: String(f.website || ''),
      avatarNumber: f.avatarNumber ? String(f.avatarNumber) : undefined,
    }));

    const wallets: Wallet[] = sqlWallets.map(w => ({
      id: String(w.id),
      name: String(w.name),
      openingBalance: Number(w.openingBalance) || 0,
      currentBalance: w.currentBalance != null ? Number(w.currentBalance) : undefined,
      color: String(w.color || '#38BDF8'),
    }));

    const expenses: Expense[] = sqlExpenses.map(e => ({
      id: String(e.id),
      groupId: e.groupId ? String(e.groupId) : null,
      description: String(e.description),
      amount: Number(e.amount) || 0,
      category: String(e.category),
      date: String(e.date),
      type: (e.type as ExpenseType) || 'personal',
      flow: (e.flow as ExpenseFlow) || 'out',
      friendId: e.friendId ? String(e.friendId) : null,
      walletId: String(e.walletId || ''),
      status: (e.status as ExpenseStatus) || 'paid',
      settled: Boolean(e.settled),
      settlementId: e.settlementId ? String(e.settlementId) : null,
      notes: String(e.notes || ''),
      createdAt: Number(e.createdAt) || Date.now(),
      originalAmount: e.originalAmount != null ? Number(e.originalAmount) : undefined,
      settledAmount: e.settledAmount != null ? Number(e.settledAmount) : undefined,
      parentExpenseId: e.parentExpenseId ? String(e.parentExpenseId) : undefined,
    }));

    const settlements: Settlement[] = sqlSettlements.map(s => {
      let expIds: string[] = [];
      try {
        expIds = typeof s.expenseIds === 'string' ? JSON.parse(s.expenseIds) : (Array.isArray(s.expenseIds) ? (s.expenseIds as string[]) : []);
      } catch {
        expIds = [];
      }
      let breakdown: Settlement['partialBreakdown'] = undefined;
      if (s.partialBreakdown) {
        try {
          breakdown = typeof s.partialBreakdown === 'string' ? JSON.parse(s.partialBreakdown) : s.partialBreakdown;
        } catch {
          breakdown = undefined;
        }
      }
      return {
        id: String(s.id),
        friendId: String(s.friendId),
        amount: Number(s.amount) || 0,
        date: String(s.date),
        note: String(s.note || ''),
        walletId: s.walletId ? String(s.walletId) : undefined,
        createdAt: Number(s.createdAt) || Date.now(),
        expenseIds: expIds,
        originalTotal: s.originalTotal != null ? Number(s.originalTotal) : undefined,
        remainingAmount: s.remainingAmount != null ? Number(s.remainingAmount) : undefined,
        partialBreakdown: breakdown,
      };
    });

    const recurringRules: RecurringRule[] = sqlRecurring.map(r => ({
      id: String(r.id),
      title: String(r.title),
      kind: (r.kind as RecurringKind) || 'quick_log',
      amount: Number(r.amount) || 0,
      category: String(r.category),
      walletId: String(r.walletId),
      friendId: r.friendId ? String(r.friendId) : null,
      type: (r.type as ExpenseType) || 'personal',
      flow: (r.flow as ExpenseFlow) || 'out',
      frequency: (r.frequency as FrequencyType) || 'monthly',
      intervalValue: Number(r.intervalValue) || 1,
      startDate: String(r.startDate),
      nextDueDate: String(r.nextDueDate || r.startDate),
      autoDeduct: Boolean(r.autoDeduct),
      status: (r.status as 'active' | 'paused') || 'active',
      notes: String(r.notes || ''),
      createdAt: Number(r.createdAt) || Date.now(),
    }));

    const categories = sqlCategories.length > 0
      ? sqlCategories.map(c => ({ name: String(c.name), color: String(c.color), icon: c.icon ? String(c.icon) : undefined }))
      : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));

    const settingsObj: Record<string, unknown> = {
      currency: 'INR',
      categories,
      defaultCategory: 'Food',
      defaultStatus: 'paid',
      defaultWalletId: wallets[0]?.id || 'wal_cash',
      enableAIAssistant: true,
      defaultAiEngine: 'offline',
      devMode: false,
      enableDevSQLConsole: true,
      enableSplitTrips: true,
      enableSampleData: false,
      enableUserGuide: false,
      colorMode: (localStorage.getItem('color-mode') as 'light' | 'dark') || 'light',
      accent: localStorage.getItem('accent-color') || 'blue',
      customAccentColor: localStorage.getItem('custom-accent-color') || '#6366f1',
      sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
    };

    sqlSettings.forEach(st => {
      const keyStr = String(st.st_key ?? st.key ?? '');
      const valStr = String(st.st_val ?? st.value ?? '');
      if (!keyStr) return;
      try {
        settingsObj[keyStr] = JSON.parse(valStr);
      } catch {
        settingsObj[keyStr] = valStr === 'true' ? true : valStr === 'false' ? false : valStr;
      }
    });

    if (localStorage.getItem('dev_mode_user_set') !== 'true') {
      settingsObj.devMode = false;
    }

    settingsObj.categories = categories;

    const db: AppDB = {
      version: 3,
      friends,
      wallets: wallets.length > 0 ? wallets : JSON.parse(JSON.stringify(DEFAULT_WALLETS)),
      expenses,
      settlements,
      recurringRules,
      settings: (settingsObj as unknown) as AppDB['settings'],
    };

    return db;
  } catch (err) {
    console.error('Error loading DB from SQL tables:', err);
    return defaultDB();
  }
}

export function loadDB(): AppDB {
  initSQLTables();
  try {
    const rawSQLDump = localStorage.getItem(SQL_STORAGE_KEY);
    if (rawSQLDump) {
      const dump = JSON.parse(rawSQLDump);
      if (dump && typeof dump === 'object') {
        resetSQLTables();

        const insertSafe = (sql: string, params: unknown[]) => {
          try {
            alasql(sql, params);
          } catch (e) {
            console.warn('SQL Load Row Warning:', e);
          }
        };

        const seenFriends = new Set<string>();
        if (Array.isArray(dump.friends)) {
          dump.friends.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenFriends.has(id)) return;
            seenFriends.add(id);
            insertSafe('INSERT INTO friends (id, name, notes, color, createdAt, type, category, billingCycle, defaultAmount, website, avatarNumber) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.name, row.notes, row.color, row.createdAt, row.type, row.category, row.billingCycle, row.defaultAmount, row.website, row.avatarNumber ?? null]);
          });
        }

        const seenWallets = new Set<string>();
        if (Array.isArray(dump.wallets)) {
          dump.wallets.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenWallets.has(id)) return;
            seenWallets.add(id);
            insertSafe('INSERT INTO wallets VALUES (?,?,?,?,?)', [row.id, row.name, row.openingBalance, row.currentBalance ?? row.openingBalance, row.color]);
          });
        }

        const seenExpenses = new Set<string>();
        if (Array.isArray(dump.expenses)) {
          dump.expenses.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenExpenses.has(id)) return;
            seenExpenses.add(id);
            insertSafe('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.groupId, row.description, row.amount, row.category, row.date, row.type, row.flow, row.friendId, row.walletId, row.status, row.settled, row.settlementId, row.notes, row.createdAt]);
          });
        }

        const seenSettlements = new Set<string>();
        if (Array.isArray(dump.settlements)) {
          dump.settlements.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenSettlements.has(id)) return;
            seenSettlements.add(id);
            insertSafe('INSERT INTO settlements VALUES (?,?,?,?,?,?,?,?)', [row.id, row.friendId, row.amount, row.date, row.note, row.walletId, row.createdAt, row.expenseIds]);
          });
        }

        const seenRules = new Set<string>();
        if (Array.isArray(dump.recurring_rules)) {
          dump.recurring_rules.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenRules.has(id)) return;
            seenRules.add(id);
            insertSafe('INSERT INTO recurring_rules VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.title, row.kind, row.amount, row.category, row.walletId, row.friendId, row.type, row.flow, row.frequency, row.intervalValue, row.startDate, row.nextDueDate, row.autoDeduct, row.status, row.notes, row.createdAt]);
          });
        }

        const seenCats = new Set<string>();
        if (Array.isArray(dump.categories)) {
          dump.categories.forEach((row: Record<string, unknown>) => {
            const name = String(row.name ?? '');
            if (!name || seenCats.has(name)) return;
            seenCats.add(name);
            insertSafe('INSERT INTO categories VALUES (?,?,?)', [row.name, row.color, row.icon]);
          });
        }

        const seenKeys = new Set<string>();
        if (Array.isArray(dump.settings)) {
          dump.settings.forEach((row: Record<string, unknown>) => {
            const key = String(row.st_key ?? row.key ?? '');
            const val = row.st_val ?? row.value ?? '';
            if (!key || seenKeys.has(key)) return;
            seenKeys.add(key);
            insertSafe('INSERT INTO settings VALUES (?,?)', [key, typeof val === 'object' ? JSON.stringify(val) : String(val)]);
          });
        }

        const loaded = loadDBFromSQLTables();
        const legacyRaw = localStorage.getItem(LEGACY_JSON_KEY);
        if (legacyRaw && (!loaded.friends || loaded.friends.length === 0)) {
          try {
            const parsed = JSON.parse(legacyRaw) as Partial<AppDB>;
            if (Array.isArray(parsed.friends) && parsed.friends.length > 0) {
              loaded.friends = parsed.friends as Friend[];
            }
          } catch (e) {
            console.warn('Failed to recover friends from legacy storage:', e);
          }
        }
        syncDBToSQLTables(loaded);
        return loaded;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_JSON_KEY);
    let initialDB: AppDB;
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Partial<AppDB>;
      const d = defaultDB();
      initialDB = { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings || {}) } };
    } else {
      initialDB = defaultDB();
    }

    syncDBToSQLTables(initialDB);
    return loadDBFromSQLTables();
  } catch (e) {
    console.error('Failed to load DB, starting fresh SQL DB', e);
    const fresh = defaultDB();
    syncDBToSQLTables(fresh);
    return fresh;
  }
}

export function saveDB(db: AppDB): void {
  syncDBToSQLTables(db);
}

export function expenseFlow(e: Expense): ExpenseFlow {
  return e.flow === 'in' ? 'in' : 'out';
}

export function expenseWalletDelta(e: Expense, db?: AppDB): number {
  if (e.status === 'unpaid') return 0;
  if (e.type === 'by_friend') return 0;
  // If this expense is part of a split group that contains a vendor bill / friend payment (by_friend),
  // no money has left the user's wallet out-of-pocket for this transaction yet.
  if (db && e.groupId) {
    const group = db.expenses.filter(g => g.groupId === e.groupId);
    if (group.some(g => g.type === 'by_friend')) return 0;
  }
  const amt = Number(e.amount) || 0;
  return expenseFlow(e) === 'in' ? amt : -amt;
}

export function walletBalance(db: AppDB, walletId: string): number {
  const w = db.wallets.find(x => x.id === walletId);
  if (!w) return 0;
  let bal = Number(w.openingBalance) || 0;
  db.expenses.forEach(e => {
    if (e.walletId === walletId) bal += expenseWalletDelta(e, db);
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
    const isIncoming = expenseFlow(e) === 'in';
    if (e.type === 'for_friend') {
      if (isIncoming) {
        owedToMe -= amt; // Repayment received from friend reduces what friend owes me
      } else {
        owedToMe += amt; // Money spent for friend increases what friend owes me
      }
    } else if (e.type === 'by_friend') {
      if (isIncoming) {
        owedByMe -= amt; // Repayment paid to friend reduces what I owe friend
      } else {
        owedByMe += amt; // Expense paid by friend for me increases what I owe friend
      }
    }
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
  if (e.status === 'unpaid') return 0;
  if (e.type !== 'personal') return 0;
  if (e.category === 'Transfer') return 0;
  const amt = Number(e.amount) || 0;
  return expenseFlow(e) === 'in' ? -amt : amt;
}

export function unsettledExpensesForFriend(db: AppDB, friendId: string): Expense[] {
  return db.expenses
    .filter(e => e.friendId === friendId && e.type !== 'personal' && !e.settled && expenseFlow(e) === 'out')
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function contactTotalSpent(db: AppDB, contactId: string): number {
  return db.expenses
    .filter(e => e.friendId === contactId)
    .reduce((sum, e) => {
      const amt = Number(e.amount) || 0;
      return sum + (expenseFlow(e) === 'in' ? -amt : amt);
    }, 0);
}

export function contactTransactionCount(db: AppDB, contactId: string): number {
  return db.expenses.filter(e => e.friendId === contactId).length;
}

export function contactLastTransaction(db: AppDB, contactId: string): Expense | null {
  const exps = db.expenses
    .filter(e => e.friendId === contactId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return exps[0] || null;
}

// CRUD helpers that return new DB state (immutable-ish)
export function transferFunds(
  db: AppDB,
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  date: string,
  note: string = ''
): { db: AppDB; groupId: string; fromName: string; toName: string } {
  const fromW = db.wallets.find(w => w.id === fromWalletId);
  const toW = db.wallets.find(w => w.id === toWalletId);
  const fromName = fromW ? fromW.name : 'Wallet';
  const toName = toW ? toW.name : 'Wallet';

  const groupId = uid('trf_grp');
  const timestamp = Date.now();
  const txDate = date || todayISO();
  const amt = Number(amount) || 0;

  const outExp: Expense = {
    id: uid('exp'),
    groupId,
    description: `Transfer to ${toName}${note ? ` (${note})` : ''}`,
    amount: amt,
    category: 'Transfer',
    date: txDate,
    type: 'personal',
    flow: 'out',
    friendId: null,
    walletId: fromWalletId,
    status: 'paid',
    settled: true,
    settlementId: null,
    notes: note || `Transfer to ${toName}`,
    createdAt: timestamp,
  };

  const inExp: Expense = {
    id: uid('exp'),
    groupId,
    description: `Transfer from ${fromName}${note ? ` (${note})` : ''}`,
    amount: amt,
    category: 'Transfer',
    date: txDate,
    type: 'personal',
    flow: 'in',
    friendId: null,
    walletId: toWalletId,
    status: 'paid',
    settled: true,
    settlementId: null,
    notes: note || `Transfer from ${fromName}`,
    createdAt: timestamp + 1,
  };

  return {
    db: { ...db, expenses: [outExp, inExp, ...db.expenses] },
    groupId,
    fromName,
    toName,
  };
}

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
    friendId: data.friendId || null,
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
    return updated;
  });
  return { ...db, expenses };
}

export function deleteExpense(db: AppDB, id: string): AppDB {
  const target = db.expenses.find(x => x.id === id || x.groupId === id);
  if (!target) return db;

  if (target.groupId) {
    return deleteExpenseGroup(db, target.groupId);
  }

  // Fallback: check if there are associated split items with same date & base description
  const cleanDesc = target.description.replace(/\s*\([^)]*\)$/i, '').trim();
  const related = db.expenses.filter(x =>
    x.id !== target.id &&
    !x.groupId &&
    x.date === target.date &&
    x.description.replace(/\s*\([^)]*\)$/i, '').trim() === cleanDesc
  );

  if (related.length > 0) {
    const toDeleteIds = new Set([target.id, ...related.map(r => r.id)]);
    const expenses = db.expenses.filter(x => !toDeleteIds.has(x.id));
    const settlements = (db.settlements || []).map(s => ({
      ...s,
      expenseIds: s.expenseIds.filter(x => !toDeleteIds.has(x))
    })).filter(s => s.expenseIds.length > 0);
    return { ...db, expenses, settlements };
  }

  const targetSettlementId = target.settlementId;
  const expenses = db.expenses.filter(x => x.id !== id);

  const settlements = (db.settlements || []).map(s => {
    if (s.expenseIds.includes(id)) {
      return { ...s, expenseIds: s.expenseIds.filter(x => x !== id) };
    }
    return s;
  }).filter(s => s.expenseIds.length > 0 && s.id !== targetSettlementId);

  return { ...db, expenses, settlements };
}

export function deleteExpenseGroup(db: AppDB, groupId: string): AppDB {
  const groupExpenses = db.expenses.filter(x => x.groupId === groupId);
  if (groupExpenses.length === 0) {
    return { ...db, expenses: db.expenses.filter(x => x.id !== groupId) };
  }

  const groupExpenseIds = new Set(groupExpenses.map(x => x.id));
  const groupSettlementIds = new Set(groupExpenses.map(x => x.settlementId).filter(Boolean) as string[]);

  const expenses = db.expenses.filter(x => x.groupId !== groupId && !groupExpenseIds.has(x.id));

  const settlements = (db.settlements || []).map(s => {
    const remainingIds = s.expenseIds.filter(id => !groupExpenseIds.has(id));
    return { ...s, expenseIds: remainingIds };
  }).filter(s => s.expenseIds.length > 0 && !groupSettlementIds.has(s.id));

  return { ...db, expenses, settlements };
}

export function addFriend(db: AppDB, data: Partial<Friend>): { db: AppDB; friend: Friend } {
  const friend: Friend = {
    id: uid('frnd'),
    name: data.name || 'Unnamed',
    notes: data.notes || '',
    color: data.color || FRIEND_PALETTE[db.friends.length % FRIEND_PALETTE.length],
    createdAt: Date.now(),
    type: data.type || 'friend',
    category: data.category || undefined,
    billingCycle: data.billingCycle || undefined,
    defaultAmount: data.defaultAmount !== undefined ? Number(data.defaultAmount) : undefined,
    website: data.website || '',
    avatarNumber: data.avatarNumber ? String(data.avatarNumber).trim() : undefined,
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

export function recordSettlement(
  db: AppDB,
  friendId: string,
  expenseIds: string[],
  note: string,
  walletId?: string,
  customAmount?: number,
  date?: string
): AppDB {
  const settlementDate = date || todayISO();
  const selectedExpenses = db.expenses.filter(e => expenseIds.includes(e.id));
  
  let owedToMe = 0, owedByMe = 0;
  selectedExpenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    if (e.type === 'for_friend') owedToMe += amt;
    else if (e.type === 'by_friend') owedByMe += amt;
  });
  
  const fullNet = owedToMe - owedByMe;
  const originalTotal = Math.abs(fullNet);
  const actualSettleAmount = (customAmount !== undefined && !isNaN(customAmount) && customAmount > 0)
    ? customAmount
    : originalTotal;

  const remainingAmount = Math.max(0, Number((originalTotal - actualSettleAmount).toFixed(2)));

  const wallet = walletId ? db.wallets.find(w => w.id === walletId) : undefined;

  let remainingCover = actualSettleAmount;
  const selectedSet = new Set(expenseIds);
  const updatedExpenses: Expense[] = [];
  const newExpenses: Expense[] = [];
  const coveredExpenseIds: string[] = [];
  const breakdown: Record<string, SettlementPartialBreakdownItem> = {};

  db.expenses.forEach(e => {
    if (!selectedSet.has(e.id)) {
      updatedExpenses.push(e);
      return;
    }

    const origAmt = e.originalAmount ?? (Number(e.amount) || 0);
    const currentAmt = Number(e.amount) || 0;

    if (remainingCover >= currentAmt) {
      remainingCover -= currentAmt;
      coveredExpenseIds.push(e.id);
      breakdown[e.id] = {
        originalAmount: origAmt,
        settledAmount: currentAmt,
        remainingAmount: 0,
      };
      updatedExpenses.push({
        ...e,
        originalAmount: origAmt,
        settledAmount: currentAmt,
        settled: true,
        settlementId: '', // Will assign below
        date: settlementDate,
      });
    } else if (remainingCover > 0) {
      const coveredPortion = Number(remainingCover.toFixed(2));
      const remainingPortion = Number((currentAmt - coveredPortion).toFixed(2));
      remainingCover = 0;

      coveredExpenseIds.push(e.id);
      breakdown[e.id] = {
        originalAmount: origAmt,
        settledAmount: coveredPortion,
        remainingAmount: remainingPortion,
      };

      updatedExpenses.push({
        ...e,
        originalAmount: origAmt,
        settledAmount: coveredPortion,
        amount: coveredPortion,
        settled: true,
        settlementId: '', // Will assign below
        date: settlementDate,
      });

      const newChildId = uid('exp');
      newExpenses.push({
        ...e,
        id: newChildId,
        parentExpenseId: e.id,
        originalAmount: origAmt,
        amount: remainingPortion,
        description: e.description.includes('Remaining') ? e.description : `${e.description} (Remaining)`,
        settled: false,
        settlementId: null,
        createdAt: Date.now() + 1,
      });
    } else {
      updatedExpenses.push({ ...e, settled: false, settlementId: null });
    }
  });

  const settlementId = uid('stl');
  const s: Settlement = {
    id: settlementId,
    friendId,
    amount: fullNet >= 0 ? actualSettleAmount : -actualSettleAmount,
    date: settlementDate,
    note: note || '',
    expenseIds: coveredExpenseIds.length > 0 ? coveredExpenseIds : expenseIds.slice(),
    createdAt: Date.now(),
    walletId: walletId || undefined,
    paymentMethod: wallet?.name || undefined,
    originalTotal,
    remainingAmount,
    partialBreakdown: Object.keys(breakdown).length > 0 ? breakdown : undefined,
  };

  const finalUpdatedExpenses = updatedExpenses.map(e =>
    e.settlementId === '' ? { ...e, settlementId: s.id } : e
  );

  return {
    ...db,
    settlements: [s, ...(db.settlements || [])],
    expenses: [...newExpenses, ...finalUpdatedExpenses],
  };
}

export function deleteSettlement(db: AppDB, id: string): AppDB {
  const target = (db.settlements || []).find(s => s.id === id);
  if (!target) return db;

  const targetExpenseIds = new Set(target.expenseIds || []);

  // Identify split child expenses that were created during partial settlement
  const childExpenseIdsToDelete = new Set<string>();
  db.expenses.forEach(e => {
    if (e.parentExpenseId && (targetExpenseIds.has(e.parentExpenseId) || e.settlementId === id)) {
      childExpenseIdsToDelete.add(e.id);
    }
  });

  // Filter out the child expenses
  let expenses = db.expenses.filter(e => !childExpenseIdsToDelete.has(e.id));

  // Restore parent / settled expenses back to pre-settlement state
  expenses = expenses.map(e => {
    if (e.settlementId === id || targetExpenseIds.has(e.id)) {
      const restoredAmt = e.originalAmount ?? e.amount;
      return {
        ...e,
        amount: restoredAmt,
        settled: false,
        settlementId: null,
        originalAmount: undefined,
        settledAmount: undefined,
      };
    }
    return e;
  });

  return {
    ...db,
    settlements: (db.settlements || []).filter(x => x.id !== id),
    expenses,
  };
}

export function unsettleExpense(db: AppDB, expenseId: string): AppDB {
  const exp = db.expenses.find(e => e.id === expenseId);
  if (!exp) return db;
  if (exp.settlementId) {
    return deleteSettlement(db, exp.settlementId);
  }
  const expenses = db.expenses.map(e => e.id === expenseId ? { ...e, settled: false, settlementId: null } : e);
  return { ...db, expenses };
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

  const { db: db1, friend: alex } = addFriend(current, { name: 'Alex Rivera' });
  current = db1;
  const { db: db2, friend: priya } = addFriend(current, { name: 'Priya Shah' });
  current = db2;
  const { db: db3, friend: sam } = addFriend(current, { name: 'Sam Okafor' });
  current = db3;

  const defaultWal = current.settings.defaultWalletId || current.wallets[0]?.id || 'wal_cash';

  const expenses = [
    { description: 'Weekly groceries', amount: 64.20, category: 'Groceries', date: d(-2), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: 'Metro card top-up', amount: 25, category: 'Transport', date: d(-4), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: "Dinner at Otto's", amount: 88, category: 'Food', date: d(-5), type: 'for_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Movie night tickets', amount: 34, category: 'Entertainment', date: d(-6), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Uber to airport', amount: 41.50, category: 'Transport', date: d(-9), type: 'by_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Coffee run', amount: 12.75, category: 'Food', date: d(-10), type: 'for_friend' as ExpenseType, friendId: sam.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Electricity bill', amount: 76, category: 'Utilities', date: d(-12), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: 'Weekend cabin trip', amount: 210, category: 'Travel', date: d(-15), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Groceries for the week', amount: 58.40, category: 'Groceries', date: d(-18), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: 'New headphones', amount: 129, category: 'Shopping', date: d(-20), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: 'Gym membership', amount: 45, category: 'Health', date: d(-22), type: 'personal' as ExpenseType, status: 'unpaid' as ExpenseStatus, walletId: defaultWal },
    { description: 'Rent, shared apartment', amount: 900, category: 'Rent', date: d(-25), type: 'by_friend' as ExpenseType, friendId: sam.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Birthday dinner', amount: 96, category: 'Food', date: d(-33), type: 'for_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Streaming subscriptions', amount: 28, category: 'Entertainment', date: d(-40), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: 'Flight tickets split', amount: 340, category: 'Travel', date: d(-48), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
  ];

  expenses.forEach(e => { current = addExpense(current, e); });

  const sampleRules = defaultSampleRecurringRules(defaultWal);
  current = {
    ...current,
    recurringRules: [...(current.recurringRules || []), ...sampleRules],
  };

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
    friendId: data.friendId || null,
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
