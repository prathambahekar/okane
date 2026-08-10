import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingDown, TrendingUp, User, Users, Briefcase, CheckSquare, Square, HeartHandshake, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, FileText, Plus, Search } from 'lucide-react';
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
  date?: string;
  notes?: string;
}

interface Props {
  expense?: Expense | null;
  initialData?: ExpenseInitialData;
  isTutorialMode?: boolean;
  onClose: () => void;
}

export default function ExpenseModal({ expense, initialData, isTutorialMode, onClose }: Props) {
  const { db, addExpense, updateExpense, deleteExpense, showToast } = useStore();
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
  const forFriendItem = grpItems.find(e => e.type === 'for_friend');

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
  const [walletId, setWalletId] = useState(initialData?.walletId ?? expense?.walletId ?? s.defaultWalletId);
  const [status, setStatus] = useState<ExpenseStatus>(expense?.status ?? s.defaultStatus);
  const [notes, setNotes] = useState(initialData?.notes ?? expense?.notes ?? '');
  const [showNotes, setShowNotes] = useState(() => Boolean(initialData?.notes || expense?.notes));
  const [error, setError] = useState('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [autoSettle, setAutoSettle] = useState(true);

  // Multi-friend selection state for splitting expenses
  const initialFriendIds = useMemo(() => {
    if (initialData?.friendId) return [initialData.friendId];
    if (expense?.groupId) {
      const items = db.expenses.filter(e => e.groupId === expense.groupId && e.type === 'for_friend');
      if (items.length > 0) return items.map(e => e.friendId).filter(Boolean) as string[];
    }
    const fId = forFriendItem?.friendId ?? expense?.friendId;
    return fId ? [fId] : [];
  }, [db.expenses, expense, forFriendItem, initialData]);

  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(initialFriendIds);
  const [showSplitCustom, setShowSplitCustom] = useState(false);
  const [splitCalcMode, setSplitCalcMode] = useState<'equal_all' | 'equal_friends' | 'custom'>('equal_all');

  // Friend Picker Dialog state
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>('all');

  // Top 4 friends computation
  const topFriends = useMemo(() => {
    const counts: Record<string, number> = {};
    db.expenses.forEach(e => {
      if (e.friendId) counts[e.friendId] = (counts[e.friendId] || 0) + 1;
    });
    return [...db.friends]
      .sort((a, b) => {
        const ca = counts[a.id] || 0;
        const cb = counts[b.id] || 0;
        if (cb !== ca) return cb - ca;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 4);
  }, [db.friends, db.expenses]);

  // Visible pills on form: Top 4 + any selected friends outside top 4
  const visiblePillFriends = useMemo(() => {
    const topIds = new Set(topFriends.map(f => f.id));
    const extraSelected = db.friends.filter(f => selectedFriendIds.includes(f.id) && !topIds.has(f.id));
    return [...topFriends, ...extraSelected];
  }, [topFriends, selectedFriendIds, db.friends]);

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
  const [customFriendShares, setCustomFriendShares] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (expense?.groupId) {
      const items = db.expenses.filter(e => e.groupId === expense.groupId && e.type === 'for_friend');
      items.forEach(e => {
        if (e.friendId) init[e.friendId] = String(e.amount);
      });
    } else if (initialFriendShare && initialFriendId) {
      init[initialFriendId] = initialFriendShare;
    }
    return init;
  });

  const getFriendShare = (fId: string): number => {
    const tot = parseFloat(amount) || 0;
    const n = selectedFriendIds.length;
    if (n === 0 || tot <= 0) return 0;

    if (splitCalcMode === 'equal_all') {
      return Math.round((tot / (n + 1)) * 100) / 100;
    }
    if (splitCalcMode === 'equal_friends') {
      return Math.round((tot / n) * 100) / 100;
    }
    const customVal = parseFloat(customFriendShares[fId] ?? '');
    if (!isNaN(customVal) && customVal >= 0) return customVal;
    return Math.round((tot / (n + 1)) * 100) / 100;
  };

  const totalFriendsShare = useMemo(() => {
    const tot = parseFloat(amount) || 0;
    const n = selectedFriendIds.length;
    if (n === 0 || tot <= 0) return 0;

    return selectedFriendIds.reduce((sum, fId) => {
      let val = 0;
      if (splitCalcMode === 'equal_all') {
        val = Math.round((tot / (n + 1)) * 100) / 100;
      } else if (splitCalcMode === 'equal_friends') {
        val = Math.round((tot / n) * 100) / 100;
      } else {
        const customVal = parseFloat(customFriendShares[fId] ?? '');
        val = !isNaN(customVal) && customVal >= 0 ? customVal : Math.round((tot / (n + 1)) * 100) / 100;
      }
      return sum + val;
    }, 0);
  }, [selectedFriendIds, amount, splitCalcMode, customFriendShares]);

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
            walletId,
            status: 'unsettled',
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
          status: 'paid',
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
          <button className="btn-icon compact-close-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
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
                    <>
                      <div className="form-group" style={{ marginBottom: 6, animation: 'fadein 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0, fontSize: 11.5 }}>
                            Select Friends {selectedFriendIds.length > 0 && `(${selectedFriendIds.length})`}
                          </label>
                          {selectedFriendIds.length > 0 && (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--debit)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                              onClick={() => setSelectedFriendIds([])}
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {/* Top Friends Pills + More Button (Flex Wrapped, No Horizontal Overflow) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 0 4px' }}>
                          {visiblePillFriends.map(f => {
                            const isSel = selectedFriendIds.includes(f.id);
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setSelectedFriendIds(prev =>
                                    prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                                  );
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 10px 3px 4px',
                                  borderRadius: 99,
                                  background: isSel ? 'var(--accent)' : 'var(--surface2)',
                                  color: isSel ? 'var(--accent-contrast)' : 'var(--text-1)',
                                  border: isSel ? 'none' : '1px solid var(--border)',
                                  fontSize: 12,
                                  fontWeight: isSel ? 600 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    ...getAvatarStyle(f.color),
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {f.name[0]?.toUpperCase()}
                                </div>
                                <span>{f.name}</span>
                                {isSel && <CheckCircle2 size={12} />}
                              </button>
                            );
                          })}

                          {/* Dialog Launcher Button for All / More Friends */}
                          {db.friends.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setIsFriendPickerOpen(true)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 10px',
                                borderRadius: 99,
                                background: 'var(--surface2)',
                                color: 'var(--accent)',
                                border: '1px dashed var(--accent)',
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                              }}
                            >
                              <Plus size={13} />
                              {db.friends.length > visiblePillFriends.length
                                ? `+${db.friends.length - visiblePillFriends.length} More`
                                : 'All Friends'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Compact Split Summary Bar */}
                      {selectedFriendIds.length > 0 && (
                        <div style={{ marginBottom: 8, animation: 'fadein 0.15s ease' }}>
                          <div className="flex-between" style={{ padding: '5px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11.5 }}>
                            <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                              Split ({selectedFriendIds.length + (splitCalcMode === 'equal_all' ? 1 : 0)} people):{' '}
                              <strong style={{ color: 'var(--accent)' }}>
                                {fmtMoney(splitCalcMode === 'equal_all' ? (Number(amount) || 0) / (selectedFriendIds.length + 1) : totalFriendsShare, s.currency)}
                              </strong>{' '}
                              / person
                            </span>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                              onClick={() => setShowSplitCustom(!showSplitCustom)}
                            >
                              {showSplitCustom ? 'Hide Split' : 'Custom Split'}
                            </button>
                          </div>

                          {showSplitCustom && (
                            <div style={{ marginTop: 6, padding: 8, background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', animation: 'fadein 0.15s ease' }}>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${splitCalcMode === 'equal_all' ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ flex: 1, fontSize: 10.5, padding: '3px' }}
                                  onClick={() => setSplitCalcMode('equal_all')}
                                >
                                  Equal Split
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${splitCalcMode === 'equal_friends' ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ flex: 1, fontSize: 10.5, padding: '3px' }}
                                  onClick={() => setSplitCalcMode('equal_friends')}
                                >
                                  100% Friend
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${splitCalcMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ flex: 1, fontSize: 10.5, padding: '3px' }}
                                  onClick={() => setSplitCalcMode('custom')}
                                >
                                  Custom
                                </button>
                              </div>

                              {splitCalcMode === 'custom' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {selectedFriendIds.map(fId => {
                                    const friendObj = db.friends.find(f => f.id === fId);
                                    if (!friendObj) return null;
                                    const currentVal = getFriendShare(fId);
                                    return (
                                      <div key={fId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                                        <span>{friendObj.name}</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          className="form-input"
                                          style={{ width: 75, height: 24, fontSize: 11.5, padding: '2px 6px', textAlign: 'right' }}
                                          value={customFriendShares[fId] ?? (isNaN(currentVal) ? '' : String(currentVal))}
                                          onChange={e => setCustomFriendShares(prev => ({ ...prev, [fId]: e.target.value }))}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
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

                  {/* Paid From (Wallet) & Status — ONLY shown when I Paid! */}
                  {whoPaid === 'me' && (
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Paid From (Wallet)</label>
                        <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                          {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      {splitMode === 'just_me' && (
                        <div className="form-group">
                          <label className="form-label">Status</label>
                          <select className="form-select" value={status} onChange={e => setStatus(e.target.value as ExpenseStatus)}>
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                          </select>
                        </div>
                      )}
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
                        <Briefcase size={16} /> Salary / Allowance
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

      {/* Friend Picker Overlay Dialog */}
      {isFriendPickerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadein 0.15s ease',
          }}
          onClick={() => setIsFriendPickerOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl, 16px)',
              width: '100%',
              maxWidth: '400px',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                  Select Friends
                </h3>
                <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 99, color: 'var(--accent)', fontWeight: 600, border: '1px solid var(--border)' }}>
                  {selectedFriendIds.length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFriendPickerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Dialog Search & Filter Controls */}
            <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: 12.5, height: 34, borderRadius: 'var(--radius)' }}
                  placeholder="Search friends or stores..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  autoFocus
                />
                {pickerSearch && (
                  <button
                    type="button"
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
                    onClick={() => setPickerSearch('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Quick Filter & Select All */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    type="button"
                    style={{
                      fontSize: 10.5,
                      padding: '3px 9px',
                      borderRadius: 99,
                      border: '1px solid var(--border)',
                      background: pickerTypeFilter === 'all' ? 'var(--accent)' : 'var(--surface2)',
                      color: pickerTypeFilter === 'all' ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontWeight: pickerTypeFilter === 'all' ? 600 : 500,
                      cursor: 'pointer',
                    }}
                    onClick={() => setPickerTypeFilter('all')}
                  >
                    All ({db.friends.length})
                  </button>
                  <button
                    type="button"
                    style={{
                      fontSize: 10.5,
                      padding: '3px 9px',
                      borderRadius: 99,
                      border: '1px solid var(--border)',
                      background: pickerTypeFilter === 'friend' ? 'var(--accent)' : 'var(--surface2)',
                      color: pickerTypeFilter === 'friend' ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontWeight: pickerTypeFilter === 'friend' ? 600 : 500,
                      cursor: 'pointer',
                    }}
                    onClick={() => setPickerTypeFilter('friend')}
                  >
                    Friends
                  </button>
                  <button
                    type="button"
                    style={{
                      fontSize: 10.5,
                      padding: '3px 9px',
                      borderRadius: 99,
                      border: '1px solid var(--border)',
                      background: pickerTypeFilter === 'vendor' ? 'var(--accent)' : 'var(--surface2)',
                      color: pickerTypeFilter === 'vendor' ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontWeight: pickerTypeFilter === 'vendor' ? 600 : 500,
                      cursor: 'pointer',
                    }}
                    onClick={() => setPickerTypeFilter('vendor')}
                  >
                    Stores
                  </button>
                </div>

                <button
                  type="button"
                  style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => {
                    if (selectedFriendIds.length === db.friends.length) {
                      setSelectedFriendIds([]);
                    } else {
                      setSelectedFriendIds(db.friends.map(f => f.id));
                    }
                  }}
                >
                  {selectedFriendIds.length === db.friends.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Scrollable Friends List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {filteredPickerFriends.length > 0 ? (
                filteredPickerFriends.map(f => {
                  const isSel = selectedFriendIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedFriendIds(prev =>
                          prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius)',
                        background: isSel ? 'var(--accent-soft)' : 'var(--surface2)',
                        border: isSel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            ...getAvatarStyle(f.color),
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {f.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: isSel ? 600 : 500, color: 'var(--text-1)' }}>
                            {f.name}
                          </div>
                          {f.type && f.type !== 'friend' && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                              {f.type === 'vendor' ? 'Store / Vendor' : f.type}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: isSel ? 'var(--accent)' : 'transparent',
                          border: isSel ? 'none' : '1.5px solid var(--text-3)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSel && <CheckCircle2 size={14} style={{ color: 'var(--accent-contrast)' }} />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
                  {pickerSearch ? `No contacts matching "${pickerSearch}"` : 'No friends added yet'}
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '6px 20px', fontSize: 13, borderRadius: 'var(--radius)' }}
                onClick={() => setIsFriendPickerOpen(false)}
              >
                Done ({selectedFriendIds.length} Selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
