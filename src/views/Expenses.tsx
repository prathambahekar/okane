import { useState, useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useStore } from '../store';
import type { Expense } from '../types';
import { expenseFlow } from '../db';
import { fmtMoney, fmtDate, typeLabel, statusLabel, friendInitial } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';

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

  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = useMemo(() => {
    let arr = [...expenses];
    if (search) arr = arr.filter(e => e.description.toLowerCase().includes(search.toLowerCase()) || e.notes?.toLowerCase().includes(search.toLowerCase()));
    if (catFilter) arr = arr.filter(e => e.category === catFilter);
    if (typeFilter) arr = arr.filter(e => e.type === typeFilter);
    if (statusFilter) {
      if (statusFilter === 'settled') arr = arr.filter(e => e.settled);
      else arr = arr.filter(e => !e.settled && e.status === statusFilter);
    }
    if (flowFilter) arr = arr.filter(e => expenseFlow(e) === flowFilter);
    if (walletFilter) arr = arr.filter(e => e.walletId === walletFilter);

    arr.sort((a, b) => {
      switch (sort) {
        case 'date-desc': return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
        case 'date-asc': return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc': return a.amount - b.amount;
        default: return 0;
      }
    });
    return arr;
  }, [expenses, search, catFilter, typeFilter, statusFilter, flowFilter, walletFilter, sort]);

  const totalOut = filtered.filter(e => expenseFlow(e) === 'out' && e.type === 'personal').reduce((s, e) => s + Number(e.amount), 0);
  const totalIn = filtered.filter(e => expenseFlow(e) === 'in' && e.type === 'personal').reduce((s, e) => s + Number(e.amount), 0);

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
          <p className="page-subtitle">{filtered.length} record{filtered.length !== 1 ? 's' : ''} · Out {fmtMoney(totalOut, currency)} / In {fmtMoney(totalIn, currency)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <AddIcon fontSize="small" /> Add Expense
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <SearchIcon className="search-icon" />
          <input className="form-input" placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-select-grid">
          <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {db.settings.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="personal">Personal</option>
            <option value="for_friend">For Friend</option>
            <option value="by_friend">By Friend</option>
          </select>
          <select className="filter-select" value={flowFilter} onChange={e => setFlowFilter(e.target.value)}>
            <option value="">Any flow</option>
            <option value="out">Out / Spent</option>
            <option value="in">In / Received</option>
          </select>
          <select className="filter-select" value={walletFilter} onChange={e => setWalletFilter(e.target.value)}>
            <option value="">All wallets</option>
            {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="date-desc">Latest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
          {(search || catFilter || typeFilter || statusFilter || flowFilter || walletFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCatFilter(''); setTypeFilter(''); setStatusFilter(''); setFlowFilter(''); setWalletFilter(''); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No expenses found</div>
            <p>Try adjusting your filters or add a new expense.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><AddIcon fontSize="small" /> Add Expense</button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="data-table desktop-only">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Wallet</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const cat = db.settings.categories.find(c => c.name === e.category);
                  const friend = e.friendId ? db.friends.find(f => f.id === e.friendId) : null;
                  const wallet = db.wallets.find(w => w.id === e.walletId);
                  const isIn = expenseFlow(e) === 'in';
                  const statusKey = e.settled ? 'settled' : e.status;
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{e.description}</div>
                        {friend && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                            <div className="avatar avatar-sm" style={{ background: friend.color, width: 18, height: 18, fontSize: 9 }}>{friendInitial(friend.name)}</div>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{friend.name}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 500, color: isIn ? 'var(--credit)' : undefined }}>
                        {isIn ? '+' : ''}{fmtMoney(e.amount, currency)}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(e.date)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                          <span style={{ fontSize: 12 }}>{e.category}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{typeLabel(e.type)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{wallet?.name ?? '—'}</td>
                      <td>
                        <span className={`badge badge-${statusKey}`}>{statusLabel(statusKey)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" onClick={() => setEditExp(e)} title="Edit"><EditIcon fontSize="small" /></button>
                          <button className="btn-icon" onClick={() => setDelId(e.id)} title="Delete" style={{ color: 'var(--debit)' }}><DeleteIcon fontSize="small" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Expandable Cards View */}
            <div className="mobile-expense-list mobile-only">
              {filtered.map(e => {
                const cat = db.settings.categories.find(c => c.name === e.category);
                const friend = e.friendId ? db.friends.find(f => f.id === e.friendId) : null;
                const wallet = db.wallets.find(w => w.id === e.walletId);
                const isIn = expenseFlow(e) === 'in';
                const statusKey = e.settled ? 'settled' : e.status;
                const isExpanded = !!expandedIds[e.id];

                return (
                  <div key={e.id} className={`mobile-expense-card ${isExpanded ? 'is-expanded' : ''}`}>
                    <div className="mobile-expense-header" onClick={() => toggleExpand(e.id)}>
                      <div className="mobile-expense-top">
                        <div className="mobile-expense-desc-wrap">
                          {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                          <span className="mobile-expense-title">{e.description}</span>
                        </div>
                        <div className="mobile-expense-amount" style={{ color: isIn ? 'var(--credit)' : undefined }}>
                          {isIn ? '+' : ''}{fmtMoney(e.amount, currency)}
                        </div>
                      </div>

                      <div className="mobile-expense-meta">
                        <div className="mobile-expense-meta-left">
                          <span>{e.category}</span>
                          <span>·</span>
                          <span>{fmtDate(e.date)}</span>
                          {friend && (
                            <>
                              <span>·</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span className="avatar avatar-sm" style={{ background: friend.color, width: 15, height: 15, fontSize: 8 }}>{friendInitial(friend.name)}</span>
                                {friend.name}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mobile-expense-expand-btn">
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mobile-expense-details">
                        <div className="mobile-expense-detail-grid">
                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Category</span>
                            <span className="mobile-expense-detail-val">
                              {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                              {e.category}
                            </span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Wallet</span>
                            <span className="mobile-expense-detail-val">{wallet?.name ?? '—'}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Type</span>
                            <span className="mobile-expense-detail-val">{typeLabel(e.type)}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Status</span>
                            <span className="mobile-expense-detail-val">
                              <span className={`badge badge-${statusKey}`}>{statusLabel(statusKey)}</span>
                            </span>
                          </div>

                          {friend && (
                            <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="mobile-expense-detail-label">Friend</span>
                              <span className="mobile-expense-detail-val">
                                <div className="avatar avatar-sm" style={{ background: friend.color, width: 18, height: 18, fontSize: 9 }}>{friendInitial(friend.name)}</div>
                                {friend.name}
                              </span>
                            </div>
                          )}

                          {e.notes && (
                            <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="mobile-expense-detail-label">Notes</span>
                              <span className="mobile-expense-detail-val" style={{ fontWeight: 400, fontStyle: 'italic' }}>{e.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="mobile-expense-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditExp(e)}>
                            <EditIcon fontSize="small" /> Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDelId(e.id)}>
                            <DeleteIcon fontSize="small" /> Delete
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

