import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingDown, TrendingUp, User, Users, CheckSquare, Square, HeartHandshake, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, FileText, Plus, Search, Store } from 'lucide-react';
import { useStore } from '../store';
import type { Expense, ExpenseType, ExpenseFlow, ExpenseStatus } from '../types';
import { todayISO, uid, friendBalance, unsettledExpensesForFriend } from '../db';
import { currencySymbol, fmtMoney, getAvatarStyle } from '../utils';

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
}

export default function ExpenseModal({ expense, initialData, isTutorialMode, onClose }: Props) {
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

  const initialWhoPaid = initialData?.whoPaid ?? (expense?.type === 'by_friend' && expense?.flow === 'out' && !expense?.friendId ? 'other' : 'me');
  const initialSplitMode = (initialData?.splitMode === 'pay_debt' ? 'just_me' : initialData?.splitMode) ?? ((isGrp || expense?.type === 'for_friend')
    ? 'for_friend'
    : 'just_me');
  const initialFriendId = initialData?.friendId ?? forFriendItem?.friendId ?? expense?.friendId ?? '';

  const initialIncomeMode = (initialData?.flow === 'in' || expense?.flow === 'in')
    ? (initialData?.friendId || expense?.type === 'by_friend' || expense?.friendId ? 'friend' : 'direct')
    : 'direct';

  const [incomeMode, setIncomeMode] = useState<'direct' | 'friend'>(initialIncomeMode);
  const [desc, setDesc] = useState(initialDesc);
  const [amount, setAmount] = useState(initialTotalAmount);
  const [friendShare, setFriendShare] = useState(initialFriendShare);
  const [category, setCategory] = useState(initialData?.category ?? expense?.category ?? s.defaultCategory);
  const [date, setDate] = useState(initialData?.date ?? expense?.date ?? todayISO());
  const [, setType] = useState<ExpenseType>(initialData?.type ?? expense?.type ?? 'personal');
  const [whoPaid, setWhoPaid] = useState<'me' | 'other'>(initialWhoPaid);
  const [splitMode, setSplitMode] = useState<'just_me' | 'for_friend' | 'pay_debt'>(initialSplitMode);
  const [flow, setFlow] = useState<ExpenseFlow>(initialData?.flow ?? expense?.flow ?? 'out');
  const [friendId, setFriendId] = useState(initialFriendId);
  const [vendorId, setVendorId] = useState<string>(initialData?.vendorId ?? expense?.vendorId ?? grpItems.find(e => e.vendorId)?.vendorId ?? '');
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [walletId, setWalletId] = useState(initialData?.walletId ?? expense?.walletId ?? s.defaultWalletId);
  const initialStatus = initialData?.status ?? expense?.status ?? (grpItems.find(e => e.status === 'unpaid')?.status) ?? s.defaultStatus;
  const [status, setStatus] = useState<ExpenseStatus>(initialStatus);

  const vendorsList = useMemo(() => db.friends.filter(f => f.type === 'vendor'), [db.friends]);
  const [notes, setNotes] = useState(initialData?.notes ?? expense?.notes ?? '');
  const [showNotes, setShowNotes] = useState(() => Boolean(initialData?.notes || expense?.notes));
  const [error, setError] = useState('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [autoSettle, setAutoSettle] = useState(true);

  // Multi-friend selection state for splitting expenses
  const initialFriendIdsList = (() => {
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
    } else if (initialFriendShare && initialFriendId) {
      init[initialFriendId] = initialFriendShare;
    }
    return init;
  })();

  // Infer previous split rule so that editing an expense preserves its exact mode (Equal, Friends Only, or Custom)
  const { inferredSplitCalcMode, inferredIncludeYou } = (() => {
    if (!expense && !initialData) {
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

      if (allEqual || forFriendItems.length <= 1) {
        return { inferredSplitCalcMode: 'equal_friends' as const, inferredIncludeYou: false };
      } else {
        return { inferredSplitCalcMode: 'custom' as const, inferredIncludeYou: false };
      }
    }

    // There IS a personal share (my share > 0)
    const expectedShare = tot / (n + 1);
    const personalEqual = Math.abs(personalAmt - expectedShare) < 0.05;
    const allFriendsEqual = forFriendItems.length > 0 && forFriendItems.every(e => {
      const amt = Number(e.amount) || 0;
      return Math.abs(amt - expectedShare) < 0.05;
    });

    if (personalEqual && allFriendsEqual) {
      return { inferredSplitCalcMode: 'equal_all' as const, inferredIncludeYou: true };
    } else {
      return { inferredSplitCalcMode: 'custom' as const, inferredIncludeYou: true };
    }
  })();

  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(initialFriendIdsList);
  const [splitCalcMode, setSplitCalcMode] = useState<'equal_all' | 'equal_friends' | 'custom'>(inferredSplitCalcMode);
  const [includeYouInCustom, setIncludeYouInCustom] = useState<boolean>(inferredIncludeYou);
  const [customFriendShares, setCustomFriendShares] = useState<Record<string, string>>(initialCustomSharesMap);

  const isYouSelected = splitCalcMode === 'equal_all' || (splitCalcMode === 'custom' && includeYouInCustom);

  // Friend Picker Dialog state
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>('all');

  // Filtered friends inside the Friend Picker Dialog
  const filteredPickerFriends = useMemo(() => {
    let list = db.friends;
    if (pickerTypeFilter !== 'all') {
      list = list.filter(f => (f.type || 'friend') === pickerTypeFilter);
    }
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [db.friends, pickerTypeFilter, pickerSearch]);

  const getFriendShare = useCallback((fId: string): number => {
    const tot = parseFloat(amount) || 0;
    const n = selectedFriendIds.length;
    if (n === 0 || tot <= 0) return 0;

    const idx = selectedFriendIds.indexOf(fId);
    if (idx === -1) return 0;

    if (splitCalcMode === 'equal_all') {
      // Split total amount among (n + 1) people (Me + n friends)
      const baseCents = Math.floor((tot * 100) / (n + 1));
      return baseCents / 100;
    }

    if (splitCalcMode === 'equal_friends') {
      // Split 100% of total amount among n friends (My share = 0)
      const baseCents = Math.floor((tot * 100) / n);
      const remainderCents = Math.round(tot * 100) - (baseCents * n);
      const friendCents = baseCents + (idx < remainderCents ? 1 : 0);
      return friendCents / 100;
    }

    // Custom mode
    if (customFriendShares[fId] !== undefined) {
      const customVal = parseFloat(customFriendShares[fId]);
      return isNaN(customVal) ? 0 : customVal;
    }

    const denom = (includeYouInCustom ? n + 1 : n) || 1;
    const baseCents = Math.floor((tot * 100) / denom);
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
      const tot = parseFloat(amount) || 0;
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
    const tot = parseFloat(amount) || 0;
    const n = selectedFriendIds.length;
    if (n === 0 || tot <= 0) return 0;

    return selectedFriendIds.reduce((sum, fId) => {
      return sum + getFriendShare(fId);
    }, 0);
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

  const mostUsedDescriptions = useMemo(() => {
    const counts: Record<string, number> = {};
    db.expenses.forEach(e => {
      const d = e.description?.trim();
      if (
        d &&
        d.length > 1 &&
        !d.toLowerCase().startsWith('debt repayment') &&
        !d.toLowerCase().startsWith('repaid') &&
        !d.toLowerCase().startsWith('paying') &&
        !d.toLowerCase().startsWith('settling') &&
        !d.toLowerCase().startsWith('full debt')
      ) {
        counts[d] = (counts[d] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);
  }, [db.expenses]);

  const toggleSelectExpense = (expId: string) => {
    const isSelected = selectedExpenseIds.includes(expId);
    const next = isSelected
      ? selectedExpenseIds.filter(id => id !== expId)
      : [...selectedExpenseIds, expId];

    setSelectedExpenseIds(next);

    if (next.length > 0) {
      const sum = next.reduce((acc, id) => {
        const item = unsettledList.find(e => e.id === id);
        return acc + (item ? Number(item.amount) || 0 : 0);
      }, 0);
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
      const totalSum = unsettledList.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      setAmount(String(totalSum));
      if (selectedFriend) {
        setDesc(flow === 'in' ? `Full debt settlement from ${selectedFriend.name}` : `Full debt settlement to ${selectedFriend.name}`);
      }
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

    const totalAmt = parseFloat(amount);
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

      if (autoSettle && selectedExpenseIds.length > 0) {
        let coverRemaining = totalAmt;
        selectedExpenseIds.forEach(id => {
          const item = db.expenses.find(ex => ex.id === id);
          if (!item) return;
          const amt = Number(item.amount) || 0;
          if (coverRemaining >= amt) {
            coverRemaining -= amt;
            updateExpense(id, { settled: true, date: date || item.date });
          } else if (coverRemaining > 0) {
            const covered = coverRemaining;
            const rem = amt - covered;
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

      if (autoSettle && selectedExpenseIds.length > 0) {
        let coverRemaining = totalAmt;
        selectedExpenseIds.forEach(id => {
          const item = db.expenses.find(ex => ex.id === id);
          if (!item) return;
          const amt = Number(item.amount) || 0;
          if (coverRemaining >= amt) {
            coverRemaining -= amt;
            updateExpense(id, { settled: true, date: date || item.date });
          } else if (coverRemaining > 0) {
            const covered = coverRemaining;
            const rem = amt - covered;
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

      const totFriendsShare = friendShareList.reduce((acc, item) => acc + item.share, 0);

      if (totFriendsShare <= 0) {
        setError('Friend shares must total greater than 0.');
        return;
      }

      if (totFriendsShare > totalAmt) {
        setError('Total friends share cannot exceed total expense amount.');
        return;
      }

      setError('');
      const myShare = totalAmt - totFriendsShare;
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

      if (myShare > 0) {
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
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal expense-drawer-modal">
        {/* Drag Handle Indicator for Mobile Bottom Sheet */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

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
          <button className="btn-icon compact-close-btn drawer-close-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="expense-modal-form">
          <div className="modal-body">
            {isTutorialMode && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.12) 100%)',
                border: '1px solid var(--accent)',
                borderRadius: '14px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-1)' }}>
                      Interactive Guided Tutorial ({tutorialStep}/4)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map(st => (
                      <div
                        key={st}
                        onClick={() => setTutorialStep(st)}
                        style={{
                          width: st === tutorialStep ? 18 : 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: st === tutorialStep ? 'var(--accent)' : 'var(--border2)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {tutorialStep === 1 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)', marginBottom: 2 }}>
                      Step 1: Enter Total Amount & Select Wallet
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                      Enter how much was spent and pick which account (Cash, Bank, Credit Card) paid for it.
                    </div>
                  </div>
                )}

                {tutorialStep === 2 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)', marginBottom: 2 }}>
                      Step 2: Add Title & Category
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                      Describe what you bought (e.g., "Dinner with Rahul") and select a category icon.
                    </div>
                  </div>
                )}

                {tutorialStep === 3 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)', marginBottom: 2 }}>
                      Step 3: Choose Who Paid & Debt Mode 👥
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                      Choose who paid! <strong>"I Paid for Friend"</strong> creates money owed to you. <strong>"Paid by Friend"</strong> creates debt you owe them.
                    </div>
                  </div>
                )}

                {tutorialStep === 4 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)', marginBottom: 2 }}>
                      Step 4: Record Transaction 🚀
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                      Click "Record Expense" below to save and see your balances & debt ledgers update live!
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                  <button
                    type="button"
                    onClick={fillTutorialSampleData}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sparkles size={14} /> Auto-Fill Demo Values
                  </button>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {tutorialStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setTutorialStep(s => s - 1)}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-1)',
                          borderRadius: '8px',
                          padding: '5px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    )}
                    {tutorialStep < 4 ? (
                      <button
                        type="button"
                        onClick={() => setTutorialStep(s => s + 1)}
                        style={{
                          background: 'var(--accent)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Next Step <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!amount || !desc) {
                            fillTutorialSampleData();
                          }
                          showToast('✨ Ready to record! Click button below.');
                        }}
                        style={{
                          background: 'var(--credit)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Ready! <CheckCircle2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
                    autoFocus
                  />
                </div>
              </div>

              {/* SPENT TAB INPUTS */}
              {flow === 'out' ? (
                <>
                  {/* Ultra-Compact Unified Scope Selector */}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4 }}>Expense Type</label>
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
                        <User size={15} /> Just Me
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'me' && splitMode === 'for_friend' ? 'active' : ''}`}
                        onClick={() => {
                          setWhoPaid('me');
                          setSplitMode('for_friend');
                          setSelectedExpenseIds([]);
                          if (!friendShare && amount) setFriendShare(amount);
                          setError('');
                        }}
                      >
                        <Users size={15} /> With Friends
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
                        <HeartHandshake size={15} /> Someone Paid
                      </button>
                    </div>
                  </div>

                  {/* Friend Selection & Split Summary: If With Friends */}
                  {whoPaid === 'me' && splitMode === 'for_friend' && (
                    <div style={{ marginBottom: 10, animation: 'fadein 0.15s ease' }}>
                      <div
                        onClick={() => setIsFriendPickerOpen(true)}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--accent-soft)',
                          border: '1.5px solid var(--accent-border-soft)',
                          borderRadius: 'var(--radius)',
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
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              color: 'var(--accent-contrast)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                            }}
                          >
                            <Users size={16} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedFriendIds.length > 0
                                ? `Splitting with ${selectedFriendIds.length} Friend${selectedFriendIds.length > 1 ? 's' : ''}`
                                : 'Tap to Select Friends & Split'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedFriendIds.length > 0 ? (
                                <>
                                  Friends Owe: <strong style={{ color: 'var(--credit)' }}>{fmtMoney(totalFriendsShare, s.currency)}</strong>
                                  {' • '}
                                  My Share: <strong style={{ color: 'var(--accent)' }}>{fmtMoney((parseFloat(amount) || 0) - totalFriendsShare, s.currency)}</strong>
                                </>
                              ) : (
                                'Set who shared this expense & split rules'
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          style={{
                            background: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                            border: 'none',
                            padding: '5px 12px',
                            borderRadius: 99,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          {selectedFriendIds.length > 0 ? 'Edit' : '+ Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If Someone Else Paid: Friend Selector */}
                  {whoPaid === 'other' && (
                    <div className="form-group" style={{ marginBottom: 8, animation: 'fadein 0.15s ease' }}>
                      <label className="form-label" style={{ fontSize: 11.5, marginBottom: 4 }}>Who Paid For You? *</label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">— select friend who paid —</option>
                        {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Description & Note Button Merged */}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: 11.5 }}>Description / Item *</label>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 600,
                          color: showNotes ? 'var(--accent)' : 'var(--text-3)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: 0,
                        }}
                        onClick={() => setShowNotes(!showNotes)}
                      >
                        <FileText size={12} /> {showNotes ? 'Hide Note' : '+ Note'}
                      </button>
                    </div>
                    <input
                      className="form-input"
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder={splitMode === 'pay_debt' ? "e.g. Settling dinner debt" : "What did you spend on?"}
                    />
                    {showNotes && (
                      <div style={{ marginTop: 4, position: 'relative', animation: 'fadein 0.15s ease' }}>
                        <textarea
                          className="form-textarea"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Add optional notes or remarks..."
                          rows={2}
                          style={{ fontSize: 12, padding: '6px 10px', paddingRight: 24 }}
                        />
                        <button
                          type="button"
                          style={{
                            position: 'absolute',
                            right: 6,
                            top: 6,
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-3)',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                          onClick={() => setShowNotes(false)}
                          title="Close note"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    {mostUsedDescriptions.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', whiteSpace: 'nowrap', marginTop: 5, alignItems: 'center', scrollbarWidth: 'none' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', flexShrink: 0 }}>Frequent:</span>
                        {mostUsedDescriptions.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 10.5,
                              padding: '1px 7px',
                              borderRadius: 'var(--radius-lg)',
                              borderColor: desc === suggestion ? 'var(--accent)' : undefined,
                              background: desc === suggestion ? 'var(--surface2)' : undefined,
                              color: desc === suggestion ? 'var(--accent)' : 'var(--text-2)',
                              flexShrink: 0,
                            }}
                            onClick={() => setDesc(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                        {s.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date Spent</label>
                      <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Wallet & Vendor on the Same Row with Inline Payment Status (Only shown when I paid) */}
                  {whoPaid === 'me' && (
                    <div className="form-row">
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0, fontSize: 11.5 }}>
                            {status === 'unpaid' ? 'Wallet (For Settlement)' : 'Paid From'}
                          </label>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'var(--surface2)',
                              padding: '2px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              gap: 2,
                            }}
                          >
                            <button
                              type="button"
                              title="Paid now from wallet"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '2px 7px',
                                borderRadius: 4,
                                border: 'none',
                                fontSize: 10.5,
                                fontWeight: status === 'paid' ? 700 : 500,
                                cursor: 'pointer',
                                background: status === 'paid' ? 'var(--surface)' : 'transparent',
                                color: status === 'paid' ? 'var(--credit, #22c55e)' : 'var(--text-3)',
                                boxShadow: status === 'paid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.12s ease',
                              }}
                              onClick={() => setStatus('paid')}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--credit, #22c55e)' }} />
                              Paid
                            </button>
                            <button
                              type="button"
                              title="Unpaid debt / pending bill"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '2px 7px',
                                borderRadius: 4,
                                border: 'none',
                                fontSize: 10.5,
                                fontWeight: status === 'unpaid' ? 700 : 500,
                                cursor: 'pointer',
                                background: status === 'unpaid' ? 'var(--surface)' : 'transparent',
                                color: status === 'unpaid' ? 'var(--debit, #ef4444)' : 'var(--text-3)',
                                boxShadow: status === 'unpaid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.12s ease',
                              }}
                              onClick={() => setStatus('unpaid')}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--debit, #ef4444)' }} />
                              Debt
                            </button>
                          </div>
                        </div>
                        <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                          {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Store size={12} style={{ color: 'var(--text-3)' }} /> Vendor (Optional)
                          </label>
                          {!isAddingVendor && (
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: 'var(--accent)',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              onClick={() => setIsAddingVendor(true)}
                            >
                              + Add
                            </button>
                          )}
                        </div>

                        {isAddingVendor ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', animation: 'fadein 0.15s ease' }}>
                            <input
                              className="form-input"
                              style={{ fontSize: 11.5, height: 34, flex: 1, padding: '0 8px' }}
                              placeholder="Store name..."
                              value={newVendorName}
                              onChange={e => setNewVendorName(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ height: 34, padding: '0 8px', fontSize: 10.5 }}
                              onClick={() => {
                                if (newVendorName.trim()) {
                                  const created = addFriend({ name: newVendorName.trim(), type: 'vendor' });
                                  setVendorId(created.id);
                                  showToast(`Added vendor ${created.name}`);
                                  setNewVendorName('');
                                  setIsAddingVendor(false);
                                }
                              }}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ height: 34, padding: '0 6px', fontSize: 10.5 }}
                              onClick={() => {
                                setIsAddingVendor(false);
                                setNewVendorName('');
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <select
                            className="form-select"
                            value={vendorId}
                            onChange={e => {
                              if (e.target.value === '__add_new__') {
                                setIsAddingVendor(true);
                              } else {
                                setVendorId(e.target.value);
                              }
                            }}
                          >
                            <option value="">— None —</option>
                            {vendorsList.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                            <option value="__add_new__">+ Add Store...</option>
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* RECEIVED / INCOME TAB INPUTS */
                <>
                  {/* Income Type Switcher */}
                  <div className="form-group">
                    <label className="form-label">Income Type</label>
                    <div className="segment-control">
                      <button
                        type="button"
                        className={`segment-btn ${incomeMode === 'direct' ? 'active' : ''}`}
                        onClick={() => {
                          setIncomeMode('direct');
                          setType('personal');
                          setFriendId('');
                          setError('');
                        }}
                      >
                        <TrendingUp size={16} /> Income
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${incomeMode === 'friend' ? 'active' : ''}`}
                        onClick={() => {
                          setIncomeMode('friend');
                          setType('by_friend');
                          setError('');
                        }}
                      >
                        <HeartHandshake size={16} /> Debt Repayment
                      </button>
                    </div>
                  </div>

                  {incomeMode === 'direct' ? (
                    <>
                      <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0 }}>Income Source / Name *</label>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: showNotes ? 'var(--accent)' : 'var(--text-3)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: 0,
                            }}
                            onClick={() => setShowNotes(!showNotes)}
                          >
                            <FileText size={12} /> {showNotes ? 'Hide Note' : '+ Note'}
                          </button>
                        </div>
                        <input
                          className="form-input"
                          value={desc}
                          onChange={e => setDesc(e.target.value)}
                          placeholder="e.g. Monthly Salary, Pocket Money from Parents"
                        />
                        {showNotes && (
                          <div style={{ marginTop: 6, animation: 'fadein 0.15s ease' }}>
                            <textarea
                              className="form-textarea"
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              placeholder="Add optional notes or remarks..."
                              rows={2}
                              style={{ fontSize: 12.5 }}
                            />
                          </div>
                        )}
                        {/* Quick Presets for Speed */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {[
                            { label: 'Salary', value: 'Monthly Salary' },
                            { label: 'Parents / Pocket Money', value: 'Pocket Money from Parents' },
                            { label: 'Freelance', value: 'Freelance Income' },
                            { label: 'Gift / Bonus', value: 'Gift / Bonus' },
                          ].map(preset => (
                            <button
                              key={preset.value}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: 11,
                                padding: '3px 9px',
                                borderRadius: 'var(--radius-lg)',
                                borderColor: desc === preset.value ? 'var(--accent)' : undefined,
                                background: desc === preset.value ? 'var(--surface2)' : undefined,
                                color: desc === preset.value ? 'var(--accent)' : 'var(--text-2)',
                              }}
                              onClick={() => setDesc(preset.value)}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
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
                              const sum = rawList.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
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
                          <option value="">— select friend who paid back —</option>
                          {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>

                      {/* Friend Debt Balance & Unsettled Items Widget */}
                      {friendId && selectedFriend && (
                        <div
                          style={{
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '12px 14px',
                            marginBottom: 16,
                            animation: 'fadein 0.15s ease',
                          }}
                        >
                          {/* Top Balance Summary Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: unsettledList.length > 0 ? 10 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  ...getAvatarStyle(selectedFriend.color),
                                  fontSize: 12,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {selectedFriend.name[0]?.toUpperCase()}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                {selectedFriend.name}
                              </span>
                            </div>

                            <div>
                              {friendBal.owedToMe > 0 ? (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: '#2e7d32',
                                    background: 'rgba(46, 125, 50, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-lg)',
                                  }}
                                >
                                  Owes you {fmtMoney(friendBal.owedToMe, s.currency)}
                                </span>
                              ) : friendBal.owedByMe > 0 ? (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: '#d97706',
                                    background: 'rgba(217, 119, 6, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-lg)',
                                  }}
                                >
                                  You owe {fmtMoney(friendBal.owedByMe, s.currency)}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 500,
                                    color: 'var(--text-3)',
                                  }}
                                >
                                  Balanced
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Unsettled Debts Selector */}
                          {unsettledList.length > 0 ? (
                            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                  Select Debt Being Repaid:
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 11, padding: '2px 8px', height: 24, borderRadius: 'var(--radius)' }}
                                  onClick={handleSettleAllDebts}
                                >
                                  {unsettledList.every(e => selectedExpenseIds.includes(e.id)) ? 'Deselect All' : `Settle All (${fmtMoney(friendBal.owedToMe, s.currency)})`}
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
                                {unsettledList.map(item => {
                                  const isSel = selectedExpenseIds.includes(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => toggleSelectExpense(item.id)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '7px 10px',
                                        borderRadius: 'var(--radius)',
                                        border: isSel ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        background: isSel ? 'var(--surface)' : 'rgba(255,255,255,0.02)',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        {isSel ? (
                                          <CheckSquare size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                        ) : (
                                          <Square size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                                        )}
                                        <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <div style={{ fontSize: 12.5, fontWeight: isSel ? 600 : 500, color: 'var(--text)' }}>
                                            {item.description}
                                          </div>
                                          <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                                            {item.date} • {item.category}
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{ fontSize: 12.5, fontWeight: 700, color: isSel ? 'var(--accent)' : 'var(--text)', flexShrink: 0, marginLeft: 8 }}>
                                        {fmtMoney(item.amount, s.currency)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {selectedExpenseIds.length > 0 ? (() => {
                                const selectedSum = selectedExpenseIds.reduce((acc, id) => {
                                  const item = db.expenses.find(ex => ex.id === id);
                                  return acc + (item ? Number(item.amount) || 0 : 0);
                                }, 0);
                                const currentAmt = parseFloat(amount) || 0;
                                const diff = selectedSum - currentAmt;
                                const isPartial = currentAmt > 0 && diff > 0.01;

                                return (
                                  <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    {/* Segment Toggle for Full vs Partial */}
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                        Payback Amount Type:
                                      </div>
                                      <div className="segment-control" style={{ display: 'flex', gap: 6 }}>
                                        <button
                                          type="button"
                                          className={`segment-btn ${!isPartial && currentAmt === selectedSum ? 'active' : ''}`}
                                          style={{ flex: 1, textAlign: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 11.5 }}
                                          onClick={() => setAmount(String(selectedSum))}
                                        >
                                          Full Payback ({fmtMoney(selectedSum, s.currency)})
                                        </button>
                                        <button
                                          type="button"
                                          className={`segment-btn ${isPartial ? 'active' : ''}`}
                                          style={{ flex: 1, textAlign: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 11.5 }}
                                          onClick={() => {
                                            if (!isPartial) setAmount(String(Math.round(selectedSum / 2)));
                                          }}
                                        >
                                          Custom / Partial Payback
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline Custom Amount Input */}
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                                          Amount Paid Back ({s.currency})
                                        </label>
                                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                          Full Owed: {fmtMoney(selectedSum, s.currency)}
                                        </span>
                                      </div>
                                      <input
                                        type="number"
                                        step="any"
                                        className="form-input"
                                        placeholder={`e.g. 20 (Full is ${selectedSum})`}
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}
                                      />
                                    </div>

                                    {/* Partial Payback Feedback Box */}
                                    {isPartial ? (
                                      <div style={{ fontSize: 11.5, color: '#d97706', background: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '8px 10px', borderRadius: 6, marginBottom: 10 }}>
                                        <div style={{ fontWeight: 700, marginBottom: 2 }}>⚡ Custom Partial Payback Active</div>
                                        <div>
                                          Receiving <strong>{fmtMoney(currentAmt, s.currency)}</strong> now. 
                                          The remaining <strong>{fmtMoney(diff, s.currency)}</strong> debt will stay active for {selectedFriend.name}.
                                        </div>
                                      </div>
                                    ) : currentAmt >= selectedSum && selectedSum > 0 ? (
                                      <div style={{ fontSize: 11.5, color: '#2e7d32', background: 'rgba(46, 125, 50, 0.12)', border: '1px solid rgba(46, 125, 50, 0.25)', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                                        ✓ Full payback of {fmtMoney(selectedSum, s.currency)} will completely clear this debt!
                                      </div>
                                    ) : null}

                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={autoSettle}
                                        onChange={e => setAutoSettle(e.target.checked)}
                                      />
                                      <span>Auto-update debt ledger upon saving</span>
                                    </label>
                                  </div>
                                );
                              })() : (
                                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.25)', borderRadius: 'var(--radius)', fontSize: 12, color: '#d97706', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <span>⚠️ Click a debt item above to link your payback (Full or Partial).</span>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ alignSelf: 'flex-start', fontSize: 11, padding: '3px 10px', height: 26 }}
                                    onClick={handleSettleAllDebts}
                                  >
                                    Select Debt ({fmtMoney(friendBal.owedToMe, s.currency)})
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 4 }}>
                              No specific pending bill splits logged. General repayment will directly update total friend ledger balance.
                            </div>
                          )}
                        </div>
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
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{
                background: flow === 'in'
                  ? 'linear-gradient(135deg, #2e7d32, #1b5e20)'
                  : undefined
              }}
            >
              {expense ? 'Save Changes' : flow === 'out' ? 'Record Expense' : 'Record Income'}
            </button>
          </div>
        </form>
      </div>

      {/* With Friends & Split Centered Dialog / Bottom Sheet Overlay */}
      {isFriendPickerOpen && (
        <div className="friend-picker-overlay" onClick={() => setIsFriendPickerOpen(false)}>
          <div className="friend-picker-sheet" onClick={e => e.stopPropagation()}>
            {/* Sheet Mobile Drag Handle */}
            <div className="friend-picker-handle">
              <div style={{ width: 36, height: 4.5, borderRadius: 99, background: 'var(--border2)' }} />
            </div>

            {/* Dialog Header */}
            <div
              style={{
                padding: '14px 18px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                  }}
                >
                  <Users size={17} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>
                    Split with Friends
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Select friends and choose split rule
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFriendPickerOpen(false)}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Merged Ultra-Sleek Search & Filter Bar */}
            <div style={{ padding: '0 18px 8px', background: 'var(--surface)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '3px 4px 3px 10px',
                }}
              >
                {/* Search Input Box */}
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 75, gap: 6 }}>
                  <Search size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 12,
                      color: 'var(--text)',
                      padding: '4px 0',
                    }}
                    placeholder="Search or add..."
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    autoFocus
                  />
                  {pickerSearch && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                      onClick={() => setPickerSearch('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Quick Add Button if typed search doesn't match existing */}
                {pickerSearch.trim() && !filteredPickerFriends.some(f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 10.5, padding: '2px 8px', height: 26, borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={() => {
                      const created = addFriend({ name: pickerSearch.trim(), type: 'friend' });
                      setSelectedFriendIds(prev => [...prev, created.id]);
                      showToast(`Added ${created.name}`);
                      setPickerSearch('');
                    }}
                  >
                    <Plus size={11} /> Add
                  </button>
                )}

                {/* Filter Segment Pills */}
                <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', padding: 2, borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}>
                  <button
                    type="button"
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 6,
                      border: 'none',
                      background: pickerTypeFilter === 'all' ? 'var(--accent)' : 'transparent',
                      color: pickerTypeFilter === 'all' ? 'var(--accent-contrast)' : 'var(--text-3)',
                      fontWeight: pickerTypeFilter === 'all' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      lineHeight: 1.2,
                    }}
                    onClick={() => setPickerTypeFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 6,
                      border: 'none',
                      background: pickerTypeFilter === 'friend' ? 'var(--accent)' : 'transparent',
                      color: pickerTypeFilter === 'friend' ? 'var(--accent-contrast)' : 'var(--text-3)',
                      fontWeight: pickerTypeFilter === 'friend' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      lineHeight: 1.2,
                    }}
                    onClick={() => setPickerTypeFilter('friend')}
                  >
                    Friends
                  </button>
                  <button
                    type="button"
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 6,
                      border: 'none',
                      background: pickerTypeFilter === 'vendor' ? 'var(--accent)' : 'transparent',
                      color: pickerTypeFilter === 'vendor' ? 'var(--accent-contrast)' : 'var(--text-3)',
                      fontWeight: pickerTypeFilter === 'vendor' ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      lineHeight: 1.2,
                    }}
                    onClick={() => setPickerTypeFilter('vendor')}
                  >
                    Stores
                  </button>
                </div>

                {/* Select All Action */}
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 10.5,
                    color: 'var(--accent)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onClick={() => {
                    if (selectedFriendIds.length === db.friends.length) {
                      setSelectedFriendIds([]);
                    } else {
                      const allIds = db.friends.map(f => f.id);
                      setSelectedFriendIds(allIds);
                      if (splitCalcMode === 'custom' && allIds.length > 0) {
                        const tot = parseFloat(amount) || 0;
                        const denom = isYouSelected ? allIds.length + 1 : allIds.length;
                        const equalVal = tot > 0 && denom > 0 ? String(Math.floor((tot * 100) / denom) / 100) : '0';
                        setCustomFriendShares(existing => {
                          const updated = { ...existing };
                          allIds.forEach(id => {
                            if (!updated[id] || isNaN(parseFloat(updated[id])) || parseFloat(updated[id]) <= 0) {
                              updated[id] = equalVal;
                            }
                          });
                          return updated;
                        });
                      }
                    }
                  }}
                >
                  {selectedFriendIds.length === db.friends.length ? 'Clear' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Equal / Dynamic Vertical Space: Friend Selection Section */}
            <div style={{ flex: splitCalcMode === 'custom' && selectedFriendIds.length > 2 ? 0.5 : (selectedFriendIds.length > 1 ? 0.7 : 1), minHeight: 0, overflowY: 'auto', padding: '6px 18px 10px', background: 'var(--surface)', transition: 'flex 0.2s ease' }}>
              {(() => {
                const showYouChip = (pickerTypeFilter === 'all' || pickerTypeFilter === 'friend') &&
                  (!pickerSearch.trim() || 'you'.includes(pickerSearch.toLowerCase().trim()) || 'me'.includes(pickerSearch.toLowerCase().trim()));
                const hasAnyItems = filteredPickerFriends.length > 0 || showYouChip;

                if (!hasAnyItems) {
                  return (
                    <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)' }}>
                      No matching friends found
                    </div>
                  );
                }

                return (
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 6 }}>
                      {showYouChip && (
                        <div
                          onClick={() => {
                            if (splitCalcMode === 'custom') {
                              setIncludeYouInCustom(!includeYouInCustom);
                            } else {
                              if (isYouSelected) {
                                handleSelectSplitCalcMode('equal_friends');
                              } else {
                                handleSelectSplitCalcMode('equal_all');
                              }
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '5px 8px',
                            borderRadius: 8,
                            background: isYouSelected ? 'var(--accent-soft)' : 'var(--surface)',
                            border: isYouSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.1s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                color: 'var(--accent-contrast)',
                                fontSize: 10,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              Y
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: isYouSelected ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              You (Me)
                            </span>
                          </div>

                          <div
                            style={{
                              width: 15,
                              height: 15,
                              borderRadius: '50%',
                              background: isYouSelected ? 'var(--accent)' : 'transparent',
                              border: isYouSelected ? 'none' : '1px solid var(--text-3)',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isYouSelected && <CheckCircle2 size={11} style={{ color: 'var(--accent-contrast)' }} />}
                          </div>
                        </div>
                      )}

                      {filteredPickerFriends.map(f => {
                        const isSel = selectedFriendIds.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            onClick={() => {
                              setSelectedFriendIds(prev => {
                                const isCurrentlySel = prev.includes(f.id);
                                const next = isCurrentlySel ? prev.filter(id => id !== f.id) : [...prev, f.id];
                                if (splitCalcMode === 'custom' && next.length > 0) {
                                  const tot = parseFloat(amount) || 0;
                                  const denom = isYouSelected ? next.length + 1 : next.length;
                                  const equalVal = tot > 0 && denom > 0 ? String(Math.floor((tot * 100) / denom) / 100) : '0';
                                  setCustomFriendShares(existing => {
                                    const updated = { ...existing };
                                    next.forEach(id => {
                                      if (!updated[id] || isNaN(parseFloat(updated[id])) || parseFloat(updated[id]) <= 0) {
                                        updated[id] = equalVal;
                                      }
                                    });
                                    return updated;
                                  });
                                }
                                return next;
                              });
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: 8,
                              background: isSel ? 'var(--accent-soft)' : 'var(--surface)',
                              border: isSel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                              cursor: 'pointer',
                              userSelect: 'none',
                              transition: 'all 0.1s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  ...getAvatarStyle(f.color),
                                  fontSize: 10,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {f.name[0]?.toUpperCase()}
                              </div>
                              <span style={{ fontSize: 11.5, fontWeight: isSel ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {f.name}
                              </span>
                            </div>

                            <div
                              style={{
                                width: 15,
                                height: 15,
                                borderRadius: '50%',
                                background: isSel ? 'var(--accent)' : 'transparent',
                                border: isSel ? 'none' : '1px solid var(--text-3)',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isSel && <CheckCircle2 size={11} style={{ color: 'var(--accent-contrast)' }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Dynamic Vertical Space: Split Rule Section */}
            <div style={{ flex: splitCalcMode === 'custom' && selectedFriendIds.length > 2 ? 1.8 : (selectedFriendIds.length > 1 ? 1.4 : 1), minHeight: 0, overflowY: 'auto', background: 'var(--surface)', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'flex 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Split Rule
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                  {selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''} Selected
                </span>
              </div>

              {/* Seamless Segmented Tab Controller */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--surface2)',
                  padding: 3,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectSplitCalcMode('equal_all')}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    border: 'none',
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: splitCalcMode === 'equal_all' ? 700 : 500,
                    background: splitCalcMode === 'equal_all' ? 'var(--accent)' : 'transparent',
                    color: splitCalcMode === 'equal_all' ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSplitCalcMode('equal_friends')}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    border: 'none',
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: splitCalcMode === 'equal_friends' ? 700 : 500,
                    background: splitCalcMode === 'equal_friends' ? 'var(--accent)' : 'transparent',
                    color: splitCalcMode === 'equal_friends' ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selectedFriendIds.length === 1 ? '100% Friend' : 'Friends Only'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSplitCalcMode('custom')}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    border: 'none',
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: splitCalcMode === 'custom' ? 700 : 500,
                    background: splitCalcMode === 'custom' ? 'var(--accent)' : 'transparent',
                    color: splitCalcMode === 'custom' ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Custom
                </button>
              </div>

              {/* Custom Amounts List (only if Custom mode) */}
              {splitCalcMode === 'custom' && selectedFriendIds.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: selectedFriendIds.length > 4 ? 260 : (selectedFriendIds.length > 2 ? 200 : 130),
                    overflowY: 'auto',
                    padding: '8px 10px',
                    background: 'var(--surface2)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}
                >
                  {selectedFriendIds.map(fId => {
                    const friendObj = db.friends.find(f => f.id === fId);
                    if (!friendObj) return null;
                    const currentVal = getFriendShare(fId);
                    const valStr = customFriendShares[fId] ?? (isNaN(currentVal) ? '' : String(currentVal));
                    return (
                      <div key={fId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {friendObj.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{s.currency}</span>
                          <input
                            type="number"
                            step="any"
                            style={{
                              width: 85,
                              height: 30,
                              fontSize: 12.5,
                              fontWeight: 600,
                              padding: '2px 8px',
                              textAlign: 'right',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface2)',
                              color: 'var(--text-1)',
                              outline: 'none',
                            }}
                            value={valStr}
                            onChange={e => setCustomFriendShares(prev => ({ ...prev, [fId]: e.target.value }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Breakdown Card (without progress bar) */}
              {selectedFriendIds.length > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {(() => {
                    const tot = parseFloat(amount) || 0;
                    const myShare = Math.max(0, tot - totalFriendsShare);
                    const perFriend = selectedFriendIds.length > 0 ? totalFriendsShare / selectedFriendIds.length : 0;

                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                          <span style={{ color: 'var(--text-2)' }}>My Share:</span>
                          <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtMoney(myShare, s.currency)}</strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--credit)' }} />
                          <span style={{ color: 'var(--text-2)' }}>Friends Owe:</span>
                          <strong style={{ color: 'var(--credit)', fontWeight: 700 }}>
                            {fmtMoney(totalFriendsShare, s.currency)}
                            {selectedFriendIds.length > 1 && (
                              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>
                                ({fmtMoney(perFriend, s.currency)}/ea)
                              </span>
                            )}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '12px 18px', background: 'var(--surface)', borderTop: 'none', display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, padding: '8px', fontSize: 12.5 }}
                onClick={() => setIsFriendPickerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ flex: 2, padding: '8px', fontSize: 12.5, fontWeight: 700 }}
                onClick={() => setIsFriendPickerOpen(false)}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
