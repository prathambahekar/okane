import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronDown, ChevronUp, Filter, Users, Layers, ArrowUpRight, ArrowDownLeft, RotateCcw, User, ReceiptText } from 'lucide-react';
import { useStore } from '../store';
import type { Expense } from '../types';
import { fmtMoney, fmtDate, typeLabel, statusLabel, friendInitial, getAvatarStyle, groupExpenses } from '../utils';
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

  const activeFilterCount = (catFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (walletFilter ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUnsettleConfirm = () => {
    if (!undoExpId) return;
    unsettleExpense(undoExpId);
    setUndoExpId(null);
  };

  const grouped = useMemo(() => groupExpenses(expenses, db.wallets), [expenses, db.wallets]);

  const filtered = useMemo(() => {
    let arr = [...grouped];
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(ge =>
        ge.description.toLowerCase().includes(q) ||
        ge.items.some(i => i.notes?.toLowerCase().includes(q))
      );
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
  }, [grouped, search, catFilter, typeFilter, statusFilter, flowFilter, walletFilter, sort]);

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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Wallet</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
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
                    const rowClass = `${isEvenGroup ? 'date-row-even' : 'date-row-odd'}${isFirstOfDate ? ' date-row-first' : ''}${isExpanded ? ' is-expanded-row' : ''}`;

                    return (
                      <React.Fragment key={ge.id}>
                        <tr className={rowClass}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{ge.description}</span>
                              {ge.isSplit && (
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
                                  <Users size={12} /> Split {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              )}
                            </div>
                            {friendsInGroup.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11.5, color: 'var(--text-3)' }}>
                                {friendsInGroup.map(f => f && (
                                  <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <div className="avatar avatar-sm" style={{ ...getAvatarStyle(f.color), width: 16, height: 16, fontSize: 8 }}>{friendInitial(f.name, f.avatarNumber)}</div>
                                    <span>{f.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                            {(() => {
                              const isAllSettled = ge.items.every(i => i.settled);
                              if (isIn) return <span style={{ color: 'var(--credit)' }}>+{fmtMoney(ge.totalAmount, currency)}</span>;
                              if (ge.isSplit) {
                                if (isAllSettled) {
                                  if (ge.personalShare > 0) return <span style={{ color: 'var(--debit)' }}>-{fmtMoney(ge.personalShare, currency)}</span>;
                                  return null;
                                }
                                return <span style={{ color: 'var(--debit)' }}>-{fmtMoney(ge.totalAmount, currency)}</span>;
                              }
                              return <span style={{ color: ge.flow === 'out' ? 'var(--debit)' : 'var(--credit)' }}>{ge.flow === 'out' ? '-' : '+'}{fmtMoney(ge.totalAmount, currency)}</span>;
                            })()}
                          </td>
                          <td style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(ge.date)}</td>
                          <td>
                            <CategoryBadge category={ge.category} color={cat?.color} icon={cat?.icon} />
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                            {ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type, undefined, primaryItem.category)}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{effectiveWalletName}</td>
                          <td>
                            {(() => {
                              const isAllSettled = ge.items.every(i => i.settled);
                              if (ge.isSplit) {
                                return (
                                  <span className={`badge badge-${isAllSettled ? 'settled' : 'unsettled'}`} style={{ whiteSpace: 'nowrap' }}>
                                    {isAllSettled ? 'Settled' : 'Unsettled'}
                                  </span>
                                );
                              }

                              const isTransfer = primaryItem.category === 'Transfer';
                              const isSettled = primaryItem.settled || isTransfer;

                              return (
                                <span className={`badge badge-${isSettled ? 'settled' : primaryItem.status}`} style={{ whiteSpace: 'nowrap' }}>
                                  {isTransfer ? 'Completed' : (isSettled ? 'Settled' : statusLabel(primaryItem.status))}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {ge.items.some(i => i.settled) && (
                                <button
                                  className="btn-icon"
                                  onClick={() => setUndoExpId(primaryItem.id)}
                                  title="Undo Settlement (Restore money to wallet)"
                                  style={{ color: '#d97706', background: 'rgba(217, 119, 6, 0.12)', borderRadius: 4, padding: 3 }}
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                              <button className="btn-icon" onClick={() => setEditExp(primaryItem)} title="Edit"><Edit2 size={15} /></button>
                              <button className="btn-icon" onClick={() => setDelId(ge.id)} title="Delete" style={{ color: 'var(--debit)' }}><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && ge.isSplit && (
                          <tr style={{ background: 'var(--surface2)' }}>
                            <td colSpan={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={14} style={{ color: 'var(--accent)' }} /> Split Breakdown (Total {fmtMoney(ge.totalAmount, currency)})
                              </div>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {ge.items.map((item, idx) => {
                                  const itemFriend = item.friendId ? db.friends.find(f => f.id === item.friendId) : null;
                                  const isMine = item.type === 'personal';
                                  const isVendorOwed = item.type === 'by_friend';
                                  const name = itemFriend?.name ?? 'Contact';

                                  let roleLabel = 'My Share';
                                  let statusText = item.settled ? 'Settled ✓' : 'Your Expense';
                                  if (item.type === 'for_friend') {
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
                  })}
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
                              color: 'var(--accent)'
                            }}>
                              <Users size={11} /> Split
                            </span>
                          )}
                        </div>
                        <div className="mobile-expense-amount">
                          {(() => {
                            const isAllSettled = ge.items.every(i => i.settled);
                            if (isIn) return <span style={{ color: 'var(--credit)' }}>+{fmtMoney(ge.totalAmount, currency)}</span>;
                            if (ge.isSplit) {
                              if (isAllSettled) {
                                if (ge.personalShare > 0) return <span style={{ color: 'var(--debit)' }}>-{fmtMoney(ge.personalShare, currency)}</span>;
                                return null;
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
                        {ge.isSplit && (
                          <div style={{
                            background: 'var(--surface2)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            marginBottom: 12,
                            border: '1px solid var(--border)'
                          }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users size={14} style={{ color: 'var(--accent)' }} /> Split Breakdown (Total {fmtMoney(ge.totalAmount, currency)})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {ge.items.map((item, idx) => {
                                const itemFriend = item.friendId ? db.friends.find(f => f.id === item.friendId) : null;
                                const isMine = item.type === 'personal';
                                const isVendorOwed = item.type === 'by_friend';
                                const name = itemFriend?.name ?? 'Contact';

                                let roleLabel = 'Mine (Your share)';
                                let statusText = item.settled ? 'Settled ✓' : 'Your Expense';
                                if (item.type === 'for_friend') {
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
                                const isAllSettled = ge.items.every(i => i.settled);
                                if (ge.isSplit) {
                                  return (
                                    <span className={`badge badge-${isAllSettled ? 'settled' : 'unsettled'}`}>
                                      {isAllSettled ? 'Settled' : 'Unsettled'}
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
                          {ge.items.some(i => i.settled) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setUndoExpId(primaryItem.id)}
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

