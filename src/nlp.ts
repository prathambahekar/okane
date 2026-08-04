import type { ExpenseType, ExpenseFlow } from './types';
import { currencySymbol } from './utils';

export interface DraftExpense {
  description: string;
  amount: number;
  category: string;
  type: ExpenseType;
  flow: ExpenseFlow;
  whoPaid?: 'me' | 'other';
  splitMode?: 'just_me' | 'equal_split' | 'custom_split' | 'for_friend' | 'pay_debt' | 'by_friend';
  myShare?: number | null;
  friendShare?: number | null;
  walletName: string;
  friendName?: string | null;
  friendNames?: string[];
  date: string;
  status?: string;
  notes?: string;
}

export interface ParseResult {
  reply: string;
  actionType: 'add_expense' | 'modify_draft' | 'general_query';
  draft?: DraftExpense;
  isOffline: boolean;
}

export function parseLocallyClient(
  prompt: string,
  categories: string[] = [],
  friends: { id: string; name: string; type?: string }[] = [],
  wallets: { id: string; name: string }[] = [],
  currency: string = 'INR'
): ParseResult {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();
  const sym = currencySymbol(currency);

  // 1. Amount Extraction
  let amount = 0;
  const numMatches = [
    ...lower.matchAll(/\b(?:rs\.?|rupees|inr|\$|₹)\s*(\d+(?:\.\d+)?)\b/gi),
    ...lower.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees|inr|\$|₹|\/-)?\b/gi),
  ];

  for (const m of numMatches) {
    const parsed = parseFloat(m[1]);
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
      break;
    }
  }

  // 2. Identify Friends / Contacts mentioned
  let foundFriendName: string | null = null;
  const matchedFriends: string[] = [];

  for (const f of friends) {
    if (f.name && f.name.length > 1) {
      const reg = new RegExp(`\\b${f.name}\\b`, 'i');
      if (reg.test(lower)) {
        matchedFriends.push(f.name);
      }
    }
  }

  // If no known friend matched, check for capitalized name or words after preposition
  if (matchedFriends.length === 0) {
    const nameMatch = clean.match(/\b(?:for|with|by|from|to|and)\s+([A-Z][a-z]+)\b/);
    if (nameMatch && nameMatch[1] && !['Me', 'My', 'Us', 'The', 'Cash', 'Bank', 'Card', 'Today', 'Yesterday'].includes(nameMatch[1])) {
      matchedFriends.push(nameMatch[1]);
    }
  }

  if (matchedFriends.length > 0) {
    foundFriendName = matchedFriends[0];
  }

  // 3. Flow (Income vs Spending)
  const inKeywords = ['received', 'got', 'salary', 'cashback', 'income', 'earned', 'refund', 'deposit', 'credited'];
  const isIncome = inKeywords.some(k => lower.includes(k));
  const flow: ExpenseFlow = isIncome ? 'in' : 'out';

  // 4. Who Paid & Split Mode Determination
  let whoPaid: 'me' | 'other' = 'me';
  let type: ExpenseType = 'personal';
  let splitMode: 'just_me' | 'equal_split' | 'custom_split' | 'for_friend' | 'pay_debt' | 'by_friend' = 'just_me';
  let myShare: number | null = null;
  let friendShare: number | null = null;

  const friendPaidPattern = foundFriendName
    ? new RegExp(`\\b(${foundFriendName}|friend|someone|he|she)\\s+(paid|bought|spent|gave)\\b|\\bpaid\\s+by\\s+(${foundFriendName}|friend)\\b|\\b(${foundFriendName})\\s+paid\\s+my\\b`, 'i')
    : /\b(alex|arman|friend|someone|he|she)\s+(paid|bought|spent|gave)\b|\bpaid\s+by\s+\w+\b/i;

  const splitPattern = /\b(split|me\s+and|both\s+of\s+us|equal\s+split|half\s+half)\b/i;
  const repayPattern = /\b(repaid|pay\s*back|settled|debt)\b/i;

  if (friendPaidPattern.test(lower)) {
    whoPaid = 'other';
    type = 'by_friend';
    splitMode = 'by_friend';
  } else if (repayPattern.test(lower)) {
    type = 'for_friend';
    splitMode = 'pay_debt';
  } else if (splitPattern.test(lower) && foundFriendName) {
    whoPaid = 'me';
    type = 'for_friend';
    splitMode = 'equal_split';
    myShare = amount > 0 ? Math.round((amount / 2) * 100) / 100 : null;
    friendShare = amount > 0 ? Math.round((amount / 2) * 100) / 100 : null;
  } else if (foundFriendName && (lower.includes('for ') || lower.includes('paid for '))) {
    whoPaid = 'me';
    type = 'for_friend';
    splitMode = 'for_friend';
    myShare = 0;
    friendShare = amount;
  } else if (foundFriendName) {
    whoPaid = 'me';
    type = 'for_friend';
    splitMode = 'equal_split';
    myShare = amount > 0 ? Math.round((amount / 2) * 100) / 100 : null;
    friendShare = amount > 0 ? Math.round((amount / 2) * 100) / 100 : null;
  }

  // 5. Category Keyword Matching
  let category = 'Food & Dining';
  const foodKeywords = ['poha', 'coffee', 'chai', 'tea', 'dinner', 'lunch', 'breakfast', 'food', 'restaurant', 'pizza', 'burger', 'swiggy', 'zomato', 'snack', 'cafe', 'bar', 'drinks'];
  const transportKeywords = ['uber', 'cab', 'auto', 'taxi', 'petrol', 'diesel', 'fuel', 'bus', 'train', 'flight', 'metro', 'parking', 'toll', 'rapido', 'ola'];
  const groceryKeywords = ['grocery', 'groceries', 'supermarket', 'mart', 'milk', 'vegetables', 'fruits', 'zepto', 'blinkit', 'instamart'];
  const entertainmentKeywords = ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'show', 'bookmyshow'];
  const utilityKeywords = ['electricity', 'wifi', 'internet', 'rent', 'recharge', 'mobile', 'water', 'gas', 'bill'];
  const shoppingKeywords = ['shopping', 'clothes', 'shoes', 'amazon', 'flipkart', 'myntra', 'mall'];

  if (isIncome) {
    category = 'Income';
  } else if (foodKeywords.some(k => lower.includes(k))) {
    category = categories.find(c => c.toLowerCase().includes('food') || c.toLowerCase().includes('dining')) || 'Food & Dining';
  } else if (transportKeywords.some(k => lower.includes(k))) {
    category = categories.find(c => c.toLowerCase().includes('transport') || c.toLowerCase().includes('travel')) || 'Transport';
  } else if (groceryKeywords.some(k => lower.includes(k))) {
    category = categories.find(c => c.toLowerCase().includes('groc')) || 'Groceries';
  } else if (entertainmentKeywords.some(k => lower.includes(k))) {
    category = categories.find(c => c.toLowerCase().includes('entert')) || 'Entertainment';
  } else if (utilityKeywords.some(k => lower.includes(k))) {
    category = categories.find(c => c.toLowerCase().includes('util') || c.toLowerCase().includes('bill')) || 'Utilities';
  } else if (shoppingKeywords.some(k => lower.includes(k))) {
    category = categories.find(c => c.toLowerCase().includes('shop')) || 'Shopping';
  } else if (categories.length > 0) {
    const matchCat = categories.find(c => lower.includes(c.toLowerCase()));
    if (matchCat) category = matchCat;
    else category = categories[0];
  }

  // 6. Wallet Matching
  let matchedWallet = wallets[0]?.name || 'Cash';
  for (const w of wallets) {
    if (lower.includes(w.name.toLowerCase())) {
      matchedWallet = w.name;
      break;
    }
  }

  // 7. Extract Clean Item Description (1-3 words max)
  let title = clean;
  if (foundFriendName) {
    title = title.replace(new RegExp(foundFriendName, 'gi'), '');
  }
  title = title.replace(/\b(yesterday|today|tomorrow)\b/gi, '')
               .replace(/i\s+(paid|bought|spent|gave|got|received|split)\s+(for\s+)?/gi, '')
               .replace(/\b(paid|bought|spent|gave|got|received|my|friend|me|and|both|us|rs|rupees|inr|\$|\/-)\b/gi, '')
               .replace(/\b(\d+(?:\.\d+)?)\b/g, '')
               .replace(/\b(for|on|via|from|by|with|using|in)\b/gi, ' ')
               .replace(/\s+/g, ' ')
               .trim();

  if (!title || title.length < 2) {
    if (lower.includes('poha')) title = 'Poha';
    else if (lower.includes('coffee')) title = 'Coffee';
    else if (lower.includes('chai') || lower.includes('tea')) title = 'Tea';
    else if (lower.includes('dinner')) title = 'Dinner';
    else if (lower.includes('lunch')) title = 'Lunch';
    else if (lower.includes('movie')) title = 'Movie Ticket';
    else if (lower.includes('uber') || lower.includes('cab')) title = 'Uber Ride';
    else title = category !== 'Other' ? category : 'Expense';
  } else {
    const words = title.split(' ').filter(w => w.length > 1);
    title = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // 8. Dates
  const todayStr = new Date().toISOString().split('T')[0];
  let dateStr = todayStr;
  if (lower.includes('yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    dateStr = d.toISOString().split('T')[0];
  } else if (lower.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    dateStr = d.toISOString().split('T')[0];
  }

  const friendLabel = foundFriendName ? ` with ${foundFriendName}` : '';
  const amtLabel = amount > 0 ? `${sym}${amount}` : 'amount';

  return {
    reply: `⚡ Offline AI: Captured "${title}" for ${amtLabel} under ${category}${friendLabel}. Review draft below!`,
    actionType: 'add_expense',
    isOffline: true,
    draft: {
      description: title,
      amount: amount,
      category: category,
      type: type,
      flow: flow,
      whoPaid: whoPaid,
      splitMode: splitMode,
      myShare: myShare,
      friendShare: friendShare,
      date: dateStr,
      walletName: matchedWallet,
      friendName: foundFriendName,
      friendNames: matchedFriends.length > 0 ? matchedFriends : (foundFriendName ? [foundFriendName] : []),
      status: type === 'personal' ? 'paid' : 'unsettled',
      notes: 'Added via Offline AI Assistant',
    },
  };
}
