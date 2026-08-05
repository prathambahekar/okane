import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingDown, TrendingUp, User, Users, Briefcase, CheckSquare, Square, Search, HeartHandshake } from 'lucide-react';
import { useStore } from '../store';
import type { Expense, ExpenseType, ExpenseFlow, ExpenseStatus } from '../types';
import { todayISO, uid, friendBalance, unsettledExpensesForFriend } from '../db';
import { currencySymbol, fmtMoney } from '../utils';

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
  onClose: () => void;
}

export default function ExpenseModal({ expense, initialData, onClose }: Props) {
  const { db, addExpense, updateExpense, deleteExpense, showToast } = useStore();
  const s = db.settings;

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

  const initialVendorId = expense?.vendorId ?? (expense?.friendId && db.friends.find(f => f.id === expense.friendId)?.type === 'vendor' ? expense.friendId : '');
  const [selectedVendorId, setSelectedVendorId] = useState<string>(initialVendorId);
  const [vendorPaymentStatus, setVendorPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [contactTypeFilter, setContactTypeFilter] = useState<'all' | 'friend' | 'vendor'>('all');

  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(initialFriendIds);
  const [friendSearch, setFriendSearch] = useState('');
  const [splitCalcMode, setSplitCalcMode] = useState<'equal_all' | 'equal_friends' | 'custom'>('equal_all');
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

  const filteredFriends = useMemo(() => {
    let list = db.friends;
    if (contactTypeFilter !== 'all') {
      list = list.filter(f => (f.type || 'friend') === contactTypeFilter);
    }
    if (friendSearch.trim()) {
      const q = friendSearch.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [db.friends, contactTypeFilter, friendSearch]);

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

  const myCalculatedShare = Math.max(0, (parseFloat(amount) || 0) - totalFriendsShare);

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
    ? (incomeMode === 'friend' ? 'by_friend' : 'personal')
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

      const targetType: ExpenseType = incomeMode === 'friend' ? 'by_friend' : 'personal';

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
        notes,
        groupId: null,
      };

      if (autoSettle && selectedExpenseIds.length > 0) {
        selectedExpenseIds.forEach(id => {
          updateExpense(id, { settled: true });
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
        selectedExpenseIds.forEach(id => {
          updateExpense(id, { settled: true });
        });
      }

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

      const isUnpaidVendor = Boolean(selectedVendorId && vendorPaymentStatus === 'unpaid');

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
            vendorId: selectedVendorId || null,
            walletId: isUnpaidVendor ? '' : walletId,
            status: 'unsettled',
            notes,
          });
        }
      });

      if (selectedVendorId && vendorPaymentStatus === 'unpaid') {
        const vObj = db.friends.find(f => f.id === selectedVendorId);
        const vName = vObj?.name || 'Vendor';
        addExpense({
          groupId: targetGroupId,
          description: `${finalDesc} (${vName} Bill)`,
          amount: totalAmt,
          category,
          date,
          type: 'by_friend',
          flow: 'out',
          friendId: selectedVendorId,
          vendorId: selectedVendorId,
          walletId: '',
          status: 'unsettled',
          notes: notes ? `${notes} (Unpaid vendor bill)` : `Unpaid bill to ${vName}`,
        });
      }

      if (myShare > 0) {
        const isUnpaidVendor = Boolean(selectedVendorId && vendorPaymentStatus === 'unpaid');
        addExpense({
          groupId: targetGroupId,
          description: finalDesc,
          amount: myShare,
          category,
          date,
          type: 'personal',
          flow,
          friendId: selectedVendorId || null,
          vendorId: selectedVendorId || null,
          walletId: isUnpaidVendor ? '' : walletId,
          status: isUnpaidVendor ? 'unpaid' : 'paid',
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
      <div className="modal">
        {/* Drag Handle Indicator for Mobile Bottom Sheet */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        <div className="modal-header">
          <span className="modal-title">{expense ? 'Edit Transaction' : flow === 'out' ? 'Record Expense' : 'Record Income'}</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>

        {/* Expense / Income Flow Switcher */}
        <div className="flow-switcher">
          <button
            type="button"
            className={`flow-tab ${flow === 'out' ? 'active-out' : ''}`}
            onClick={() => {
              setFlow('out');
              setError('');
            }}
          >
            <TrendingDown size={18} /> Expense
          </button>
          <button
            type="button"
            className={`flow-tab ${flow === 'in' ? 'active-in' : ''}`}
            onClick={() => {
              setFlow('in');
              setError('');
            }}
          >
            <TrendingUp size={18} /> Income
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                  {/* Who Paid Primary Switcher */}
                  <div className="form-group">
                    <label className="form-label">Who Paid?</label>
                    <div className="segment-control">
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'me' ? 'active' : ''}`}
                        onClick={() => { setWhoPaid('me'); setError(''); }}
                      >
                        <User size={16} /> I Paid
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'other' ? 'active' : ''}`}
                        onClick={() => { setWhoPaid('other'); setError(''); }}
                      >
                        <Users size={16} /> Someone Else Paid
                      </button>
                    </div>
                  </div>

                  {/* Progressive Disclosure: If I Paid */}
                  {whoPaid === 'me' && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <label className="form-label">Expense Scope</label>
                      <div className="segment-control stacked">
                        <button
                          type="button"
                          className={`segment-btn ${splitMode === 'just_me' ? 'active' : ''}`}
                          onClick={() => { setSplitMode('just_me'); setSelectedExpenseIds([]); }}
                        >
                          <User size={17} />
                          <span>Just For Me</span>
                        </button>
                        <button
                          type="button"
                          className={`segment-btn ${splitMode === 'for_friend' ? 'active' : ''}`}
                          onClick={() => {
                            setSplitMode('for_friend');
                            setSelectedExpenseIds([]);
                            if (!friendShare && amount) setFriendShare(amount);
                          }}
                        >
                          <Users size={17} />
                          <span>With Friends / Group</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional Contact/Vendor Selector for Personal Expense */}
                  {whoPaid === 'me' && splitMode === 'just_me' && db.friends.length > 0 && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <label className="form-label">Contact / Store (Optional)</label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">— Personal Expense —</option>
                        {db.friends.map(f => {
                          const t = f.type || 'friend';
                          const tag = t === 'vendor' ? ' (Store/Vendor)' : t === 'subscription' ? ' (Sub)' : '';
                          return <option key={f.id} value={f.id}>{f.name}{tag}</option>;
                        })}
                      </select>
                    </div>
                  )}

                  {/* Vendor / Merchant Selector for Split Expense */}
                  {whoPaid === 'me' && splitMode === 'for_friend' && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease', marginBottom: 14 }}>
                      <label className="form-label">Store / Merchant (Optional)</label>
                      <select
                        className="form-select"
                        value={selectedVendorId}
                        onChange={e => {
                          const vId = e.target.value;
                          setSelectedVendorId(vId);
                          if (vId) {
                            const v = db.friends.find(f => f.id === vId);
                            if (v?.category) setCategory(v.category);
                          }
                        }}
                      >
                        <option value="">— Direct / No Specific Store —</option>
                        {db.friends.map(f => {
                          const t = f.type || 'friend';
                          const tag = t === 'vendor' ? ' (Vendor)' : t === 'subscription' ? ' (Sub)' : '';
                          return <option key={f.id} value={f.id}>{f.name}{tag}</option>;
                        })}
                      </select>

                      {selectedVendorId && (
                        <div style={{ marginTop: 8, background: 'var(--surface2)', border: '1px solid var(--border)', padding: 10, borderRadius: 'var(--radius)' }}>
                          <label className="form-label" style={{ fontSize: 11.5, marginBottom: 6 }}>Payment to Merchant</label>
                          <div className="segment-control">
                            <button
                              type="button"
                              className={`segment-btn ${vendorPaymentStatus === 'paid' ? 'active' : ''}`}
                              onClick={() => setVendorPaymentStatus('paid')}
                            >
                              <span>Paid Upfront</span>
                            </button>
                            <button
                              type="button"
                              className={`segment-btn ${vendorPaymentStatus === 'unpaid' ? 'active' : ''}`}
                              onClick={() => setVendorPaymentStatus('unpaid')}
                            >
                              <span>On Credit / Unpaid</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Friend Selection & Custom Split Share: If Split with Friend */}
                  {whoPaid === 'me' && splitMode === 'for_friend' && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label className="form-label" style={{ margin: 0 }}>Select Friends *</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {selectedFriendIds.length > 0 && (
                            <span style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent)', fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>
                              {selectedFriendIds.length} selected
                            </span>
                          )}
                          {db.friends.length > 0 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6 }}
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
                          )}
                        </div>
                      </div>

                      {/* Clean Search & Category Filter Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                          <input
                            type="text"
                            className="form-input"
                            style={{ paddingLeft: 30, fontSize: 12.5, height: 34, borderRadius: 'var(--radius)' }}
                            placeholder="Search friends..."
                            value={friendSearch}
                            onChange={e => setFriendSearch(e.target.value)}
                          />
                          {friendSearch && (
                            <button
                              type="button"
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
                              onClick={() => setFriendSearch('')}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {/* Filter Tabs */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${contactTypeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 10.5, padding: '2px 10px', borderRadius: 99 }}
                            onClick={() => setContactTypeFilter('all')}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${contactTypeFilter === 'friend' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 10.5, padding: '2px 10px', borderRadius: 99 }}
                            onClick={() => setContactTypeFilter('friend')}
                          >
                            Friends
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${contactTypeFilter === 'vendor' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 10.5, padding: '2px 10px', borderRadius: 99 }}
                            onClick={() => setContactTypeFilter('vendor')}
                          >
                            Stores
                          </button>
                        </div>
                      </div>

                      {/* Clean Grid / Tile List of Friends */}
                      <div
                        style={{
                          maxHeight: 190,
                          overflowY: 'auto',
                          paddingRight: 2,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                          gap: 6,
                        }}
                      >
                        {filteredFriends.length > 0 ? (
                          filteredFriends.map(f => {
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
                                  gap: 8,
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius)',
                                  background: isSel ? 'rgba(56, 189, 248, 0.08)' : 'var(--surface2)',
                                  border: isSel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <div
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    background: f.color || 'var(--accent)',
                                    color: f.color ? '#fff' : 'var(--accent-contrast)',
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
                                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                  <div style={{
                                    fontSize: 12.5,
                                    fontWeight: isSel ? 600 : 500,
                                    color: 'var(--text-1)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {f.name}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: isSel ? 'var(--accent)' : 'transparent',
                                    border: isSel ? 'none' : '1.5px solid var(--text-3)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isSel && <CheckSquare size={12} style={{ color: 'var(--accent-contrast)' }} />}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                            {friendSearch ? `No friends matching "${friendSearch}"` : 'No friends added yet'}
                          </div>
                        )}
                      </div>

                      {/* Multi-Friend Split Calculation Breakdown */}
                      {selectedFriendIds.length > 0 && (
                        <div style={{ animation: 'fadein 0.15s ease', marginTop: 14 }}>
                          <label className="form-label" style={{ marginBottom: 6 }}>How to Divide Bill?</label>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${splitCalcMode === 'equal_all' ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ flex: 1, fontSize: 11, padding: '6px 4px', textTransform: 'none' }}
                              onClick={() => setSplitCalcMode('equal_all')}
                            >
                              Split Equally
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${splitCalcMode === 'equal_friends' ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ flex: 1, fontSize: 11, padding: '6px 4px', textTransform: 'none' }}
                              onClick={() => setSplitCalcMode('equal_friends')}
                            >
                              100% For Friend
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${splitCalcMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ flex: 1, fontSize: 11, padding: '6px 4px', textTransform: 'none' }}
                              onClick={() => setSplitCalcMode('custom')}
                            >
                              Custom Amounts
                            </button>
                          </div>

                          <div
                            style={{
                              background: 'var(--surface2)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-lg)',
                              padding: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                              <span>Shares Breakdown ({selectedFriendIds.length + (splitCalcMode === 'equal_all' ? 1 : 0)} people)</span>
                              <span style={{ color: 'var(--accent)' }}>
                                Total Owed: {fmtMoney(totalFriendsShare, s.currency)}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {splitCalcMode !== 'equal_friends' && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>You (Personal Share)</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>
                                    {fmtMoney(myCalculatedShare, s.currency)}
                                  </span>
                                </div>
                              )}

                              {selectedFriendIds.map(fId => {
                                const friendObj = db.friends.find(f => f.id === fId);
                                if (!friendObj) return null;
                                const currentVal = getFriendShare(fId);

                                return (
                                  <div
                                    key={fId}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      borderRadius: 'var(--radius)',
                                      background: 'var(--surface)',
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                      <div
                                        style={{
                                          width: 22,
                                          height: 22,
                                          borderRadius: '50%',
                                          background: friendObj.color || 'var(--accent)',
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {friendObj.name[0]?.toUpperCase()}
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {friendObj.name}
                                      </span>
                                    </div>

                                    {splitCalcMode === 'custom' ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{currencySymbol(s.currency)}</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          className="form-input"
                                          style={{ width: 85, height: 28, fontSize: 12, padding: '2px 6px', textAlign: 'right' }}
                                          value={customFriendShares[fId] ?? String(currentVal)}
                                          onChange={e => {
                                            setCustomFriendShares(prev => ({ ...prev, [fId]: e.target.value }));
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
                                        {fmtMoney(currentVal, s.currency)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}



                  {/* Friend Selection: If Someone Else Paid */}
                  {whoPaid === 'other' && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <label className="form-label">Who Paid For You? *</label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">— select friend who paid —</option>
                        {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <p className="form-hint" style={{ marginTop: 2 }}>
                        You will owe this friend the amount recorded. Money will not be deducted from your wallet.
                      </p>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Description / Item *</label>
                    <input
                      className="form-input"
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder={splitMode === 'pay_debt' ? "e.g. Settling dinner debt" : "What did you spend on?"}
                    />
                    {mostUsedDescriptions.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>Frequent:</span>
                        {mostUsedDescriptions.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-lg)',
                              borderColor: desc === suggestion ? 'var(--accent)' : undefined,
                              background: desc === suggestion ? 'var(--surface2)' : undefined,
                              color: desc === suggestion ? 'var(--accent)' : 'var(--text-2)',
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
                        <label className="form-label">Income Source / Name *</label>
                        <input
                          className="form-input"
                          value={desc}
                          onChange={e => setDesc(e.target.value)}
                          placeholder="e.g. Monthly Salary, Pocket Money from Parents"
                        />
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
                            setSelectedExpenseIds([]);
                            const foundFriend = db.friends.find(f => f.id === fid);
                            if (foundFriend) {
                              setDesc(`Debt repayment from ${foundFriend.name}`);
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
                                  background: selectedFriend.color || 'var(--accent)',
                                  color: '#fff',
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

                              {selectedExpenseIds.length > 0 && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={autoSettle}
                                    onChange={e => setAutoSettle(e.target.checked)}
                                  />
                                  <span>Mark {selectedExpenseIds.length > 1 ? 'these debts' : 'this debt'} as settled in friend ledger</span>
                                </label>
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

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>

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
    </div>,
    document.body
  );
}
