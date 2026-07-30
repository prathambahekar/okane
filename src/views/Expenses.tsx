import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronDown, ChevronUp, Filter, Users, Layers, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useStore } from '../store';
import type { Expense } from '../types';
import { fmtMoney, fmtDate, typeLabel, statusLabel, friendInitial, groupExpenses } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CategoryIcon, { CategoryBadge } from '../components/CategoryIcon';

export default function Expenses() {
  const { db, deleteExpense, showToast } = useStore();
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
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const activeFilterCount = (catFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (walletFilter ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const grouped = useMemo(() => groupExpenses(expenses), [expenses]);

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

  const handleDelete = (id: string) => {
    deleteExpense(id);
    setDelId(null);
    showToast('Expense deleted');
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

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No expenses found</div>
            <p>Try adjusting your filters or add a new expense.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Expense</button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="data-table desktop-only">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
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
                  const wallet = db.wallets.find(w => w.id === ge.walletId);
                  const isIn = ge.flow === 'in';
                  const isExpanded = !!expandedIds[ge.id];
                  const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);

                  return (
                    <React.Fragment key={ge.id}>
                      <tr className={isExpanded ? 'is-expanded-row' : ''}>
                        <td style={{ textAlign: 'center', padding: '8px 2px' }}>
                          {ge.isSplit && (
                            <button
                              className="btn-icon"
                              style={{ width: 22, height: 22, opacity: 0.8 }}
                              onClick={() => toggleExpand(ge.id)}
                              title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{ge.description}</span>
                            {ge.isSplit && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 600,
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: 'var(--accent)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                <Users size={12} /> Split
                              </span>
                            )}
                          </div>
                          {friendsInGroup.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11.5, color: 'var(--text-3)' }}>
                              {friendsInGroup.map(f => f && (
                                <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <div className="avatar avatar-sm" style={{ background: f.color, width: 16, height: 16, fontSize: 8 }}>{friendInitial(f.name)}</div>
                                  <span>{f.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 14, color: isIn ? 'var(--credit)' : undefined, whiteSpace: 'nowrap' }}>
                          {isIn ? '+' : ''}{fmtMoney(ge.totalAmount, currency)}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(ge.date)}</td>
                        <td>
                          <CategoryBadge category={ge.category} color={cat?.color} icon={cat?.icon} />
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type)}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{wallet?.name ?? '—'}</td>
                        <td>
                          {ge.isSplit ? (
                            <span className="badge badge-unsettled" style={{ whiteSpace: 'nowrap' }}>
                              {ge.items.every(i => i.settled) ? 'Settled' : 'Split'}
                            </span>
                          ) : (
                            <span className={`badge badge-${primaryItem.settled ? 'settled' : primaryItem.status}`} style={{ whiteSpace: 'nowrap' }}>
                              {statusLabel(primaryItem.settled ? 'settled' : primaryItem.status)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn-icon" onClick={() => setEditExp(primaryItem)} title="Edit"><Edit2 size={15} /></button>
                            <button className="btn-icon" onClick={() => setDelId(ge.id)} title="Delete" style={{ color: 'var(--debit)' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && ge.isSplit && (
                        <tr style={{ background: 'var(--surface2)' }}>
                          <td></td>
                          <td colSpan={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users size={14} style={{ color: 'var(--accent)' }} /> Split Breakdown (Total {fmtMoney(ge.totalAmount, currency)})
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              {ge.items.map((item, idx) => {
                                const itemFriend = item.friendId ? db.friends.find(f => f.id === item.friendId) : null;
                                const isMine = item.type === 'personal';
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
                                        <span style={{ fontSize: 16 }}>👤</span>
                                        <div>
                                          <div style={{ fontWeight: 600, fontSize: 12 }}>My Share</div>
                                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Your Expense</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="avatar avatar-sm" style={{ background: itemFriend?.color ?? 'var(--accent)', width: 22, height: 22, fontSize: 10 }}>
                                          {friendInitial(itemFriend?.name ?? '?')}
                                        </div>
                                        <div>
                                          <div style={{ fontWeight: 600, fontSize: 12 }}>{itemFriend?.name ?? 'Friend'}'s Share</div>
                                          <div style={{ fontSize: 11, color: item.settled ? 'var(--credit)' : 'var(--debit)' }}>
                                            {item.settled ? 'Settled ✓' : 'Unsettled'}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13 }}>
                                      {fmtMoney(item.amount, currency)}
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

            {/* Mobile Expandable Cards View */}
            <div className="mobile-expense-list mobile-only">
              {filtered.map(ge => {
                const primaryItem = ge.items[0];
                const cat = db.settings.categories.find(c => c.name === ge.category);
                const wallet = db.wallets.find(w => w.id === ge.walletId);
                const isIn = ge.flow === 'in';
                const isExpanded = !!expandedIds[ge.id];
                const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);

                return (
                  <div key={ge.id} className={`mobile-expense-card ${isExpanded ? 'is-expanded' : ''}`}>
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
                              background: 'rgba(56, 189, 248, 0.12)',
                              color: 'var(--accent)'
                            }}>
                              <Users size={11} /> Split
                            </span>
                          )}
                        </div>
                        <div className="mobile-expense-amount" style={{ color: isIn ? 'var(--credit)' : undefined }}>
                          {isIn ? '+' : ''}{fmtMoney(ge.totalAmount, currency)}
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
                              <span className="avatar avatar-sm" style={{ background: f.color, width: 15, height: 15, fontSize: 8 }}>{friendInitial(f.name)}</span>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {ge.items.map((item, idx) => {
                                const itemFriend = item.friendId ? db.friends.find(f => f.id === item.friendId) : null;
                                const isMine = item.type === 'personal';
                                return (
                                  <div key={item.id || idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: 12,
                                    padding: '4px 0',
                                    borderBottom: idx < ge.items.length - 1 ? '1px dashed var(--border)' : 'none'
                                  }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {isMine ? (
                                        <><span>👤</span> <span><strong>Mine</strong> (Your share)</span></>
                                      ) : (
                                        <>
                                          <span className="avatar avatar-sm" style={{ background: itemFriend?.color ?? 'var(--accent)', width: 16, height: 16, fontSize: 8 }}>
                                            {friendInitial(itemFriend?.name ?? '?')}
                                          </span>
                                          <span><strong>{itemFriend?.name ?? 'Friend'}'s share</strong> {item.settled ? '· Settled ✓' : ''}</span>
                                        </>
                                      )}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{fmtMoney(item.amount, currency)}</span>
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
                            <span className="mobile-expense-detail-val">{wallet?.name ?? '—'}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Type</span>
                            <span className="mobile-expense-detail-val">{ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type)}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Status</span>
                            <span className="mobile-expense-detail-val">
                              <span className={`badge badge-${primaryItem.settled ? 'settled' : primaryItem.status}`}>
                                {statusLabel(primaryItem.settled ? 'settled' : primaryItem.status)}
                              </span>
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
        <ConfirmDialog title="Delete Expense" message="Are you sure you want to delete this expense? This cannot be undone."
          onConfirm={() => handleDelete(delId)} onClose={() => setDelId(null)} />
      )}
    </div>
  );
}

