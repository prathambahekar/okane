import { CURRENCIES } from './db';
import type { Expense, ExpenseFlow, ExpenseType } from './types';
import { expenseFlow, personalNetAmount } from './db';

export function currencySymbol(currency: string): string {
  const c = CURRENCIES.find(x => x.code === currency);
  return c ? c.symbol : '$';
}

export function fmtMoney(n: number, currency: string): string {
  const v = Number(n) || 0;
  const sym = currencySymbol(currency);
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-' : '') + sym + s;
}

export function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function typeLabel(type: ExpenseType, friendType?: 'friend' | 'vendor' | 'subscription'): string {
  if (type === 'personal') return 'Personal';
  if (friendType === 'vendor') {
    if (type === 'for_friend') return 'Advance to Vendor';
    return 'Billed by Vendor';
  }
  if (friendType === 'subscription') {
    if (type === 'for_friend') return 'Prepaid Sub';
    return 'Subscription Bill';
  }
  if (type === 'for_friend') return 'Paid for friend';
  return 'Friend paid';
}

export function typeLabelWithFlow(e: Expense, friendType?: 'friend' | 'vendor' | 'subscription'): string {
  const base = typeLabel(e.type, friendType);
  if (expenseFlow(e) === 'in') {
    if (friendType === 'vendor') {
      if (e.type === 'for_friend') return 'Vendor refund';
      if (e.type === 'by_friend') return 'Vendor payout';
    }
    if (e.type === 'for_friend') return 'Friend repaid me';
    if (e.type === 'by_friend') return 'I repaid friend';
    return base + ' · received';
  }
  return base;
}

export function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function flowLabel(flow: ExpenseFlow): string {
  return flow === 'in' ? 'Received' : 'Spent';
}

export function fmtExpenseAmount(e: Expense, currency: string): string {
  if (expenseFlow(e) === 'in') return '+' + fmtMoney(e.amount, currency);
  return fmtMoney(e.amount, currency);
}

export function expenseAmountClass(e: Expense): string {
  if (expenseFlow(e) === 'in') return 'credit';
  if (e.type === 'by_friend') return 'debit';
  if (e.type === 'for_friend') return 'credit';
  return '';
}

export interface GroupedExpense {
  id: string;
  groupId?: string | null;
  description: string;
  totalAmount: number;
  date: string;
  category: string;
  walletId: string;
  flow: ExpenseFlow;
  createdAt: number;
  items: Expense[];
  isSplit: boolean;
  personalShare: number;
  friendShare: number;
  friendIds: string[];
}

export function groupExpenses(expenses: Expense[]): GroupedExpense[] {
  const groupedMap = new Map<string, Expense[]>();
  const singles: Expense[] = [];

  for (const e of expenses) {
    if (e.groupId) {
      if (!groupedMap.has(e.groupId)) {
        groupedMap.set(e.groupId, []);
      }
      groupedMap.get(e.groupId)!.push(e);
    } else {
      singles.push(e);
    }
  }

  const result: GroupedExpense[] = [];

  groupedMap.forEach((items, gId) => {
    if (items.length <= 1) {
      const e = items[0];
      const friendIds = e.friendId ? [e.friendId] : [];
      result.push({
        id: e.id,
        groupId: e.groupId,
        description: e.description.replace(/\s*\(Friend share\)$/i, '').trim(),
        totalAmount: e.amount,
        date: e.date,
        category: e.category,
        walletId: e.walletId,
        flow: e.flow,
        createdAt: e.createdAt,
        items: [e],
        isSplit: e.type !== 'personal',
        personalShare: e.type === 'personal' ? e.amount : 0,
        friendShare: e.type !== 'personal' ? e.amount : 0,
        friendIds,
      });
    } else {
      items.sort((a) => (a.type === 'personal' ? -1 : 1));
      const first = items[0];

      const byFriendItems = items.filter(i => i.type === 'by_friend');
      const forFriendItems = items.filter(i => i.type === 'for_friend');
      const personalItems = items.filter(i => i.type === 'personal');

      const byFriendSum = byFriendItems.reduce((sum, item) => sum + Number(item.amount), 0);
      const forFriendSum = forFriendItems.reduce((sum, item) => sum + Number(item.amount), 0);
      const personalSum = personalItems.reduce((sum, item) => sum + Number(item.amount), 0);

      const totalAmount = byFriendItems.length > 0
        ? Math.max(byFriendSum, personalSum + forFriendSum)
        : (personalSum + forFriendSum || items.reduce((sum, i) => sum + Number(i.amount), 0));

      const personalShare = personalItems.length > 0
        ? personalSum
        : (byFriendItems.length > 0 ? Math.max(0, totalAmount - forFriendSum) : 0);

      const friendShare = forFriendSum;
      const friendIds = Array.from(new Set(items.map(i => i.friendId).filter(Boolean) as string[]));
      const maxCreatedAt = Math.max(...items.map(i => i.createdAt || 0));
      const cleanDesc = first.description.replace(/\s*\([^)]*\)$/i, '').trim();

      const finalItems = [...items];
      if (personalItems.length === 0 && personalShare > 0) {
        finalItems.unshift({
          id: `synth_mine_${gId}`,
          description: cleanDesc,
          amount: personalShare,
          category: first.category,
          date: first.date,
          type: 'personal',
          flow: first.flow,
          friendId: null,
          walletId: first.walletId,
          status: 'paid',
          settled: false,
          settlementId: null,
          notes: '',
          createdAt: maxCreatedAt,
          groupId: gId,
        });
      }

      result.push({
        id: gId,
        groupId: gId,
        description: cleanDesc,
        totalAmount,
        date: first.date,
        category: first.category,
        walletId: first.walletId,
        flow: first.flow,
        createdAt: maxCreatedAt,
        items: finalItems,
        isSplit: true,
        personalShare,
        friendShare,
        friendIds,
      });
    }
  });

  for (const e of singles) {
    const friendIds = e.friendId ? [e.friendId] : [];
    result.push({
      id: e.id,
      groupId: null,
      description: e.description.replace(/\s*\(Friend share\)$/i, '').trim(),
      totalAmount: e.amount,
      date: e.date,
      category: e.category,
      walletId: e.walletId,
      flow: e.flow,
      createdAt: e.createdAt,
      items: [e],
      isSplit: false,
      personalShare: e.type === 'personal' ? e.amount : 0,
      friendShare: e.type !== 'personal' ? e.amount : 0,
      friendIds,
    });
  }

  result.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return result;
}

export function friendInitial(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export function generateInsights(
  expenses: Expense[],
  friends: { id: string; name: string }[],
  friendBalanceFn: (id: string) => { net: number },
  currency: string,
) {
  const out: { tone: 'up' | 'down' | 'neutral'; html: string }[] = [];
  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = lastDate.getFullYear() + '-' + String(lastDate.getMonth() + 1).padStart(2, '0');
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });

  const thisM = expenses.filter(e => monthKey(e.date) === thisKey && e.type === 'personal');
  const lastM = expenses.filter(e => monthKey(e.date) === lastKey && e.type === 'personal');

  const catThis: Record<string, number> = {};
  const catLast: Record<string, number> = {};
  thisM.forEach(e => { catThis[e.category] = (catThis[e.category] || 0) + personalNetAmount(e); });
  lastM.forEach(e => { catLast[e.category] = (catLast[e.category] || 0) + personalNetAmount(e); });

  const changes: { cat: string; pct: number; cur: number; prev: number }[] = [];
  Object.keys(catThis).forEach(cat => {
    const prev = catLast[cat] || 0;
    const cur = catThis[cat];
    if (prev > 0) {
      const pct = ((cur - prev) / prev) * 100;
      if (Math.abs(pct) > 15) changes.push({ cat, pct, cur, prev });
    }
  });
  const biggestIncrease = changes.filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct)[0] ?? null;
  const biggestDecrease = changes.filter(c => c.pct < 0).sort((a, b) => a.pct - b.pct)[0] ?? null;

  if (biggestIncrease) {
    out.push({ tone: 'up', html: `You spent <strong>${Math.round(biggestIncrease.pct)}% more</strong> on ${biggestIncrease.cat} this month than last (${fmtMoney(biggestIncrease.cur, currency)} vs ${fmtMoney(biggestIncrease.prev, currency)}).` });
  }
  if (biggestDecrease) {
    out.push({ tone: 'down', html: `Nice — <strong>${biggestDecrease.cat}</strong> spending dropped ${Math.round(Math.abs(biggestDecrease.pct))}% compared to last month.` });
  }

  const topCat = Object.entries(catThis).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const totalThis = Object.values(catThis).reduce((a, b) => a + b, 0);
    const share = totalThis > 0 ? (topCat[1] / totalThis) * 100 : 0;
    out.push({ tone: 'neutral', html: `<strong>${topCat[0]}</strong> is your top category in ${monthName}, making up ${Math.round(share)}% of spend (${fmtMoney(topCat[1], currency)}).` });
  }

  const balances = friends
    .map(f => ({ friend: f, ...friendBalanceFn(f.id) }))
    .filter(b => Math.abs(b.net) > 0.004)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  if (balances.length) {
    const top = balances[0];
    out.push({
      tone: top.net > 0 ? 'down' : 'up',
      html: top.net > 0
        ? `<strong>${top.friend.name}</strong> owes you the most right now — ${fmtMoney(top.net, currency)}.`
        : `You owe <strong>${top.friend.name}</strong> the most right now — ${fmtMoney(Math.abs(top.net), currency)}.`,
    });
  }

  const unsettled = expenses.filter(e => e.type !== 'personal' && !e.settled && expenseFlow(e) === 'out');
  if (unsettled.length >= 3) {
    const val = unsettled.reduce((s, e) => s + Number(e.amount), 0);
    out.push({ tone: 'neutral', html: `You have <strong>${unsettled.length} shared expenses</strong> worth ${fmtMoney(val, currency)} still waiting to be settled.` });
  }

  const dayOfMonth = now.getDate();
  const thisTotal = thisM.reduce((s, e) => s + personalNetAmount(e), 0);
  const lastTotal = lastM.reduce((s, e) => s + personalNetAmount(e), 0);
  const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  if (lastTotal > 0 && dayOfMonth >= 5) {
    const projected = (thisTotal / dayOfMonth) * daysInLastMonth;
    const pct = ((projected - lastTotal) / lastTotal) * 100;
    if (Math.abs(pct) > 10) {
      out.push({ tone: pct > 0 ? 'up' : 'down', html: `At this pace you're on track to spend <strong>${Math.round(Math.abs(pct))}% ${pct > 0 ? 'more' : 'less'}</strong> this month than last (~${fmtMoney(projected, currency)} projected).` });
    }
  }

  return out.slice(0, 5);
}
