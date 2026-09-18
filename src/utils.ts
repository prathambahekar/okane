import { CURRENCIES } from './db';
import type { Expense, ExpenseFlow, ExpenseType, Wallet, Friend, Category, Settlement, ContactType } from './types';
import { expenseFlow, personalNetAmount } from './db';

export function currencySymbol(currency: string): string {
  if (!currency) return '₹';
  const c = CURRENCIES.find(x => x.code === currency || x.symbol === currency);
  if (c) return c.symbol;
  if (currency === 'INR') return '₹';
  if (currency === 'USD') return '$';
  if (currency === 'EUR') return '€';
  if (currency === 'GBP') return '£';
  return currency;
}

export function fmtMoney(n: number, currency: string, hideAmount?: boolean): string {
  const isHidden = hideAmount === true;
  const v = Number(n) || 0;
  const sym = currencySymbol(currency);
  if (isHidden) {
    return (v < 0 ? '-' : '') + '• • • •';
  }
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-' : '') + sym + s;
}

export function fmtCompactNumber(n: number, isIndianSystem: boolean = true): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';

  if (isIndianSystem) {
    if (abs >= 10000000) {
      const val = abs / 10000000;
      const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '');
      return `${sign}${formatted}Cr`;
    }
    if (abs >= 100000) {
      const val = abs / 100000;
      const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '');
      return `${sign}${formatted}L`;
    }
  } else {
    if (abs >= 1000000000) {
      const val = abs / 1000000000;
      const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '');
      return `${sign}${formatted}B`;
    }
    if (abs >= 1000000) {
      const val = abs / 1000000;
      const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '');
      return `${sign}${formatted}M`;
    }
  }

  if (abs >= 1000) {
    const val = abs / 1000;
    const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '');
    return `${sign}${formatted}k`;
  }
  return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}`;
}

export function fmtMoneyCompact(n: number, currency: string): string {
  const v = Number(n) || 0;
  const sym = currencySymbol(currency);
  const sign = v < 0 ? '-' : '';
  const isIndian = currency === 'INR' || sym === '₹';
  const absCompact = fmtCompactNumber(Math.abs(v), isIndian);
  return `${sign}${sym}${absCompact}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateWithDay(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return fmtDate(iso);
  const nowYear = new Date().getFullYear();
  const dYear = d.getFullYear();
  if (dYear === nowYear) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function getRelativeDateLabel(dateStr: string): string | null {
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  if (dateStr === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  if (dateStr === yesterday) return 'Yesterday';
  return null;
}

export function fmtMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function formatBillingCycleShort(cycle?: string): string {
  if (!cycle) return 'mo';
  if (cycle === 'monthly') return 'mo';
  if (cycle === 'yearly') return 'yr';
  if (cycle === 'quarterly') return '3mo';
  if (cycle === 'half_yearly') return '6mo';
  const match = cycle.match(/(\d+)\s*month/i);
  if (match) return `${match[1]}mo`;
  return cycle;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function typeLabel(type: ExpenseType, friendType?: 'friend' | 'vendor' | 'subscription', category?: string): string {
  if (category === 'Transfer') return 'Wallet Transfer';
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
  if (e.category === 'Transfer') return 'Wallet Transfer';
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
  if (!s || s === 'none') return '';
  if (s === 'paid') return 'Paid';
  if (s === 'settled') return 'Settled';
  if (s === 'unsettled') return 'Unsettled';
  if (s === 'unpaid') return 'Unpaid';
  if (s === 'partial') return 'Partially Settled';
  if (s === 'completed') return 'Completed';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function flowLabel(flow: ExpenseFlow): string {
  return flow === 'in' ? 'Received' : 'Spent';
}

export function cleanExpenseDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/\s*\([^)]*Bill[^)]*\)/gi, '')
    .replace(/\s*\([^)]*Tiffin Aunty[^)]*\)/gi, '')
    .replace(/\s*\(Unpaid.*?\)/gi, '')
    .replace(/\s*\(Remaining\)/gi, '')
    .replace(/\s*\(Friend share\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  settlementId?: string | null;
  description: string;
  totalAmount: number;
  date: string;
  category: string;
  walletId: string;
  flow: ExpenseFlow;
  createdAt: number;
  items: Expense[];
  isSplit: boolean;
  isSettlementGroup?: boolean;
  isForgiven?: boolean;
  settlementItemCount?: number;
  settlementDateRange?: string;
  personalShare: number;
  friendShare: number;
  friendIds: string[];
  vendorId?: string | null;
  fromWalletName?: string;
  toWalletName?: string;
}

export function groupExpenses(
  expenses: Expense[],
  wallets?: Wallet[],
  friends?: Friend[],
  settlements?: Settlement[]
): GroupedExpense[] {
  const walletMap = wallets ? new Map(wallets.map(w => [w.id, w.name])) : null;
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
    const isTransferGroup = items.some(i => i.category === 'Transfer') || gId.startsWith('trf_grp');

      if (isTransferGroup) {
        const outItem = items.find(i => i.flow === 'out') || items[0];
        const inItem = items.find(i => i.flow === 'in') || items[1];

        let fromWName = outItem ? (walletMap?.get(outItem.walletId) || wallets?.find(w => w.id === outItem.walletId)?.name) : undefined;
        let toWName = inItem ? (walletMap?.get(inItem.walletId) || wallets?.find(w => w.id === inItem.walletId)?.name) : undefined;

        if (!fromWName && inItem?.description) {
          const m = inItem.description.match(/Transfer from\s+(.+?)(?:\s*\(|$)/i);
          if (m) fromWName = m[1].trim();
        }
        if (!toWName && outItem?.description) {
          const m = outItem.description.match(/Transfer to\s+(.+?)(?:\s*\(|$)/i);
          if (m) toWName = m[1].trim();
        }

        fromWName = fromWName || 'Wallet';
        toWName = toWName || 'Wallet';

        let noteStr = '';
        if (outItem?.notes && !outItem.notes.toLowerCase().startsWith('transfer to')) {
          noteStr = outItem.notes.trim();
        } else if (inItem?.notes && !inItem.notes.toLowerCase().startsWith('transfer from')) {
          noteStr = inItem.notes.trim();
        }

        const cleanDesc = `Transfer: ${fromWName} → ${toWName}${noteStr ? ` (${noteStr})` : ''}`;
        const transferAmount = outItem ? outItem.amount : (inItem ? inItem.amount : items[0].amount);
        const maxCreatedAt = Math.max(...items.map(i => i.createdAt || 0));

        result.push({
          id: gId,
          groupId: gId,
          description: cleanDesc,
          totalAmount: transferAmount,
          date: outItem?.date || items[0].date,
          category: 'Transfer',
          walletId: outItem?.walletId || items[0].walletId,
          flow: 'out',
          createdAt: maxCreatedAt,
          items,
          isSplit: false,
          personalShare: 0,
          friendShare: 0,
          friendIds: [],
          vendorId: null,
          fromWalletName: fromWName,
          toWalletName: toWName,
        });
      } else if (items.length <= 1) {
        const e = items[0];
        const isSplitGroup = Boolean(gId && (gId.startsWith('grp_') || gId.startsWith('split_')));
        const friendIds = e.friendId ? [e.friendId] : [];
        const cleanDesc = e.description.replace(/\s*\(Friend share\)$/i, '').trim();

        if (isSplitGroup && e.type === 'for_friend') {
          result.push({
            id: gId,
            groupId: gId,
            description: cleanDesc,
            totalAmount: e.amount,
            date: e.date,
            category: e.category,
            walletId: e.walletId,
            flow: e.flow,
            createdAt: e.createdAt,
            items: [e],
            isSplit: true,
            personalShare: 0,
            friendShare: e.amount,
            friendIds,
            vendorId: e.vendorId || null,
          });
        } else {
          result.push({
            id: e.id,
            groupId: e.groupId,
            description: cleanDesc,
            totalAmount: e.amount,
            date: e.date,
            category: e.category,
            walletId: e.walletId,
            flow: e.flow,
            createdAt: e.createdAt,
            items: [e],
            isSplit: isSplitGroup,
            personalShare: e.type === 'personal' ? e.amount : 0,
            friendShare: e.type !== 'personal' ? e.amount : 0,
            friendIds,
            vendorId: e.vendorId || null,
          });
        }
      } else {
        items.sort((a) => (a.type === 'personal' ? -1 : 1));
        const first = items[0];
        const groupVendorId = items.find(i => i.vendorId)?.vendorId || first.vendorId || null;

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

        const isSplit = Boolean(
          gId.startsWith('grp_') ||
          gId.startsWith('split_') ||
          (forFriendItems.length > 0 || byFriendItems.length > 0)
        );

        const finalItems = [...items];
        if (personalItems.length === 0 && isSplit && personalShare > 0) {
          finalItems.unshift({
            id: `synth_mine_${gId}`,
            description: cleanDesc,
            amount: personalShare,
            category: first.category,
            date: first.date,
            type: 'personal',
            flow: first.flow,
            friendId: null,
            vendorId: groupVendorId,
            walletId: first.walletId,
            status: first.status || 'paid',
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
          isSplit,
          personalShare,
          friendShare,
          friendIds,
          vendorId: groupVendorId,
        });
      }
  });

  for (const e of singles) {
    if (e.category === 'Transfer') {
      let fromWName = wallets?.find(w => w.id === e.walletId)?.name;
      let toWName: string | undefined;

      if (e.description.toLowerCase().startsWith('transfer to')) {
        toWName = e.description.replace(/^Transfer to\s*/i, '').replace(/\s*\([^)]*\)$/, '').trim();
      } else if (e.description.toLowerCase().startsWith('transfer from')) {
        toWName = fromWName;
        fromWName = e.description.replace(/^Transfer from\s*/i, '').replace(/\s*\([^)]*\)$/, '').trim();
      }

      const cleanDesc = `Transfer: ${fromWName || 'Wallet'} → ${toWName || 'Wallet'}`;
      result.push({
        id: e.id,
        groupId: null,
        description: cleanDesc,
        totalAmount: e.amount,
        date: e.date,
        category: 'Transfer',
        walletId: e.walletId,
        flow: 'out',
        createdAt: e.createdAt,
        items: [e],
        isSplit: false,
        personalShare: 0,
        friendShare: 0,
        friendIds: [],
        vendorId: null,
        fromWalletName: fromWName,
        toWalletName: toWName,
      });
    } else {
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
        vendorId: e.vendorId || null,
      });
    }
  }

  if (settlements && settlements.length > 0) {
    for (const s of settlements) {
      const friend = friends?.find(f => f.id === s.friendId);
      const flow: ExpenseFlow = s.amount >= 0 ? 'in' : 'out';
      const totalAmount = Math.abs(s.amount);

      const coveredExpenses = expenses.filter(e =>
        (s.expenseIds && s.expenseIds.includes(e.id)) ||
        (e.settlementId && String(e.settlementId).trim() === String(s.id).trim()) ||
        (e.vendorSettlementId && String(e.vendorSettlementId).trim() === String(s.id).trim())
      );

      const isForgiven = Boolean(s.isForgiven || (s.note && /forgiv|waiv/i.test(s.note)));
      let noteText = s.note ? s.note.trim() : '';
      if (isForgiven) {
        noteText = noteText
          .replace(/^forgiven\s*\/\s*waived\s*off$/i, '')
          .replace(/^forgiven$/i, '')
          .replace(/^waived\s*off$/i, '')
          .replace(/^waived$/i, '')
          .trim();
      }

      const action = s.amount >= 0 ? 'Received' : 'Paid';
      const cleanDesc = noteText
        ? `Settlement: ${action} (${noteText})`
        : `Settlement: ${action}`;

      result.push({
        id: `stl_${s.id}`,
        groupId: `stl_${s.id}`,
        settlementId: s.id,
        description: cleanDesc,
        totalAmount,
        date: s.date,
        category: 'Settlement',
        walletId: s.walletId || '',
        flow,
        createdAt: s.createdAt || Date.now(),
        items: coveredExpenses,
        isSplit: false,
        isSettlementGroup: true,
        isForgiven,
        settlementItemCount: coveredExpenses.length || (s.expenseIds || []).length,
        settlementDateRange: '',
        personalShare: 0,
        friendShare: totalAmount,
        friendIds: [s.friendId],
        vendorId: friend?.type === 'vendor' ? s.friendId : null,
      });
    }
  }

  result.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return result;
}

export type SpendingMode = 'all' | 'me';

export function getGroupedExpenseAmount(ge: GroupedExpense, mode: SpendingMode = 'all'): number {
  if (ge.category === 'Transfer' || ge.items?.some(i => i.category === 'Transfer')) {
    return 0;
  }
  if (ge.isSettlementGroup) {
    return mode === 'me' ? 0 : ge.totalAmount;
  }
  if (mode === 'me') {
    if (ge.isSplit) {
      return ge.personalShare;
    }
    const firstItem = ge.items[0];
    if (firstItem) {
      if (firstItem.type === 'for_friend') {
        return 0;
      }
      if (firstItem.type === 'personal') {
        return ge.totalAmount;
      }
      if (firstItem.type === 'by_friend') {
        return ge.totalAmount;
      }
    }
    return ge.personalShare > 0 ? ge.personalShare : ge.totalAmount;
  }
  return ge.totalAmount;
}

export function friendInitial(
  nameOrFriend?: string | { name?: string; avatarNumber?: string },
  avatarNumber?: string
): string {
  if (!nameOrFriend) return '?';
  if (typeof nameOrFriend === 'object') {
    if (nameOrFriend.avatarNumber && nameOrFriend.avatarNumber.trim()) {
      return nameOrFriend.avatarNumber.trim();
    }
    return (nameOrFriend.name || '?').trim().charAt(0).toUpperCase();
  }
  if (avatarNumber && avatarNumber.trim()) {
    return avatarNumber.trim();
  }
  return nameOrFriend.trim().charAt(0).toUpperCase();
}

export function getAvatarStyle(color?: string): React.CSSProperties {
  if (!color) {
    return {
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
      border: '1px solid var(--accent-border-soft)',
    };
  }

  // Hex color (#RRGGBB)
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return {
      background: `${color}28`,
      color: color,
      border: `1px solid ${color}55`,
    };
  }

  // Short hex (#RGB)
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const fullHex = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    return {
      background: `${fullHex}28`,
      color: fullHex,
      border: `1px solid ${fullHex}55`,
    };
  }

  // CSS variables handling
  if (color.includes('--credit')) {
    return {
      background: 'var(--credit-bg, rgba(16, 185, 129, 0.16))',
      color: 'var(--credit, #10b981)',
      border: '1px solid var(--credit-border, rgba(16, 185, 129, 0.35))',
    };
  }

  if (color.includes('--debit')) {
    return {
      background: 'var(--debit-bg, rgba(239, 68, 68, 0.16))',
      color: 'var(--debit, #ef4444)',
      border: '1px solid var(--debit-border, rgba(239, 68, 68, 0.35))',
    };
  }

  if (color.includes('--amber')) {
    return {
      background: 'var(--amber-bg, rgba(245, 158, 11, 0.16))',
      color: 'var(--amber, #f59e0b)',
      border: '1px solid var(--amber-border, rgba(245, 158, 11, 0.35))',
    };
  }

  return {
    background: 'var(--accent-soft)',
    color: color || 'var(--accent)',
    border: '1px solid var(--accent-border-soft)',
  };
}

export function getContactColor(contact?: { type?: ContactType; color?: string } | null, fallback?: string): string {
  if (!contact) return fallback || 'var(--accent)';
  if (contact.type === 'vendor') {
    return (contact.color && contact.color !== '#6366f1') ? contact.color : '#f59e0b';
  }
  if (contact.type === 'subscription') {
    return (contact.color && contact.color !== '#6366f1') ? contact.color : '#8b5cf6';
  }
  return contact.color || fallback || 'var(--accent)';
}

export function getContactStyle(contact?: { type?: ContactType; color?: string } | null, fallback?: string): React.CSSProperties {
  const color = getContactColor(contact, fallback);
  return getAvatarStyle(color);
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

export function getGroupSettlementStatus(ge: GroupedExpense): {
  statusKey: 'settled' | 'partial' | 'unsettled' | 'unpaid' | 'paid' | 'completed' | 'none';
  statusLabel: string;
  isAllSettled: boolean;
  isPartiallySettled: boolean;
} {
  // 1. Settlement Group (Debt repayments / Settle Up records)
  if (ge.isSettlementGroup) {
    return {
      statusKey: 'settled',
      statusLabel: 'Settled ✓',
      isAllSettled: true,
      isPartiallySettled: false,
    };
  }

  const primaryItem = ge.items[0] || { category: ge.category, status: 'paid' as const, settled: false };
  const isTransfer = ge.category === 'Transfer' || primaryItem.category === 'Transfer';
  if (isTransfer) {
    return {
      statusKey: 'none',
      statusLabel: '',
      isAllSettled: true,
      isPartiallySettled: false,
    };
  }

  // 2. Regular Income (No badge for income)
  if (ge.flow === 'in' && !ge.isSettlementGroup) {
    return {
      statusKey: 'none',
      statusLabel: '',
      isAllSettled: true,
      isPartiallySettled: false,
    };
  }

  const realItems = ge.items.filter(i => !i.id?.startsWith('synth_mine_'));
  const friendItems = realItems.filter(i => i.type === 'for_friend' || i.type === 'by_friend');
  const isSplitGroup = Boolean(ge.isSplit || (friendItems.length > 0 && ge.personalShare > 0) || friendItems.length > 1);

  // Check friend settlement
  const totalFriendItems = friendItems.length;
  const settledFriendItems = friendItems.filter(i => i.settled || i.settlementId).length;
  const isFriendAllSettled = totalFriendItems > 0 && settledFriendItems === totalFriendItems;
  const isFriendSomeSettled = settledFriendItems > 0 || friendItems.some(i => i.parentExpenseId || (i.originalAmount && i.settledAmount));

  // Check vendor debt obligation (e.g. debt / unpaid on vendor)
  const itemsWithVendorDebt = realItems.filter(i => i.vendorId && (i.status === 'unpaid' || i.vendorSettled !== undefined));
  const hasVendorDebt = itemsWithVendorDebt.length > 0 || (ge.vendorId && ge.items.some(i => i.status === 'unpaid'));
  const targetVendorItems = itemsWithVendorDebt.length > 0 ? itemsWithVendorDebt : realItems.filter(i => i.vendorId);
  const isVendorAllSettled = hasVendorDebt && targetVendorItems.length > 0 && targetVendorItems.every(i => i.vendorSettled === true || (i.status === 'paid' && i.vendorSettled !== false));

  // 3. Split Expense (Multiple people involved: user + friends, or multiple friends)
  // "only in case of split thing we use tags like partially settled or completely settled"
  if (isSplitGroup) {
    if (hasVendorDebt) {
      if (isFriendAllSettled && isVendorAllSettled) {
        return {
          statusKey: 'settled',
          statusLabel: 'Completely Settled',
          isAllSettled: true,
          isPartiallySettled: false,
        };
      }
      if ((isFriendSomeSettled || isVendorAllSettled) && !(isFriendAllSettled && isVendorAllSettled)) {
        return {
          statusKey: 'partial',
          statusLabel: 'Partially Settled',
          isAllSettled: false,
          isPartiallySettled: true,
        };
      }
      return {
        statusKey: 'unsettled',
        statusLabel: 'Unsettled',
        isAllSettled: false,
        isPartiallySettled: false,
      };
    } else {
      if (isFriendAllSettled) {
        return {
          statusKey: 'settled',
          statusLabel: 'Completely Settled',
          isAllSettled: true,
          isPartiallySettled: false,
        };
      }
      if (isFriendSomeSettled) {
        return {
          statusKey: 'partial',
          statusLabel: 'Partially Settled',
          isAllSettled: false,
          isPartiallySettled: true,
        };
      }
      return {
        statusKey: 'unsettled',
        statusLabel: 'Unsettled',
        isAllSettled: false,
        isPartiallySettled: false,
      };
    }
  }

  // 4. Single Friend Obligation (e.g. Paid 100% for 1 friend 'for_friend' or Someone paid for me 'by_friend')
  if (friendItems.length === 1) {
    const singleItem = friendItems[0];
    const isSettled = Boolean(singleItem.settled || singleItem.settlementId || (hasVendorDebt && isVendorAllSettled));
    if (isSettled) {
      return {
        statusKey: 'settled',
        statusLabel: 'Settled ✓',
        isAllSettled: true,
        isPartiallySettled: false,
      };
    }
    return {
      statusKey: 'unpaid',
      statusLabel: singleItem.type === 'by_friend' ? 'Unpaid' : 'Unsettled',
      isAllSettled: false,
      isPartiallySettled: false,
    };
  }

  // 5. Pure Vendor Debt without friends (Unpaid bill / Debt to vendor)
  // "when i paid owe, after settling it should be settled"
  if (hasVendorDebt) {
    if (isVendorAllSettled) {
      return {
        statusKey: 'settled',
        statusLabel: 'Settled ✓',
        isAllSettled: true,
        isPartiallySettled: false,
      };
    }
    return {
      statusKey: 'unpaid',
      statusLabel: 'Unpaid',
      isAllSettled: false,
      isPartiallySettled: false,
    };
  }

  // 6. Direct Personal Payment or Settled Personal Expense
  const isAnySettled = realItems.some(i => i.settled || i.settlementId || i.vendorSettled);
  if (isAnySettled) {
    return {
      statusKey: 'settled',
      statusLabel: 'Settled ✓',
      isAllSettled: true,
      isPartiallySettled: false,
    };
  }

  const isDirectPaid = primaryItem.status === 'paid' || (!primaryItem.status && !primaryItem.settled && !primaryItem.vendorSettled);
  if (isDirectPaid) {
    return {
      statusKey: 'paid',
      statusLabel: 'Paid',
      isAllSettled: true,
      isPartiallySettled: false,
    };
  }

  const isExplicitSettled = Boolean(primaryItem.settled);
  return {
    statusKey: isExplicitSettled ? 'settled' : (primaryItem.status || 'paid'),
    statusLabel: isExplicitSettled ? 'Settled ✓' : (primaryItem.status === 'unpaid' ? 'Unpaid' : 'Paid'),
    isAllSettled: isExplicitSettled || primaryItem.status !== 'unpaid',
    isPartiallySettled: false,
  };
}

export function resolveCategoryMeta(
  categoryName: string,
  categoryObj?: Category | null,
  isSettlementGroup?: boolean,
  categoriesMap?: Map<string, Category>
): { name: string; color: string; icon: string; bg: string; border: string } {
  const normCat = (categoryName || '').trim().toLowerCase();

  if (isSettlementGroup || normCat === 'settlement') {
    return {
      name: 'Settlement',
      color: '#10B981',
      icon: 'refund',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
    };
  }

  if (normCat === 'transfer') {
    return {
      name: 'Transfer',
      color: '#6366F1',
      icon: 'transfer',
      bg: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.25)',
    };
  }

  if (normCat === 'income' || normCat === 'salary' || normCat === 'deposit') {
    return {
      name: categoryName || 'Income',
      color: '#10B981',
      icon: 'income',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
    };
  }

  if (normCat === 'groceries' || normCat === 'grocery' || normCat === 'supermarket' || normCat === 'zepto' || normCat === 'zeptoo' || normCat === 'blinkit' || normCat === 'instamart') {
    return {
      name: categoryName || 'Groceries',
      color: '#10B981',
      icon: 'groceries',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
    };
  }

  let cat = categoryObj;
  if (!cat && categoriesMap && categoryName) {
    cat = Array.from(categoriesMap.values()).find(c => c.name.trim().toLowerCase() === normCat);
  }

  let color = cat?.color;
  let icon = cat?.icon;

  // Keyword inferences if icon is missing or generic
  if (!icon || icon === 'other' || icon === 'tag') {
    if (normCat.includes('grocer') || normCat.includes('zepto') || normCat.includes('blinkit') || normCat.includes('instamart') || normCat.includes('mart')) {
      icon = 'groceries';
      if (!color) color = '#10B981';
    } else if (normCat.includes('food') || normCat.includes('dining') || normCat.includes('swiggy') || normCat.includes('zomato')) {
      icon = 'food';
      if (!color) color = '#F97316';
    } else if (normCat.includes('income') || normCat.includes('salary') || normCat.includes('credit')) {
      icon = 'income';
      if (!color) color = '#10B981';
    } else if (normCat.includes('shopping') || normCat.includes('amazon') || normCat.includes('flipkart')) {
      icon = 'shopping';
      if (!color) color = '#EC4899';
    } else if (normCat.includes('transfer')) {
      icon = 'transfer';
      if (!color) color = '#6366F1';
    }
  }

  // Upgrade legacy reddish-pink #F97362 food color to warm appetizing food orange #F97316
  if (color === '#F97362' || (!color && normCat === 'food')) {
    color = '#F97316';
    icon = icon || 'food';
  }

  if (!color) {
    color = '#64748B';
  }

  const hex = color.startsWith('#') && color.length === 7 ? color : '#64748B';
  return {
    name: cat?.name || categoryName || 'Other',
    color,
    icon: icon || 'other',
    bg: `${hex}18`,
    border: `${hex}30`,
  };
}

/**
 * Normalizes settlement descriptions so that "Settlement: Paid to <Name>" or "Settlement: Received"
 * returns clean title "Settlement", preserving notes if attached (e.g. "Settlement (Note)").
 */
export function cleanSettlementDescription(desc: string): string {
  if (!desc) return desc;

  const cleaned = desc
    .replace(/\s*\(\s*Forgiven\s*\/\s*Waived\s*off\s*\)/gi, '')
    .replace(/\s*\(\s*Forgiven\s*\)/gi, '')
    .replace(/\s*\(\s*Waived\s*off\s*\)/gi, '')
    .replace(/\s*\(\s*Waived\s*\)/gi, '')
    .replace(/\s*\(\s*Forgotten\s*\)/gi, '')
    .trim();

  // If it starts with "Settlement"
  if (/^Settlement/i.test(cleaned)) {
    // If exact "Settlement: Paid" or "Settlement: Received"
    if (/^Settlement:\s*(Paid|Received)$/i.test(cleaned)) {
      return 'Settlement';
    }

    // Extract the portion after "Settlement:" or "Settlement"
    let after = cleaned.replace(/^Settlement:?\s*/i, '').trim();

    // Remove "Paid to <name>", "Received from <name>", "Paid", "Received"
    after = after
      .replace(/^(Paid\s+to|Received\s+from|Paid|Received)\s*/i, '')
      .trim();

    if (after) {
      // Check for note in parentheses e.g. "(Dinner)" or "Shriyansh (Dinner)"
      const parenMatch = after.match(/\((.*?)\)/);
      if (parenMatch) {
        const note = parenMatch[1].trim();
        return note ? `Settlement (${note})` : 'Settlement';
      }
      // If after is purely a name or redundant string, return 'Settlement'
      return 'Settlement';
    }
    return 'Settlement';
  }

  return cleaned;
}
