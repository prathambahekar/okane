import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, RotateCcw, TrendingDown, TrendingUp, User, Users, HeartHandshake, Sparkles, Feather, Plus, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import type { Expense, ExpenseType, ExpenseFlow, ExpenseStatus } from '../types';
import { todayISO, uid, friendBalance, unsettledExpensesForFriend } from '../db';
import { currencySymbol, fmtMoney } from '../utils';
import { detectCategoryFromText } from '../utils/categoryDetector';
import { showSoftKeyboard } from '../utils/keyboard';
import {
  ExpenseTutorialBanner,
  FriendSplitModal,
  DebtSettlementWidget,
  VendorQuickAdd,
} from './expense';
import { NoteEditorModal } from './common/NoteEditorModal';
import { NotePreviewCard } from './common/NotePreviewCard';
import { getFrequentTasks } from '../utils/frequentTasks';

export interface ExpenseInitialData {
  description?: string;
  amount?: number | string;
  category?: string;
  type?: ExpenseType;
  flow?: ExpenseFlow;
  whoPaid?: 'me' | 'other';
  splitMode?: 'just_me' | 'for_friend' | 'pay_debt';
  walletId?: string;
  friendId?: string;
  friendIds?: string[];
  vendorId?: string;
  date?: string;
  status?: ExpenseStatus;
  notes?: string;
}

interface Props {
  expense?: Expense | null;
  initialData?: ExpenseInitialData;
  isTutorialMode?: boolean;
  onClose: () => void;
  zIndex?: number;
}

export default function ExpenseModal({ expense, initialData, isTutorialMode, onClose, zIndex }: Props) {
  const { db, addExpense, updateExpense, deleteExpense, addFriend, showToast } = useStore();
  const s = db.settings;

  // Tutorial state
  const [tutorialStep, setTutorialStep] = useState<number>(1);

  const fillTutorialSampleData = () => {
    setDesc('Dinner with Friends');
    setAmount('1200');
    setCategory('Food & Dining');
    setWhoPaid('me');
    setSplitMode('for_friend');
    if (db.friends.length > 0) {
      setFriendId(db.friends[0].id);
      setSelectedFriendIds([db.friends[0].id]);
      setFriendShare('600');
    }
    showToast('✨ Sample expense data filled!');
  };

  const grpItems = expense?.groupId
    ? db.expenses.filter(e => e.groupId === expense.groupId)
    : (expense ? [expense] : []);

  const isGrp = grpItems.length > 1;
  const forFriendItems = grpItems.filter(e => e.type === 'for_friend');
  const personalItem = grpItems.find(e => e.type === 'personal');
  const forFriendItem = forFriendItems[0];

  const initialTotalAmount = initialData?.amount !== undefined && initialData?.amount !== ''
    ? String(initialData.amount)
    : (isGrp
      ? String(grpItems.reduce((sum, e) => sum + Number(e.amount), 0))
      : (expense ? String(expense.amount) : ''));

  const initialFriendShare = forFriendItem
    ? String(forFriendItem.amount)
    : (expense ? String(expense.amount) : '');

  const initialDesc = initialData?.description ?? (expense
    ? expense.description.replace(/\s*\(Friend share\)$/i, '').trim()
    : '');

  const initialWhoPaid = initialData?.whoPaid ?? (expense?.type === 'by_friend' && expense?.flow === 'out' ? 'other' : 'me');
  const initialSplitMode = (initialData?.splitMode === 'pay_debt' ? 'just_me' : initialData?.splitMode) ?? ((isGrp || (expense?.type === 'for_friend' && initialWhoPaid !== 'other'))
    ? 'for_friend'
    : 'just_me');
  const initialFriendId = initialData?.friendId ?? forFriendItem?.friendId ?? expense?.friendId ?? '';

  const initialIncomeMode = (initialData?.flow === 'in' || expense?.flow === 'in')
    ? (initialData?.friendId || expense?.type === 'by_friend' || expense?.friendId ? 'friend' : 'direct')
    : 'direct';

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [incomeMode, setIncomeMode] = useState<'direct' | 'friend'>(initialIncomeMode);
  const [desc, setDesc] = useState(initialDesc);
  const [amount, setAmount] = useState(initialTotalAmount);
  const [friendShare, setFriendShare] = useState(initialFriendShare);
  const [category, setCategory] = useState(initialData?.category ?? expense?.category ?? s.defaultCategory);
  const [isCategoryManuallySelected, setIsCategoryManuallySelected] = useState(Boolean(initialData?.category || expense?.category));
  const [autoDetectedCategory, setAutoDetectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(initialData?.date ?? expense?.date ?? todayISO());
  const [whoPaid, setWhoPaid] = useState<'me' | 'other'>(initialWhoPaid);
  const [splitMode, setSplitMode] = useState<'just_me' | 'for_friend' | 'pay_debt'>(initialSplitMode);
  const [flow, setFlow] = useState<ExpenseFlow>(initialData?.flow ?? expense?.flow ?? 'out');
  const [friendId, setFriendId] = useState(initialFriendId);
  const [vendorId, setVendorId] = useState<string>(initialData?.vendorId ?? expense?.vendorId ?? grpItems.find(e => e.vendorId)?.vendorId ?? '');
  const [walletId, setWalletId] = useState(initialData?.walletId ?? expense?.walletId ?? s.defaultWalletId);
  const initialStatus = initialData?.status ?? expense?.status ?? (grpItems.find(e => e.status === 'unpaid')?.status) ?? s.defaultStatus;
  const [status, setStatus] = useState<ExpenseStatus>(initialStatus);

  const vendorsList = useMemo(() => db.friends.filter(f => f.type === 'vendor'), [db.friends]);
  const [notes, setNotes] = useState(initialData?.notes ?? expense?.notes ?? '');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [autoSettle, setAutoSettle] = useState(true);
  const descInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus description input on modal mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (descInputRef.current) {
        showSoftKeyboard(descInputRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  // Multi-friend selection state for splitting expenses
  const initialFriendIdsList = (() => {
    if (initialData?.friendIds && initialData.friendIds.length > 0) return initialData.friendIds;
    if (initialData?.friendId) return [initialData.friendId];
    if (expense?.groupId) {
      const items = db.expenses.filter(e => e.groupId === expense.groupId && e.type === 'for_friend');
      if (items.length > 0) return items.map(e => e.friendId).filter(Boolean) as string[];
    }
    const fId = forFriendItem?.friendId ?? expense?.friendId;
    return fId ? [fId] : [];
  })();

  const initialCustomSharesMap = (() => {
    const init: Record<string, string> = {};
    if (expense?.groupId) {
      const items = db.expenses.filter(e => e.groupId === expense.groupId && e.type === 'for_friend');
      items.forEach(e => {
        if (e.friendId) init[e.friendId] = String(e.amount);
      });
    } else if (forFriendItem?.friendId) {
      init[forFriendItem.friendId] = String(forFriendItem.amount);
    } else if (expense?.friendId && expense.type === 'for_friend') {
      init[expense.friendId] = String(expense.amount);
    }
    return init;
  })();

  // Infer previous split rule so that editing an expense preserves its exact mode (Equal, Friends Only, or Custom)
  const { inferredSplitCalcMode, inferredIncludeYou } = (() => {
    // For any new expense (even with initialData), always default to Equal split with You included
    if (!expense) {
      return { inferredSplitCalcMode: 'equal_all' as const, inferredIncludeYou: true };
    }

    const n = initialFriendIdsList.length;
    if (n === 0) {
      return { inferredSplitCalcMode: 'equal_all' as const, inferredIncludeYou: true };
    }

    const tot = parseFloat(initialTotalAmount) || 0;
    const personalAmt = personalItem ? (Number(personalItem.amount) || 0) : 0;
    const hasPersonalShare = personalAmt > 0.001;

    // If there is NO personal share (my share = 0, e.g. 100% Friend or Friends Only)
    if (!hasPersonalShare) {
      const expectedFriendShare = tot / n;
      const allEqual = forFriendItems.length > 0 && forFriendItems.every(e => {
        const amt = Number(e.amount) || 0;
        return Math.abs(amt - expectedFriendShare) < 0.05;
      });
      if (allEqual) {
        return { inferredSplitCalcMode: 'equal_friends' as const, inferredIncludeYou: false };
      }
      return { inferredSplitCalcMode: 'custom' as const, inferredIncludeYou: false };
    }

    // If there IS a personal share (Me + Friends)
    const expectedEqualShare = tot / (n + 1);
    const personalMatches = Math.abs(personalAmt - expectedEqualShare) < 0.05;
    const allFriendsMatch = forFriendItems.length > 0 && forFriendItems.every(e => {
      const amt = Number(e.amount) || 0;
      return Math.abs(amt - expectedEqualShare) < 0.05;
    });

    if (personalMatches && allFriendsMatch) {
      return { inferredSplitCalcMode: 'equal_all' as const, inferredIncludeYou: true };
    }

    return { inferredSplitCalcMode: 'custom' as const, inferredIncludeYou: true };
  })();

  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(initialFriendIdsList);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [splitCalcMode, setSplitCalcMode] = useState<'equal_all' | 'equal_friends' | 'custom'>(inferredSplitCalcMode);
  const [includeYouInCustom, setIncludeYouInCustom] = useState<boolean>(inferredIncludeYou);
  const [customFriendShares, setCustomFriendShares] = useState<Record<string, string>>(initialCustomSharesMap);

  const isYouSelected = splitCalcMode === 'equal_all' || (splitCalcMode === 'custom' && includeYouInCustom);

  const getFriendShare = useCallback((fId: string): number => {
    const tot = Math.round((parseFloat(amount) || 0) * 100) / 100;
    const n = selectedFriendIds.length;
    if (n === 0 || tot <= 0) return 0;

    const idx = selectedFriendIds.indexOf(fId);
    if (idx === -1) return 0;

    if (splitCalcMode === 'equal_all') {
      // Split total amount among (n + 1) people (Me + n friends)
      const baseCents = Math.floor(Math.round(tot * 100) / (n + 1));
      return baseCents / 100;
    }

    if (splitCalcMode === 'equal_friends') {
      // Split 100% of total amount among n friends (My share = 0)
      const totalCents = Math.round(tot * 100);
      const baseCents = Math.floor(totalCents / n);
      const remainderCents = totalCents - (baseCents * n);
      const friendCents = baseCents + (idx < remainderCents ? 1 : 0);
      return friendCents / 100;
    }

    // Custom mode
    if (customFriendShares[fId] !== undefined) {
      const customVal = parseFloat(customFriendShares[fId]);
      return isNaN(customVal) ? 0 : Math.round(customVal * 100) / 100;
    }

    const denom = (includeYouInCustom ? n + 1 : n) || 1;
    const baseCents = Math.floor(Math.round(tot * 100) / denom);
    return baseCents / 100;
  }, [amount, selectedFriendIds, splitCalcMode, customFriendShares, includeYouInCustom]);

  const handleSelectSplitCalcMode = (mode: 'equal_all' | 'equal_friends' | 'custom', includeYouOverride?: boolean) => {
    const targetMode = mode;
    let nextIncludeYou = includeYouOverride !== undefined ? includeYouOverride : includeYouInCustom;

    if (targetMode === 'equal_all') {
      nextIncludeYou = true;
    } else if (targetMode === 'equal_friends') {
      nextIncludeYou = false;
    }

    setIncludeYouInCustom(nextIncludeYou);
    setSplitCalcMode(targetMode);

    if (targetMode === 'custom') {
      const n = selectedFriendIds.length;
      const tot = Math.round((parseFloat(amount) || 0) * 100) / 100;
      const denom = (nextIncludeYou ? n + 1 : n) || 1;
      const equalVal = tot > 0 && denom > 0 ? String(Math.floor((tot * 100) / denom) / 100) : '0';
      setCustomFriendShares(prev => {
        const initialCustom: Record<string, string> = { ...prev };
        selectedFriendIds.forEach(fId => {
          if (!initialCustom[fId] || isNaN(parseFloat(initialCustom[fId])) || parseFloat(initialCustom[fId]) <= 0) {
            initialCustom[fId] = equalVal;
          }
        });
        return initialCustom;
      });
    }
  };

  const totalFriendsShare = useMemo(() => {
    const tot = Math.round((parseFloat(amount) || 0) * 100) / 100;
    const n = selectedFriendIds.length;
    if (n === 0 || tot <= 0) return 0;

    const sum = selectedFriendIds.reduce((acc, fId) => {
      return acc + getFriendShare(fId);
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [selectedFriendIds, amount, getFriendShare]);

  const selectedFriend = db.friends.find(f => f.id === friendId);
  const friendBal = friendId ? friendBalance(db, friendId) : { owedToMe: 0, owedByMe: 0, net: 0 };

  const unsettledList = useMemo(() => {
    if (!friendId) return [];
    const rawList = unsettledExpensesForFriend(db, friendId);
    if (flow === 'in') {
      return rawList.filter(e => e.type === 'for_friend');
    } else if (splitMode === 'pay_debt') {
      return rawList.filter(e => e.type === 'by_friend');
    }
    return rawList;
  }, [db, friendId, flow, splitMode]);

  const frequentDescriptions = useMemo(() => {
    const raw = getFrequentTasks(db);
    const list: string[] = [];
    for (const t of raw) {
      const text = t.description?.trim();
      if (text && !list.some(item => item.toLowerCase() === text.toLowerCase())) {
        list.push(text);
      }
    }
    return list.slice(0, 5);
  }, [db]);

  const toggleSelectExpense = (expId: string) => {
    const isSelected = selectedExpenseIds.includes(expId);
    const next = isSelected
      ? selectedExpenseIds.filter(id => id !== expId)
      : [...selectedExpenseIds, expId];

    setSelectedExpenseIds(next);

    if (next.length > 0) {
      const sum = Math.round(next.reduce((acc, id) => {
        const item = unsettledList.find(e => e.id === id);
        return acc + (item ? Number(item.amount) || 0 : 0);
      }, 0) * 100) / 100;
      setAmount(String(sum));

      if (next.length === 1) {
        const item = unsettledList.find(e => e.id === next[0]);
        if (item) setDesc(flow === 'in' ? `Repayment for ${item.description}` : `Repaid for ${item.description}`);
      } else {
        setDesc(flow === 'in'
          ? `Settling ${next.length} debts from ${selectedFriend?.name || 'friend'}`
          : `Paying ${next.length} debts to ${selectedFriend?.name || 'friend'}`);
      }
    } else {
      setAmount('');
      if (selectedFriend) {
        setDesc(flow === 'in' ? `Debt repayment from ${selectedFriend.name}` : `Debt repayment to ${selectedFriend.name}`);
      }
    }
  };

  const handleSettleAllDebts = () => {
    const allIds = unsettledList.map(e => e.id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedExpenseIds.includes(id));
    if (isAllSelected) {
      setSelectedExpenseIds([]);
      setAmount('');
      if (selectedFriend) {
        setDesc(flow === 'in' ? `Debt repayment from ${selectedFriend.name}` : `Debt repayment to ${selectedFriend.name}`);
      }
    } else {
      setSelectedExpenseIds(allIds);
      const totalSum = Math.round(unsettledList.reduce((acc, e) => acc + (Number(e.amount) || 0), 0) * 100) / 100;
      setAmount(String(totalSum));
      if (selectedFriend) {
        setDesc(flow === 'in' ? `Full debt settlement from ${selectedFriend.name}` : `Full debt settlement to ${selectedFriend.name}`);
      }
    }
  };

  const handleDescriptionChange = (newDesc: string) => {
    setDesc(newDesc);

    // If on out flow and user hasn't manually locked a category selection
    if (flow === 'out' && !isCategoryManuallySelected) {
      const detected = detectCategoryFromText(newDesc, s.categories, db.expenses);
      if (detected) {
        setCategory(detected);
        setAutoDetectedCategory(detected);
      } else {
        setAutoDetectedCategory(null);
      }
    }
  };

  const handleClearForm = () => {
    setDesc('');
    setAmount('');
    setFriendShare('');
    setCategory(s.defaultCategory);
    setIsCategoryManuallySelected(false);
    setAutoDetectedCategory(null);
    setDate(todayISO());
    setWhoPaid('me');
    setSplitMode('just_me');
    setFlow('out');
    setIncomeMode('direct');
    setFriendId('');
    setSelectedFriendIds([]);
    setSplitCalcMode('equal_all');
    setIncludeYouInCustom(true);
    setCustomFriendShares({});
    setVendorId('');
    setWalletId(s.defaultWalletId);
    setStatus(s.defaultStatus);
    setNotes('');
    setError('');
    setSelectedExpenseIds([]);
    showToast('Form cleared');
    if (descInputRef.current) {
      descInputRef.current.focus();
    }
  };

  const calculatedType: ExpenseType = flow === 'in'
    ? (incomeMode === 'friend' ? 'for_friend' : 'personal')
    : whoPaid === 'other' || splitMode === 'pay_debt'
    ? 'by_friend'
    : splitMode === 'for_friend'
    ? 'for_friend'
    : 'personal';

  const calculatedStatus: ExpenseStatus = calculatedType === 'personal' ? status : 'unsettled';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalDesc = desc.trim();
    if (flow === 'in' && incomeMode === 'friend' && !finalDesc) {
      const selectedF = db.friends.find(f => f.id === friendId);
      finalDesc = selectedF ? `Debt repayment from ${selectedF.name}` : 'Debt Repayment';
    } else if (flow === 'out' && splitMode === 'pay_debt' && !finalDesc) {
      const selectedF = db.friends.find(f => f.id === friendId);
      finalDesc = selectedF ? `Debt repayment to ${selectedF.name}` : 'Debt Repayment';
    }

    if (!finalDesc && flow === 'out') { setError('Description is required.'); return; }
    if (!finalDesc && flow === 'in') { setError('Income source or description is required.'); return; }

    const totalAmt = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (!amount || isNaN(totalAmt) || totalAmt <= 0) { setError('Enter a valid amount.'); return; }

    if (flow === 'in') {
      if (incomeMode === 'friend' && !friendId) {
        setError('Please select the friend who paid you back.');
        return;
      }
      setError('');

      const targetType: ExpenseType = incomeMode === 'friend' ? 'for_friend' : 'personal';
      const isAutoSettling = autoSettle && selectedExpenseIds.length > 0;

      const data: Partial<Expense> = {
        description: finalDesc,
        amount: totalAmt,
        category: 'Income',
        date,
        type: targetType,
        flow: 'in',
        friendId: targetType === 'personal' ? null : (friendId || null),
        vendorId: vendorId || null,
        walletId,
        status: 'paid',
        settled: isAutoSettling,
        notes,
        groupId: null,
      };

      // Only perform cascading coverRemaining splits on new repayments to prevent duplicate splits on edit
      if (!expense && autoSettle && selectedExpenseIds.length > 0) {
        let coverRemaining = totalAmt;
        selectedExpenseIds.forEach(id => {
          const item = db.expenses.find(ex => ex.id === id);
          if (!item) return;
          const amt = Number(item.amount) || 0;
          if (coverRemaining >= amt) {
            coverRemaining -= amt;
            updateExpense(id, { settled: true, date: date || item.date });
          } else if (coverRemaining > 0) {
            const covered = Math.round(coverRemaining * 100) / 100;
            const rem = Math.round((amt - covered) * 100) / 100;
            coverRemaining = 0;
            updateExpense(id, { amount: covered, settled: true, date: date || item.date });
            addExpense({
              ...item,
              amount: rem,
              description: item.description.includes('Remaining') ? item.description : `${item.description} (Remaining)`,
              settled: false,
              settlementId: null,
            });
          }
        });
      }

      if (expense) {
        if (expense.groupId) {
          const existing = db.expenses.filter(ex => ex.groupId === expense.groupId);
          existing.forEach(ex => deleteExpense(ex.id));
          addExpense(data);
        } else {
          updateExpense(expense.id, data);
        }
        showToast('Income updated');
      } else {
        addExpense(data);
        showToast('Income recorded');
      }
      onClose();
      return;
    }

    // Outflow handling
    if (whoPaid === 'me' && splitMode === 'pay_debt') {
      if (!friendId) {
        setError('Please select the friend you are paying back.');
        return;
      }
      setError('');

      if (!expense && autoSettle && selectedExpenseIds.length > 0) {
        let coverRemaining = totalAmt;
        selectedExpenseIds.forEach(id => {
          const item = db.expenses.find(ex => ex.id === id);
          if (!item) return;
          const amt = Number(item.amount) || 0;
          if (coverRemaining >= amt) {
            coverRemaining -= amt;
            updateExpense(id, { settled: true });
          } else if (coverRemaining > 0) {
            const covered = Math.round(coverRemaining * 100) / 100;
            const rem = Math.round((amt - covered) * 100) / 100;
            coverRemaining = 0;
            updateExpense(id, { amount: covered, settled: true });
            addExpense({
              ...item,
              amount: rem,
              description: item.description.includes('Remaining') ? item.description : `${item.description} (Remaining)`,
              settled: false,
              settlementId: null,
            });
          }
        });
      }

      const isAutoSettling = autoSettle && selectedExpenseIds.length > 0;
      const data: Partial<Expense> = {
        description: finalDesc,
        amount: totalAmt,
        category: category || 'Bill Settlement',
        date,
        type: 'by_friend',
        flow: 'out',
        friendId,
        vendorId: vendorId || null,
        walletId,
        status: 'paid',
        settled: isAutoSettling,
        notes,
        groupId: null,
      };

      if (expense) {
        if (expense.groupId) {
          const existing = db.expenses.filter(ex => ex.groupId === expense.groupId);
          existing.forEach(ex => deleteExpense(ex.id));
          addExpense(data);
        } else {
          updateExpense(expense.id, data);
        }
        showToast('Debt repayment updated');
      } else {
        addExpense(data);
        showToast('Debt repayment recorded');
      }
      onClose();
      return;
    }

    if (whoPaid === 'me' && splitMode === 'for_friend') {
      if (selectedFriendIds.length === 0) {
        setError('Please select at least one friend to split with.');
        return;
      }

      if (!amount || isNaN(totalAmt) || totalAmt <= 0) {
        setError('Please enter a valid total expense amount.');
        return;
      }

      const friendShareList = selectedFriendIds.map(fId => ({
        friendId: fId,
        share: getFriendShare(fId),
      }));

      const totFriendsShare = Math.round(friendShareList.reduce((acc, item) => acc + item.share, 0) * 100) / 100;

      if (totFriendsShare <= 0) {
        setError('Friend shares must total greater than 0.');
        return;
      }

      if (totFriendsShare > totalAmt + 0.01) {
        setError('Total friends share cannot exceed total expense amount.');
        return;
      }

      if (!isYouSelected && Math.abs(totFriendsShare - totalAmt) > 0.01) {
        setError(`Total friends share (${fmtMoney(totFriendsShare, s.currency)}) must equal the total expense amount (${fmtMoney(totalAmt, s.currency)}) when "You (Me)" is not included.`);
        return;
      }

      setError('');
      const myShare = isYouSelected ? Math.round(Math.max(0, totalAmt - totFriendsShare) * 100) / 100 : 0;
      const targetGroupId = expense?.groupId || uid('grp');

      if (expense) {
        if (expense.groupId) {
          const existing = db.expenses.filter(ex => ex.groupId === expense.groupId);
          existing.forEach(ex => deleteExpense(ex.id));
        } else {
          deleteExpense(expense.id);
        }
      }

      friendShareList.forEach(({ friendId: fId, share }) => {
        if (share > 0) {
          addExpense({
            groupId: targetGroupId,
            description: finalDesc,
            amount: share,
            category,
            date,
            type: 'for_friend',
            flow,
            friendId: fId,
            vendorId: vendorId || null,
            walletId,
            status: status === 'unpaid' ? 'unpaid' : 'unsettled',
            notes,
          });
        }
      });

      if (isYouSelected && myShare > 0.001) {
        addExpense({
          groupId: targetGroupId,
          description: finalDesc,
          amount: myShare,
          category,
          date,
          type: 'personal',
          flow,
          walletId,
          vendorId: vendorId || null,
          status: status,
          notes,
        });
      }

      showToast(
        selectedFriendIds.length > 1
          ? `Expense split among ${selectedFriendIds.length} friends recorded`
          : expense ? 'Split expense updated' : 'Split expense recorded'
      );
      onClose();
      return;
    } else {
      if (calculatedType !== 'personal' && !friendId) { setError('Select a friend.'); return; }
      setError('');

      const data: Partial<Expense> = {
        description: finalDesc,
        amount: totalAmt,
        category, date, type: calculatedType,
        flow,
        friendId: friendId || null,
        vendorId: vendorId || null,
        walletId: whoPaid === 'other' ? '' : walletId,
        status: calculatedStatus,
        notes,
        groupId: null,
      };

      if (expense) {
        if (expense.groupId) {
          const existing = db.expenses.filter(ex => ex.groupId === expense.groupId);
          existing.forEach(ex => deleteExpense(ex.id));
          addExpense(data);
        } else {
          updateExpense(expense.id, data);
        }
        showToast('Expense updated');
      } else {
        addExpense(data);
        showToast('Expense added');
      }
    }

    onClose();
  };

  return createPortal(
    <div className="modal-backdrop-motion" style={zIndex ? { zIndex } : undefined}>
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        style={zIndex ? { zIndex: zIndex + 1 } : undefined}
        onClick={onClose}
      />

      {/* Sheet panel / Desktop center dialog */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal expense-drawer-modal modal-dialog-panel"
        style={zIndex ? { zIndex: zIndex + 2 } : undefined}
      >
        {/* Drag Handle Indicator for Mobile Bottom Sheet */}
        <div className="modal-drag-handle" />

        <div className="modal-header compact-expense-header">
          {expense ? (
            <span className="modal-title">Edit Transaction</span>
          ) : (
            <div className="header-flow-switcher">
              <button
                type="button"
                className={`header-flow-tab ${flow === 'out' ? 'active-out' : ''}`}
                onClick={() => {
                  setFlow('out');
                  setError('');
                }}
              >
                <TrendingDown size={14} /> Expense
              </button>
              <button
                type="button"
                className={`header-flow-tab ${flow === 'in' ? 'active-in' : ''}`}
                onClick={() => {
                  setFlow('in');
                  setError('');
                }}
              >
                <TrendingUp size={14} /> Income
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="expense-modal-form">
          <div className="modal-body">
            {isTutorialMode && (
              <ExpenseTutorialBanner
                tutorialStep={tutorialStep}
                setTutorialStep={setTutorialStep}
                flow={flow}
                splitMode={splitMode}
                amount={amount}
                selectedFriendIds={selectedFriendIds}
                onFillSampleData={fillTutorialSampleData}
              />
            )}

            <div className="form-grid">
              {/* Hero Amount Field */}
              <div className={`hero-amount-card ${flow === 'out' ? 'hero-debit' : 'hero-credit'}`}>
                <span className="hero-amount-label">
                  {flow === 'out' ? 'Total Amount Spent' : 'Amount Received'} *
                </span>
                <div className="hero-amount-input-wrap">
                  <span className="hero-currency-symbol">{currencySymbol(s.currency)}</span>
                  <input
                    className="hero-amount-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => {
                      setAmount(e.target.value);
                      if (!friendShare || friendShare === amount) {
                        setFriendShare(e.target.value);
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* SPENT TAB INPUTS */}
              {flow === 'out' ? (
                <>
                  {/* Ultra-Compact Unified Scope Selector */}
                  <div className="form-group" style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                        Expense Type
                      </label>
                    </div>
                    <div className="segment-control">
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'me' && splitMode === 'just_me' ? 'active' : ''}`}
                        onClick={() => {
                          setWhoPaid('me');
                          setSplitMode('just_me');
                          setSelectedExpenseIds([]);
                          setError('');
                        }}
                      >
                        <User size={15} style={{ color: 'inherit' }} />
                        <span>Just Me</span>
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'me' && splitMode === 'for_friend' ? 'active' : ''}`}
                        onClick={() => {
                          setWhoPaid('me');
                          setSplitMode('for_friend');
                          setSelectedExpenseIds([]);
                          if (!friendShare && amount) setFriendShare(amount);
                          if (!expense) {
                            setSplitCalcMode('equal_all');
                            setIncludeYouInCustom(true);
                          }
                          setError('');
                        }}
                      >
                        <Users size={15} style={{ color: 'inherit' }} />
                        <span>With Friends</span>
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'other' ? 'active' : ''}`}
                        onClick={() => {
                          setWhoPaid('other');
                          setSplitMode('just_me');
                          setError('');
                        }}
                      >
                        <HeartHandshake size={15} style={{ color: 'inherit' }} />
                        <span>Someone Paid</span>
                      </button>
                    </div>
                  </div>

                  {/* Friend Selection & Split Summary: If With Friends */}
                  {whoPaid === 'me' && splitMode === 'for_friend' && (
                    <div style={{ marginBottom: 6, animation: 'fadein 0.15s ease' }}>
                      <div
                        onClick={() => setIsFriendPickerOpen(true)}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--surface2)',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--accent-gradient, var(--accent))',
                              color: 'var(--accent-contrast, #ffffff)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: 'var(--fs-sm)',
                              flexShrink: 0,
                              boxShadow: '0 2px 6px var(--accent-soft)',
                            }}
                          >
                            <Users size={15} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedFriendIds.length > 0
                                ? `Splitting with ${selectedFriendIds.length} Friend${selectedFriendIds.length > 1 ? 's' : ''}`
                                : 'Tap to Select Friends & Split'}
                            </div>
                            {selectedFriendIds.length > 0 && (
                              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Friends Owe: <strong style={{ color: 'var(--credit)' }}>{fmtMoney(totalFriendsShare, s.currency)}</strong>
                                {isYouSelected && ((parseFloat(amount) || 0) - totalFriendsShare) > 0.001 && (
                                  <>
                                    {' • '}
                                    My Share: <strong style={{ color: 'var(--accent)' }}>{fmtMoney((parseFloat(amount) || 0) - totalFriendsShare, s.currency)}</strong>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--surface3)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {selectedFriendIds.length > 0 ? (
                            <ChevronRight size={15} />
                          ) : (
                            <Plus size={14} strokeWidth={2.5} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If Someone Else Paid: Friend Selector */}
                  {whoPaid === 'other' && (
                    <div className="form-group" style={{ marginBottom: 6, animation: 'fadein 0.15s ease' }}>
                      <label className="form-label" style={{ fontSize: 10.5, fontWeight: 750, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
                        Who Paid For You? *
                      </label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">Select friend who paid</option>
                        {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Description & Note Button Merged */}
                  <div className="form-group" style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: 10.5, fontWeight: 750, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                        Description / Item *
                      </label>
                      <button
                        type="button"
                        className={`btn-note-feather ${notes ? 'has-note' : ''}`}
                        onClick={() => setIsNoteModalOpen(true)}
                        title={notes ? `Note: ${notes}` : "Add note"}
                        aria-label={notes ? "Edit note" : "Add note"}
                      >
                        <Feather size={13} strokeWidth={2.2} style={{ color: notes ? '#38bdf8' : 'var(--text-2)' }} />
                      </button>
                    </div>
                    <input
                      ref={descInputRef}
                      className="form-input"
                      value={desc}
                      onChange={e => handleDescriptionChange(e.target.value)}
                      placeholder={splitMode === 'pay_debt' ? "e.g. Settling dinner debt" : "What did you spend on?"}
                    />
                    <NotePreviewCard
                      notes={notes}
                      onEdit={() => setIsNoteModalOpen(true)}
                      onClear={() => setNotes('')}
                    />
                    {frequentDescriptions.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 8,
                          width: '100%',
                          minWidth: 0,
                          boxSizing: 'border-box',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 700,
                            color: 'var(--text-3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3.5,
                            flexShrink: 0,
                            height: 22,
                            lineHeight: 1,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                          }}
                        >
                          <Sparkles size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} /> Frequent
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            overflowX: 'auto',
                            whiteSpace: 'nowrap',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            flex: 1,
                            minWidth: 0,
                            paddingBottom: 2,
                          }}
                        >
                          {frequentDescriptions.map((itemText, idx) => {
                            const isSelected = desc.trim().toLowerCase() === itemText.toLowerCase();

                            return (
                              <button
                                key={`${itemText}-${idx}`}
                                type="button"
                                title={itemText}
                                style={{
                                  fontSize: 'var(--fs-xs)',
                                  fontWeight: isSelected ? 700 : 600,
                                  height: 28,
                                  padding: '0 13px',
                                  borderRadius: 'var(--radius-full)',
                                  border: isSelected ? 'none' : '1px solid var(--border)',
                                  background: isSelected ? 'var(--text)' : 'var(--surface2)',
                                  color: isSelected ? 'var(--bg)' : 'var(--text-2)',
                                  boxShadow: isSelected ? '0 1px 4px rgba(0, 0, 0, 0.2)' : 'none',
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  maxWidth: 160,
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  lineHeight: 1,
                                  boxSizing: 'border-box',
                                }}
                                onClick={() => {
                                  handleDescriptionChange(itemText);
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemText}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18, height: 18, marginBottom: 4 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Category
                        </label>
                        {autoDetectedCategory && autoDetectedCategory === category && (
                          <span
                            style={{
                              fontSize: 'var(--fs-caption)',
                              fontWeight: 700,
                              color: 'var(--accent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2.5,
                              background: 'var(--accent-soft)',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-full)',
                            }}
                            title="Category suggested automatically based on your description"
                          >
                            <Sparkles size={9} /> Auto
                          </span>
                        )}
                      </div>
                      <select
                        className="form-select"
                        value={category}
                        onChange={e => {
                          setCategory(e.target.value);
                          setIsCategoryManuallySelected(true);
                          setAutoDetectedCategory(null);
                        }}
                      >
                        {s.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18, height: 18, marginBottom: 4 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Date Spent
                        </label>
                      </div>
                      <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Wallet & Vendor on the Same Row with Inline Payment Status (Only shown when I paid) */}
                  {whoPaid === 'me' && (
                    <div className="form-row">
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18, height: 18, marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                            {status === 'unpaid' ? 'Wallet' : 'Paid From'}
                          </label>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'var(--surface2)',
                              padding: '2px',
                              borderRadius: 'var(--radius-full)',
                              border: 'none',
                              gap: 2,
                            }}
                          >
                            <button
                              type="button"
                              title="Paid now from wallet"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px 9px',
                                borderRadius: 'var(--radius-full)',
                                border: 'none',
                                fontSize: 'var(--fs-caption)',
                                fontWeight: status === 'paid' ? 700 : 500,
                                cursor: 'pointer',
                                background: status === 'paid' ? 'var(--credit-bg, rgba(16, 185, 129, 0.14))' : 'transparent',
                                color: status === 'paid' ? 'var(--credit, #10b981)' : 'var(--text-3)',
                                boxShadow: status === 'paid' ? '0 1px 3px var(--credit-bg)' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setStatus('paid')}
                            >
                              Paid
                            </button>
                            <button
                              type="button"
                              title="Unpaid debt / pending bill"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px 9px',
                                borderRadius: 'var(--radius-full)',
                                border: 'none',
                                fontSize: 'var(--fs-caption)',
                                fontWeight: status === 'unpaid' ? 700 : 500,
                                cursor: 'pointer',
                                background: status === 'unpaid' ? 'var(--debit-bg, rgba(239, 68, 68, 0.15))' : 'transparent',
                                color: status === 'unpaid' ? 'var(--debit, #ef4444)' : 'var(--text-3)',
                                boxShadow: status === 'unpaid' ? '0 1px 3px var(--debit-bg)' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setStatus('unpaid')}
                            >
                              Debt
                            </button>
                          </div>
                        </div>
                        <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                          {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>

                      <VendorQuickAdd
                        vendorId={vendorId}
                        setVendorId={setVendorId}
                        vendorsList={vendorsList}
                        addFriend={addFriend}
                        showToast={showToast}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* RECEIVED / INCOME TAB INPUTS */
                <>
                  {/* Income Type Switcher */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 'var(--fs-caption)', marginBottom: 4 }}>Income Type</label>
                    <div className="segment-control">
                      <button
                        type="button"
                        className={`segment-btn ${incomeMode === 'direct' ? 'active' : ''}`}
                        onClick={() => {
                          setIncomeMode('direct');
                          setFriendId('');
                          setError('');
                        }}
                      >
                        <TrendingUp size={16} style={{ color: 'inherit' }} />
                        <span>Income</span>
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${incomeMode === 'friend' ? 'active' : ''}`}
                        onClick={() => {
                          setIncomeMode('friend');
                          setError('');
                        }}
                      >
                        <HeartHandshake size={16} style={{ color: 'inherit' }} />
                        <span>Debt Repayment</span>
                      </button>
                    </div>
                  </div>

                  {incomeMode === 'direct' ? (
                    <>
                      <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 600 }}>Income Source / Name *</label>
                          <button
                            type="button"
                            className={`btn-note-feather ${notes ? 'has-note' : ''}`}
                            onClick={() => setIsNoteModalOpen(true)}
                            title={notes ? `Note: ${notes}` : "Add note"}
                            aria-label={notes ? "Edit note" : "Add note"}
                          >
                            <Feather size={13} strokeWidth={2.2} style={{ color: notes ? '#38bdf8' : 'var(--text-2)' }} />
                          </button>
                        </div>
                        <input
                          className="form-input"
                          value={desc}
                          onChange={e => setDesc(e.target.value)}
                          placeholder="e.g. Monthly Salary, Pocket Money from Parents"
                        />
                        <NotePreviewCard
                          notes={notes}
                          onEdit={() => setIsNoteModalOpen(true)}
                          onClear={() => setNotes('')}
                        />
                        {/* Quick Presets for Speed */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            overflowX: 'auto',
                            whiteSpace: 'nowrap',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            marginTop: 8,
                            paddingBottom: 2,
                          }}
                        >
                          {[
                            { label: 'Salary', value: 'Monthly Salary' },
                            { label: 'Parents / Pocket Money', value: 'Pocket Money from Parents' },
                            { label: 'Freelance', value: 'Freelance Income' },
                            { label: 'Gift / Bonus', value: 'Gift / Bonus' },
                          ].map(preset => {
                            const isSelected = desc === preset.value;
                            return (
                              <button
                                key={preset.value}
                                type="button"
                                title={preset.value}
                                style={{
                                  fontSize: 'var(--fs-caption)',
                                  fontWeight: isSelected ? 700 : 600,
                                  height: 26,
                                  padding: '0 12px',
                                  borderRadius: 'var(--radius-full)',
                                  border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                                  background: isSelected ? 'var(--surface2)' : 'var(--surface3)',
                                  color: isSelected ? 'var(--text)' : 'var(--text-2)',
                                  boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.18)' : 'none',
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  lineHeight: 1,
                                  boxSizing: 'border-box',
                                }}
                                onClick={() => setDesc(preset.value)}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preset.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22, height: 22, marginBottom: 5 }}>
                            <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 600 }}>Deposited To (Wallet)</label>
                          </div>
                          <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                            {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22, height: 22, marginBottom: 5 }}>
                            <label className="form-label" style={{ margin: 0, fontSize: 'var(--fs-caption)', fontWeight: 600 }}>Date Received</label>
                          </div>
                          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Friend Debt Repayment */}
                      <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                        <label className="form-label">Who Paid You Back? *</label>
                        <select
                          className="form-select"
                          value={friendId}
                          onChange={e => {
                            const fid = e.target.value;
                            setFriendId(fid);
                            const foundFriend = db.friends.find(f => f.id === fid);
                            const rawList = fid ? unsettledExpensesForFriend(db, fid).filter(ex => ex.type === 'for_friend') : [];
                            if (rawList.length > 0) {
                              const allIds = rawList.map(ex => ex.id);
                              setSelectedExpenseIds(allIds);
                              const sum = Math.round(rawList.reduce((s, ex) => s + (Number(ex.amount) || 0), 0) * 100) / 100;
                              setAmount(String(sum));
                              if (rawList.length === 1) {
                                setDesc(`Repayment for ${rawList[0].description}`);
                              } else if (foundFriend) {
                                setDesc(`Debt repayment from ${foundFriend.name}`);
                              }
                            } else {
                              setSelectedExpenseIds([]);
                              if (foundFriend) {
                                setDesc(`Debt repayment from ${foundFriend.name}`);
                              }
                            }
                          }}
                        >
                          <option value="">Select friend who paid back</option>
                          {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>

                      {/* Friend Debt Balance & Unsettled Items Widget */}
                      {friendId && selectedFriend && (
                        <DebtSettlementWidget
                          friend={selectedFriend}
                          friendBal={friendBal}
                          unsettledList={unsettledList}
                          selectedExpenseIds={selectedExpenseIds}
                          toggleSelectExpense={toggleSelectExpense}
                          handleSettleAllDebts={handleSettleAllDebts}
                          amount={amount}
                          setAmount={setAmount}
                          autoSettle={autoSettle}
                          setAutoSettle={setAutoSettle}
                          db={db}
                          mode="receive_from_friend"
                        />
                      )}

                      <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                        <label className="form-label">Payment Note / Description</label>
                        <input
                          className="form-input"
                          value={desc}
                          onChange={e => setDesc(e.target.value)}
                          placeholder="e.g. Settled dinner bill, Debt repayment"
                        />
                      </div>

                      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Deposited To (Wallet)</label>
                          <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                            {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Date Received</label>
                          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {error && <p className="form-error">{error}</p>}
            </div>
          </div>
          <div
            className="modal-footer"
            style={{
              padding: '8px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
              background: 'var(--surface)',
              borderTop: 'none',
              display: 'flex',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="btn btn-drawer-cancel"
              onClick={handleClearForm}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 'var(--radius-full)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontWeight: 700,
                fontSize: 'var(--fs-base)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <RotateCcw size={15} style={{ color: 'var(--text)' }} />
              <span>Clear</span>
            </button>
            <button
              type="submit"
              className="btn btn-drawer-save-mono"
              style={{
                flex: 1.25,
                height: 44,
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: 'var(--fs-base)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                background: 'var(--text)',
                border: '1px solid var(--text)',
                color: 'var(--bg)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              }}
            >
              {flow === 'out' ? (
                <TrendingDown size={15} style={{ color: 'inherit' }} />
              ) : (
                <TrendingUp size={15} style={{ color: 'inherit' }} />
              )}
              <span>{expense ? 'Save Changes' : flow === 'out' ? 'Record Expense' : 'Record Income'}</span>
            </button>
          </div>
        </form>
      </motion.div>

      {/* Friend Split Modal Dialog */}
      <FriendSplitModal
        isOpen={isFriendPickerOpen}
        onClose={() => setIsFriendPickerOpen(false)}
        amount={amount}
        selectedFriendIds={selectedFriendIds}
        setSelectedFriendIds={setSelectedFriendIds}
        splitCalcMode={splitCalcMode}
        includeYouInCustom={includeYouInCustom}
        setIncludeYouInCustom={setIncludeYouInCustom}
        customFriendShares={customFriendShares}
        setCustomFriendShares={setCustomFriendShares}
        handleSelectSplitCalcMode={handleSelectSplitCalcMode}
        getFriendShare={getFriendShare}
        totalFriendsShare={totalFriendsShare}
        isYouSelected={isYouSelected}
        db={db}
        addFriend={addFriend}
        showToast={showToast}
      />

      {/* Note Editor Modal Dialog */}
      <NoteEditorModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title={flow === 'in' ? 'Income Note' : 'Expense Note'}
        initialNote={notes}
        onSave={setNotes}
        quickTags={
          flow === 'in'
            ? ['Salary', 'Bonus', 'Freelance payment', 'Gift', 'Reimbursement from friend', 'Interest / Returns']
            : ['Reimbursable', 'Office bill', 'Cash payment', 'Personal', 'Tax deductible', 'Shared bill', 'Group trip']
        }
      />
    </div>,
    document.body
  );
}
