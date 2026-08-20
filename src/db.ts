import alasql from 'alasql';
import type { AppDB, Wallet, Friend, Expense, Settlement, ExpenseFlow, ExpenseType, ExpenseStatus, RecurringRule, FrequencyType, ContactType, RecurringKind, SettlementPartialBreakdownItem, Envelope } from './types';

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
    alasql('DROP TABLE IF EXISTS envelopes');
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
    alasql('CREATE TABLE IF NOT EXISTS expenses (id STRING PRIMARY KEY, groupId STRING, description STRING, amount NUMBER, category STRING, date STRING, type STRING, flow STRING, friendId STRING, walletId STRING, status STRING, settled INT, settlementId STRING, notes STRING, createdAt INT, originalAmount NUMBER, settledAmount NUMBER, parentExpenseId STRING, vendorId STRING)');
    alasql('CREATE TABLE IF NOT EXISTS settlements (id STRING PRIMARY KEY, friendId STRING, amount NUMBER, date STRING, note STRING, walletId STRING, createdAt INT, expenseIds STRING, originalTotal NUMBER, remainingAmount NUMBER, partialBreakdown STRING)');
    alasql('CREATE TABLE IF NOT EXISTS recurring_rules (id STRING PRIMARY KEY, title STRING, kind STRING, amount NUMBER, category STRING, walletId STRING, friendId STRING, type STRING, flow STRING, frequency STRING, intervalValue INT, startDate STRING, nextDueDate STRING, autoDeduct INT, status STRING, notes STRING, createdAt INT)');
    alasql('CREATE TABLE IF NOT EXISTS envelopes (id STRING PRIMARY KEY, walletId STRING, name STRING, targetAmount NUMBER, currentAmount NUMBER, color STRING, icon STRING, targetDate STRING, notes STRING, createdAt INT)');
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

  const activeTripRaw = localStorage.getItem('okane_active_trip_v1');
  const tripHistoryRaw = localStorage.getItem('okane_trip_history_v1');
  const presetGroupsRaw = localStorage.getItem('okane_preset_groups_v1');

  if (activeTripRaw !== null) {
    alasql('DELETE FROM settings WHERE st_key = "_active_trip"');
    alasql('INSERT INTO settings VALUES ("_active_trip", ?)', [activeTripRaw]);
  }
  if (tripHistoryRaw !== null) {
    alasql('DELETE FROM settings WHERE st_key = "_trip_history"');
    alasql('INSERT INTO settings VALUES ("_trip_history", ?)', [tripHistoryRaw]);
  }
  if (presetGroupsRaw !== null) {
    alasql('DELETE FROM settings WHERE st_key = "_preset_groups"');
    alasql('INSERT INTO settings VALUES ("_preset_groups", ?)', [presetGroupsRaw]);
  }

  const dump = {
    friends: (alasql('SELECT * FROM friends') as Record<string, unknown>[]) || [],
    wallets: (alasql('SELECT * FROM wallets') as Record<string, unknown>[]) || [],
    expenses: (alasql('SELECT * FROM expenses') as Record<string, unknown>[]) || [],
    settlements: (alasql('SELECT * FROM settlements') as Record<string, unknown>[]) || [],
    recurring_rules: (alasql('SELECT * FROM recurring_rules') as Record<string, unknown>[]) || [],
    envelopes: (alasql('SELECT * FROM envelopes') as Record<string, unknown>[]) || [],
    categories: (alasql('SELECT * FROM categories') as Record<string, unknown>[]) || [],
    settings: (alasql('SELECT * FROM settings') as Record<string, unknown>[]) || [],
  };

  let sql = `-- OKANE RELATIONAL SQL DATABASE BACKUP
-- Generated: ${new Date().toISOString()}

CREATE TABLE IF NOT EXISTS friends (id TEXT PRIMARY KEY, name TEXT, notes TEXT, color TEXT, createdAt INTEGER, type TEXT, category TEXT, billingCycle TEXT, defaultAmount REAL, website TEXT, avatarNumber TEXT);
CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY, name TEXT, openingBalance REAL, currentBalance REAL, color TEXT);
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, groupId TEXT, description TEXT, amount REAL, category TEXT, date TEXT, type TEXT, flow TEXT, friendId TEXT, walletId TEXT, status TEXT, settled INTEGER, settlementId TEXT, notes TEXT, createdAt INTEGER, originalAmount REAL, settledAmount REAL, parentExpenseId TEXT, vendorId TEXT);
CREATE TABLE IF NOT EXISTS settlements (id TEXT PRIMARY KEY, friendId TEXT, amount REAL, date TEXT, note TEXT, walletId TEXT, createdAt INTEGER, expenseIds TEXT, originalTotal REAL, remainingAmount REAL, partialBreakdown TEXT);
CREATE TABLE IF NOT EXISTS recurring_rules (id TEXT PRIMARY KEY, title TEXT, kind TEXT, amount REAL, category TEXT, walletId TEXT, friendId TEXT, type TEXT, flow TEXT, frequency TEXT, intervalValue INTEGER, startDate TEXT, nextDueDate TEXT, autoDeduct INTEGER, status TEXT, notes TEXT, createdAt INTEGER);
CREATE TABLE IF NOT EXISTS envelopes (id TEXT PRIMARY KEY, walletId TEXT, name TEXT, targetAmount REAL, currentAmount REAL, color TEXT, icon TEXT, targetDate TEXT, notes TEXT, createdAt INTEGER);
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
    sql += `INSERT INTO expenses (id, groupId, description, amount, category, date, type, flow, friendId, walletId, status, settled, settlementId, notes, createdAt, originalAmount, settledAmount, parentExpenseId, vendorId) VALUES (${escapeVal(e.id)}, ${escapeVal(e.groupId)}, ${escapeVal(e.description)}, ${escapeVal(e.amount)}, ${escapeVal(e.category)}, ${escapeVal(e.date)}, ${escapeVal(e.type)}, ${escapeVal(e.flow)}, ${escapeVal(e.friendId)}, ${escapeVal(e.walletId)}, ${escapeVal(e.status)}, ${escapeVal(e.settled)}, ${escapeVal(e.settlementId)}, ${escapeVal(e.notes)}, ${escapeVal(e.createdAt)}, ${escapeVal(e.originalAmount)}, ${escapeVal(e.settledAmount)}, ${escapeVal(e.parentExpenseId)}, ${escapeVal(e.vendorId)});\n`;
  });

  sql += `\nDELETE FROM settlements;\n`;
  dump.settlements.forEach(s => {
    sql += `INSERT INTO settlements (id, friendId, amount, date, note, walletId, createdAt, expenseIds, originalTotal, remainingAmount, partialBreakdown) VALUES (${escapeVal(s.id)}, ${escapeVal(s.friendId)}, ${escapeVal(s.amount)}, ${escapeVal(s.date)}, ${escapeVal(s.note)}, ${escapeVal(s.walletId)}, ${escapeVal(s.createdAt)}, ${escapeVal(s.expenseIds)}, ${escapeVal(s.originalTotal)}, ${escapeVal(s.remainingAmount)}, ${escapeVal(s.partialBreakdown)});\n`;
  });

  sql += `\nDELETE FROM recurring_rules;\n`;
  dump.recurring_rules.forEach(r => {
    sql += `INSERT INTO recurring_rules (id, title, kind, amount, category, walletId, friendId, type, flow, frequency, intervalValue, startDate, nextDueDate, autoDeduct, status, notes, createdAt) VALUES (${escapeVal(r.id)}, ${escapeVal(r.title)}, ${escapeVal(r.kind)}, ${escapeVal(r.amount)}, ${escapeVal(r.category)}, ${escapeVal(r.walletId)}, ${escapeVal(r.friendId)}, ${escapeVal(r.type)}, ${escapeVal(r.flow)}, ${escapeVal(r.frequency)}, ${escapeVal(r.intervalValue)}, ${escapeVal(r.startDate)}, ${escapeVal(r.nextDueDate)}, ${escapeVal(r.autoDeduct)}, ${escapeVal(r.status)}, ${escapeVal(r.notes)}, ${escapeVal(r.createdAt)});\n`;
  });

  sql += `\nDELETE FROM envelopes;\n`;
  dump.envelopes.forEach(e => {
    sql += `INSERT INTO envelopes (id, walletId, name, targetAmount, currentAmount, color, icon, targetDate, notes, createdAt) VALUES (${escapeVal(e.id)}, ${escapeVal(e.walletId)}, ${escapeVal(e.name)}, ${escapeVal(e.targetAmount)}, ${escapeVal(e.currentAmount)}, ${escapeVal(e.color)}, ${escapeVal(e.icon)}, ${escapeVal(e.targetDate)}, ${escapeVal(e.notes)}, ${escapeVal(e.createdAt)});\n`;
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
  { id: 'wal_upi', name: 'UPI', openingBalance: 0, color: '#34D399' },
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

export function defaultSampleEnvelopes(walletId: string): Envelope[] {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const targetDateStr = nextYear.toISOString().split('T')[0];

  return [
    {
      id: 'env_emergency',
      walletId,
      name: 'Emergency Fund',
      targetAmount: 10000,
      currentAmount: 3500,
      color: '#10B981',
      icon: 'shield',
      targetDate: targetDateStr,
      notes: '3-6 months reserve fund',
      createdAt: Date.now() - 86400000 * 30,
    },
    {
      id: 'env_vacation',
      walletId,
      name: 'Vacation Savings',
      targetAmount: 3000,
      currentAmount: 1200,
      color: '#3B82F6',
      icon: 'plane',
      targetDate: targetDateStr,
      notes: 'Year-end holiday travel',
      createdAt: Date.now() - 86400000 * 15,
    },
    {
      id: 'env_gadget',
      walletId,
      name: 'New Laptop',
      targetAmount: 2000,
      currentAmount: 800,
      color: '#8B5CF6',
      icon: 'laptop',
      targetDate: targetDateStr,
      notes: 'Hardware upgrade savings',
      createdAt: Date.now() - 86400000 * 10,
    },
  ];
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
    envelopes: defaultSampleEnvelopes(defaultWal),
    settings: {
      currency: 'INR',
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      defaultCategory: 'Food',
      defaultStatus: 'paid',
      defaultWalletId: defaultWal,
      enableAIAssistant: true,
      enableEnvelopes: false,
      enableAutopay: false,
      defaultAiEngine: 'offline',
      devMode: false,
      enableDevSQLConsole: true,
      enableSplitTrips: false,
      enableSampleData: false,
      enableUserGuide: false,
      colorMode: (localStorage.getItem('color-mode') as 'light' | 'dark') || 'dark',
      accent: localStorage.getItem('accent-color') || 'blue',
      customAccentColor: localStorage.getItem('custom-accent-color') || '#6366f1',
      sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
      enableAnimations: true,
      performanceMode: false,
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
      safeInsert('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        e.id, e.groupId || null, e.description, Number(e.amount) || 0, e.category, e.date,
        e.type, e.flow, e.friendId || null, e.walletId || null, e.status, e.settled ? 1 : 0,
        e.settlementId || null, e.notes || '', e.createdAt || Date.now(),
        e.originalAmount != null ? Number(e.originalAmount) : null,
        e.settledAmount != null ? Number(e.settledAmount) : null,
        e.parentExpenseId || null,
        e.vendorId || null
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

    const seenEnvelopes = new Set<string>();
    (db.envelopes || []).forEach(env => {
      if (!env.id || seenEnvelopes.has(env.id)) return;
      seenEnvelopes.add(env.id);
      safeInsert('INSERT INTO envelopes VALUES (?,?,?,?,?,?,?,?,?,?)', [
        env.id, env.walletId, env.name, Number(env.targetAmount) || 0, Number(env.currentAmount) || 0,
        env.color || '#3B82F6', env.icon || 'piggy-bank', env.targetDate || '', env.notes || '', env.createdAt || Date.now()
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

    // Sync Trip and Split data into settings table and localStorage
    const activeTripStr = db.activeTrip !== undefined ? (db.activeTrip ? JSON.stringify(db.activeTrip) : '') : localStorage.getItem('okane_active_trip_v1');
    const tripHistoryStr = db.tripHistory !== undefined ? JSON.stringify(db.tripHistory) : localStorage.getItem('okane_trip_history_v1');
    const presetGroupsStr = db.presetGroups !== undefined ? JSON.stringify(db.presetGroups) : localStorage.getItem('okane_preset_groups_v1');

    if (activeTripStr) {
      safeInsert('INSERT INTO settings VALUES (?,?)', ['_active_trip', activeTripStr]);
      localStorage.setItem('okane_active_trip_v1', activeTripStr);
    } else {
      localStorage.removeItem('okane_active_trip_v1');
    }
    if (tripHistoryStr) {
      safeInsert('INSERT INTO settings VALUES (?,?)', ['_trip_history', tripHistoryStr]);
      localStorage.setItem('okane_trip_history_v1', tripHistoryStr);
    }
    if (presetGroupsStr) {
      safeInsert('INSERT INTO settings VALUES (?,?)', ['_preset_groups', presetGroupsStr]);
      localStorage.setItem('okane_preset_groups_v1', presetGroupsStr);
    }

    const sqlDump = {
      friends: alasql('SELECT * FROM friends'),
      wallets: alasql('SELECT * FROM wallets'),
      expenses: alasql('SELECT * FROM expenses'),
      settlements: alasql('SELECT * FROM settlements'),
      recurring_rules: alasql('SELECT * FROM recurring_rules'),
      envelopes: alasql('SELECT * FROM envelopes'),
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
    const sqlEnvelopes = (alasql('SELECT * FROM envelopes') as Record<string, unknown>[]) || [];
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
      vendorId: e.vendorId ? String(e.vendorId) : null,
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

    const envelopes: Envelope[] = sqlEnvelopes.map(e => ({
      id: String(e.id),
      walletId: String(e.walletId),
      name: String(e.name),
      targetAmount: Number(e.targetAmount) || 0,
      currentAmount: Number(e.currentAmount) || 0,
      color: e.color ? String(e.color) : '#3B82F6',
      icon: e.icon ? String(e.icon) : 'piggy-bank',
      targetDate: e.targetDate ? String(e.targetDate) : undefined,
      notes: e.notes ? String(e.notes) : '',
      createdAt: Number(e.createdAt) || Date.now(),
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
      enableEnvelopes: false,
      enableAutopay: false,
      defaultAiEngine: 'offline',
      devMode: false,
      enableDevSQLConsole: true,
      enableSplitTrips: false,
      enableSampleData: false,
      enableUserGuide: false,
      colorMode: (localStorage.getItem('color-mode') as 'light' | 'dark') || 'light',
      accent: localStorage.getItem('accent-color') || 'blue',
      customAccentColor: localStorage.getItem('custom-accent-color') || '#6366f1',
      sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
      enableAnimations: true,
      performanceMode: false,
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

    if (settingsObj._active_trip !== undefined) {
      const val = typeof settingsObj._active_trip === 'string' ? settingsObj._active_trip : JSON.stringify(settingsObj._active_trip);
      if (val) localStorage.setItem('okane_active_trip_v1', val);
      else localStorage.removeItem('okane_active_trip_v1');
    }
    if (settingsObj._trip_history !== undefined) {
      const val = typeof settingsObj._trip_history === 'string' ? settingsObj._trip_history : JSON.stringify(settingsObj._trip_history);
      if (val) localStorage.setItem('okane_trip_history_v1', val);
    }
    if (settingsObj._preset_groups !== undefined) {
      const val = typeof settingsObj._preset_groups === 'string' ? settingsObj._preset_groups : JSON.stringify(settingsObj._preset_groups);
      if (val) localStorage.setItem('okane_preset_groups_v1', val);
    }

    settingsObj.categories = categories;

    let parsedActiveTrip = null;
    try {
      const raw = localStorage.getItem('okane_active_trip_v1');
      if (raw) parsedActiveTrip = JSON.parse(raw);
    } catch { /* ignore */ }

    let parsedTripHistory = [];
    try {
      const raw = localStorage.getItem('okane_trip_history_v1');
      if (raw) parsedTripHistory = JSON.parse(raw);
    } catch { /* ignore */ }

    let parsedPresetGroups = [];
    try {
      const raw = localStorage.getItem('okane_preset_groups_v1');
      if (raw) parsedPresetGroups = JSON.parse(raw);
    } catch { /* ignore */ }

    const db: AppDB = {
      version: 3,
      friends,
      wallets: wallets.length > 0 ? wallets : JSON.parse(JSON.stringify(DEFAULT_WALLETS)),
      expenses,
      settlements,
      recurringRules,
      envelopes,
      settings: (settingsObj as unknown) as AppDB['settings'],
      activeTrip: parsedActiveTrip,
      tripHistory: parsedTripHistory,
      presetGroups: parsedPresetGroups,
    };

    return db;
  } catch (err) {
    console.error('Error loading DB from SQL tables:', err);
    return defaultDB();
  }
}

// In-memory cache of current DB to avoid re-parsing JSON and executing synchronous SQL dumps on the main UI thread
let cachedAppDB: AppDB | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function loadDB(): AppDB {
  if (cachedAppDB) {
    return cachedAppDB;
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_JSON_KEY);
    if (legacyRaw) {
      try {
        const parsed = JSON.parse(legacyRaw) as Partial<AppDB>;
        if (parsed && typeof parsed === 'object') {
          const d = defaultDB();
          const merged: AppDB = {
            ...d,
            ...parsed,
            settings: { ...d.settings, ...(parsed.settings || {}) },
            wallets: Array.isArray(parsed.wallets) && parsed.wallets.length > 0 ? parsed.wallets : d.wallets,
            friends: Array.isArray(parsed.friends) ? parsed.friends : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
            settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
            recurringRules: Array.isArray(parsed.recurringRules) ? parsed.recurringRules : [],
            envelopes: Array.isArray(parsed.envelopes) ? parsed.envelopes : d.envelopes,
          };
          cachedAppDB = merged;

          // Defer SQL table hydration so it doesn't block the initial Android Webview render frame
          if (typeof window !== 'undefined') {
            const deferInit = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 100));
            deferInit(() => {
              try {
                syncDBToSQLTables(merged);
              } catch (e) {
                console.warn('Deferred SQL sync notice:', e);
              }
            });
          }
          return merged;
        }
      } catch (err) {
        console.warn('Failed parsing direct JSON cache, checking SQL storage...', err);
      }
    }

    initSQLTables();
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
            insertSafe('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.groupId || null, row.description, Number(row.amount) || 0, row.category, row.date,
              row.type, row.flow, row.friendId || null, row.walletId || null, row.status, row.settled ? 1 : 0,
              row.settlementId || null, row.notes || '', row.createdAt || Date.now(),
              row.originalAmount != null ? Number(row.originalAmount) : null,
              row.settledAmount != null ? Number(row.settledAmount) : null,
              row.parentExpenseId || null,
              row.vendorId || null
            ]);
          });
        }

        const seenSettlements = new Set<string>();
        if (Array.isArray(dump.settlements)) {
          dump.settlements.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenSettlements.has(id)) return;
            seenSettlements.add(id);
            insertSafe('INSERT INTO settlements VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.friendId, Number(row.amount) || 0, row.date, row.note || '', row.walletId || null,
              row.createdAt || Date.now(),
              typeof row.expenseIds === 'string' ? row.expenseIds : JSON.stringify(row.expenseIds ?? []),
              row.originalTotal != null ? Number(row.originalTotal) : null,
              row.remainingAmount != null ? Number(row.remainingAmount) : null,
              row.partialBreakdown ? (typeof row.partialBreakdown === 'string' ? row.partialBreakdown : JSON.stringify(row.partialBreakdown)) : null
            ]);
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

        const seenEnvelopes = new Set<string>();
        if (Array.isArray(dump.envelopes)) {
          dump.envelopes.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenEnvelopes.has(id)) return;
            seenEnvelopes.add(id);
            insertSafe('INSERT INTO envelopes VALUES (?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.walletId, row.name, Number(row.targetAmount) || 0, Number(row.currentAmount) || 0,
              row.color || '#3B82F6', row.icon || 'piggy-bank', row.targetDate || '', row.notes || '', row.createdAt || Date.now()
            ]);
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
        cachedAppDB = loaded;
        return loaded;
      }
    }

    const fresh = defaultDB();
    cachedAppDB = fresh;
    syncDBToSQLTables(fresh);
    return fresh;
  } catch (e) {
    console.error('Failed to load DB, starting fresh SQL DB', e);
    const fresh = defaultDB();
    cachedAppDB = fresh;
    return fresh;
  }
}

export function saveDB(db: AppDB): void {
  cachedAppDB = db;

  // Immediate lightweight JSON save to keep UI responsive and safe
  try {
    localStorage.setItem(LEGACY_JSON_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('localStorage save warning:', e);
  }

  // Debounce heavy full SQL relational table syncs and string generation
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    try {
      syncDBToSQLTables(db);
    } catch (e) {
      console.warn('Debounced SQL sync notice:', e);
    }
  }, 300);
}

// Flush pending writes immediately if the Android app is closed/hidden
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cachedAppDB) {
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
      }
      try {
        syncDBToSQLTables(cachedAppDB);
      } catch (e) {
        console.warn('Visibility hidden sync notice:', e);
      }
    }
  });
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
  // If this was a vendor debt settled later, the settlement record already deducted the wallet
  if (e.vendorId && e.vendorSettlementId) return 0;

  const amt = Number(e.amount) || 0;
  return expenseFlow(e) === 'in' ? amt : -amt;
}

export interface DBCalculationCache {
  walletBalances: Map<string, number>;
  totalWalletBalance: number;
  friendBalances: Map<string, { owedToMe: number; owedByMe: number; net: number }>;
  allFriendBalancesSorted: Array<{ friend: Friend; owedToMe: number; owedByMe: number; net: number }>;
  overallBalance: { credit: number; debit: number; net: number };
  contactStats: Map<string, { totalSpent: number; count: number; lastTx: Expense | null }>;
  envelopeAllocated: Map<string, number>;
}

const dbCalculationCache = new WeakMap<AppDB, DBCalculationCache>();

export function getDBCalculationCache(db: AppDB): DBCalculationCache {
  const cached = dbCalculationCache.get(db);
  if (cached) return cached;

  const groupHasByFriend = new Set<string>();
  (db.expenses || []).forEach(e => {
    if (e.groupId && e.type === 'by_friend') {
      groupHasByFriend.add(e.groupId);
    }
  });

  const walletBalances = new Map<string, number>();
  (db.wallets || []).forEach(w => {
    walletBalances.set(w.id, Number(w.openingBalance) || 0);
  });

  const friendBalances = new Map<string, { owedToMe: number; owedByMe: number; net: number }>();
  const contactStats = new Map<string, { totalSpent: number; count: number; lastTx: Expense | null }>();

  const getOrCreateFriendBal = (id: string) => {
    let b = friendBalances.get(id);
    if (!b) {
      b = { owedToMe: 0, owedByMe: 0, net: 0 };
      friendBalances.set(id, b);
    }
    return b;
  };

  const getOrCreateContactStat = (id: string) => {
    let s = contactStats.get(id);
    if (!s) {
      s = { totalSpent: 0, count: 0, lastTx: null };
      contactStats.set(id, s);
    }
    return s;
  };

  (db.friends || []).forEach(f => {
    getOrCreateFriendBal(f.id);
    getOrCreateContactStat(f.id);
  });

  (db.expenses || []).forEach(e => {
    const amt = Number(e.amount) || 0;
    const isIncoming = expenseFlow(e) === 'in';

    // Wallet balance calculation
    if (e.walletId && e.status !== 'unpaid' && e.type !== 'by_friend') {
      const skipGroup = e.groupId ? groupHasByFriend.has(e.groupId) : false;
      const skipVendorSettled = e.vendorId && e.vendorSettlementId;
      if (!skipGroup && !skipVendorSettled) {
        const delta = isIncoming ? amt : -amt;
        walletBalances.set(e.walletId, (walletBalances.get(e.walletId) || 0) + delta);
      }
    }

    // Friend & Contact statistics calculation
    if (e.friendId) {
      const fb = getOrCreateFriendBal(e.friendId);
      const cs = getOrCreateContactStat(e.friendId);
      cs.count += 1;
      cs.totalSpent += (isIncoming ? -amt : amt);
      if (!cs.lastTx || e.date > cs.lastTx.date || (e.date === cs.lastTx.date && (e.createdAt || 0) > (cs.lastTx.createdAt || 0))) {
        cs.lastTx = e;
      }

      if (e.type !== 'personal') {
        if (!e.settled) {
          if (e.type === 'for_friend') {
            if (isIncoming) fb.owedToMe -= amt;
            else fb.owedToMe += amt;
          } else if (e.type === 'by_friend') {
            if (isIncoming) fb.owedByMe -= amt;
            else fb.owedByMe += amt;
          }
        }
      } else if (e.status === 'unpaid' && !e.settled) {
        if (isIncoming) fb.owedToMe += amt;
        else fb.owedByMe += amt;
      }
    }

    if (e.vendorId) {
      const cs = getOrCreateContactStat(e.vendorId);
      cs.count += 1;
      cs.totalSpent += (isIncoming ? -amt : amt);
      if (!cs.lastTx || e.date > cs.lastTx.date || (e.date === cs.lastTx.date && (e.createdAt || 0) > (cs.lastTx.createdAt || 0))) {
        cs.lastTx = e;
      }

      const fb = getOrCreateFriendBal(e.vendorId);
      if (e.status === 'unpaid') {
        const isVendorUnsettled = !e.vendorSettled && (!e.settled || e.type === 'for_friend');
        if (isVendorUnsettled) {
          if (isIncoming) fb.owedToMe += amt;
          else fb.owedByMe += amt;
        }
      } else if (e.type === 'by_friend') {
        const isVendorUnsettled = !e.vendorSettled && !e.settled;
        if (isVendorUnsettled) {
          if (isIncoming) fb.owedByMe -= amt;
          else fb.owedByMe += amt;
        }
      }
    }
  });

  (db.settlements || []).forEach(s => {
    if (s.walletId) {
      const amt = Number(s.amount) || 0;
      walletBalances.set(s.walletId, (walletBalances.get(s.walletId) || 0) + amt);
    }
  });

  friendBalances.forEach(b => {
    b.net = b.owedToMe - b.owedByMe;
  });

  let totalWallet = 0;
  walletBalances.forEach(b => {
    totalWallet += b;
  });

  const allFriendBalancesSorted = (db.friends || [])
    .map(f => ({ friend: f, ...friendBalances.get(f.id)! }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  let credit = 0, debit = 0;
  (db.friends || []).forEach(f => {
    const b = friendBalances.get(f.id);
    if (b) {
      credit += b.owedToMe;
      debit += b.owedByMe;
    }
  });
  const overall = { credit, debit, net: credit - debit };

  const envelopeAllocated = new Map<string, number>();
  (db.envelopes || []).forEach(env => {
    envelopeAllocated.set(env.walletId, (envelopeAllocated.get(env.walletId) || 0) + (Number(env.currentAmount) || 0));
  });

  const cacheEntry: DBCalculationCache = {
    walletBalances,
    totalWalletBalance: totalWallet,
    friendBalances,
    allFriendBalancesSorted,
    overallBalance: overall,
    contactStats,
    envelopeAllocated,
  };

  dbCalculationCache.set(db, cacheEntry);
  return cacheEntry;
}

export function walletBalance(db: AppDB, walletId: string): number {
  return getDBCalculationCache(db).walletBalances.get(walletId) ?? 0;
}

export function totalWalletBalance(db: AppDB): number {
  return getDBCalculationCache(db).totalWalletBalance;
}

export function friendBalance(db: AppDB, friendId: string): { owedToMe: number; owedByMe: number; net: number } {
  return getDBCalculationCache(db).friendBalances.get(friendId) || { owedToMe: 0, owedByMe: 0, net: 0 };
}

export function allFriendBalances(db: AppDB) {
  return getDBCalculationCache(db).allFriendBalancesSorted;
}

export function overallBalance(db: AppDB): { credit: number; debit: number; net: number } {
  return getDBCalculationCache(db).overallBalance;
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
    .filter(e => {
      if (expenseFlow(e) !== 'out') return false;
      // 1. Shared friend expenses (friend owes user)
      if (e.friendId === friendId && e.type !== 'personal') {
        return !e.settled;
      }
      // 2. Unpaid vendor debt (user owes vendor)
      if (e.vendorId === friendId && e.status === 'unpaid') {
        return !e.vendorSettled && (!e.settled || e.type === 'for_friend');
      }
      // 3. Unpaid friend debt
      if (e.friendId === friendId && e.status === 'unpaid') {
        return !e.settled;
      }
      // 4. Vendor billed on credit/tab
      if (e.vendorId === friendId && e.type === 'by_friend') {
        return !e.vendorSettled && !e.settled;
      }
      return false;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export function contactTotalSpent(db: AppDB, contactId: string): number {
  return getDBCalculationCache(db).contactStats.get(contactId)?.totalSpent || 0;
}

export function contactTransactionCount(db: AppDB, contactId: string): number {
  return getDBCalculationCache(db).contactStats.get(contactId)?.count || 0;
}

export function contactLastTransaction(db: AppDB, contactId: string): Expense | null {
  return getDBCalculationCache(db).contactStats.get(contactId)?.lastTx || null;
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
    vendorId: data.vendorId || null,
    walletId: data.type === 'by_friend' ? (data.walletId || '') : (data.walletId || db.settings.defaultWalletId || db.wallets[0]?.id),
    status: (data.status as ExpenseStatus) || db.settings.defaultStatus,
    settled: data.settled !== undefined ? Boolean(data.settled) : false,
    settlementId: data.settlementId !== undefined ? data.settlementId : null,
    notes: data.notes || '',
    createdAt: Date.now(),
    originalAmount: data.originalAmount,
    originalDate: data.originalDate,
    settledAmount: data.settledAmount,
    parentExpenseId: data.parentExpenseId,
    vendorSettled: data.vendorSettled,
    vendorSettlementId: data.vendorSettlementId,
    vendorSettledAmount: data.vendorSettledAmount,
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
  const isDefault = data.isDefault !== undefined ? Boolean(data.isDefault) : (db.wallets.length === 0);
  const wallet: Wallet = {
    id: uid('wal'),
    name: data.name || 'Wallet',
    openingBalance: Number(data.openingBalance) || 0,
    color: data.color || FRIEND_PALETTE[db.wallets.length % FRIEND_PALETTE.length],
    icon: data.icon || 'wallet',
    minBalanceAlert: data.minBalanceAlert !== undefined ? Number(data.minBalanceAlert) : undefined,
    monthlySpendLimit: data.monthlySpendLimit !== undefined ? Number(data.monthlySpendLimit) : undefined,
    isDefault,
    rulesNotes: data.rulesNotes || '',
  };
  
  let nextWallets = [...db.wallets];
  const nextSettings = { ...db.settings };

  if (isDefault) {
    nextWallets = nextWallets.map(w => ({ ...w, isDefault: false }));
    nextSettings.defaultWalletId = wallet.id;
  }
  nextWallets.push(wallet);

  return { db: { ...db, wallets: nextWallets, settings: nextSettings }, wallet };
}

export function updateWallet(db: AppDB, id: string, data: Partial<Wallet>): AppDB {
  const isSettingDefault = data.isDefault === true;
  const nextSettings = { ...db.settings };
  if (isSettingDefault) {
    nextSettings.defaultWalletId = id;
  } else if (data.isDefault === false && db.settings.defaultWalletId === id) {
    // If unsetting default and it was default, ensure a fallback exists
    const fallback = db.wallets.find(w => w.id !== id);
    if (fallback) {
      nextSettings.defaultWalletId = fallback.id;
    }
  }

  return {
    ...db,
    settings: nextSettings,
    wallets: db.wallets.map(w => {
      if (w.id === id) {
        return {
          ...w,
          ...data,
          isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : (w.isDefault ?? (nextSettings.defaultWalletId === id)),
          openingBalance: data.openingBalance !== undefined ? Number(data.openingBalance) : w.openingBalance,
        };
      }
      if (isSettingDefault) {
        return { ...w, isDefault: false };
      }
      return w;
    }),
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
    const isIncoming = expenseFlow(e) === 'in';
    const isSettlingVendor = e.vendorId === friendId;
    const isSettlingFriend = e.friendId === friendId;

    if (isSettlingVendor) {
      // Settling with the vendor! Buying goods/services (flow === 'out') on credit means user owes vendor (owedByMe)
      if (isIncoming) {
        owedToMe += amt;
      } else {
        owedByMe += amt;
      }
    } else if (isSettlingFriend) {
      if (e.type === 'for_friend') {
        if (isIncoming) owedToMe -= amt;
        else owedToMe += amt;
      } else if (e.type === 'by_friend') {
        if (isIncoming) owedByMe -= amt;
        else owedByMe += amt;
      } else if (e.status === 'unpaid') {
        if (isIncoming) owedToMe += amt;
        else owedByMe += amt;
      }
    } else {
      // General debt / contact
      if (isIncoming) owedToMe += amt;
      else owedByMe += amt;
    }
  });
  
  const fullNet = owedToMe - owedByMe;
  const originalTotal = Math.abs(fullNet);
  const isFullSettlement = customAmount === undefined || customAmount === null || customAmount >= originalTotal;
  const actualSettleAmount = (!isFullSettlement && !isNaN(customAmount!) && customAmount! > 0)
    ? customAmount!
    : originalTotal;

  const remainingAmount = isFullSettlement ? 0 : Math.max(0, Number((originalTotal - actualSettleAmount).toFixed(2)));

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

    const isSettlingVendor = e.vendorId === friendId;
    const isSettlingFriend = e.friendId === friendId;
    const willSettleFriend = isSettlingFriend || (!e.friendId && !isSettlingVendor) || e.type === 'personal';
    const willSettleVendor = isSettlingVendor || (!e.vendorId && !isSettlingFriend);

    if (isFullSettlement || remainingCover >= currentAmt) {
      if (!isFullSettlement) {
        remainingCover -= currentAmt;
      }
      coveredExpenseIds.push(e.id);
      breakdown[e.id] = {
        originalAmount: origAmt,
        settledAmount: currentAmt,
        remainingAmount: 0,
      };
      updatedExpenses.push({
        ...e,
        originalAmount: origAmt,
        originalDate: e.originalDate || e.date,
        settledAmount: currentAmt,
        status: (willSettleVendor && willSettleFriend) ? 'paid' : (willSettleVendor ? 'paid' : e.status),
        settled: willSettleFriend ? true : e.settled,
        settlementId: willSettleFriend ? '' : e.settlementId, // Will assign below
        vendorSettled: willSettleVendor ? true : e.vendorSettled,
        vendorSettlementId: isSettlingVendor ? '' : e.vendorSettlementId,
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
        originalDate: e.originalDate || e.date,
        settledAmount: coveredPortion,
        amount: coveredPortion,
        status: (willSettleVendor && willSettleFriend) ? 'paid' : (willSettleVendor ? 'paid' : e.status),
        settled: willSettleFriend ? true : e.settled,
        settlementId: willSettleFriend ? '' : e.settlementId, // Will assign below
        vendorSettled: willSettleVendor ? true : e.vendorSettled,
        vendorSettlementId: isSettlingVendor ? '' : e.vendorSettlementId,
        date: settlementDate,
      });

      const newChildId = uid('exp');
      newExpenses.push({
        ...e,
        id: newChildId,
        parentExpenseId: e.id,
        originalAmount: origAmt,
        originalDate: e.originalDate || e.date,
        amount: remainingPortion,
        description: e.description.includes('Remaining') ? e.description : `${e.description} (Remaining)`,
        status: e.status === 'unpaid' ? 'unpaid' : e.status,
        settled: willSettleFriend ? false : e.settled,
        settlementId: null,
        vendorSettled: isSettlingVendor ? false : e.vendorSettled,
        vendorSettlementId: null,
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

  const finalUpdatedExpenses = updatedExpenses.map(e => {
    let res = e;
    if (res.settlementId === '') {
      res = { ...res, settlementId: s.id };
    }
    if (res.vendorSettlementId === '') {
      res = { ...res, vendorSettlementId: s.id };
    }
    return res;
  });

  return {
    ...db,
    settlements: [s, ...(db.settlements || [])],
    expenses: [...newExpenses, ...finalUpdatedExpenses],
  };
}

export function deleteSettlement(db: AppDB, id: string): AppDB {
  const target = (db.settlements || []).find(s => s.id === id);
  const targetExpenseIds = new Set(target?.expenseIds || []);

  const childExpenseIdsToDelete = new Set<string>();
  const parentExpenseIdsToRestore = new Set<string>(targetExpenseIds);

  db.expenses.forEach(e => {
    if (e.settlementId === id || e.vendorSettlementId === id) {
      if (e.parentExpenseId) {
        childExpenseIdsToDelete.add(e.id);
        parentExpenseIdsToRestore.add(e.parentExpenseId);
      } else {
        parentExpenseIdsToRestore.add(e.id);
      }
    } else if (e.parentExpenseId && targetExpenseIds.has(e.parentExpenseId)) {
      childExpenseIdsToDelete.add(e.id);
      parentExpenseIdsToRestore.add(e.parentExpenseId);
    }
  });

  // Filter out child expenses created during partial settlement
  let expenses = db.expenses.filter(e => !childExpenseIdsToDelete.has(e.id));

  // Restore parent / settled expenses back to pre-settlement state
  expenses = expenses.map(e => {
    const isMainSettlement = e.settlementId === id;
    const isVendorSettlement = e.vendorSettlementId === id;

    if (isMainSettlement || isVendorSettlement || parentExpenseIdsToRestore.has(e.id) || (e.groupId && parentExpenseIdsToRestore.has(e.groupId))) {
      const restoredAmt = e.originalAmount ?? e.amount;
      const restoredDate = e.originalDate || e.date;
      return {
        ...e,
        amount: restoredAmt,
        date: restoredDate,
        status: (e.vendorId && (!e.vendorSettled || isVendorSettlement)) ? 'unpaid' : e.status,
        settled: isMainSettlement ? false : e.settled,
        settlementId: isMainSettlement ? null : e.settlementId,
        vendorSettled: isVendorSettlement ? false : e.vendorSettled,
        vendorSettlementId: isVendorSettlement ? null : e.vendorSettlementId,
        originalAmount: undefined,
        originalDate: undefined,
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
  if (expenseId.startsWith('stl_') || (db.settlements || []).some(s => s.id === expenseId)) {
    return deleteSettlement(db, expenseId);
  }

  const exp = db.expenses.find(e => e.id === expenseId);
  if (!exp) {
    const groupExps = db.expenses.filter(e => e.groupId === expenseId);
    if (groupExps.length > 0) {
      const stl = (db.settlements || []).find(s =>
        groupExps.some(ge => (s.expenseIds || []).includes(ge.id) || (ge.settlementId === s.id))
      );
      if (stl) return deleteSettlement(db, stl.id);

      const childIds = new Set(groupExps.filter(e => e.parentExpenseId).map(e => e.id));
      const expenses = db.expenses.filter(e => !childIds.has(e.id)).map(e => {
        if (e.groupId === expenseId) {
          return {
            ...e,
            amount: e.originalAmount ?? e.amount,
            date: e.originalDate || e.date,
            settled: false,
            settlementId: null,
            originalAmount: undefined,
            originalDate: undefined,
            settledAmount: undefined,
          };
        }
        return e;
      });
      return { ...db, expenses };
    }
    return db;
  }

  // 1. Direct settlementId
  if (exp.settlementId) {
    return deleteSettlement(db, exp.settlementId);
  }

  // 2. Parent expense check
  const parentId = exp.parentExpenseId;
  if (parentId) {
    const parentExp = db.expenses.find(e => e.id === parentId);
    if (parentExp?.settlementId) {
      return deleteSettlement(db, parentExp.settlementId);
    }
  }

  // 3. Search settlements for expenseId or parentExpenseId
  const stl = (db.settlements || []).find(s =>
    (s.expenseIds || []).includes(exp.id) ||
    (parentId && (s.expenseIds || []).includes(parentId))
  );
  if (stl) {
    return deleteSettlement(db, stl.id);
  }

  // 4. Group ID check for split/grouped expenses
  if (exp.groupId) {
    const groupExpenses = db.expenses.filter(e => e.groupId === exp.groupId);
    for (const ge of groupExpenses) {
      if (ge.settlementId) {
        return deleteSettlement(db, ge.settlementId);
      }
      const groupStl = (db.settlements || []).find(s =>
        (s.expenseIds || []).includes(ge.id) ||
        (ge.parentExpenseId && (s.expenseIds || []).includes(ge.parentExpenseId))
      );
      if (groupStl) {
        return deleteSettlement(db, groupStl.id);
      }
    }
  }

  // 5. Fallback reset for this expense and its parent/child relationships
  const parentIdToRestore = exp.parentExpenseId || exp.id;
  const childIdsToDelete = new Set(
    db.expenses.filter(e => e.parentExpenseId === parentIdToRestore).map(e => e.id)
  );

  const expenses = db.expenses
    .filter(e => !childIdsToDelete.has(e.id))
    .map(e => {
      if (e.id === parentIdToRestore || e.id === expenseId || (exp.groupId && e.groupId === exp.groupId)) {
        const restoredAmt = e.originalAmount ?? e.amount;
        const restoredDate = e.originalDate || e.date;
        return {
          ...e,
          amount: restoredAmt,
          date: restoredDate,
          settled: false,
          settlementId: null,
          originalAmount: undefined,
          originalDate: undefined,
          settledAmount: undefined,
        };
      }
      return e;
    });

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

export function walletEnvelopeAllocated(db: AppDB, walletId: string): number {
  return getDBCalculationCache(db).envelopeAllocated.get(walletId) || 0;
}

export function walletUnallocatedBalance(db: AppDB, walletId: string): number {
  const total = walletBalance(db, walletId);
  const allocated = walletEnvelopeAllocated(db, walletId);
  return total - allocated;
}

export function addEnvelope(db: AppDB, data: Partial<Envelope>): { db: AppDB; envelope: Envelope } {
  const walId = data.walletId || db.settings.defaultWalletId || db.wallets[0]?.id || 'wal_cash';
  const envelope: Envelope = {
    id: uid('env'),
    walletId: walId,
    name: data.name?.trim() || 'New Goal Envelope',
    targetAmount: Math.max(0, Number(data.targetAmount) || 0),
    currentAmount: Math.max(0, Number(data.currentAmount) || 0),
    color: data.color || '#3B82F6',
    icon: data.icon || 'piggy-bank',
    targetDate: data.targetDate || '',
    notes: data.notes?.trim() || '',
    createdAt: Date.now(),
  };
  return {
    db: {
      ...db,
      envelopes: [envelope, ...(db.envelopes || [])],
    },
    envelope,
  };
}

export function updateEnvelope(db: AppDB, id: string, data: Partial<Envelope>): AppDB {
  const envelopes = (db.envelopes || []).map(e => {
    if (e.id !== id) return e;
    const updated = { ...e, ...data };
    if (data.targetAmount !== undefined) updated.targetAmount = Math.max(0, Number(data.targetAmount) || 0);
    if (data.currentAmount !== undefined) updated.currentAmount = Math.max(0, Number(data.currentAmount) || 0);
    return updated;
  });
  return { ...db, envelopes };
}

export function deleteEnvelope(db: AppDB, id: string): AppDB {
  return {
    ...db,
    envelopes: (db.envelopes || []).filter(e => e.id !== id),
  };
}

export function adjustEnvelopeBalance(db: AppDB, id: string, delta: number): AppDB {
  const envelopes = (db.envelopes || []).map(e => {
    if (e.id !== id) return e;
    const nextAmt = Math.max(0, Number((e.currentAmount + delta).toFixed(2)));
    return { ...e, currentAmount: nextAmt };
  });
  return { ...db, envelopes };
}
