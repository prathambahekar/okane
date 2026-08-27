import type { AppDB, ExpenseFlow, ExpenseType, ExpenseStatus } from '../types';
import { currencySymbol } from '../utils';

export interface FrequentTaskItem {
  label: string;
  subText?: string;
  description: string;
  amount: number;
  category: string;
  flow: ExpenseFlow;
  whoPaid: 'me' | 'other';
  type: ExpenseType;
  splitMode: 'just_me' | 'for_friend' | 'by_friend' | 'pay_debt';
  status: ExpenseStatus;
  isDebt: boolean;
  friendId?: string | null;
  friendName?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  walletId?: string;
  prompt: string;
}

export function getFrequentTasks(db: AppDB): FrequentTaskItem[] {
  const currency = db.settings?.currency || 'INR';
  const currSym = currencySymbol(currency);
  const defaultWalletId = db.settings?.defaultWalletId || db.wallets[0]?.id || '';

  // Determine reference date (latest expense date in DB or today)
  const now = new Date();
  let refTime = now.getTime();
  if (db.expenses && db.expenses.length > 0) {
    const maxDateStr = db.expenses.reduce((max, e) => (e.date > max ? e.date : max), '');
    if (maxDateStr) {
      const parsedMax = new Date(maxDateStr).getTime();
      if (!isNaN(parsedMax) && parsedMax > refTime - 30 * 86400 * 1000) {
        refTime = parsedMax;
      }
    }
  }

  const cutoff7 = new Date(refTime - 7 * 86400 * 1000).toISOString().slice(0, 10);
  const cutoff14 = new Date(refTime - 14 * 86400 * 1000).toISOString().slice(0, 10);
  const cutoff30 = new Date(refTime - 30 * 86400 * 1000).toISOString().slice(0, 10);

  // 1. Filter expenses from past 7 days first
  let candidates = db.expenses.filter(e => {
    if (!e.date) return false;
    const d = (e.description || '').trim().toLowerCase();
    if (!d || d.length < 2) return false;
    if (d.startsWith('settling') || d.startsWith('repaid') || d.startsWith('debt repayment')) return false;
    return e.date >= cutoff7;
  });

  // If 7 days yields fewer than 2 items, expand to 14 days, then 30 days
  if (candidates.length < 2) {
    candidates = db.expenses.filter(e => {
      if (!e.date) return false;
      const d = (e.description || '').trim().toLowerCase();
      if (!d || d.length < 2) return false;
      if (d.startsWith('settling') || d.startsWith('repaid') || d.startsWith('debt repayment')) return false;
      return e.date >= cutoff14;
    });
  }

  if (candidates.length < 2) {
    candidates = db.expenses.filter(e => {
      if (!e.date) return false;
      const d = (e.description || '').trim().toLowerCase();
      if (!d || d.length < 2) return false;
      if (d.startsWith('settling') || d.startsWith('repaid') || d.startsWith('debt repayment')) return false;
      return e.date >= cutoff30;
    });
  }

  interface ScenarioStat {
    rawDesc: string;
    flow: ExpenseFlow;
    type: ExpenseType;
    whoPaid: 'me' | 'other';
    status: ExpenseStatus;
    isDebt: boolean;
    friendId: string | null;
    vendorId: string | null;
    amounts: number[];
    latestAmount: number;
    latestDate: string;
    category: string;
    walletId: string;
    count: number;
  }

  const statsMap: Record<string, ScenarioStat> = {};

  candidates.forEach(e => {
    const rawDesc = (e.description || '').trim();
    const normDesc = rawDesc.toLowerCase();
    const flow = e.flow || 'out';
    const type = e.type || 'personal';
    const whoPaid: 'me' | 'other' = (type === 'by_friend' || (e as { whoPaid?: string }).whoPaid === 'other') ? 'other' : 'me';
    const isDebt = e.status === 'unpaid';
    const status: ExpenseStatus = e.status || (isDebt ? 'unpaid' : 'paid');
    const friendId = e.friendId || null;
    const vendorId = e.vendorId || null;

    const groupKey = `${normDesc}|${flow}|${type}|${whoPaid}|${isDebt ? 'debt' : 'paid'}|${friendId || ''}|${vendorId || ''}`;

    if (!statsMap[groupKey]) {
      statsMap[groupKey] = {
        rawDesc,
        flow,
        type,
        whoPaid,
        status,
        isDebt,
        friendId,
        vendorId,
        amounts: [],
        latestAmount: e.amount || 0,
        latestDate: e.date || '',
        category: e.category || 'Food & Dining',
        walletId: e.walletId || defaultWalletId,
        count: 0,
      };
    }

    const item = statsMap[groupKey];
    item.count += 1;
    if (e.amount > 0) {
      item.amounts.push(e.amount);
    }
    if (!item.latestDate || (e.date && e.date >= item.latestDate)) {
      item.latestDate = e.date || '';
      item.latestAmount = e.amount || item.latestAmount;
    }
    if (e.category) item.category = e.category;
    if (e.walletId) item.walletId = e.walletId;
  });

  // Sort candidates by count (frequency) and recency (latestDate)
  const sortedKeys = Object.keys(statsMap).sort((a, b) => {
    const itemA = statsMap[a];
    const itemB = statsMap[b];
    if (itemB.count !== itemA.count) {
      return itemB.count - itemA.count;
    }
    return itemB.latestDate.localeCompare(itemA.latestDate);
  });

  const tasks: FrequentTaskItem[] = [];

  sortedKeys.forEach(key => {
    const stat = statsMap[key];

    // Calculate exact price (most frequent price or latest)
    let exactAmount = stat.latestAmount || 0;
    if (stat.amounts.length > 0) {
      const priceCounts: Record<number, number> = {};
      stat.amounts.forEach(a => {
        priceCounts[a] = (priceCounts[a] || 0) + 1;
      });
      const topPrices = Object.entries(priceCounts).sort((a, b) => b[1] - a[1]);
      if (topPrices.length > 0 && topPrices[0][1] >= 2) {
        exactAmount = Number(topPrices[0][0]);
      }
    }

    const formattedDesc = stat.rawDesc.charAt(0).toUpperCase() + stat.rawDesc.slice(1);

    // Resolve Friend / Vendor object
    const friendObj = stat.friendId ? db.friends.find(f => f.id === stat.friendId) : null;
    const vendorObj = stat.vendorId ? db.friends.find(f => f.id === stat.vendorId) : null;
    const friendName = friendObj ? friendObj.name : null;
    const vendorName = vendorObj ? vendorObj.name : null;

    // Build clean display label
    let label = formattedDesc;
    if (stat.whoPaid === 'other' && friendName) {
      label = `${formattedDesc} (by ${friendName})`;
    } else if (stat.type === 'for_friend' && friendName) {
      label = `${formattedDesc} (with ${friendName})`;
    }

    let splitMode: 'just_me' | 'for_friend' | 'by_friend' | 'pay_debt' = 'just_me';
    if (stat.whoPaid === 'other' || stat.type === 'by_friend') {
      splitMode = 'by_friend';
    } else if (stat.type === 'for_friend') {
      splitMode = 'for_friend';
    }

    tasks.push({
      label,
      subText: `${currSym}${exactAmount}`,
      description: formattedDesc,
      amount: exactAmount,
      category: stat.category,
      flow: stat.flow,
      whoPaid: stat.whoPaid,
      type: stat.type,
      splitMode,
      status: stat.status,
      isDebt: stat.isDebt,
      friendId: stat.friendId,
      friendName,
      vendorId: stat.vendorId,
      vendorName,
      walletId: stat.walletId,
      prompt: label,
    });
  });

  const seenKeys = new Set<string>();
  const uniqueTasks: FrequentTaskItem[] = [];
  tasks.forEach(t => {
    const key = `${t.label}|${t.amount}|${t.friendId || ''}|${t.vendorId || ''}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueTasks.push(t);
    }
  });

  return uniqueTasks.slice(0, 6);
}
