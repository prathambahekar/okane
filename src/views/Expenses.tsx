import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronDown, ChevronUp, ChevronRight, Filter, Users, Layers, ArrowUpRight, ArrowDownLeft, RotateCcw, User, ReceiptText, Wallet, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import type { Expense } from '../types';
import { fmtMoney, fmtDate, typeLabel, statusLabel, friendInitial, getAvatarStyle, groupExpenses, cleanExpenseDescription } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CategoryIcon, { CategoryBadge } from '../components/CategoryIcon';

export default function Expenses() {
  const { db, deleteExpense, unsettleExpense, showToast } = useStore();
  const { expenses, settings: { currency } } = db;

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [flowFilter, setFlowFilter] = useState('');
  const [walletFilter, setWalletFilter] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [undoExpId, setUndoExpId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const activeFilterCount = (catFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (walletFilter ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDateCollapse = (dateStr: string) => {
    setCollapsedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const handleUnsettleConfirm = () => {
    if (!undoExpId) return;
    unsettleExpense(undoExpId);
    setUndoExpId(null);
  };

  const grouped = useMemo(() => groupExpenses(expenses, db.wallets, db.friends), [expenses, db.wallets, db.friends]);

  const filtered = useMemo(() => {
    let arr = [...grouped];
    if (search) {
      const q = search.toLowerCase().trim();
      arr = arr.filter(ge => {
        if (ge.description.toLowerCase().includes(q)) return true;
        if (cleanExpenseDescription(ge.description).toLowerCase().includes(q)) return true;
        if (ge.category.toLowerCase().includes(q)) return true;
        if (ge.settlementDateRange && ge.settlementDateRange.toLowerCase().includes(q)) return true;

        const walletObj = db.wallets.find(w => w.id === ge.walletId);
        if (walletObj && walletObj.name.toLowerCase().includes(q)) return true;

        if (ge.friendIds.some(fId => {
          const f = db.friends.find(fr => fr.id === fId);
          return f && f.name.toLowerCase().includes(q);
        })) return true;

        if (ge.settlementId) {
          const stl = db.settlements.find(s => s.id === ge.settlementId);
          if (stl) {
            if (stl.note && stl.note.toLowerCase().includes(q)) return true;
            if (stl.date && stl.date.includes(q)) return true;
            if (stl.paymentMethod && stl.paymentMethod.toLowerCase().includes(q)) return true;
            if (String(stl.amount).includes(q)) return true;
            if (stl.originalTotal && String(stl.originalTotal).includes(q)) return true;
            if (stl.friendId) {
              const f = db.friends.find(fr => fr.id === stl.friendId);
              if (f && f.name.toLowerCase().includes(q)) return true;
            }
          }
        }

        return ge.items.some(i => {
          if (i.description.toLowerCase().includes(q)) return true;
          if (cleanExpenseDescription(i.description).toLowerCase().includes(q)) return true;
          if (i.notes && i.notes.toLowerCase().includes(q)) return true;
          if (i.category && i.category.toLowerCase().includes(q)) return true;
          if (i.date && i.date.includes(q)) return true;
          if (i.originalDate && i.originalDate.includes(q)) return true;
          if (String(i.amount).includes(q)) return true;
          if (i.originalAmount && String(i.originalAmount).includes(q)) return true;
          if (i.friendId) {
            const f = db.friends.find(fr => fr.id === i.friendId);
            if (f && f.name.toLowerCase().includes(q)) return true;
          }
          return false;
        });
      });
    }
    if (catFilter) arr = arr.filter(ge => ge.category === catFilter);
    if (typeFilter) {
      arr = arr.filter(ge =>
        ge.items.some(i => i.type === typeFilter) || (typeFilter === 'for_friend' && ge.isSplit)
      );
    }
    if (statusFilter) {
      if (statusFilter === 'settled') arr = arr.filter(ge => ge.items.every(i => i.settled));
      else arr = arr.filter(ge => ge.items.some(i => !i.settled && i.status === statusFilter));
    }
    if (flowFilter) arr = arr.filter(ge => ge.flow === flowFilter);
    if (walletFilter) arr = arr.filter(ge => ge.walletId === walletFilter);

    arr.sort((a, b) => {
      switch (sort) {
        case 'date-desc': return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
        case 'date-asc': return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
        case 'amount-desc': return b.totalAmount - a.totalAmount;
        case 'amount-asc': return a.totalAmount - b.totalAmount;
        default: return 0;
      }
    });
    return arr;
  }, [grouped, search, catFilter, typeFilter, statusFilter, flowFilter, walletFilter, sort, db.wallets, db.friends, db.settlements]);

  const dateGroupInfo = useMemo(() => {
    const groupMap: Record<string, number> = {};
    const isFirstMap: Record<string, boolean> = {};
    let currentGroup = 0;
    let prevDate: string | null = null;

    filtered.forEach((ge) => {
      if (prevDate !== null && ge.date !== prevDate) {
        currentGroup++;
        isFirstMap[ge.id] = true;
      } else {
        isFirstMap[ge.id] = prevDate === null;
      }
      groupMap[ge.id] = currentGroup % 2;
      prevDate = ge.date;
    });

    return { groupMap, isFirstMap };
  }, [filtered]);

  const handleDelete = (id: string) => {
    deleteExpense(id);
    setDelId(null);
    showToast('Expense deleted & money restored to wallet');
  };

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
        </div>
        <button className="btn btn-primary desktop-only" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Spent / Received Main Tabs */}
      <div className="tab-list" style={{ marginBottom: 14 }}>
        <button className={`tab-btn ${flowFilter === '' ? 'active' : ''}`} onClick={() => setFlowFilter('')}>
          <Layers size={14} /> All
        </button>
        <button className={`tab-btn ${flowFilter === 'out' ? 'active' : ''}`} onClick={() => setFlowFilter('out')}>
          <ArrowUpRight size={14} /> Spent
        </button>
        <button className={`tab-btn ${flowFilter === 'in' ? 'active' : ''}`} onClick={() => setFlowFilter('in')}>
          <ArrowDownLeft size={14} /> Received
        </button>
      </div>

      {/* Merged Search & Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            className="form-input"
            placeholder="Search expenses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={`filter-toggle-btn ${showFilters || activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
            title="Toggle filters"
          >
            <Filter size={16} />
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
        </div>

        {(showFilters || activeFilterCount > 0) && (
          <div className="filter-scroll-row" style={{ animation: 'fadein 0.15s ease' }}>
            <select className="filter-pill-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">Category: All</option>
              {db.settings.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>

            <select className="filter-pill-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Type: All</option>
              <option value="personal">Personal</option>
              <option value="for_friend">For Friend</option>
              <option value="by_friend">By Friend</option>
            </select>

            <select className="filter-pill-select" value={walletFilter} onChange={e => setWalletFilter(e.target.value)}>
              <option value="">Wallet: All</option>
              {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>

            <select className="filter-pill-select" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="date-desc">Sort: Latest</option>
              <option value="date-asc">Sort: Oldest</option>
              <option value="amount-desc">Sort: Highest</option>
              <option value="amount-asc">Sort: Lowest</option>
            </select>

            {(search || catFilter || typeFilter || statusFilter || flowFilter || walletFilter || sort !== 'date-desc') && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  setSearch(''); setCatFilter(''); setTypeFilter('');
                  setStatusFilter(''); setFlowFilter(''); setWalletFilter(''); setSort('date-desc');
                }}
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ReceiptText size={36} /></div>
            <div className="empty-state-title">No expenses found</div>
            <p>Try adjusting your filters or add a new expense.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Expense</button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-wrapper desktop-only">
              <table className="modern-tx-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%', textAlign: 'left' }}>Transaction</th>
                    <th style={{ width: '13%', textAlign: 'left' }}>Amount</th>
                    <th style={{ width: '16%', textAlign: 'left' }}>Type</th>
                    <th style={{ width: '18%', textAlign: 'left' }}>Wallet</th>
                    <th style={{ width: '19%', textAlign: 'left' }}>Status</th>
                    <th style={{ textAlign: 'right', width: '12%', minWidth: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let prevDateStr = '';
                    return filtered.map(ge => {
                      const primaryItem = ge.items[0];
                      const cat = db.settings.categories.find(c => c.name === ge.category);
                      const stl = ge.items.reduce<typeof db.settlements[0] | null | undefined>((found, item) => {
                        if (found) return found;
                        if (item.settlementId) return db.settlements.find(s => s.id === item.settlementId);
                        return db.settlements.find(s => s.expenseIds.includes(item.id));
                      }, null);
                      const stlWallet = stl?.walletId ? db.wallets.find(w => w.id === stl.walletId) : undefined;
                      const wallet = ge.items.reduce<typeof db.wallets[0] | null | undefined>((found, item) => {
                        if (found) return found;
                        return item.walletId ? db.wallets.find(w => w.id === item.walletId) : null;
                      }, null) || db.wallets.find(w => w.id === ge.walletId);
                      let effectiveWalletName = wallet?.name || stlWallet?.name || stl?.paymentMethod || '—';
                      if (ge.category === 'Transfer') {
                        if (ge.fromWalletName && ge.toWalletName) {
                          effectiveWalletName = `${ge.fromWalletName} → ${ge.toWalletName}`;
                        } else {
                          const outItem = ge.items.find(i => i.flow === 'out');
                          const inItem = ge.items.find(i => i.flow === 'in');
                          const fromW = outItem ? db.wallets.find(w => w.id === outItem.walletId) : null;
                          const toW = inItem ? db.wallets.find(w => w.id === inItem.walletId) : null;
                          if (fromW || toW) {
                            effectiveWalletName = `${fromW?.name || 'Wallet'} → ${toW?.name || 'Wallet'}`;
                          }
                        }
                      }
                      const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
                      const isExpanded = !!expandedIds[ge.id];
                      const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);

                      // Calculate friend settlement status for this group
                      const friendItems = ge.items.filter(i => i.type === 'for_friend' || i.type === 'by_friend');
                      const hasFriendItem = friendItems.length > 0 || ge.friendIds.length > 0 || ge.isSplit;
                      const targetItemsForStatus = friendItems.length > 0 ? friendItems : ge.items;
                      const totalTargetCount = targetItemsForStatus.length;
                      const settledTargetCount = targetItemsForStatus.filter(i => i.settled || i.settlementId).length;
                      const isGroupAllSettled = totalTargetCount > 0 && settledTargetCount === totalTargetCount;
                      const isGroupSomeSettled = settledTargetCount > 0;
                      const hasChildOrPartial = ge.items.some(i => i.parentExpenseId || (i.originalAmount && i.settledAmount));
                      const isGroupPartiallySettled = (isGroupSomeSettled && !isGroupAllSettled) || (hasChildOrPartial && !isGroupAllSettled);

                      // Check if date header should be shown
                      const isNewDateHeader = sort.startsWith('date') && ge.date !== prevDateStr;
                      if (isNewDateHeader) {
                        prevDateStr = ge.date;
                      }

                      // Compute date group totals if showing date header
                      const dateExpenses = isNewDateHeader ? filtered.filter(x => x.date === ge.date) : [];
                      const dateOutSum = isNewDateHeader ? dateExpenses.reduce((sum, x) => (x.flow === 'out' && x.category !== 'Transfer') ? sum + x.totalAmount : sum, 0) : 0;
                      const dateInSum = isNewDateHeader ? dateExpenses.reduce((sum, x) => (x.flow === 'in' && x.category !== 'Transfer') ? sum + x.totalAmount : sum, 0) : 0;

                      const isDateCollapsed = sort.startsWith('date') && !!collapsedDates[ge.date];

                      if (isDateCollapsed) {
                        if (!isNewDateHeader) return null;
                        return (
                          <tr key={ge.id} className="tx-date-header-row">
                            <td colSpan={6}>
                              <div
                                className="tx-date-header-content"
                                onClick={() => toggleDateCollapse(ge.date)}
                                title="Click to expand date group"
                              >
                                <div className="tx-date-header-left">
                                  <ChevronRight size={14} style={{ color: 'var(--accent)' }} />
                                  <span>{fmtDate(ge.date)}</span>
                                  <span style={{ fontSize: 11, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>
                                    Collapsed ({dateExpenses.length})
                                  </span>
                                </div>
                                <div className="tx-date-header-right">
                                  <span>{dateExpenses.length} transaction{dateExpenses.length > 1 ? 's' : ''}</span>
                                  {dateOutSum > 0 && <span className="tx-date-stat debit">-{fmtMoney(dateOutSum, currency)}</span>}
                                  {dateInSum > 0 && <span className="tx-date-stat credit">+{fmtMoney(dateInSum, currency)}</span>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <React.Fragment key={ge.id}>
                          {isNewDateHeader && (
                            <tr className="tx-date-header-row">
                              <td colSpan={6}>
                                <div
                                  className="tx-date-header-content"
                                  onClick={() => toggleDateCollapse(ge.date)}
                                  title="Click to collapse date group"
                                >
                                  <div className="tx-date-header-left">
                                    <ChevronDown size={14} style={{ color: 'var(--accent)' }} />
                                    <span>{fmtDate(ge.date)}</span>
                                  </div>
                                  <div className="tx-date-header-right">
                                    <span>{dateExpenses.length} transaction{dateExpenses.length > 0 ? (dateExpenses.length > 1 ? 's' : '') : ''}</span>
                                    {dateOutSum > 0 && <span className="tx-date-stat debit">-{fmtMoney(dateOutSum, currency)}</span>}
                                    {dateInSum > 0 && <span className="tx-date-stat credit">+{fmtMoney(dateInSum, currency)}</span>}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr className="modern-tx-row">
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                  className="tx-squircle-icon"
                                  style={{
                                    background: cat?.color && cat.color.startsWith('#') ? `${cat.color}20` : 'var(--accent-soft)',
                                    color: cat?.color || 'var(--accent)'
                                  }}
                                >
                                  <CategoryIcon category={ge.category} icon={cat?.icon} size={20} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{ge.description}</span>
                                    {(ge.isSplit || ge.items.length > 1 || ge.isSettlementGroup) && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpand(ge.id)}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          padding: '2px 8px',
                                          borderRadius: 12,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          background: 'var(--accent-soft)',
                                          color: 'var(--accent)',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          border: 'none',
                                          cursor: 'pointer'
                                        }}
                                        title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
                                      >
                                        <Users size={11} /> {ge.isSettlementGroup ? 'Settlement' : (ge.isSplit ? 'Split' : 'Breakdown')} {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </button>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{ge.category}</span>
                                    {ge.isSettlementGroup && <span>• {ge.settlementItemCount} item{ge.settlementItemCount! > 1 ? 's' : ''} settled</span>}
                                  </div>
                                  {friendsInGroup.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
                                      {friendsInGroup.map(f => f && (
                                        <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          <div className="avatar avatar-sm" style={{ ...getAvatarStyle(f.color), width: 16, height: 16, fontSize: 8 }}>{friendInitial(f.name, f.avatarNumber)}</div>
                                          <span>{f.name}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                {(() => {
                                  if (ge.isSettlementGroup) {
                                    return (
                                      <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                                        {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                                      </span>
                                    );
                                  }
                                  if (isIn) return <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: 'var(--credit)' }}>+{fmtMoney(ge.totalAmount, currency)}</span>;
                                  if (ge.isSplit) {
                                    if (isGroupAllSettled) {
                                      if (ge.personalShare > 0) return <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: 'var(--debit)' }}>-{fmtMoney(ge.personalShare, currency)}</span>;
                                      return (
                                        <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                                          {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                                        </span>
                                      );
                                    }
                                    return <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: 'var(--debit)' }}>-{fmtMoney(ge.personalShare, currency)}</span>;
                                  }
                                  return <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: ge.flow === 'out' ? 'var(--debit)' : 'var(--credit)' }}>{ge.flow === 'out' ? '-' : '+'}{fmtMoney(ge.totalAmount, currency)}</span>;
                                })()}
                                {ge.isSplit && ge.personalShare > 0 && !isGroupAllSettled && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                                    Your share: {fmtMoney(ge.personalShare, currency)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="tx-type-pill">
                                {ge.isSettlementGroup ? (
                                  <CheckCircle2 size={11} style={{ color: '#10b981' }} />
                                ) : ge.isSplit ? (
                                  <Users size={11} style={{ color: 'var(--accent)' }} />
                                ) : (
                                  <User size={11} style={{ color: 'var(--text-3)' }} />
                                )}
                                <span>{ge.isSettlementGroup ? 'Settlement' : (ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type, undefined, primaryItem.category))}</span>
                              </span>
                            </td>
                            <td>
                              <span className="tx-wallet-pill">
                                <Wallet size={11} style={{ color: 'var(--text-3)' }} />
                                <span>{effectiveWalletName}</span>
                              </span>
                            </td>
                            <td>
                              {(() => {
                                if (ge.isSettlementGroup) {
                                  return (
                                    <span className="tx-status-pill status-settled">
                                      <span className="status-dot" />
                                      <span>Settled ✓</span>
                                    </span>
                                  );
                                }
                                if (hasFriendItem) {
                                  if (isGroupAllSettled) {
                                    return (
                                      <span className="tx-status-pill status-settled">
                                        <span className="status-dot" />
                                        <span>Completely Settled</span>
                                      </span>
                                    );
                                  }
                                  if (isGroupPartiallySettled) {
                                    return (
                                      <span className="tx-status-pill status-partial">
                                        <span className="status-dot" />
                                        <span>Partially Settled</span>
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="tx-status-pill status-unsettled">
                                      <span className="status-dot" />
                                      <span>Unsettled</span>
                                    </span>
                                  );
                                }

                                const isTransfer = primaryItem.category === 'Transfer';
                                const isSettled = primaryItem.settled || isTransfer;

                                return (
                                  <span className={`tx-status-pill status-${isTransfer || isSettled ? 'settled' : primaryItem.status}`}>
                                    <span className="status-dot" />
                                    <span>{isTransfer ? 'Completed' : (isSettled ? 'Settled' : statusLabel(primaryItem.status))}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {ge.items.some(i => i.settled || i.settlementId) && (
                                  <button
                                    className="tx-action-btn action-undo"
                                    onClick={() => {
                                      const targetItem = ge.items.find(i => i.settlementId) || ge.items.find(i => i.settled) || primaryItem;
                                      setUndoExpId(targetItem.settlementId || targetItem.id || ge.id);
                                    }}
                                    title="Undo Settlement (Restore money to wallet)"
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                                <button className="tx-action-btn" onClick={() => setEditExp(primaryItem)} title="Edit">
                                  <Edit2 size={14} />
                                </button>
                                <button className="tx-action-btn action-delete" onClick={() => setDelId(ge.id)} title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (ge.isSplit || ge.items.length > 1 || ge.isSettlementGroup) && (
                            <tr style={{ background: 'var(--surface2)' }}>
                              <td colSpan={6} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Users size={14} style={{ color: 'var(--accent)' }} /> {ge.isSettlementGroup ? 'Settlement Breakdown' : (ge.isSplit ? 'Split Breakdown' : 'Breakdown')} (Total {fmtMoney(ge.totalAmount, currency)})
                                </div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {ge.items.map((item, idx) => {
                                  const itemFriend = item.friendId ? db.friends.find(f => f.id === item.friendId) : null;
                                  const isMine = item.type === 'personal';
                                  const isVendorOwed = item.type === 'by_friend';
                                  const name = itemFriend?.name ?? 'Contact';

                                  let roleLabel = 'My Share';
                                  let statusText = item.settled ? 'Settled ✓' : 'Your Expense';
                                  if (ge.isSettlementGroup) {
                                    const itemDesc = cleanExpenseDescription(item.description);
                                    const itemDateStr = fmtDate(item.originalDate || item.date);
                                    roleLabel = `${itemDesc} (${itemDateStr})`;
                                    statusText = 'Settled ✓';
                                  } else if (item.type === 'for_friend') {
                                    roleLabel = item.settled ? `${name} paid you` : `${name} owes you`;
                                    statusText = item.settled ? 'Settled ✓' : 'Owes You';
                                  } else if (item.type === 'by_friend') {
                                    roleLabel = item.settled ? `Paid to ${name}` : `You owe ${name}`;
                                    statusText = item.settled ? 'Settled ✓' : 'You Owe Vendor';
                                  }

                                  const isSubDebit = item.type === 'by_friend' || item.type === 'personal';
                                  const subSign = isSubDebit ? '-' : '+';
                                  const subColor = isSubDebit ? 'var(--debit)' : 'var(--credit)';

                                  return (
                                    <div key={item.id || idx} style={{
                                      background: 'var(--surface)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 6,
                                      padding: '8px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 12,
                                      minWidth: 210,
                                    }}>
                                      {isMine ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <User size={16} style={{ color: 'var(--text-2)' }} />
                                          <div>
                                            <div style={{ fontWeight: 600, fontSize: 12 }}>My Share</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Your Expense</div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <div className="avatar avatar-sm" style={{ ...getAvatarStyle(itemFriend?.color), width: 22, height: 22, fontSize: 10 }}>
                                            {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                                          </div>
                                          <div>
                                            <div style={{ fontWeight: 600, fontSize: 12 }}>
                                              {roleLabel}
                                            </div>
                                            <div style={{ fontSize: 11, color: item.settled ? 'var(--credit)' : (isVendorOwed ? '#d32f2f' : 'var(--accent)') }}>
                                              {statusText}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13, color: subColor }}>
                                        {subSign}{fmtMoney(item.amount, currency)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Expandable Cards View */}
            <div className="mobile-expense-list mobile-only">
              {filtered.map(ge => {
                const primaryItem = ge.items[0];
                const cat = db.settings.categories.find(c => c.name === ge.category);
                const stl = ge.items.reduce<typeof db.settlements[0] | null | undefined>((found, item) => {
                  if (found) return found;
                  if (item.settlementId) return db.settlements.find(s => s.id === item.settlementId);
                  return db.settlements.find(s => s.expenseIds.includes(item.id));
                }, null);
                const stlWallet = stl?.walletId ? db.wallets.find(w => w.id === stl.walletId) : undefined;
                const wallet = ge.items.reduce<typeof db.wallets[0] | null | undefined>((found, item) => {
                  if (found) return found;
                  return item.walletId ? db.wallets.find(w => w.id === item.walletId) : null;
                }, null) || db.wallets.find(w => w.id === ge.walletId);
                let effectiveWalletName = wallet?.name || stlWallet?.name || stl?.paymentMethod || '—';
                if (ge.category === 'Transfer') {
                  if (ge.fromWalletName && ge.toWalletName) {
                    effectiveWalletName = `${ge.fromWalletName} → ${ge.toWalletName}`;
                  } else {
                    const outItem = ge.items.find(i => i.flow === 'out');
                    const inItem = ge.items.find(i => i.flow === 'in');
                    const fromW = outItem ? db.wallets.find(w => w.id === outItem.walletId) : null;
                    const toW = inItem ? db.wallets.find(w => w.id === inItem.walletId) : null;
                    if (fromW || toW) {
                      effectiveWalletName = `${fromW?.name || 'Wallet'} → ${toW?.name || 'Wallet'}`;
                    }
                  }
                }
                const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
                const isExpanded = !!expandedIds[ge.id];
                const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);

                const isEvenGroup = dateGroupInfo.groupMap[ge.id] === 0;
                const isFirstOfDate = dateGroupInfo.isFirstMap[ge.id];
                const cardClass = `mobile-expense-card ${isEvenGroup ? 'date-card-even' : 'date-card-odd'}${isFirstOfDate ? ' date-card-first' : ''}${isExpanded ? ' is-expanded' : ''}`;

                // Calculate friend settlement status for this group
                const friendItems = ge.items.filter(i => i.type === 'for_friend' || i.type === 'by_friend');
                const hasFriendItem = friendItems.length > 0 || ge.friendIds.length > 0 || ge.isSplit;
                const targetItemsForStatus = friendItems.length > 0 ? friendItems : ge.items;
                const totalTargetCount = targetItemsForStatus.length;
                const settledTargetCount = targetItemsForStatus.filter(i => i.settled || i.settlementId).length;
                const isGroupAllSettled = totalTargetCount > 0 && settledTargetCount === totalTargetCount;
                const isGroupSomeSettled = settledTargetCount > 0;
                const hasChildOrPartial = ge.items.some(i => i.parentExpenseId || (i.originalAmount && i.settledAmount));
                const isGroupPartiallySettled = (isGroupSomeSettled && !isGroupAllSettled) || (hasChildOrPartial && !isGroupAllSettled);

                return (
                  <div key={ge.id} className={cardClass}>
                    <div className="mobile-expense-header" onClick={() => toggleExpand(ge.id)}>
                      <div className="mobile-expense-top">
                        <div className="mobile-expense-desc-wrap">
                          <CategoryIcon category={ge.category} icon={cat?.icon} size={15} style={{ color: cat?.color ?? 'var(--accent)', flexShrink: 0 }} />
                          <span className="mobile-expense-title">{ge.description}</span>
                          {ge.isSplit && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '2px 6px',
                              borderRadius: 10,
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              whiteSpace: 'nowrap'
                            }}>
                              <Users size={11} /> {ge.isSettlementGroup ? 'Settlement' : 'Split'}
                            </span>
                          )}
                          {hasFriendItem && !ge.isSettlementGroup && (
                            <>
                              {isGroupAllSettled ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Settled ✓
                                </span>
                              ) : isGroupPartiallySettled ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: 'rgba(245, 158, 11, 0.18)',
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Partially Settled
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Unsettled
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="mobile-expense-amount">
                          {(() => {
                            const isAllSettled = ge.items.every(i => i.settled);
                            if (ge.isSettlementGroup) {
                              return (
                                <span style={{ color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                                  {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                                </span>
                              );
                            }
                            if (isIn) return <span style={{ color: 'var(--credit)' }}>+{fmtMoney(ge.totalAmount, currency)}</span>;
                            if (ge.isSplit) {
                              if (isAllSettled) {
                                if (ge.personalShare > 0) return <span style={{ color: 'var(--debit)' }}>-{fmtMoney(ge.personalShare, currency)}</span>;
                                return (
                                  <span style={{ color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                                    {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                                  </span>
                                );
                              }
                              return <span style={{ color: 'var(--debit)' }}>-{fmtMoney(ge.totalAmount, currency)}</span>;
                            }
                            return <span style={{ color: ge.flow === 'out' ? 'var(--debit)' : 'var(--credit)' }}>{ge.flow === 'out' ? '-' : '+'}{fmtMoney(ge.totalAmount, currency)}</span>;
                          })()}
                        </div>
                      </div>

                      <div className="mobile-expense-meta">
                        <div className="mobile-expense-meta-left">
                          <span>{fmtDate(ge.date)}</span>
                          <span>·</span>
                          <span>{ge.category}</span>
                          {ge.isSettlementGroup && (
                            <>
                              <span>·</span>
                              <span>{ge.settlementItemCount} item{ge.settlementItemCount! > 1 ? 's' : ''}{ge.settlementDateRange ? ` (${ge.settlementDateRange})` : ''}</span>
                            </>
                          )}
                          {friendsInGroup.map(f => f && (
                            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span>·</span>
                              <span className="avatar avatar-sm" style={{ ...getAvatarStyle(f.color), width: 15, height: 15, fontSize: 8 }}>{friendInitial(f.name, f.avatarNumber)}</span>
                              {f.name}
                            </span>
                          ))}
                        </div>
                        <div className="mobile-expense-expand-btn">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mobile-expense-details">
                        {(ge.isSplit || ge.items.length > 1 || ge.isSettlementGroup) && (
                          <div style={{
                            background: 'var(--surface2)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            marginBottom: 12,
                            border: '1px solid var(--border)'
                          }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users size={14} style={{ color: 'var(--accent)' }} /> {ge.isSettlementGroup ? 'Settlement Breakdown' : (ge.isSplit ? 'Split Breakdown' : 'Breakdown')} (Total {fmtMoney(ge.totalAmount, currency)})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {ge.items.map((item, idx) => {
                                const itemFriend = item.friendId ? db.friends.find(f => f.id === item.friendId) : null;
                                const isMine = item.type === 'personal';
                                const isVendorOwed = item.type === 'by_friend';
                                const name = itemFriend?.name ?? 'Contact';

                                let roleLabel = 'Mine (Your share)';
                                let statusText = item.settled ? 'Settled ✓' : 'Your Expense';
                                if (ge.isSettlementGroup) {
                                  const itemDesc = cleanExpenseDescription(item.description);
                                  const itemDateStr = fmtDate(item.originalDate || item.date);
                                  roleLabel = `${itemDesc} (${itemDateStr})`;
                                  statusText = 'Settled ✓';
                                } else if (item.type === 'for_friend') {
                                  roleLabel = item.settled ? `${name} paid you` : `${name} owes you`;
                                  statusText = item.settled ? 'Settled ✓' : 'Owes You';
                                } else if (item.type === 'by_friend') {
                                  roleLabel = item.settled ? `Paid to ${name}` : `You owe ${name}`;
                                  statusText = item.settled ? 'Settled ✓' : 'You Owe Vendor';
                                }

                                const isSubDebit = item.type === 'by_friend' || item.type === 'personal';
                                const subSign = isSubDebit ? '-' : '+';
                                const subColor = isSubDebit ? 'var(--debit)' : 'var(--credit)';

                                return (
                                  <div key={item.id || idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: 12,
                                    padding: '6px 0',
                                    borderBottom: idx < ge.items.length - 1 ? '1px dashed var(--border)' : 'none'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {isMine ? (
                                        <>
                                          <User size={16} style={{ color: 'var(--text-2)' }} />
                                          <div>
                                            <div style={{ fontWeight: 600 }}>{roleLabel}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{statusText}</div>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <span className="avatar avatar-sm" style={{ ...getAvatarStyle(itemFriend?.color), width: 22, height: 22, fontSize: 10 }}>
                                            {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                                          </span>
                                          <div>
                                            <div style={{ fontWeight: 600 }}>
                                              {roleLabel}
                                            </div>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: item.settled ? 'var(--credit)' : (isVendorOwed ? '#d32f2f' : 'var(--accent)') }}>
                                              {statusText}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 'auto', color: subColor }}>
                                      {subSign}{fmtMoney(item.amount, currency)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mobile-expense-detail-grid">
                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Category</span>
                            <span className="mobile-expense-detail-val">
                              <CategoryBadge category={ge.category} color={cat?.color} icon={cat?.icon} size={13} />
                            </span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Wallet</span>
                            <span className="mobile-expense-detail-val">{effectiveWalletName}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Type</span>
                            <span className="mobile-expense-detail-val">{ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type, undefined, primaryItem.category)}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Status</span>
                            <span className="mobile-expense-detail-val">
                              {(() => {
                                if (hasFriendItem && !ge.isSettlementGroup) {
                                  if (isGroupAllSettled) {
                                    return (
                                      <span className="badge badge-settled" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                                        Completely Settled
                                      </span>
                                    );
                                  }
                                  if (isGroupPartiallySettled) {
                                    return (
                                      <span className="badge badge-partial" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: 600 }}>
                                        Partially Settled
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="badge badge-unsettled" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', fontWeight: 600 }}>
                                      Unsettled
                                    </span>
                                  );
                                }
                                const isTransfer = primaryItem.category === 'Transfer';
                                const isSettled = primaryItem.settled || isTransfer;
                                return (
                                  <span className={`badge badge-${isSettled ? 'settled' : primaryItem.status}`}>
                                    {isTransfer ? 'Completed' : (isSettled ? 'Settled' : statusLabel(primaryItem.status))}
                                  </span>
                                );
                              })()}
                            </span>
                          </div>

                          {primaryItem.notes && (
                            <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="mobile-expense-detail-label">Notes</span>
                              <span className="mobile-expense-detail-val" style={{ fontWeight: 400, fontStyle: 'italic' }}>{primaryItem.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="mobile-expense-actions">
                          {ge.items.some(i => i.settled || i.settlementId) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const targetItem = ge.items.find(i => i.settlementId) || ge.items.find(i => i.settled) || primaryItem;
                                setUndoExpId(targetItem.settlementId || targetItem.id || ge.id);
                              }}
                              style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.3)' }}
                            >
                              <RotateCcw size={14} /> Undo Settlement
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditExp(primaryItem)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDelId(ge.id)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showAdd && <ExpenseModal onClose={() => setShowAdd(false)} />}
      {editExp && <ExpenseModal expense={editExp} onClose={() => setEditExp(null)} />}
      {delId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Are you sure you want to delete this expense? Any amount deducted from your wallet will be added back automatically."
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
      {undoExpId && (
        <ConfirmDialog
          title="Undo Settlement"
          message="Are you sure you want to undo settlement for this expense? The money will be returned to your wallet and the item marked as unsettled."
          onConfirm={handleUnsettleConfirm}
          onClose={() => setUndoExpId(null)}
        />
      )}
    </div>
  );
}

