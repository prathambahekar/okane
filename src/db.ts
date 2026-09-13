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
    alasql('CREATE TABLE IF NOT EXISTS wallets (id STRING PRIMARY KEY, name STRING, openingBalance NUMBER, currentBalance NUMBER, color STRING, icon STRING, minBalanceAlert NUMBER, monthlySpendLimit NUMBER, isDefault INT, isHidden INT, rulesNotes STRING)');
    alasql('CREATE TABLE IF NOT EXISTS expenses (id STRING PRIMARY KEY, groupId STRING, description STRING, amount NUMBER, category STRING, date STRING, type STRING, flow STRING, friendId STRING, walletId STRING, status STRING, settled INT, settlementId STRING, notes STRING, createdAt INT, originalAmount NUMBER, originalDate STRING, settledAmount NUMBER, parentExpenseId STRING, vendorId STRING, vendorSettled INT, vendorSettlementId STRING, vendorSettledAmount NUMBER)');
    alasql('CREATE TABLE IF NOT EXISTS settlements (id STRING PRIMARY KEY, friendId STRING, amount NUMBER, date STRING, note STRING, walletId STRING, paymentMethod STRING, createdAt INT, expenseIds STRING, originalTotal NUMBER, remainingAmount NUMBER, partialBreakdown STRING)');
    alasql('CREATE TABLE IF NOT EXISTS recurring_rules (id STRING PRIMARY KEY, title STRING, kind STRING, amount NUMBER, category STRING, walletId STRING, friendId STRING, type STRING, flow STRING, frequency STRING, intervalValue INT, startDate STRING, nextDueDate STRING, autoDeduct INT, lastDeductedDate STRING, lastLoggedDate STRING, status STRING, notes STRING, createdAt INT)');
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
  let isEscaped = false;

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

    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
      current += char;
      isEscaped = true;
      continue;
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
  ensureSQLTablesSynced();
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

export function downloadFile(content: string, fileName: string, mimeType = 'text/plain;charset=utf-8'): boolean {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch { /* ignore */ }
    }, 1500);
    return true;
  } catch (err) {
    console.error('File download failed:', err);
    return false;
  }
}

export function generateSQLDumpString(providedDB?: AppDB): string {
  // Ensure SQL tables are completely synchronized with the latest application state before dumping
  try {
    const currentAppDB = providedDB || cachedAppDB || loadDB();
    if (currentAppDB) {
      syncDBToSQLTables(currentAppDB);
    }
  } catch (e) {
    console.warn('[SQL Dump] Pre-sync error:', e);
  }

  initSQLTables();

  const getLocal = (k: string) => (typeof localStorage !== 'undefined' ? (localStorage.getItem(k) || '') : '');
  const activeTripRaw = getLocal('okane_active_trip_v1');
  const tripHistoryRaw = getLocal('okane_trip_history_v1');
  const presetGroupsRaw = getLocal('okane_preset_groups_v1');

  if (activeTripRaw) {
    try {
      alasql('DELETE FROM settings WHERE st_key = "_active_trip"');
      alasql('INSERT INTO settings VALUES ("_active_trip", ?)', [activeTripRaw]);
    } catch { /* ignore */ }
  }
  if (tripHistoryRaw) {
    try {
      alasql('DELETE FROM settings WHERE st_key = "_trip_history"');
      alasql('INSERT INTO settings VALUES ("_trip_history", ?)', [tripHistoryRaw]);
    } catch { /* ignore */ }
  }
  if (presetGroupsRaw) {
    try {
      alasql('DELETE FROM settings WHERE st_key = "_preset_groups"');
      alasql('INSERT INTO settings VALUES ("_preset_groups", ?)', [presetGroupsRaw]);
    } catch { /* ignore */ }
  }

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
CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY, name TEXT, openingBalance REAL, currentBalance REAL, color TEXT, icon TEXT, minBalanceAlert REAL, monthlySpendLimit REAL, isDefault INTEGER, isHidden INTEGER, rulesNotes TEXT);
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, groupId TEXT, description TEXT, amount REAL, category TEXT, date TEXT, type TEXT, flow TEXT, friendId TEXT, walletId TEXT, status TEXT, settled INTEGER, settlementId TEXT, notes TEXT, createdAt INTEGER, originalAmount REAL, originalDate TEXT, settledAmount REAL, parentExpenseId TEXT, vendorId TEXT, vendorSettled INTEGER, vendorSettlementId TEXT, vendorSettledAmount REAL);
CREATE TABLE IF NOT EXISTS settlements (id TEXT PRIMARY KEY, friendId TEXT, amount REAL, date TEXT, note TEXT, walletId TEXT, paymentMethod TEXT, createdAt INTEGER, expenseIds TEXT, originalTotal REAL, remainingAmount REAL, partialBreakdown TEXT);
CREATE TABLE IF NOT EXISTS recurring_rules (id TEXT PRIMARY KEY, title TEXT, kind TEXT, amount REAL, category TEXT, walletId TEXT, friendId TEXT, type TEXT, flow TEXT, frequency TEXT, intervalValue INTEGER, startDate TEXT, nextDueDate TEXT, autoDeduct INTEGER, lastDeductedDate TEXT, lastLoggedDate TEXT, status TEXT, notes TEXT, createdAt INTEGER);
CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY, color TEXT, icon TEXT);
CREATE TABLE IF NOT EXISTS settings (st_key TEXT PRIMARY KEY, st_val TEXT);

`;

  const escapeVal = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
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
    sql += `INSERT INTO wallets (id, name, openingBalance, currentBalance, color, icon, minBalanceAlert, monthlySpendLimit, isDefault, isHidden, rulesNotes) VALUES (${escapeVal(w.id)}, ${escapeVal(w.name)}, ${escapeVal(w.openingBalance)}, ${escapeVal(w.currentBalance ?? w.openingBalance)}, ${escapeVal(w.color)}, ${escapeVal(w.icon)}, ${escapeVal(w.minBalanceAlert)}, ${escapeVal(w.monthlySpendLimit)}, ${escapeVal(w.isDefault)}, ${escapeVal(w.isHidden)}, ${escapeVal(w.rulesNotes)});\n`;
  });

  sql += `\nDELETE FROM expenses;\n`;
  dump.expenses.forEach(e => {
    sql += `INSERT INTO expenses (id, groupId, description, amount, category, date, type, flow, friendId, walletId, status, settled, settlementId, notes, createdAt, originalAmount, originalDate, settledAmount, parentExpenseId, vendorId, vendorSettled, vendorSettlementId, vendorSettledAmount) VALUES (${escapeVal(e.id)}, ${escapeVal(e.groupId)}, ${escapeVal(e.description)}, ${escapeVal(e.amount)}, ${escapeVal(e.category)}, ${escapeVal(e.date)}, ${escapeVal(e.type)}, ${escapeVal(e.flow)}, ${escapeVal(e.friendId)}, ${escapeVal(e.walletId)}, ${escapeVal(e.status)}, ${escapeVal(e.settled)}, ${escapeVal(e.settlementId)}, ${escapeVal(e.notes)}, ${escapeVal(e.createdAt)}, ${escapeVal(e.originalAmount)}, ${escapeVal(e.originalDate)}, ${escapeVal(e.settledAmount)}, ${escapeVal(e.parentExpenseId)}, ${escapeVal(e.vendorId)}, ${escapeVal(e.vendorSettled)}, ${escapeVal(e.vendorSettlementId)}, ${escapeVal(e.vendorSettledAmount)});\n`;
  });

  sql += `\nDELETE FROM settlements;\n`;
  dump.settlements.forEach(s => {
    sql += `INSERT INTO settlements (id, friendId, amount, date, note, walletId, paymentMethod, createdAt, expenseIds, originalTotal, remainingAmount, partialBreakdown) VALUES (${escapeVal(s.id)}, ${escapeVal(s.friendId)}, ${escapeVal(s.amount)}, ${escapeVal(s.date)}, ${escapeVal(s.note)}, ${escapeVal(s.walletId)}, ${escapeVal(s.paymentMethod)}, ${escapeVal(s.createdAt)}, ${escapeVal(s.expenseIds)}, ${escapeVal(s.originalTotal)}, ${escapeVal(s.remainingAmount)}, ${escapeVal(s.partialBreakdown)});\n`;
  });

  sql += `\nDELETE FROM recurring_rules;\n`;
  dump.recurring_rules.forEach(r => {
    sql += `INSERT INTO recurring_rules (id, title, kind, amount, category, walletId, friendId, type, flow, frequency, intervalValue, startDate, nextDueDate, autoDeduct, lastDeductedDate, lastLoggedDate, status, notes, createdAt) VALUES (${escapeVal(r.id)}, ${escapeVal(r.title)}, ${escapeVal(r.kind)}, ${escapeVal(r.amount)}, ${escapeVal(r.category)}, ${escapeVal(r.walletId)}, ${escapeVal(r.friendId)}, ${escapeVal(r.type)}, ${escapeVal(r.flow)}, ${escapeVal(r.frequency)}, ${escapeVal(r.intervalValue)}, ${escapeVal(r.startDate)}, ${escapeVal(r.nextDueDate)}, ${escapeVal(r.autoDeduct)}, ${escapeVal(r.lastDeductedDate)}, ${escapeVal(r.lastLoggedDate)}, ${escapeVal(r.status)}, ${escapeVal(r.notes)}, ${escapeVal(r.createdAt)});\n`;
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

export function generateJSONBackupString(providedDB?: AppDB): string {
  const currentDB = providedDB || cachedAppDB || loadDB();
  return JSON.stringify(currentDB, null, 2);
}

export function generateCSVExportString(providedDB?: AppDB): string {
  const currentDB = providedDB || cachedAppDB || loadDB();
  const walletsMap = new Map((currentDB.wallets || []).map(w => [w.id, w.name]));
  const friendsMap = new Map((currentDB.friends || []).map(f => [f.id, f.name]));
  const currency = currentDB.settings?.currency || 'INR';

  const headers = ['Date', 'Description', 'Amount', 'Currency', 'Category', 'Type', 'Flow', 'Contact/Friend', 'Wallet', 'Status', 'Settled', 'Notes'];

  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = (currentDB.expenses || []).map(e => [
    escapeCSV(e.date),
    escapeCSV(e.description),
    escapeCSV(e.amount),
    escapeCSV(currency),
    escapeCSV(e.category),
    escapeCSV(e.type),
    escapeCSV(e.flow),
    escapeCSV(e.friendId ? friendsMap.get(e.friendId) || e.friendId : ''),
    escapeCSV(e.walletId ? walletsMap.get(e.walletId) || e.walletId : ''),
    escapeCSV(e.status),
    escapeCSV(e.settled ? 'Yes' : 'No'),
    escapeCSV(e.notes || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
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
    let q = stmt.trim();
    if (!q) return;

    // Normalize any non-standard SQLite syntax to standard AlaSQL statements
    q = q.replace(/^INSERT\s+OR\s+(?:REPLACE|IGNORE)\s+INTO\s+/i, 'INSERT INTO ');

    try {
      alasql(q);
    } catch (err) {
      let handled = false;
      const positionalMatch = q.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)(?:\s*\(([\s\S]*?)\))?\s+VALUES\s*\(([\s\S]*)\);?$/i);
      if (positionalMatch) {
        const rawTbl = positionalMatch[1].toLowerCase();
        const targetTable = rawTbl === 'contacts' ? 'friends' : rawTbl;
        try {
          const tableObj = (alasql.tables as Record<string, { columns?: { columnid: string }[] }>)[targetTable];
          const explicitCols = positionalMatch[2] ? positionalMatch[2].split(',').map(s => s.trim()) : null;
          const valuesStr = positionalMatch[3];
          const parsedVals = splitSqlValues(valuesStr);
          if (tableObj && tableObj.columns && tableObj.columns.length > 0) {
            const colNames = explicitCols || tableObj.columns.map(c => c.columnid);
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

export function defaultSampleRecurringRules(walletId: string, isINR: boolean = true): RecurringRule[] {
  const t = todayISO();
  const y = (() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - 1);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  })();
  const val = (usd: number, inr: number) => (isINR ? inr : usd);

  return [
    {
      id: 'rec_netflix',
      title: 'Netflix Subscription',
      kind: 'autopay',
      amount: val(14.99, 199),
      category: 'Entertainment',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'monthly',
      intervalValue: 1,
      startDate: t,
      nextDueDate: t, // Due today for immediate notification
      autoDeduct: false,
      status: 'active',
      notes: 'Monthly standard HD plan',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'rec_spotify',
      title: 'Spotify Premium',
      kind: 'autopay',
      amount: val(9.99, 119),
      category: 'Entertainment',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'monthly',
      intervalValue: 1,
      startDate: t,
      nextDueDate: t, // Due today for immediate notification
      autoDeduct: false,
      status: 'active',
      notes: 'Individual music subscription',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'rec_tiffin',
      title: isINR ? 'Daily Tiffin Service' : 'Daily Lunch Delivery',
      kind: 'quick_log',
      amount: val(6.5, 80),
      category: 'Food',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'daily',
      intervalValue: 1,
      startDate: t,
      status: 'active',
      lastLoggedDate: y, // Logged yesterday -> Due today in notifications
      notes: 'Daily lunch meal',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'rec_recharge',
      title: isINR ? 'Mobile Recharge (2 Months)' : 'Mobile Plan Renewal',
      kind: 'quick_log',
      amount: val(35, 479),
      category: 'Utilities',
      walletId,
      type: 'personal',
      flow: 'out',
      frequency: 'custom_months',
      intervalValue: 2,
      startDate: t,
      status: 'active',
      lastLoggedDate: y, // Logged yesterday -> Due today in notifications
      notes: 'Prepaid phone plan',
      createdAt: Date.now() - 86400000,
    }
  ];
}

export const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#F97316', icon: 'food' },
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
  { id: 'wal_cash', name: 'Cash', openingBalance: 0, color: '#FBBF24', icon: 'cash' },
  { id: 'wal_upi', name: 'UPI', openingBalance: 0, color: '#34D399', icon: 'card' },
];

export const FRIEND_PALETTE = [
  '#4F46E5', '#059669', '#D97706', '#2563EB', '#7C3AED',
  '#E11D48', '#0D9488', '#0284C7',
];

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  country: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom' },
  { code: 'AED', symbol: 'د.إ', name: 'Emirati Dirham', country: 'United Arab Emirates' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', country: 'Singapore' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', country: 'Saudi Arabia' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', country: 'Switzerland' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', country: 'Malaysia' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', country: 'Thailand' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', country: 'Indonesia' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', country: 'Philippines' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', country: 'Vietnam' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', country: 'South Korea' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', country: 'New Zealand' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', country: 'Hong Kong' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', country: 'Brazil' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', country: 'Mexico' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', country: 'Turkey' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', country: 'Russia' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', country: 'Sweden' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', country: 'Norway' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', country: 'Denmark' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', country: 'Poland' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', country: 'Czech Republic' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', country: 'Hungary' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', country: 'Romania' },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel', country: 'Israel' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', country: 'Egypt' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'Pakistan' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', country: 'Sri Lanka' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', country: 'Nepal' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', country: 'Qatar' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', country: 'Kuwait' },
  { code: 'OMR', symbol: 'RO', name: 'Omani Rial', country: 'Oman' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', country: 'Bahrain' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', country: 'Jordan' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', country: 'Chile' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', country: 'Colombia' },
  { code: 'ARS', symbol: 'ARS$', name: 'Argentine Peso', country: 'Argentina' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', country: 'Peru' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'Ghana' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', country: 'Taiwan' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge', country: 'Kazakhstan' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', country: 'Ukraine' },
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', country: 'Morocco' },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', country: 'Tunisia' },
  { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar', country: 'Algeria' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón', country: 'Costa Rica' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', country: 'Uruguay' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso', country: 'Dominican Republic' },
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
      enableAutopay: true,
      devMode: false,
      enableDevSQLConsole: false,
      enableSplitTrips: true,
      enableUserGuide: false,
      colorMode: (typeof localStorage !== 'undefined' ? (localStorage.getItem('color-mode') as 'light' | 'dark') : 'dark') || 'dark',
      accent: 'monochrome',
      customAccentColor: (typeof localStorage !== 'undefined' ? localStorage.getItem('custom-accent-color') : '#6366f1') || '#6366f1',
      sidebarCollapsed: typeof localStorage !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false,
      enableAnimations: true,
      performanceMode: false,
      enableSecurityLock: false,
      enableBiometricLock: false,
      securityPin: '',
      requireBiometricOnResume: false,
      autoUnlockOnFace: false,
      hideScrollbar: typeof localStorage !== 'undefined' ? (localStorage.getItem('hide_scrollbar') !== null ? localStorage.getItem('hide_scrollbar') === 'true' : true) : true,
      searchLocation: (typeof localStorage !== 'undefined' ? (localStorage.getItem('search_location') as 'floating' | 'topbar') : 'topbar') || 'topbar',
      autoOpenKeyboard: typeof localStorage !== 'undefined' ? (localStorage.getItem('auto_open_keyboard') === 'true') : false,
      floatingSidebar: typeof localStorage !== 'undefined' ? localStorage.getItem('sidebar_floating') === 'true' : false,
      hideAmounts: typeof localStorage !== 'undefined' ? localStorage.getItem('hide_amounts') === 'true' : false,
      hideNavLabels: typeof localStorage !== 'undefined' ? (localStorage.getItem('hide_nav_labels') !== null ? localStorage.getItem('hide_nav_labels') === 'true' : true) : true,
      enableDummyData: false,
    },
    recurringRules: [],
  };
}

export function sanitizeLoadedDB(rawDB: unknown): AppDB {
  const d = defaultDB();
  if (!rawDB || typeof rawDB !== 'object') {
    return d;
  }
  const parsed = rawDB as Partial<AppDB>;

  const rawWallets = Array.isArray(parsed.wallets) && parsed.wallets.length > 0
    ? parsed.wallets.filter(w => w && typeof w === 'object' && w.id && w.name)
    : d.wallets;
  const safeWallets = (rawWallets.length > 0 ? rawWallets : d.wallets).map(w => {
    let icon = w.icon;
    if (!icon || icon === 'wallet') {
      const n = (w.name || '').toLowerCase();
      icon = 'card';
      if (n.includes('cash') || w.id === 'wal_cash') icon = 'cash';
      else if (n.includes('upi') || n.includes('bhim') || w.id === 'wal_upi') icon = 'other_upi';
      else if (n.includes('gpay') || n.includes('google')) icon = 'gpay';
      else if (n.includes('phonepe') || n.includes('phone')) icon = 'phonepe';
      else if (n.includes('paytm')) icon = 'paytm';
      else if (n.includes('amazon')) icon = 'amazonpay';
      else if (n.includes('bank') || n.includes('account') || n.includes('hdfc') || n.includes('sbi') || n.includes('icici')) icon = 'bank';
      else if (n.includes('card') || n.includes('debit') || n.includes('credit')) icon = 'card';
      else if (n.includes('apple')) icon = 'applepay';
      else if (n.includes('cred')) icon = 'cred';
    }
    return {
      ...w,
      icon,
      isDefault: Boolean(w.isDefault),
      isHidden: Boolean(w.isHidden),
    };
  });

  const rawCategories = parsed.settings?.categories;
  const categories = Array.isArray(rawCategories) && rawCategories.length > 0
    ? rawCategories.filter(c => c && typeof c === 'object' && c.name)
    : d.settings.categories;
  const safeCategories = categories.length > 0 ? categories : d.settings.categories;

  const rawFriends = Array.isArray(parsed.friends)
    ? parsed.friends.filter(f => f && typeof f === 'object' && f.id && f.name)
    : [];
  const friends = rawFriends.map(f => {
    if (f.type === 'vendor' && (f.color === '#6366f1' || !f.color)) {
      return { ...f, color: '#f59e0b' };
    }
    return f;
  });

  const expenses = Array.isArray(parsed.expenses)
    ? parsed.expenses.filter(e => e && typeof e === 'object' && e.id && e.description !== undefined)
    : [];

  const settlements = Array.isArray(parsed.settlements)
    ? parsed.settlements.filter(s => s && typeof s === 'object' && s.id)
    : [];

  const seenRuleIds = new Set<string>();
  const recurringRules = Array.isArray(parsed.recurringRules)
    ? parsed.recurringRules.filter(r => {
        if (!r || typeof r !== 'object' || !r.id || !r.title) return false;
        if (seenRuleIds.has(r.id)) return false;
        seenRuleIds.add(r.id);
        return true;
      })
    : [];

  const settings = {
    ...d.settings,
    ...(parsed.settings || {}),
    enableSplitTrips: parsed.settings?.enableSplitTrips ?? true,
    hideNavLabels: parsed.settings?.hideNavLabels ?? (typeof localStorage !== 'undefined' && localStorage.getItem('hide_nav_labels') !== null ? localStorage.getItem('hide_nav_labels') === 'true' : true),
    categories: safeCategories,
    currency: parsed.settings?.currency || 'INR',
    defaultWalletId: parsed.settings?.defaultWalletId || safeWallets[0].id,
    enableSecurityLock: parsed.settings?.enableSecurityLock === true && Boolean(parsed.settings?.securityPin),
    enableBiometricLock: parsed.settings?.enableBiometricLock === true && Boolean(parsed.settings?.securityPin),
    autoUnlockOnFace: parsed.settings?.autoUnlockOnFace === true && Boolean(parsed.settings?.enableSecurityLock),
    requireBiometricOnResume: parsed.settings?.requireBiometricOnResume === true,
    autoOpenKeyboard: parsed.settings?.autoOpenKeyboard === true || (typeof localStorage !== 'undefined' && localStorage.getItem('auto_open_keyboard') === 'true'),
  };

  return {
    version: 3,
    friends,
    wallets: safeWallets,
    expenses,
    settlements,
    recurringRules,
    settings,
    activeTrip: parsed.activeTrip ?? null,
    tripHistory: Array.isArray(parsed.tripHistory) ? parsed.tripHistory : [],
    presetGroups: Array.isArray(parsed.presetGroups) ? parsed.presetGroups : [],
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

let isSQLDirty = false;

export function ensureSQLTablesSynced(explicitDB?: AppDB): void {
  if (!isSQLDirty && !explicitDB) return;
  const target = explicitDB || cachedAppDB || loadDB();
  syncDBToSQLTables(target);
  isSQLDirty = false;
}

export function syncDBToSQLTables(db: AppDB): void {
  isSQLDirty = false;
  resetSQLTables();
  try {
    const safeInsert = (sql: string, params: unknown[]) => {
      try {
        alasql(sql, params);
      } catch (e) {
        console.warn('SQL Insert warning:', e);
      }
    };

    const getLocal = (k: string) => (typeof localStorage !== 'undefined' ? (localStorage.getItem(k) || '') : '');
    const setLocal = (k: string, v: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); };
    const removeLocal = (k: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); };

    const seenFriends = new Set<string>();
    (db.friends || []).forEach(f => {
      if (!f.id || seenFriends.has(f.id)) return;
      seenFriends.add(f.id);
      safeInsert('INSERT INTO friends (id, name, notes, color, createdAt, type, category, billingCycle, defaultAmount, website, avatarNumber) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
        f.id, f.name, f.notes || '', f.color || '',
        f.createdAt || Date.now(), f.type || 'friend', f.category || null, f.billingCycle || null,
        f.defaultAmount !== undefined && f.defaultAmount !== null ? Number(f.defaultAmount) : null, f.website || '', f.avatarNumber || null
      ]);
    });

    const seenWallets = new Set<string>();
    (db.wallets || []).forEach(w => {
      if (!w.id || seenWallets.has(w.id)) return;
      seenWallets.add(w.id);
      safeInsert('INSERT INTO wallets (id, name, openingBalance, currentBalance, color, icon, minBalanceAlert, monthlySpendLimit, isDefault, isHidden, rulesNotes) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
        w.id, w.name, Number(w.openingBalance) || 0, walletBalance(db, w.id), w.color || '',
        w.icon || null,
        w.minBalanceAlert != null ? Number(w.minBalanceAlert) : null,
        w.monthlySpendLimit != null ? Number(w.monthlySpendLimit) : null,
        w.isDefault ? 1 : 0,
        w.isHidden ? 1 : 0,
        w.rulesNotes || null
      ]);
    });

    const seenExpenses = new Set<string>();
    (db.expenses || []).forEach(e => {
      if (!e.id || seenExpenses.has(e.id)) return;
      seenExpenses.add(e.id);
      safeInsert('INSERT INTO expenses (id, groupId, description, amount, category, date, type, flow, friendId, walletId, status, settled, settlementId, notes, createdAt, originalAmount, originalDate, settledAmount, parentExpenseId, vendorId, vendorSettled, vendorSettlementId, vendorSettledAmount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        e.id, e.groupId || null, e.description, Number(e.amount) || 0, e.category, e.date,
        e.type, e.flow, e.friendId || null, e.walletId || null, e.status, e.settled ? 1 : 0,
        e.settlementId || null, e.notes || '', e.createdAt || Date.now(),
        e.originalAmount != null ? Number(e.originalAmount) : null,
        e.originalDate || null,
        e.settledAmount != null ? Number(e.settledAmount) : null,
        e.parentExpenseId || null,
        e.vendorId || null,
        e.vendorSettled ? 1 : 0,
        e.vendorSettlementId || null,
        e.vendorSettledAmount != null ? Number(e.vendorSettledAmount) : null
      ]);
    });

    const seenSettlements = new Set<string>();
    (db.settlements || []).forEach(s => {
      if (!s.id || seenSettlements.has(s.id)) return;
      seenSettlements.add(s.id);
      safeInsert('INSERT INTO settlements (id, friendId, amount, date, note, walletId, paymentMethod, createdAt, expenseIds, originalTotal, remainingAmount, partialBreakdown) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [
        s.id, s.friendId, Number(s.amount) || 0, s.date, s.note || '', s.walletId || null,
        s.paymentMethod || null,
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
      safeInsert('INSERT INTO recurring_rules (id, title, kind, amount, category, walletId, friendId, type, flow, frequency, intervalValue, startDate, nextDueDate, autoDeduct, lastDeductedDate, lastLoggedDate, status, notes, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        r.id, r.title, r.kind, Number(r.amount) || 0, r.category, r.walletId, r.friendId || null,
        r.type, r.flow, r.frequency, r.intervalValue, r.startDate, r.nextDueDate || r.startDate,
        r.autoDeduct ? 1 : 0,
        r.lastDeductedDate || null,
        r.lastLoggedDate || null,
        r.status, r.notes || '', r.createdAt || Date.now()
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
        if (!seenSettingsKeys.has(k) && !k.startsWith('_')) {
          seenSettingsKeys.add(k);
          safeInsert('INSERT INTO settings VALUES (?,?)', [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
        }
      });
      if (typeof localStorage !== 'undefined') {
        if (db.settings.colorMode) localStorage.setItem('color-mode', db.settings.colorMode);
        if (db.settings.accent) localStorage.setItem('accent-color', db.settings.accent);
        if (db.settings.customAccentColor) localStorage.setItem('custom-accent-color', db.settings.customAccentColor);
        if (db.settings.sidebarCollapsed !== undefined) localStorage.setItem('sidebar_collapsed', String(db.settings.sidebarCollapsed));
        if (db.settings.floatingSidebar !== undefined) localStorage.setItem('sidebar_floating', String(db.settings.floatingSidebar));
        if (db.settings.hideScrollbar !== undefined) localStorage.setItem('hide_scrollbar', String(db.settings.hideScrollbar));
        if (db.settings.hideAmounts !== undefined) localStorage.setItem('hide_amounts', String(db.settings.hideAmounts));
      }
    }

    // Sync Trip and Split data into settings table and localStorage
    const activeTripStr = db.activeTrip !== undefined
      ? (db.activeTrip ? JSON.stringify(db.activeTrip) : '')
      : getLocal('okane_active_trip_v1');
    const tripHistoryStr = db.tripHistory !== undefined
      ? (db.tripHistory ? JSON.stringify(db.tripHistory) : '')
      : getLocal('okane_trip_history_v1');
    const presetGroupsStr = db.presetGroups !== undefined
      ? (db.presetGroups ? JSON.stringify(db.presetGroups) : '')
      : getLocal('okane_preset_groups_v1');

    if (activeTripStr) {
      safeInsert('INSERT INTO settings VALUES (?,?)', ['_active_trip', activeTripStr]);
      setLocal('okane_active_trip_v1', activeTripStr);
    } else {
      try { alasql('DELETE FROM settings WHERE st_key = "_active_trip"'); } catch { /* ignore */ }
      removeLocal('okane_active_trip_v1');
    }
    if (tripHistoryStr) {
      safeInsert('INSERT INTO settings VALUES (?,?)', ['_trip_history', tripHistoryStr]);
      setLocal('okane_trip_history_v1', tripHistoryStr);
    } else {
      try { alasql('DELETE FROM settings WHERE st_key = "_trip_history"'); } catch { /* ignore */ }
      removeLocal('okane_trip_history_v1');
    }
    if (presetGroupsStr) {
      safeInsert('INSERT INTO settings VALUES (?,?)', ['_preset_groups', presetGroupsStr]);
      setLocal('okane_preset_groups_v1', presetGroupsStr);
    } else {
      try { alasql('DELETE FROM settings WHERE st_key = "_preset_groups"'); } catch { /* ignore */ }
      removeLocal('okane_preset_groups_v1');
    }

    if (typeof localStorage !== 'undefined') {
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
    }
  } catch (err) {
    console.error('Error syncing DB to SQL tables:', err);
  }
}

export function loadDBFromSQLTables(): AppDB {
  initSQLTables();
  try {
    const getLocal = (k: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null);
    const setLocal = (k: string, v: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); };
    const removeLocal = (k: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); };

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
      icon: w.icon ? String(w.icon) : undefined,
      minBalanceAlert: w.minBalanceAlert != null ? Number(w.minBalanceAlert) : undefined,
      monthlySpendLimit: w.monthlySpendLimit != null ? Number(w.monthlySpendLimit) : undefined,
      isDefault: w.isDefault != null ? Boolean(w.isDefault) : undefined,
      isHidden: w.isHidden != null ? Boolean(w.isHidden) : undefined,
      rulesNotes: w.rulesNotes ? String(w.rulesNotes) : undefined,
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
      originalDate: e.originalDate ? String(e.originalDate) : undefined,
      settledAmount: e.settledAmount != null ? Number(e.settledAmount) : undefined,
      parentExpenseId: e.parentExpenseId ? String(e.parentExpenseId) : undefined,
      vendorId: e.vendorId ? String(e.vendorId) : null,
      vendorSettled: e.vendorSettled != null ? Boolean(e.vendorSettled) : undefined,
      vendorSettlementId: e.vendorSettlementId ? String(e.vendorSettlementId) : null,
      vendorSettledAmount: e.vendorSettledAmount != null ? Number(e.vendorSettledAmount) : undefined,
    }));

    const settlements: Settlement[] = sqlSettlements.map(s => {
      let expIds: string[] = [];
      try {
        if (typeof s.expenseIds === 'string') {
          try {
            expIds = JSON.parse(s.expenseIds);
          } catch {
            expIds = s.expenseIds.split(',').map(x => x.trim()).filter(Boolean);
          }
        } else if (Array.isArray(s.expenseIds)) {
          expIds = (s.expenseIds as string[]).map(String);
        }
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
        paymentMethod: s.paymentMethod ? String(s.paymentMethod) : undefined,
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
      lastDeductedDate: r.lastDeductedDate ? String(r.lastDeductedDate) : null,
      lastLoggedDate: r.lastLoggedDate ? String(r.lastLoggedDate) : null,
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
      enableAutopay: true,
      devMode: true,
      enableDevSQLConsole: true,
      enableSplitTrips: true,
      enableUserGuide: false,
      colorMode: (getLocal('color-mode') as 'light' | 'dark') || 'light',
      accent: 'monochrome',
      customAccentColor: getLocal('custom-accent-color') || '#6366f1',
      sidebarCollapsed: getLocal('sidebar_collapsed') === 'true',
      enableAnimations: true,
      performanceMode: false,
      hideScrollbar: getLocal('hide_scrollbar') !== null ? getLocal('hide_scrollbar') === 'true' : true,
      floatingSidebar: getLocal('sidebar_floating') === 'true',
      hideAmounts: getLocal('hide_amounts') === 'true',
    };

    let sqlActiveTripRaw: string | null = null;
    let sqlTripHistoryRaw: string | null = null;
    let sqlPresetGroupsRaw: string | null = null;

    sqlSettings.forEach(st => {
      const keyStr = String(st.st_key ?? st.key ?? '');
      const valStr = String(st.st_val ?? st.value ?? '');
      if (!keyStr) return;
      if (keyStr === '_active_trip') {
        sqlActiveTripRaw = valStr;
        return;
      }
      if (keyStr === '_trip_history') {
        sqlTripHistoryRaw = valStr;
        return;
      }
      if (keyStr === '_preset_groups') {
        sqlPresetGroupsRaw = valStr;
        return;
      }
      if (keyStr.startsWith('_')) {
        return;
      }
      try {
        settingsObj[keyStr] = JSON.parse(valStr);
      } catch {
        settingsObj[keyStr] = valStr === 'true' ? true : valStr === 'false' ? false : valStr;
      }
    });

    if (settingsObj.hideAmounts !== undefined) {
      setLocal('hide_amounts', String(Boolean(settingsObj.hideAmounts)));
    }

    if (sqlActiveTripRaw !== null) {
      if (sqlActiveTripRaw) setLocal('okane_active_trip_v1', sqlActiveTripRaw);
      else removeLocal('okane_active_trip_v1');
    }
    if (sqlTripHistoryRaw !== null && sqlTripHistoryRaw) {
      setLocal('okane_trip_history_v1', sqlTripHistoryRaw);
    }
    if (sqlPresetGroupsRaw !== null && sqlPresetGroupsRaw) {
      setLocal('okane_preset_groups_v1', sqlPresetGroupsRaw);
    }

    settingsObj.categories = categories;

    let parsedActiveTrip = null;
    try {
      const raw = sqlActiveTripRaw || getLocal('okane_active_trip_v1');
      if (raw) parsedActiveTrip = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { /* ignore */ }

    let parsedTripHistory = [];
    try {
      const raw = sqlTripHistoryRaw || getLocal('okane_trip_history_v1');
      if (raw) parsedTripHistory = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { /* ignore */ }

    let parsedPresetGroups = [];
    try {
      const raw = sqlPresetGroupsRaw || getLocal('okane_preset_groups_v1');
      if (raw) parsedPresetGroups = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { /* ignore */ }

    const db: AppDB = {
      version: 3,
      friends,
      wallets: wallets.length > 0 ? wallets : JSON.parse(JSON.stringify(DEFAULT_WALLETS)),
      expenses,
      settlements,
      recurringRules,
      settings: (settingsObj as unknown) as AppDB['settings'],
      activeTrip: parsedActiveTrip,
      tripHistory: parsedTripHistory,
      presetGroups: parsedPresetGroups,
    };

    return sanitizeLoadedDB(db);
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
          const merged = sanitizeLoadedDB(parsed);
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
            insertSafe('INSERT INTO wallets (id, name, openingBalance, currentBalance, color, icon, minBalanceAlert, monthlySpendLimit, isDefault, isHidden, rulesNotes) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.name, row.openingBalance, row.currentBalance ?? row.openingBalance, row.color ?? '#38BDF8',
              row.icon ?? null, row.minBalanceAlert ?? null, row.monthlySpendLimit ?? null, row.isDefault ? 1 : 0, row.isHidden ? 1 : 0, row.rulesNotes ?? null
            ]);
          });
        }

        const seenExpenses = new Set<string>();
        if (Array.isArray(dump.expenses)) {
          dump.expenses.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenExpenses.has(id)) return;
            seenExpenses.add(id);
            insertSafe('INSERT INTO expenses (id, groupId, description, amount, category, date, type, flow, friendId, walletId, status, settled, settlementId, notes, createdAt, originalAmount, originalDate, settledAmount, parentExpenseId, vendorId, vendorSettled, vendorSettlementId, vendorSettledAmount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.groupId || null, row.description, Number(row.amount) || 0, row.category, row.date,
              row.type, row.flow, row.friendId || null, row.walletId || null, row.status, row.settled ? 1 : 0,
              row.settlementId || null, row.notes || '', row.createdAt || Date.now(),
              row.originalAmount != null ? Number(row.originalAmount) : null,
              row.originalDate || null,
              row.settledAmount != null ? Number(row.settledAmount) : null,
              row.parentExpenseId || null,
              row.vendorId || null,
              row.vendorSettled ? 1 : 0,
              row.vendorSettlementId || null,
              row.vendorSettledAmount != null ? Number(row.vendorSettledAmount) : null
            ]);
          });
        }

        const seenSettlements = new Set<string>();
        if (Array.isArray(dump.settlements)) {
          dump.settlements.forEach((row: Record<string, unknown>) => {
            const id = String(row.id ?? '');
            if (!id || seenSettlements.has(id)) return;
            seenSettlements.add(id);
            insertSafe('INSERT INTO settlements (id, friendId, amount, date, note, walletId, paymentMethod, createdAt, expenseIds, originalTotal, remainingAmount, partialBreakdown) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.friendId, Number(row.amount) || 0, row.date, row.note || '', row.walletId || null,
              row.paymentMethod || null,
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
            insertSafe('INSERT INTO recurring_rules (id, title, kind, amount, category, walletId, friendId, type, flow, frequency, intervalValue, startDate, nextDueDate, autoDeduct, lastDeductedDate, lastLoggedDate, status, notes, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
              row.id, row.title, row.kind, row.amount, row.category, row.walletId, row.friendId, row.type, row.flow, row.frequency, row.intervalValue, row.startDate, row.nextDueDate,
              row.autoDeduct ? 1 : 0,
              row.lastDeductedDate ?? null,
              row.lastLoggedDate ?? null,
              row.status, row.notes, row.createdAt
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

        const loaded = sanitizeLoadedDB(loadDBFromSQLTables());
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
  isSQLDirty = true;

  // Immediate lightweight JSON save to keep UI responsive and safe
  try {
    localStorage.setItem(LEGACY_JSON_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('localStorage save warning:', e);
  }

  // Defer heavy full SQL relational table syncs to idle time so typing and interactions are never blocked
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
        if (isSQLDirty && cachedAppDB) {
          try {
            syncDBToSQLTables(cachedAppDB);
          } catch (e) {
            console.warn('Idle SQL sync notice:', e);
          }
        }
      });
    } else {
      if (isSQLDirty && cachedAppDB) {
        try {
          syncDBToSQLTables(cachedAppDB);
        } catch (e) {
          console.warn('Debounced SQL sync notice:', e);
        }
      }
    }
  }, 2500);
}

// Flush pending writes immediately if the Android app is closed/hidden
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cachedAppDB && isSQLDirty) {
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

  const vendorSettlementExpenseIds = new Set<string>();
  (db.settlements || []).forEach(s => {
    if (s.walletId && Array.isArray(s.expenseIds)) {
      if (Number(s.amount) < 0) {
        s.expenseIds.forEach(id => vendorSettlementExpenseIds.add(id));
      }
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
      const skipVendorSettled = Boolean(
        e.vendorSettlementId ||
        (e.vendorId && (e.vendorSettled || vendorSettlementExpenseIds.has(e.id)))
      );
      if (!skipGroup && !skipVendorSettled) {
        const delta = isIncoming ? amt : -amt;
        walletBalances.set(e.walletId, (walletBalances.get(e.walletId) || 0) + delta);
      }
    }

    // Friend & Contact statistics calculation
    const fId = e.friendId ? String(e.friendId).trim() : null;
    if (fId) {
      const fb = getOrCreateFriendBal(fId);
      const cs = getOrCreateContactStat(fId);
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
      } else if ((e.status === 'unpaid' || e.status === 'unsettled') && !e.settled) {
        if (isIncoming) fb.owedToMe += amt;
        else fb.owedByMe += amt;
      }
    }

    const vId = e.vendorId ? String(e.vendorId).trim() : null;
    if (vId) {
      const cs = getOrCreateContactStat(vId);
      cs.count += 1;
      cs.totalSpent += (isIncoming ? -amt : amt);
      if (!cs.lastTx || e.date > cs.lastTx.date || (e.date === cs.lastTx.date && (e.createdAt || 0) > (cs.lastTx.createdAt || 0))) {
        cs.lastTx = e;
      }

      const fb = getOrCreateFriendBal(vId);
      if (e.status === 'unpaid' || !e.vendorSettled) {
        const isVendorUnsettled = !e.vendorSettled && (!e.settled || e.type === 'for_friend' || e.type === 'personal');
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
  walletBalances.forEach((b, walletId) => {
    const w = (db.wallets || []).find(x => x.id === walletId);
    if (!w?.isHidden) {
      totalWallet += b;
    }
  });

  const allFriendBalancesSorted = (db.friends || [])
    .map(f => ({ friend: f, ...friendBalances.get(f.id)! }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  let credit = 0, debit = 0;
  (db.friends || []).forEach(f => {
    if ((f.type || 'friend') === 'friend') {
      const b = friendBalances.get(f.id);
      if (b) {
        if (b.net > 0) credit += b.net;
        else if (b.net < 0) debit += Math.abs(b.net);
      }
    }
  });
  const overall = { credit, debit, net: credit - debit };

  const cacheEntry: DBCalculationCache = {
    walletBalances,
    totalWalletBalance: totalWallet,
    friendBalances,
    allFriendBalancesSorted,
    overallBalance: overall,
    contactStats,
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
  const norm = String(friendId).trim();
  return getDBCalculationCache(db).friendBalances.get(norm) || { owedToMe: 0, owedByMe: 0, net: 0 };
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
  const normTarget = String(friendId).trim();
  return (db.expenses || [])
    .filter(e => {
      const amt = Number(e.amount) || 0;
      if (amt <= 0.0001) return false;

      const fId = e.friendId ? String(e.friendId).trim() : null;
      const vId = e.vendorId ? String(e.vendorId).trim() : null;

      const matchesFriend = Boolean(fId && fId === normTarget);
      const matchesVendor = Boolean(vId && vId === normTarget);

      if (!matchesFriend && !matchesVendor) return false;

      // If matches as friend and settled
      if (matchesFriend && e.settled) return false;

      // If matches as vendor and vendorSettled
      if (matchesVendor && e.vendorSettled) return false;

      // Active debt for friend
      if (matchesFriend && !e.settled) return true;

      // Active debt for vendor
      if (matchesVendor && !e.vendorSettled) return true;

      return false;
    })
    .sort((a, b) => (b.originalDate || b.date).localeCompare(a.originalDate || a.date) || (b.createdAt || 0) - (a.createdAt || 0));
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
  let expenses = db.expenses.filter(x => x.id !== id);

  // If this expense had a settlement, clean up the settlement reference on sibling expenses
  // if the settlement is completely removed, or keep it consistent
  const settlements = (db.settlements || []).map(s => {
    if (s.expenseIds.includes(id)) {
      return { ...s, expenseIds: s.expenseIds.filter(x => x !== id) };
    }
    return s;
  }).filter(s => s.expenseIds.length > 0 && s.id !== targetSettlementId);

  const remainingSettlementIds = new Set(settlements.map(s => s.id));
  if (targetSettlementId && !remainingSettlementIds.has(targetSettlementId)) {
    // Sibling expenses that were in targetSettlementId should no longer point to deleted settlement
    expenses = expenses.map(e => {
      if (e.settlementId === targetSettlementId) {
        return { ...e, settled: false, settlementId: null, originalAmount: undefined, originalDate: undefined, settledAmount: undefined };
      }
      return e;
    });
  }

  return { ...db, expenses, settlements };
}

export function deleteExpenseGroup(db: AppDB, groupId: string): AppDB {
  const groupExpenses = db.expenses.filter(x => x.groupId === groupId);
  if (groupExpenses.length === 0) {
    return deleteExpense(db, groupId);
  }

  const groupExpenseIds = new Set(groupExpenses.map(x => x.id));
  const groupSettlementIds = new Set(groupExpenses.map(x => x.settlementId).filter(Boolean) as string[]);

  let expenses = db.expenses.filter(x => x.groupId !== groupId && !groupExpenseIds.has(x.id));

  const settlements = (db.settlements || []).map(s => {
    const remainingIds = s.expenseIds.filter(id => !groupExpenseIds.has(id));
    return { ...s, expenseIds: remainingIds };
  }).filter(s => s.expenseIds.length > 0 && !groupSettlementIds.has(s.id));

  const remainingSettlementIds = new Set(settlements.map(s => s.id));
  groupSettlementIds.forEach(stlId => {
    if (!remainingSettlementIds.has(stlId)) {
      expenses = expenses.map(e => {
        if (e.settlementId === stlId) {
          return { ...e, settled: false, settlementId: null, originalAmount: undefined, originalDate: undefined, settledAmount: undefined };
        }
        return e;
      });
    }
  });

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
    isHidden: isDefault ? false : Boolean(data.isHidden),
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
        const nextIsDefault = data.isDefault !== undefined ? Boolean(data.isDefault) : (w.isDefault ?? (nextSettings.defaultWalletId === id));
        const nextIsHidden = nextIsDefault ? false : (data.isHidden !== undefined ? Boolean(data.isHidden) : Boolean(w.isHidden));
        return {
          ...w,
          ...data,
          isDefault: nextIsDefault,
          isHidden: nextIsHidden,
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
      });

      const newChildId = uid('exp');
      newExpenses.push({
        ...e,
        id: newChildId,
        parentExpenseId: e.id,
        originalAmount: origAmt,
        originalDate: e.originalDate || e.date,
        date: e.date,
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
      updatedExpenses.push({
        ...e,
        settled: isSettlingFriend ? false : e.settled,
        settlementId: isSettlingFriend ? null : e.settlementId,
        vendorSettled: isSettlingVendor ? false : e.vendorSettled,
        vendorSettlementId: isSettlingVendor ? null : e.vendorSettlementId,
      });
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
  const normId = String(id).trim();
  const target = (db.settlements || []).find(s => String(s?.id).trim() === normId);
  const targetFriendId = target?.friendId ? String(target.friendId).trim() : '';
  const targetAmount = Math.abs(Number(target?.amount) || 0);
  const targetWalletId = target?.walletId || '';

  let targetExpIdsList: string[] = [];
  const rawExpenseIds = target?.expenseIds as unknown;
  if (rawExpenseIds) {
    if (Array.isArray(rawExpenseIds)) {
      targetExpIdsList = rawExpenseIds.map(x => String(x).trim());
    } else if (typeof rawExpenseIds === 'string') {
      try {
        const parsed = JSON.parse(rawExpenseIds);
        targetExpIdsList = Array.isArray(parsed) ? parsed.map(x => String(x).trim()) : [];
      } catch {
        targetExpIdsList = rawExpenseIds.split(',').map(x => x.trim()).filter(Boolean);
      }
    }
  }

  const targetExpenseIds = new Set<string>(targetExpIdsList);
  if (target?.partialBreakdown && typeof target.partialBreakdown === 'object') {
    Object.keys(target.partialBreakdown).forEach(k => targetExpenseIds.add(String(k).trim()));
  }

  const childExpenseIdsToDelete = new Set<string>();
  const parentExpenseIdsToRestore = new Set<string>(targetExpenseIds);

  (db.expenses || []).forEach(e => {
    const eId = String(e.id).trim();
    const eStl = e.settlementId ? String(e.settlementId).trim() : '';
    const eVendorStl = e.vendorSettlementId ? String(e.vendorSettlementId).trim() : '';
    const isDirect = eStl === normId || eVendorStl === normId;
    const eParent = e.parentExpenseId ? String(e.parentExpenseId).trim() : '';

    if (isDirect) {
      if (eParent) {
        childExpenseIdsToDelete.add(eId);
        parentExpenseIdsToRestore.add(eParent);
      } else {
        parentExpenseIdsToRestore.add(eId);
      }
    } else if (eParent && targetExpenseIds.has(eParent)) {
      childExpenseIdsToDelete.add(eId);
      parentExpenseIdsToRestore.add(eParent);
    }
  });

  // Filter out child expenses created during partial settlement
  let expenses = (db.expenses || []).filter(e => !childExpenseIdsToDelete.has(String(e.id).trim()));

  // Restore parent / settled expenses back to pre-settlement state
  expenses = expenses.map(e => {
    const eId = String(e.id).trim();
    const eStl = e.settlementId ? String(e.settlementId).trim() : '';
    const eVendorStl = e.vendorSettlementId ? String(e.vendorSettlementId).trim() : '';
    const isMainSettlement = eStl === normId;
    const isVendorSettlement = eVendorStl === normId;
    const isInTargetList = targetExpenseIds.has(eId);
    const isParentToRestore = parentExpenseIdsToRestore.has(eId);
    const isGroupToRestore = Boolean(e.groupId && parentExpenseIdsToRestore.has(String(e.groupId).trim()));

    if (isMainSettlement || isVendorSettlement || isInTargetList || isParentToRestore || isGroupToRestore) {
      const origCandidate = Number(e.originalAmount);
      const currCandidate = Number(e.amount);
      let restoredAmt = targetAmount;
      if (!isNaN(origCandidate) && origCandidate > 0.0001) {
        restoredAmt = origCandidate;
      } else if (!isNaN(currCandidate) && currCandidate > 0.0001) {
        restoredAmt = currCandidate;
      }

      const restoredDate = e.originalDate || e.date || target?.date || todayISO();
      const isVendorExpense = Boolean(e.vendorId && (!targetFriendId || String(e.vendorId).trim() === targetFriendId)) || isVendorSettlement;

      let restoredStatus: ExpenseStatus = 'unsettled';
      if (isVendorExpense || e.type === 'personal') {
        restoredStatus = 'unpaid';
      } else {
        restoredStatus = 'unsettled';
      }

      return {
        ...e,
        amount: restoredAmt,
        date: restoredDate,
        status: restoredStatus,
        settled: false,
        settlementId: null,
        vendorSettled: false,
        vendorSettlementId: null,
        originalAmount: undefined,
        originalDate: undefined,
        settledAmount: undefined,
      };
    }
    return e;
  });

  // Verify whether the target contact now has any unsettled expenses in the updated list
  const tempDB: AppDB = { ...db, expenses };
  const currentUnsettled = targetFriendId ? unsettledExpensesForFriend(tempDB, targetFriendId) : [];

  // If no expenses are currently unsettled for this contact, or if all restored expenses total 0,
  // synthesize an active unsettled expense so that the contact definitely returns to Pending Settlements!
  if (targetFriendId && currentUnsettled.length === 0 && targetAmount > 0) {
    const friend = (db.friends || []).find(f => String(f?.id).trim() === targetFriendId);
    const isOwedByMe = (Number(target?.amount) || 0) < 0; // Negative settlement amount means user paid the friend/vendor
    const fallbackCategory = friend?.category || db.settings?.defaultCategory || 'Food';
    const fallbackWalletId = targetWalletId || db.settings?.defaultWalletId || db.wallets?.[0]?.id || 'wal_cash';

    const newExp: Expense = {
      id: uid('exp'),
      description: target?.note ? target.note : (friend ? `${friend.name} Expense` : 'Pending Settlement Expense'),
      amount: targetAmount,
      category: fallbackCategory,
      date: target?.date || todayISO(),
      type: friend?.type === 'vendor' ? 'personal' : (isOwedByMe ? 'by_friend' : 'for_friend'),
      flow: 'out',
      friendId: friend?.type === 'vendor' ? null : targetFriendId,
      vendorId: friend?.type === 'vendor' ? targetFriendId : null,
      walletId: fallbackWalletId,
      status: friend?.type === 'vendor' ? 'unpaid' : 'unsettled',
      settled: false,
      settlementId: null,
      vendorSettled: false,
      vendorSettlementId: null,
      createdAt: Date.now(),
      notes: `Restored from undone settlement on ${target?.date || todayISO()}`,
    };
    expenses = [newExp, ...expenses];
  }

  // Ensure contact exists in friends array
  let friends = db.friends || [];
  if (targetFriendId && !friends.some(f => String(f?.id).trim() === targetFriendId)) {
    const restoredFriend: Friend = {
      id: targetFriendId,
      name: target?.note ? target.note.split(' ')[0] : 'Contact',
      notes: 'Restored from settlement',
      color: '#6366f1',
      createdAt: Date.now(),
      type: 'friend',
    };
    friends = [restoredFriend, ...friends];
  }

  return {
    ...db,
    friends,
    settlements: (db.settlements || []).filter(x => String(x?.id).trim() !== normId),
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
        groupExps.some(ge => (s.expenseIds || []).includes(ge.id) || (ge.settlementId === s.id) || (ge.vendorSettlementId === s.id))
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
            vendorSettled: false,
            vendorSettlementId: null,
            status: e.vendorId ? 'unpaid' : e.status,
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

  // 1. Direct settlementId or vendorSettlementId
  if (exp.settlementId) {
    return deleteSettlement(db, exp.settlementId);
  }
  if (exp.vendorSettlementId) {
    return deleteSettlement(db, exp.vendorSettlementId);
  }

  // 2. Parent expense check
  const parentId = exp.parentExpenseId;
  if (parentId) {
    const parentExp = db.expenses.find(e => e.id === parentId);
    if (parentExp?.settlementId) {
      return deleteSettlement(db, parentExp.settlementId);
    }
    if (parentExp?.vendorSettlementId) {
      return deleteSettlement(db, parentExp.vendorSettlementId);
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
      if (ge.vendorSettlementId) {
        return deleteSettlement(db, ge.vendorSettlementId);
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
        let restoredStatus: ExpenseStatus = e.status;
        if (e.vendorId) {
          restoredStatus = 'unpaid';
        } else if (e.type === 'personal' && e.friendId) {
          restoredStatus = 'unpaid';
        } else if (e.type === 'for_friend' || e.type === 'by_friend') {
          restoredStatus = 'unsettled';
        }

        return {
          ...e,
          amount: Number(restoredAmt) || 0,
          date: restoredDate,
          settled: false,
          settlementId: null,
          vendorSettled: false,
          vendorSettlementId: null,
          status: restoredStatus,
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

  const isINR = (current.settings?.currency || 'INR') === 'INR';
  const val = (usd: number, inr: number) => (isINR ? inr : usd);

  // Check or add friend 1 (Hrishi / Alex)
  let alex = current.friends.find(f => f.name === 'Hrishi' || f.name === 'Alex Rivera');
  if (!alex) {
    const res = addFriend(current, { name: isINR ? 'Hrishi' : 'Alex Rivera', color: '#10b981' });
    current = res.db;
    alex = res.friend;
  }

  // Check or add friend 2 (Anushka / Priya)
  let priya = current.friends.find(f => f.name === 'Anushka' || f.name === 'Priya Shah');
  if (!priya) {
    const res = addFriend(current, { name: isINR ? 'Anushka' : 'Priya Shah', color: '#f43f5e' });
    current = res.db;
    priya = res.friend;
  }

  // Check or add friend 3 (Shriyansh / Sam)
  let sam = current.friends.find(f => f.name === 'Shriyansh' || f.name === 'Sam Okafor');
  if (!sam) {
    const res = addFriend(current, { name: isINR ? 'Shriyansh' : 'Sam Okafor', color: '#f59e0b' });
    current = res.db;
    sam = res.friend;
  }

  // Check or add a Store / Vendor contact (Tiffin Aunty / Corner Deli)
  let vendor = current.friends.find(f => f.name === 'Tiffin Aunty' || f.type === 'vendor');
  if (!vendor) {
    const res = addFriend(current, {
      name: isINR ? 'Tiffin Aunty' : 'Corner Mart & Deli',
      type: 'vendor',
      category: 'Food',
      notes: 'Daily home-style tiffin & grocery meals',
      color: '#f59e0b',
    });
    current = res.db;
    vendor = res.friend;
  }

  const defaultWal = current.settings.defaultWalletId || current.wallets[0]?.id || 'wal_cash';
  const secondWal = current.wallets.length > 1 ? current.wallets[1].id : defaultWal;

  const expenses = [
    { description: 'Weekly groceries', amount: val(64.20, 1420), category: 'Groceries', date: d(-1), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: defaultWal },
    { description: 'Metro card top-up', amount: val(25, 350), category: 'Transport', date: d(-2), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: secondWal },
    { description: "Dinner at Bistro", amount: val(88, 1689), category: 'Food', date: d(-3), type: 'for_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus, walletId: secondWal },
    { description: 'Monthly Tiffin Service', amount: val(85, 2400), category: 'Food', date: d(-4), type: 'personal' as ExpenseType, friendId: vendor.id, vendorId: vendor.id, status: 'paid' as ExpenseStatus, walletId: secondWal },
    { description: 'Movie night tickets', amount: val(34, 750), category: 'Entertainment', date: d(-5), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Uber to airport', amount: val(41.50, 620), category: 'Transport', date: d(-7), type: 'by_friend' as ExpenseType, friendId: alex.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Coffee run', amount: val(12.75, 220), category: 'Food', date: d(-8), type: 'for_friend' as ExpenseType, friendId: sam.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Electricity bill', amount: val(76, 1850), category: 'Utilities', date: d(-11), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: secondWal },
    { description: 'Weekend cabin trip', amount: val(210, 4200), category: 'Travel', date: d(-14), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'unsettled' as ExpenseStatus, walletId: secondWal },
    { description: 'New headphones', amount: val(129, 2999), category: 'Shopping', date: d(-18), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: secondWal },
    { description: 'Gym membership', amount: val(45, 1500), category: 'Health', date: d(-21), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: secondWal },
    { description: 'Apartment rent share', amount: val(900, 11500), category: 'Rent', date: d(-24), type: 'by_friend' as ExpenseType, friendId: sam.id, status: 'unsettled' as ExpenseStatus, walletId: defaultWal },
    { description: 'Flight tickets split', amount: val(340, 5400), category: 'Travel', date: d(-30), type: 'for_friend' as ExpenseType, friendId: priya.id, status: 'settled' as ExpenseStatus, settled: true, walletId: secondWal },
    { description: 'Streaming subscriptions', amount: val(28, 649), category: 'Entertainment', date: d(-35), type: 'personal' as ExpenseType, status: 'paid' as ExpenseStatus, walletId: secondWal },
  ];

  expenses.forEach(e => { current = addExpense(current, e); });

  const sampleRules = defaultSampleRecurringRules(defaultWal, isINR);
  const existingRules = current.recurringRules || [];
  
  // Update any existing matching sample rules so they become active and due today in notifications
  const sampleMap = new Map(sampleRules.map(r => [r.id, r]));
  const updatedExisting = existingRules.map(r => {
    if (sampleMap.has(r.id)) {
      const sample = sampleMap.get(r.id)!;
      return {
        ...r,
        status: 'active' as const,
        amount: sample.amount,
        nextDueDate: sample.kind === 'autopay' ? d(0) : r.nextDueDate,
        lastLoggedDate: sample.kind === 'quick_log' ? d(-1) : r.lastLoggedDate,
      };
    }
    return r;
  });

  const existingRuleIds = new Set(existingRules.map(r => r.id));
  const newRules = sampleRules.filter(r => !existingRuleIds.has(r.id));
  current = {
    ...current,
    recurringRules: [...updatedExisting, ...newRules],
  };

  return current;
}

export function resetAndSeedSampleData(): AppDB {
  const fresh = defaultDB();
  return seedSampleData(fresh);
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
