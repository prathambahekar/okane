import type { ExpenseType, ExpenseFlow, AppDB, Friend, Wallet } from './types';
import { currencySymbol } from './utils';
import { friendBalance, walletBalance, totalWalletBalance } from './db';

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
  friends: Friend[] | { id: string; name: string; type?: string }[] = [],
  wallets: Wallet[] | { id: string; name: string }[] = [],
  currency: string = 'INR',
  db?: AppDB
): ParseResult {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();
  const sym = currencySymbol(currency);

  // Helper to format currency
  const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString()}`;

  // ==========================================
  // 0. CONVERSATIONAL & GREETING INTENT HANDLING
  // ==========================================
  const expenseVerbsPattern = /\b(spent|spend|paid|pay|bought|buy|received|got|earned|salary|credited|debited|split|borrowed|lent|repaid|gave|sent|cost|charge|bill|fee|tiffin|coffee|chai|tea|lunch|dinner|breakfast|uber|cab|auto|petrol|diesel|groceries|swiggy|zomato|movie|rent|wifi|recharge)\b/i;
  const hasExpenseKeywords = expenseVerbsPattern.test(lower);
  const hasNumbers = /\b\d+\b/.test(lower);

  // If no expense keywords and no numbers, handle greetings, questions & casual talk naturally
  if (!hasExpenseKeywords && !hasNumbers) {
    // Greetings
    if (/^\s*(hi+|hello+|hey+|heyy+|greetings|good morning|good afternoon|good evening|yo+|sup|namaste|hola)\b/i.test(lower)) {
      return {
        reply: `Hey there! 👋 I'm Max, your Okane AI assistant. How can I help you today? You can ask about your balances, spending summaries, or log a transaction!`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Identity & Capabilities
    if (/who are you|what is your name|what can you do|what are your features|who made you|help|help me|how to use|features/i.test(lower)) {
      return {
        reply: `I'm Max, your personal AI financial assistant in Okane! Here's what I can do:\n• **Log transactions**: e.g., *"Spent ₹150 on Lunch"* or *"Got ₹5000 salary"*\n• **Split bills**: e.g., *"Paid 600 for Dinner with Rahul"*\n• **Check balances**: e.g., *"What is my balance?"* or *"Who owes me money?"*\n• **Monthly insights**: e.g., *"How much did I spend this month?"*`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Small talk & Pleasantries
    if (/how are you|how's it going|how is it going|what's up|how do you do/i.test(lower)) {
      return {
        reply: `I'm doing great and ready to assist! How are your finances looking today?`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Gratitude
    if (/\b(thanks|thank you|thx|tysm|cheers|appreciation)\b/i.test(lower)) {
      return {
        reply: `You're very welcome! 😊 Let me know whenever you want to track an expense or check your ledger.`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Praise / Feedback
    if (/\b(good job|awesome|cool|nice|great|perfect|amazing)\b/i.test(lower)) {
      return {
        reply: `Thank you! Happy to help you manage your money effortlessly. 🚀`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Jokes
    if (/\b(tell me a joke|joke|humor|funny)\b/i.test(lower)) {
      return {
        reply: `Why did the dollar bill go to school? Because it wanted to get a little more cents! 😄`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Farewell
    if (/\b(bye|goodbye|see you|later|cya)\b/i.test(lower)) {
      return {
        reply: `Goodbye! Have a great day and happy budgeting! 👋`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // Okane App & Financial FAQ
    if (/\b(save money|tips to save|how to save|budgeting tips)\b/i.test(lower)) {
      return {
        reply: `Here are 3 quick tips to save more with Okane:\n1. **Use Envelope Budgeting** to set strict monthly caps.\n2. **Track small daily expenses** like coffee & snacks—they add up fast!\n3. **Review your monthly summary** regularly to spot unnecessary recurring expenses.`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    if (/\b(envelope|envelopes)\b/i.test(lower)) {
      return {
        reply: `Envelope budgeting lets you allocate funds into virtual envelopes (e.g., Food, Transport, Rent). When an envelope runs out, you know it's time to pause spending in that category!`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    if (/\b(split trip|trips|vacation)\b/i.test(lower)) {
      return {
        reply: `Split Trips lets you group shared expenses during vacations or events with friends. You can track who paid what and calculate settlements easily!`,
        actionType: 'general_query',
        isOffline: true,
      };
    }
  }

  // ==========================================
  // 1. QUERY HANDLING: WALLET / ACCOUNT BALANCES
  // ==========================================
  const isBalanceQuery =
    (lower.includes('balance') || lower.includes('how much money') || lower.includes('how much cash') || lower.includes('my funds') || lower.includes('total funds') || lower.includes('my accounts')) &&
    !lower.includes('spent') && !lower.includes('spend');

  if (isBalanceQuery && db) {
    // Check if asking for a specific wallet
    const matchedWallet = db.wallets.find(w => lower.includes(w.name.toLowerCase()));
    if (matchedWallet) {
      const bal = walletBalance(db, matchedWallet.id);
      return {
        reply: `Your ${matchedWallet.name} balance is ${fmt(bal)}.`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    // General balance across all wallets
    const total = totalWalletBalance(db);
    const walletLines = db.wallets.map(w => {
      const b = walletBalance(db, w.id);
      return `• ${w.name}: ${fmt(b)}`;
    }).join('\n');

    return {
      reply: `Your total net balance is ${fmt(total)} across ${db.wallets.length} accounts:\n${walletLines}`,
      actionType: 'general_query',
      isOffline: true,
    };
  }

  // ==========================================
  // 2. QUERY HANDLING: FRIENDS, DEBTS & WHO OWES ME
  // ==========================================
  const isWhoOwesQuery =
    lower.includes('who owes') || lower.includes('who owe') || lower.includes('owe me') ||
    lower.includes('pending from friends') || lower.includes('debts and credits');

  if (isWhoOwesQuery && db) {
    const debtors = db.friends
      .map(f => ({ friend: f, bal: friendBalance(db, f.id) }))
      .filter(fb => fb.bal.net > 0);

    if (debtors.length === 0) {
      return {
        reply: `Nobody owes you money right now! All your friend accounts are settled.`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    const totalOwed = debtors.reduce((sum, d) => sum + d.bal.net, 0);
    const lines = debtors.map(d => `• ${d.friend.name}: owes you ${fmt(d.bal.net)}`).join('\n');
    return {
      reply: `You have ${fmt(totalOwed)} pending to collect from ${debtors.length} friend${debtors.length > 1 ? 's' : ''}:\n${lines}`,
      actionType: 'general_query',
      isOffline: true,
    };
  }

  const isWhoIOweQuery =
    lower.includes('who do i owe') || lower.includes('who i owe') || lower.includes('i owe') ||
    lower.includes('my debts') || lower.includes('pending to pay');

  if (isWhoIOweQuery && db) {
    const creditors = db.friends
      .map(f => ({ friend: f, bal: friendBalance(db, f.id) }))
      .filter(fb => fb.bal.net < 0);

    if (creditors.length === 0) {
      return {
        reply: `You don't owe anyone money right now. Your ledger is all clear!`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    const totalDebt = creditors.reduce((sum, c) => sum + Math.abs(c.bal.net), 0);
    const lines = creditors.map(c => `• ${c.friend.name}: you owe ${fmt(c.bal.net)}`).join('\n');
    return {
      reply: `You owe a total of ${fmt(totalDebt)} across ${creditors.length} contact${creditors.length > 1 ? 's' : ''}:\n${lines}`,
      actionType: 'general_query',
      isOffline: true,
    };
  }

  // Specific friend/vendor balance or query
  if (db && (lower.includes('how much') || lower.includes('balance') || lower.includes('transactions with') || lower.includes('history') || lower.includes('ledger'))) {
    const targetFriend = db.friends.find(f => lower.includes(f.name.toLowerCase()));
    if (targetFriend) {
      const bal = friendBalance(db, targetFriend.id);
      const friendTxs = db.expenses.filter(e => e.friendId === targetFriend.id || e.vendorId === targetFriend.id);
      const txCount = friendTxs.length;

      let balStr = `You are all settled up with ${targetFriend.name}.`;
      if (bal.net > 0) {
        balStr = `${targetFriend.name} owes you ${fmt(bal.net)}.`;
      } else if (bal.net < 0) {
        balStr = `You owe ${targetFriend.name} ${fmt(bal.net)}.`;
      }

      return {
        reply: `${targetFriend.name} (${targetFriend.type || 'contact'}):\n• Balance: ${balStr}\n• Total linked transactions: ${txCount}`,
        actionType: 'general_query',
        isOffline: true,
      };
    }
  }

  // ==========================================
  // 3. QUERY HANDLING: SPENDING, MONTHLY, ANALYTICS
  // ==========================================
  const isSpendingQuery =
    (lower.includes('how much did i spend') || lower.includes('how much i spent') || lower.includes('monthly spend') ||
     lower.includes('total spend') || lower.includes('spending summary') || lower.includes('spending this month')) &&
    !lower.match(/\b(spent|paid)\s+(\d+)/);

  if (isSpendingQuery && db) {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const thisMonthExpenses = db.expenses.filter(e => e.flow !== 'in' && e.date.startsWith(currentMonthPrefix));
    const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const catSpend: Record<string, number> = {};
    thisMonthExpenses.forEach(e => {
      catSpend[e.category] = (catSpend[e.category] || 0) + e.amount;
    });

    const topCats = Object.entries(catSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amt]) => `• ${cat}: ${fmt(amt)}`)
      .join('\n');

    return {
      reply: `This month you have spent ${fmt(thisMonthTotal)} across ${thisMonthExpenses.length} transactions.\n${topCats ? `Top Categories:\n${topCats}` : ''}`,
      actionType: 'general_query',
      isOffline: true,
    };
  }

  const isRecentTxsQuery =
    lower.includes('recent transaction') || lower.includes('last transaction') || lower.includes('last expense') ||
    lower.includes('recent expense') || lower.includes('show transactions');

  if (isRecentTxsQuery && db) {
    const recent = db.expenses.slice(0, 4);
    if (recent.length === 0) {
      return {
        reply: `You haven't logged any transactions yet. Try saying "Spent ${sym}75 on Tiffin via GPay"!`,
        actionType: 'general_query',
        isOffline: true,
      };
    }

    const lines = recent.map(e => {
      const flowSign = e.flow === 'in' ? '+' : '-';
      return `• ${e.date}: ${e.description} (${flowSign}${fmt(e.amount)}) [${e.category}]`;
    }).join('\n');

    return {
      reply: `Here are your most recent transactions:\n${lines}`,
      actionType: 'general_query',
      isOffline: true,
    };
  }

  // ==========================================
  // 4. TRANSACTION / LOGGING / SPLITTING PARSER
  // ==========================================
  // Flow Determination (Getting Money vs. Spending Money)
  const inKeywords = ['received', 'got', 'salary', 'cashback', 'income', 'earned', 'refund', 'deposit', 'credited', 'paid me', 'sent me', 'gave me'];
  const isIncome = inKeywords.some(k => lower.includes(k));
  const flow: ExpenseFlow = isIncome ? 'in' : 'out';

  // Amount Extraction
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

  // Identify Friends / Contacts & Who Paid
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

  if (matchedFriends.length === 0) {
    const nameMatch = clean.match(/\b(?:for|with|by|from|to|and)\s+([A-Z][a-z]+)\b/);
    if (nameMatch && nameMatch[1] && !['Me', 'My', 'Us', 'The', 'Cash', 'Bank', 'Card', 'Today', 'Yesterday', 'Tiffin', 'Coffee', 'Lunch'].includes(nameMatch[1])) {
      matchedFriends.push(nameMatch[1]);
    }
  }

  if (matchedFriends.length > 0) {
    foundFriendName = matchedFriends[0];
  }

  let whoPaid: 'me' | 'other' = 'me';
  let type: ExpenseType = 'personal';
  let splitMode: 'just_me' | 'equal_split' | 'custom_split' | 'for_friend' | 'pay_debt' | 'by_friend' = 'just_me';
  let myShare: number | null = null;
  let friendShare: number | null = null;

  const friendPaidPattern = foundFriendName
    ? new RegExp(`\\b(${foundFriendName}|friend|someone|he|she)\\s+(paid|bought|spent|gave|sent)\\b|\\bpaid\\s+by\\s+(${foundFriendName}|friend)\\b|\\b(${foundFriendName})\\s+paid\\s+my\\b`, 'i')
    : /\b(alex|arman|friend|someone|he|she)\s+(paid|bought|spent|gave|sent)\b|\bpaid\s+by\s+\w+\b/i;

  const splitPattern = /\b(split|me\s+and|both\s+of\s+us|equal\s+split|half\s+half)\b/i;
  const repayPattern = /\b(repaid|pay\s*back|settled|debt)\b/i;

  if (isIncome && foundFriendName) {
    whoPaid = 'other';
    type = 'by_friend';
    splitMode = 'pay_debt';
  } else if (friendPaidPattern.test(lower)) {
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

  // Category Keyword Matching
  let category = 'Food & Dining';
  const foodKeywords = ['poha', 'tiffin', 'coffee', 'chai', 'tea', 'dinner', 'lunch', 'breakfast', 'food', 'restaurant', 'pizza', 'burger', 'swiggy', 'zomato', 'snack', 'cafe', 'bar', 'drinks'];
  const transportKeywords = ['uber', 'cab', 'auto', 'taxi', 'petrol', 'diesel', 'fuel', 'bus', 'train', 'flight', 'metro', 'parking', 'toll', 'rapido', 'ola'];
  const groceryKeywords = ['grocery', 'groceries', 'supermarket', 'mart', 'milk', 'vegetables', 'fruits', 'zepto', 'blinkit', 'instamart'];
  const entertainmentKeywords = ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'show', 'bookmyshow'];
  const utilityKeywords = ['electricity', 'wifi', 'internet', 'rent', 'recharge', 'mobile', 'water', 'gas', 'bill'];
  const shoppingKeywords = ['shopping', 'clothes', 'shoes', 'amazon', 'flipkart', 'myntra', 'mall'];

  const matchedKnownItem = foodKeywords.some(k => lower.includes(k)) ||
    transportKeywords.some(k => lower.includes(k)) ||
    groceryKeywords.some(k => lower.includes(k)) ||
    entertainmentKeywords.some(k => lower.includes(k)) ||
    utilityKeywords.some(k => lower.includes(k)) ||
    shoppingKeywords.some(k => lower.includes(k));

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

  // Wallet Matching
  let matchedWallet = wallets[0]?.name || 'Cash';
  for (const w of wallets) {
    if (lower.includes(w.name.toLowerCase())) {
      matchedWallet = w.name;
      break;
    }
  }

  // Extract Clean Item Description (1-3 words max)
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
    if (lower.includes('tiffin')) title = 'Tiffin';
    else if (lower.includes('poha')) title = 'Poha';
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

  // If amount was not specified in the query, check if this title has a known exact recurring or past price (e.g. Tiffin = 75)
  if (amount === 0 && db) {
    const lowerTitle = title.toLowerCase();
    const matchingRecurring = db.recurringRules?.find(r => r.title.toLowerCase().includes(lowerTitle));
    if (matchingRecurring && matchingRecurring.amount > 0) {
      amount = matchingRecurring.amount;
    } else {
      const pastExpenses = db.expenses.filter(e => e.description.toLowerCase().includes(lowerTitle) && e.amount > 0);
      if (pastExpenses.length > 0) {
        amount = pastExpenses[0].amount;
      }
    }
  }

  // CHECK FINANCIAL INTENT:
  // Only extract info & build draft if user specified an amount, used transaction verbs, or mentioned a known item/friend action
  const hasTransactionIntent = amount > 0 || hasExpenseKeywords || matchedKnownItem || (foundFriendName != null && (lower.includes('paid') || lower.includes('gave') || lower.includes('split') || lower.includes('for')));

  if (!hasTransactionIntent) {
    return {
      reply: `I didn't catch an expense amount or transaction details in your message. If you'd like to log an expense, try something like: *"Spent ₹150 on Lunch"* or *"Paid ₹500 for Uber with Cash"*!`,
      actionType: 'general_query',
      isOffline: true,
    };
  }

  // Dates
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
    reply: `I've drafted "${title}" for ${amtLabel} under ${category}${friendLabel} using ${matchedWallet}. Review and confirm below!`,
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
      notes: 'Added via Max Assistant',
    },
  };
}
