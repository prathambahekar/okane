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
  friendIds?: string[];
  friendNames?: string[];
  vendorId?: string | null;
  vendorName?: string | null;
  walletId?: string;
  prompt: string;
}

export function sanitizeDescription(raw: string, friends: Array<{ id: string; name: string }>): string {
  let cleaned = (raw || '').trim();
  if (!cleaned) return '';

  // Remove (Remaining), [Remaining], (Friend share), (Personal share), (My share), (Split)
  cleaned = cleaned.replace(/\s*[([](?:remaining|friend share|personal share|my share|split|equal split)[)\]]/gi, '');

  // Strip explicit friend name patterns embedded in description
  if (Array.isArray(friends)) {
    friends.forEach(f => {
      if (!f.name || !f.name.trim()) return;
      const escapedName = f.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Patterns: (with Hrishi), (by Hrishi), (for Hrishi), (me + Hrishi), (Hrishi)
      cleaned = cleaned.replace(new RegExp(`\\s*\\([\\s]*(?:with|by|for|and|\\+|me\\s*\\+|\\+\\s*me)?\\s*${escapedName}[^)]*\\)`, 'gi'), '');
      cleaned = cleaned.replace(new RegExp(`\\s*\\[[\\s]*(?:with|by|for|and|\\+|me\\s*\\+|\\+\\s*me)?\\s*${escapedName}[^\\]]*\\]`, 'gi'), '');
      cleaned = cleaned.replace(new RegExp(`\\s+(?:with|by|for)\\s+${escapedName}\\b`, 'gi'), '');
      cleaned = cleaned.replace(new RegExp(`\\s*[-:]\\s*${escapedName}\\b`, 'gi'), '');
      cleaned = cleaned.replace(new RegExp(`\\(${escapedName}\\)`, 'gi'), '');
    });
  }

  // Remove generic (with ...), (by ...), (for ...)
  cleaned = cleaned.replace(/\s*\(\s*(?:with|by|for)\s+[^)]+\)/gi, '');

  // Remove trailing dangling punctuation like () [] - : ,
  cleaned = cleaned.replace(/[\s\-:(),[\]]+$/, '').trim();

  return cleaned || raw.trim();
}

export function getFrequentTasks(db: AppDB): FrequentTaskItem[] {
  const currency = db.settings?.currency || 'INR';
  const currSym = currencySymbol(currency);
  const defaultWalletId = db.settings?.defaultWalletId || db.wallets[0]?.id || '';
  const friends = db.friends || [];

  // Determine reference date (latest expense date in DB or today)
  const now = new Date();
  const maxDateStr = (db.expenses || []).reduce((max, e) => (e.date && e.date > max ? e.date : max), '');
  let refTime = now.getTime();
  if (maxDateStr) {
    const parsedMax = new Date(maxDateStr).getTime();
    if (!isNaN(parsedMax)) {
      // If dataset's latest date is significantly shifted from system clock, anchor to dataset's latest date
      if (Math.abs(now.getTime() - parsedMax) > 14 * 86400 * 1000) {
        refTime = parsedMax;
      } else {
        refTime = Math.max(now.getTime(), parsedMax);
      }
    }
  }

  const cutoff7 = new Date(refTime - 7 * 86400 * 1000).toISOString().slice(0, 10);
  const cutoff14 = new Date(refTime - 14 * 86400 * 1000).toISOString().slice(0, 10);
  const cutoff30 = new Date(refTime - 30 * 86400 * 1000).toISOString().slice(0, 10);

  // 1. Filter expenses strictly from the past 7 days first
  const candidates7 = (db.expenses || []).filter(e => {
    if (!e.date) return false;
    const d = (e.description || '').trim().toLowerCase();
    if (!d || d.length < 2) return false;
    if (d.startsWith('settling') || d.startsWith('repaid') || d.startsWith('debt repayment')) return false;
    return e.date >= cutoff7;
  });

  let candidates = candidates7;

  // ONLY expand window if there are absolutely NO transactions in the past 7 days
  if (candidates.length === 0) {
    candidates = (db.expenses || []).filter(e => {
      if (!e.date) return false;
      const d = (e.description || '').trim().toLowerCase();
      if (!d || d.length < 2) return false;
      if (d.startsWith('settling') || d.startsWith('repaid') || d.startsWith('debt repayment')) return false;
      return e.date >= cutoff14;
    });
  }

  if (candidates.length === 0) {
    candidates = (db.expenses || []).filter(e => {
      if (!e.date) return false;
      const d = (e.description || '').trim().toLowerCase();
      if (!d || d.length < 2) return false;
      if (d.startsWith('settling') || d.startsWith('repaid') || d.startsWith('debt repayment')) return false;
      return e.date >= cutoff30;
    });
  }

  interface CandidateTransaction {
    rawDesc: string;
    flow: ExpenseFlow;
    type: ExpenseType;
    whoPaid: 'me' | 'other';
    status: ExpenseStatus;
    isDebt: boolean;
    friendId: string | null;
    friendIds: string[];
    vendorId: string | null;
    totalAmount: number;
    date: string;
    category: string;
    walletId: string;
  }

  const transactions: CandidateTransaction[] = [];
  const groupMap: Record<string, typeof db.expenses> = {};
  const standaloneExpenses: typeof db.expenses = [];

  const defaultCategory = db.settings?.defaultCategory || 'Food & Dining';

  candidates.forEach(e => {
    if (e.groupId) {
      if (!groupMap[e.groupId]) {
        const fullGroup = (db.expenses || []).filter(item => item.groupId === e.groupId);
        groupMap[e.groupId] = fullGroup.length > 0 ? fullGroup : [e];
      }
    } else {
      standaloneExpenses.push(e);
    }
  });

  // Process grouped split transactions (combines personal + friend split parts into one transaction event)
  Object.values(groupMap).forEach(grp => {
    const first = grp[0];
    const forFriendItems = grp.filter(e => e.type === 'for_friend' && e.friendId);
    const rawFriendIds = Array.from(new Set(
      grp.map(e => e.friendId).filter((id): id is string => Boolean(id))
    ));

    // Separate contacts by type: vendor vs friend
    let vendorId = grp.find(e => e.vendorId)?.vendorId || null;
    const friendIds: string[] = [];
    rawFriendIds.forEach(id => {
      const contact = friends.find(f => f.id === id);
      if (contact?.type === 'vendor') {
        if (!vendorId) vendorId = contact.id;
      } else {
        friendIds.push(id);
      }
    });

    const friendId = forFriendItems.find(e => friendIds.includes(e.friendId || ''))?.friendId || friendIds[0] || null;
    const totalAmount = Math.round(grp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) * 100) / 100;
    const isDebt = grp.some(e => e.status === 'unpaid');
    const status: ExpenseStatus = isDebt ? 'unpaid' : (first.status || 'paid');
    const whoPaid: 'me' | 'other' = (grp.some(e => e.type === 'by_friend' || (e as { whoPaid?: string }).whoPaid === 'other')) ? 'other' : 'me';
    const type: ExpenseType = (forFriendItems.length > 0 || friendIds.length > 0) ? 'for_friend' : (first.type || 'personal');
    const date = grp.reduce((max, e) => (e.date > max ? e.date : max), first.date || '');

    transactions.push({
      rawDesc: first.description,
      flow: first.flow || 'out',
      type,
      whoPaid,
      status,
      isDebt,
      friendId,
      friendIds,
      vendorId,
      totalAmount,
      date,
      category: first.category || defaultCategory,
      walletId: first.walletId || defaultWalletId,
    });
  });

  // Process standalone expenses
  standaloneExpenses.forEach(e => {
    let whoPaid: 'me' | 'other' = (e.type === 'by_friend' || (e as { whoPaid?: string }).whoPaid === 'other') ? 'other' : 'me';
    const isDebt = e.status === 'unpaid';
    const status: ExpenseStatus = e.status || (isDebt ? 'unpaid' : 'paid');
    let vendorId = e.vendorId || null;
    let friendIds = e.friendId ? [e.friendId] : [];
    let friendId = e.friendId || null;

    // Check if e.friendId is actually a vendor
    if (friendId) {
      const contact = friends.find(f => f.id === friendId);
      if (contact?.type === 'vendor') {
        if (!vendorId) vendorId = contact.id;
        friendIds = [];
        friendId = null;
      }
    }

    // Infer friend from description if friendId was not saved explicitly
    if (friendIds.length === 0 && Array.isArray(friends) && friends.length > 0) {
      const descLower = (e.description || '').toLowerCase();
      const matched = friends.filter(f => {
        if (!f.name || f.type === 'vendor') return false;
        const nameLower = f.name.trim().toLowerCase();
        if (nameLower.length < 2) return false;
        const reg = new RegExp(`(?:with|by|for|\\+|and|\\(|\\b)${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\)|\\b|$)`, 'i');
        return reg.test(descLower);
      });

      if (matched.length > 0) {
        friendIds = matched.map(f => f.id);
        friendId = friendIds[0];
        if (/\b(?:by|paid by)\b/i.test(descLower)) {
          whoPaid = 'other';
        }
      }
    }

    let type: ExpenseType = e.type || 'personal';
    if (whoPaid === 'other') {
      type = 'by_friend';
    } else if (friendIds.length > 0) {
      type = 'for_friend';
    }

    transactions.push({
      rawDesc: e.description,
      flow: e.flow || 'out',
      type,
      whoPaid,
      status,
      isDebt,
      friendId,
      friendIds,
      vendorId,
      totalAmount: Number(e.amount) || 0,
      date: e.date || '',
      category: e.category || defaultCategory,
      walletId: e.walletId || defaultWalletId,
    });
  });

  interface ScenarioStat {
    cleanDesc: string;
    flow: ExpenseFlow;
    type: ExpenseType;
    whoPaid: 'me' | 'other';
    status: ExpenseStatus;
    isDebt: boolean;
    friendId: string | null;
    friendIds: string[];
    vendorId: string | null;
    amounts: number[];
    latestAmount: number;
    latestDate: string;
    category: string;
    walletId: string;
    count: number;
  }

  const statsMap: Record<string, ScenarioStat> = {};

  transactions.forEach(t => {
    const cleaned = sanitizeDescription(t.rawDesc, friends);
    if (!cleaned || cleaned.length < 2) return;

    const normDesc = cleaned.toLowerCase();
    const sortedFriendIds = [...t.friendIds].sort().join(',');
    const groupKey = `${normDesc}|${t.flow}|${t.type}|${t.whoPaid}|${t.isDebt ? 'debt' : 'paid'}|${sortedFriendIds}|${t.vendorId || ''}`;

    if (!statsMap[groupKey]) {
      statsMap[groupKey] = {
        cleanDesc: cleaned,
        flow: t.flow,
        type: t.type,
        whoPaid: t.whoPaid,
        status: t.status,
        isDebt: t.isDebt,
        friendId: t.friendId,
        friendIds: t.friendIds,
        vendorId: t.vendorId,
        amounts: [],
        latestAmount: t.totalAmount || 0,
        latestDate: t.date || '',
        category: t.category || 'Food & Dining',
        walletId: t.walletId || defaultWalletId,
        count: 0,
      };
    }

    const item = statsMap[groupKey];
    item.count += 1;
    if (t.totalAmount > 0) {
      item.amounts.push(t.totalAmount);
    }
    if (!item.latestDate || (t.date && t.date >= item.latestDate)) {
      item.latestDate = t.date || '';
      item.latestAmount = t.totalAmount || item.latestAmount;
    }
    if (t.category) item.category = t.category;
    if (t.walletId) item.walletId = t.walletId;
  });

  // Sort candidates by frequency and recency weighting
  const sortedKeys = Object.keys(statsMap).sort((a, b) => {
    const itemA = statsMap[a];
    const itemB = statsMap[b];

    const timeA = new Date(itemA.latestDate).getTime() || 0;
    const timeB = new Date(itemB.latestDate).getTime() || 0;

    const daysAgoA = Math.max(0, (refTime - timeA) / (86400 * 1000));
    const daysAgoB = Math.max(0, (refTime - timeB) / (86400 * 1000));

    const recencyWeightA = daysAgoA <= 2 ? 4 : (daysAgoA <= 5 ? 2.5 : (daysAgoA <= 7 ? 1.5 : 0.8));
    const recencyWeightB = daysAgoB <= 2 ? 4 : (daysAgoB <= 5 ? 2.5 : (daysAgoB <= 7 ? 1.5 : 0.8));

    const scoreA = itemA.count * 10 * recencyWeightA;
    const scoreB = itemB.count * 10 * recencyWeightB;

    if (Math.abs(scoreB - scoreA) > 0.001) {
      return scoreB - scoreA;
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

    const formattedDesc = stat.cleanDesc.charAt(0).toUpperCase() + stat.cleanDesc.slice(1);

    // Resolve Friend / Vendor objects cleanly
    const friendObjects = stat.friendIds
      .map(id => friends.find(f => f.id === id))
      .filter((f): f is typeof friends[0] => Boolean(f && f.type !== 'vendor'));
    const friendNames = friendObjects.map(f => f.name);
    const friendObj = friendObjects[0] || (stat.friendId ? friends.find(f => f.id === stat.friendId && f.type !== 'vendor') : null);
    const vendorObj = stat.vendorId
      ? friends.find(f => f.id === stat.vendorId)
      : (stat.friendId ? friends.find(f => f.id === stat.friendId && f.type === 'vendor') : null);
    const isVendor = Boolean(vendorObj);
    const friendName = friendObj ? friendObj.name : null;
    const vendorName = vendorObj ? vendorObj.name : null;
    const resolvedVendorId = vendorObj?.id || stat.vendorId || null;
    const resolvedFriendIds = friendObjects.map(f => f.id);
    const resolvedFriendId = friendObj?.id || (resolvedFriendIds[0] || null);

    // Display label is the clean description (badges will show friend chips)
    const label = formattedDesc;

    let splitMode: 'just_me' | 'for_friend' | 'by_friend' | 'pay_debt' = 'just_me';
    if (stat.whoPaid === 'other' || stat.type === 'by_friend') {
      splitMode = 'by_friend';
    } else if (stat.type === 'for_friend' || friendObjects.length > 0) {
      splitMode = 'for_friend';
    }

    // Prepare prompt for AI assistant if clicked
    let prompt = label;
    if (stat.whoPaid === 'other' && friendName && !isVendor) {
      prompt = `${formattedDesc} (paid by ${friendName}) for ${currSym}${exactAmount}`;
    } else if ((stat.type === 'for_friend' || friendObjects.length > 0) && !isVendor) {
      if (friendNames.length > 0) {
        prompt = `${formattedDesc} split with ${friendNames.join(' and ')} for ${currSym}${exactAmount}`;
      } else if (friendName) {
        prompt = `${formattedDesc} split with ${friendName} for ${currSym}${exactAmount}`;
      }
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
      friendId: resolvedFriendId,
      friendName,
      friendIds: resolvedFriendIds,
      friendNames,
      vendorId: resolvedVendorId,
      vendorName,
      walletId: stat.walletId,
      prompt,
    });
  });

  const seenKeys = new Set<string>();
  const uniqueTasks: FrequentTaskItem[] = [];
  tasks.forEach(t => {
    const friendsKey = (t.friendIds || []).sort().join(',');
    const key = `${t.label.toLowerCase()}|${t.amount}|${friendsKey}|${t.vendorId || ''}|${t.whoPaid}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueTasks.push(t);
    }
  });

  return uniqueTasks.slice(0, 4);
}
