import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useStore } from '../store';
import type { Wallet } from '../types';
import { walletBalance, expenseFlow, monthKey } from '../db';
import { fmtMoney, fmtDate, typeLabel, statusLabel } from '../utils';
import WalletModal from '../components/WalletModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExpenseModal from '../components/ExpenseModal';

export default function Wallets() {
  const { db, deleteWallet, showToast } = useStore();
  const { wallets, expenses, settings: { currency } } = db;
  const [editW, setEditW] = useState<Wallet | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(wallets[0]?.id ?? '');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = (id: string) => {
    if (!deleteWallet(id)) {
      showToast('Cannot delete the only wallet.');
      return;
    }
    if (activeTab === id) setActiveTab(db.wallets.find(w => w.id !== id)?.id ?? '');
    setDelId(null);
  };

  const activeWallet = wallets.find(w => w.id === activeTab) || wallets[0];
  const walletExpenses = activeWallet
    ? [...expenses.filter(e => e.walletId === activeWallet.id)].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const walletMonthSpend = walletExpenses
    .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'out' && e.status !== 'unpaid')
    .reduce((s, e) => s + Number(e.amount), 0);
  const walletMonthIn = walletExpenses
    .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'in' && e.status !== 'unpaid')
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="view-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallets</h1>
        </div>
        <button className="btn btn-primary desktop-only" onClick={() => setShowAdd(true)}>
          <AddIcon fontSize="small" /> Add Wallet
        </button>
      </div>

      {/* Wallet Cards Selector Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {wallets.map(w => {
          const bal = walletBalance(db, w.id);
          const isSelected = activeTab === w.id;
          const wExpCount = expenses.filter(e => e.walletId === w.id).length;

          return (
            <div
              key={w.id}
              onClick={() => setActiveTab(w.id)}
              style={{
                background: isSelected ? 'var(--surface2)' : 'var(--surface)',
                border: `1.5px solid ${isSelected ? (w.color || 'var(--accent)') : 'var(--border)'}`,
                borderRadius: 16,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isSelected ? `0 0 0 3px ${w.color}22` : 'none',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: `${w.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AccountBalanceWalletIcon style={{ color: w.color, fontSize: 18 }} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{w.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" style={{ padding: 4 }} onClick={() => setEditW(w)} title="Edit Wallet">
                    <EditIcon style={{ fontSize: 15 }} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ padding: 4, color: 'var(--debit)' }}
                    onClick={() => setDelId(w.id)}
                    disabled={wallets.length <= 1}
                    title="Delete Wallet"
                  >
                    <DeleteIcon style={{ fontSize: 15 }} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 22, fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)', marginBottom: 6 }}>
                {fmtMoney(bal, currency)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-3)' }}>
                <span>Opening: {fmtMoney(w.openingBalance, currency)}</span>
                <span>{wExpCount} transaction{wExpCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Wallet Transactions Section */}
      {activeWallet && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: activeWallet.color,
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{activeWallet.name} Transactions</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--debit)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <TrendingDownIcon style={{ fontSize: 14 }} /> -{fmtMoney(walletMonthSpend, currency)}
                </span>
                <span style={{ color: 'var(--text-3)' }}>·</span>
                <span style={{ color: 'var(--credit)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <TrendingUpIcon style={{ fontSize: 14 }} /> +{fmtMoney(walletMonthIn, currency)}
                </span>
              </div>

              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px', gap: 4 }}
                onClick={() => setShowAddExp(true)}
              >
                <AddIcon style={{ fontSize: 14 }} /> Add
              </button>
            </div>
          </div>

          {walletExpenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p>No transactions in {activeWallet.name} yet.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddExp(true)}>
                <AddIcon fontSize="small" /> Record First Transaction
              </button>
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
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {walletExpenses.slice(0, 40).map(e => {
                    const cat = db.settings.categories.find(c => c.name === e.category);
                    const isIn = expenseFlow(e) === 'in';
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{e.description}</td>
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
                        <td>
                          <span className={`badge badge-${e.settled ? 'settled' : e.status}`}>
                            {statusLabel(e.settled ? 'settled' : e.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Expandable Cards View */}
              <div className="mobile-expense-list mobile-only">
                {walletExpenses.slice(0, 40).map(e => {
                  const cat = db.settings.categories.find(c => c.name === e.category);
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
                              <span className="mobile-expense-detail-label">Type</span>
                              <span className="mobile-expense-detail-val">{typeLabel(e.type)}</span>
                            </div>

                            <div className="mobile-expense-detail-item">
                              <span className="mobile-expense-detail-label">Status</span>
                              <span className="mobile-expense-detail-val">
                                <span className={`badge badge-${statusKey}`}>{statusLabel(statusKey)}</span>
                              </span>
                            </div>

                            {e.notes && (
                              <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                                <span className="mobile-expense-detail-label">Notes</span>
                                <span className="mobile-expense-detail-val" style={{ fontWeight: 400, fontStyle: 'italic' }}>{e.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {walletExpenses.length > 40 && (
            <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
              Showing 40 of {walletExpenses.length} transactions
            </div>
          )}
        </div>
      )}

      {showAdd && <WalletModal onClose={() => setShowAdd(false)} />}
      {editW && <WalletModal wallet={editW} onClose={() => setEditW(null)} />}
      {showAddExp && <ExpenseModal expense={{ walletId: activeWallet.id } as never} onClose={() => setShowAddExp(false)} />}
      {delId && (
        <ConfirmDialog
          title="Delete Wallet"
          message="All expenses in this wallet will be moved to another wallet. Are you sure?"
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
