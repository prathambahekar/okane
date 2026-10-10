import type { AppDB } from '../types';
import { expenseWalletDelta, expenseFlow } from '../db';
import { cleanExpenseDescription } from '../utils';

export interface MonthReportCategory {
  name: string;
  amount: number;
  pct: number;
  count: number;
}

export interface MonthReportWallet {
  id: string;
  name: string;
  color: string;
  icon?: string;
  openingBalance: number;
  closingBalance: number;
  moneyIn: number;
  moneyOut: number;
  netChange: number;
}

export interface MonthReportDaily {
  day: number;
  dateStr: string;
  dayName: string;
  spent: number;
  received: number;
  net: number;
}

export interface MonthReportData {
  yearMonth: string; // 'YYYY-MM'
  monthLabel: string; // 'October 2026'
  shortMonthLabel: string; // 'Oct 2026'
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  daysPassed: number;
  isCurrentMonth: boolean;
  openingBalance: number;
  closingBalance: number;
  moneyIn: number;
  moneyOut: number;
  netCashFlow: number;
  savingsRate: number;
  dailyAverageSpend: number;
  transactionCount: number;
  inflowCount: number;
  outflowCount: number;
  highestExpense: {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
  } | null;
  peakSpendingDay: {
    dateStr: string;
    dayNumber: number;
    amount: number;
  } | null;
  categories: MonthReportCategory[];
  wallets: MonthReportWallet[];
  dailyBreakdown: MonthReportDaily[];
}

export interface MonthComparisonData {
  spendDiff: number;
  spendPctChange: number;
  incomeDiff: number;
  incomePctChange: number;
  openingDiff: number;
  openingPctChange: number;
  closingDiff: number;
  closingPctChange: number;
  netCashFlowDiff: number;
  dailyAvgDiff: number;
  categoryDiffs: Array<{
    name: string;
    currentAmount: number;
    prevAmount: number;
    diff: number;
    pctChange: number;
  }>;
}

export function getPrevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthName(yearMonth: string, short: boolean = false): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, {
    month: short ? 'short' : 'long',
    year: 'numeric',
  });
}

export function calculateMonthReport(db: AppDB, yearMonth: string): MonthReportData {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStartIso = `${yearMonth}-01`;
  const monthEndIso = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = yearMonth === currentYearMonth;
  const daysPassed = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

  const targetWallets = (db.wallets || []).filter(w => !w.isHidden);
  const targetWalletIds = new Set(targetWallets.map(w => w.id));

  // 1. Calculate opening balance as of day 1 00:00:00
  const walletOpeningMap = new Map<string, number>();
  targetWallets.forEach(w => {
    walletOpeningMap.set(w.id, Number(w.openingBalance) || 0);
  });

  // Replay transactions prior to monthStartIso
  (db.expenses || []).forEach(e => {
    if (e.date < monthStartIso && e.walletId && targetWalletIds.has(e.walletId)) {
      const delta = expenseWalletDelta(e, db);
      if (delta !== 0) {
        walletOpeningMap.set(e.walletId, (walletOpeningMap.get(e.walletId) || 0) + delta);
      }
    }
  });

  (db.settlements || []).forEach(s => {
    if (s.date < monthStartIso && s.walletId && targetWalletIds.has(s.walletId) && !s.isForgiven) {
      const amt = Number(s.amount) || 0;
      if (amt !== 0) {
        walletOpeningMap.set(s.walletId, (walletOpeningMap.get(s.walletId) || 0) + amt);
      }
    }
  });

  let totalOpeningBalance = 0;
  walletOpeningMap.forEach(bal => {
    totalOpeningBalance += bal;
  });

  // 2. Track activity within the month
  let moneyIn = 0;
  let moneyOut = 0;
  let inflowCount = 0;
  let outflowCount = 0;

  const walletActivityMap = new Map<string, { in: number; out: number }>();
  targetWallets.forEach(w => {
    walletActivityMap.set(w.id, { in: 0, out: 0 });
  });

  const dailyActivityMap = new Map<number, { spent: number; received: number }>();
  for (let i = 1; i <= daysInMonth; i++) {
    dailyActivityMap.set(i, { spent: 0, received: 0 });
  }

  const categoryMap = new Map<string, { amount: number; count: number }>();
  let highestExpense: MonthReportData['highestExpense'] = null;

  // Process month expenses
  (db.expenses || []).forEach(e => {
    if (e.date >= monthStartIso && e.date <= monthEndIso) {
      const isTransfer = e.category === 'Transfer';
      const isIncoming = expenseFlow(e) === 'in';
      const amt = Number(e.amount) || 0;
      if (amt <= 0) return;

      const dayNum = parseInt(e.date.slice(8, 10), 10);
      const dayEntry = dailyActivityMap.get(dayNum);

      // Wallet level tracking
      const wId = e.walletId;
      if (wId && targetWalletIds.has(wId)) {
        const delta = expenseWalletDelta(e, db);
        const wAct = walletActivityMap.get(wId);
        if (wAct && delta !== 0) {
          if (delta > 0) wAct.in += delta;
          else wAct.out += Math.abs(delta);
        }
      }

      // If personal or split expense (excluding internal wallet transfers)
      if (!isTransfer) {
        if (isIncoming) {
          moneyIn += amt;
          inflowCount++;
          if (dayEntry) dayEntry.received += amt;
        } else {
          // Outflow expense
          if (e.status !== 'unpaid') {
            moneyOut += amt;
            outflowCount++;
            if (dayEntry) dayEntry.spent += amt;

            // Category tracking
            const catName = e.category || 'General';
            const catEntry = categoryMap.get(catName) || { amount: 0, count: 0 };
            catEntry.amount += amt;
            catEntry.count += 1;
            categoryMap.set(catName, catEntry);

            // Highest expense tracking
            if (!highestExpense || amt > highestExpense.amount) {
              highestExpense = {
                id: e.id,
                description: cleanExpenseDescription(e.description) || e.category,
                amount: amt,
                category: e.category,
                date: e.date,
              };
            }
          }
        }
      }
    }
  });

  // Process settlements in month
  (db.settlements || []).forEach(s => {
    if (s.date >= monthStartIso && s.date <= monthEndIso && !s.isForgiven) {
      const amt = Number(s.amount) || 0;
      if (amt === 0) return;

      const dayNum = parseInt(s.date.slice(8, 10), 10);
      const dayEntry = dailyActivityMap.get(dayNum);

      const wId = s.walletId;
      if (wId && targetWalletIds.has(wId)) {
        const wAct = walletActivityMap.get(wId);
        if (wAct) {
          if (amt > 0) wAct.in += amt;
          else wAct.out += Math.abs(amt);
        }
      }

      if (amt > 0) {
        moneyIn += amt;
        inflowCount++;
        if (dayEntry) dayEntry.received += amt;
      } else {
        const absAmt = Math.abs(amt);
        moneyOut += absAmt;
        outflowCount++;
        if (dayEntry) dayEntry.spent += absAmt;

        const catName = 'Settlement';
        const catEntry = categoryMap.get(catName) || { amount: 0, count: 0 };
        catEntry.amount += absAmt;
        catEntry.count += 1;
        categoryMap.set(catName, catEntry);
      }
    }
  });

  // Calculate closing balance
  const netCashFlow = moneyIn - moneyOut;
  const closingBalance = totalOpeningBalance + netCashFlow;

  const savingsRate = moneyIn > 0 ? Math.round(((moneyIn - moneyOut) / moneyIn) * 100) : 0;
  const dailyAverageSpend = daysPassed > 0 ? Math.round(moneyOut / daysPassed) : 0;

  // Categories array sorted by spend descending
  const totalCategorySpend = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.amount, 0);
  const categories: MonthReportCategory[] = Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      pct: totalCategorySpend > 0 ? Math.round((data.amount / totalCategorySpend) * 100) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Peak spending day
  let peakSpendingDay: MonthReportData['peakSpendingDay'] = null;
  dailyActivityMap.forEach((entry, dayNumber) => {
    if (entry.spent > 0) {
      if (!peakSpendingDay || entry.spent > peakSpendingDay.amount) {
        peakSpendingDay = {
          dateStr: `${yearMonth}-${String(dayNumber).padStart(2, '0')}`,
          dayNumber,
          amount: entry.spent,
        };
      }
    }
  });

  // Daily trend
  const dailyBreakdown: MonthReportDaily[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dObj = new Date(year, month - 1, i);
    const dayName = dObj.toLocaleDateString(undefined, { weekday: 'short' });
    const act = dailyActivityMap.get(i) || { spent: 0, received: 0 };
    dailyBreakdown.push({
      day: i,
      dateStr: `${yearMonth}-${String(i).padStart(2, '0')}`,
      dayName,
      spent: act.spent,
      received: act.received,
      net: act.received - act.spent,
    });
  }

  // Wallet breakdowns
  const wallets: MonthReportWallet[] = targetWallets.map(w => {
    const openBal = walletOpeningMap.get(w.id) || 0;
    const act = walletActivityMap.get(w.id) || { in: 0, out: 0 };
    const netChange = act.in - act.out;
    const closeBal = openBal + netChange;
    return {
      id: w.id,
      name: w.name,
      color: w.color || 'var(--accent)',
      icon: w.icon,
      openingBalance: openBal,
      closingBalance: closeBal,
      moneyIn: act.in,
      moneyOut: act.out,
      netChange,
    };
  });

  return {
    yearMonth,
    monthLabel: formatMonthName(yearMonth, false),
    shortMonthLabel: formatMonthName(yearMonth, true),
    year,
    month,
    daysInMonth,
    daysPassed,
    isCurrentMonth,
    openingBalance: totalOpeningBalance,
    closingBalance,
    moneyIn,
    moneyOut,
    netCashFlow,
    savingsRate,
    dailyAverageSpend,
    transactionCount: inflowCount + outflowCount,
    inflowCount,
    outflowCount,
    highestExpense,
    peakSpendingDay,
    categories,
    wallets,
    dailyBreakdown,
  };
}

export function compareMonthReports(
  current: MonthReportData,
  prev: MonthReportData
): MonthComparisonData {
  const spendDiff = current.moneyOut - prev.moneyOut;
  const spendPctChange = prev.moneyOut > 0 ? ((current.moneyOut - prev.moneyOut) / prev.moneyOut) * 100 : 0;

  const incomeDiff = current.moneyIn - prev.moneyIn;
  const incomePctChange = prev.moneyIn > 0 ? ((current.moneyIn - prev.moneyIn) / prev.moneyIn) * 100 : 0;

  const openingDiff = current.openingBalance - prev.openingBalance;
  const openingPctChange = prev.openingBalance !== 0 ? ((current.openingBalance - prev.openingBalance) / Math.abs(prev.openingBalance)) * 100 : 0;

  const closingDiff = current.closingBalance - prev.closingBalance;
  const closingPctChange = prev.closingBalance !== 0 ? ((current.closingBalance - prev.closingBalance) / Math.abs(prev.closingBalance)) * 100 : 0;

  const netCashFlowDiff = current.netCashFlow - prev.netCashFlow;
  const dailyAvgDiff = current.dailyAverageSpend - prev.dailyAverageSpend;

  // Compare categories
  const prevCatMap = new Map<string, number>();
  prev.categories.forEach(c => prevCatMap.set(c.name, c.amount));

  const allCatNames = new Set<string>();
  current.categories.forEach(c => allCatNames.add(c.name));
  prev.categories.forEach(c => allCatNames.add(c.name));

  const categoryDiffs: MonthComparisonData['categoryDiffs'] = [];
  allCatNames.forEach(name => {
    const currentAmt = current.categories.find(c => c.name === name)?.amount || 0;
    const prevAmt = prevCatMap.get(name) || 0;
    const diff = currentAmt - prevAmt;
    const pctChange = prevAmt > 0 ? ((currentAmt - prevAmt) / prevAmt) * 100 : 0;
    categoryDiffs.push({
      name,
      currentAmount: currentAmt,
      prevAmount: prevAmt,
      diff,
      pctChange,
    });
  });

  categoryDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    spendDiff,
    spendPctChange,
    incomeDiff,
    incomePctChange,
    openingDiff,
    openingPctChange,
    closingDiff,
    closingPctChange,
    netCashFlowDiff,
    dailyAvgDiff,
    categoryDiffs,
  };
}
