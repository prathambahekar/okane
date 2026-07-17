import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useStore } from '../store';
import type { Wallet } from '../types';
import { walletBalance, totalWalletBalance, expenseFlow, monthKey } from '../db';
import { fmtMoney, fmtDate } from '../utils';
import WalletModal from '../components/WalletModal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Wallets() {
  const { db, deleteWallet, showToast } = useStore();
  const { wallets, expenses, settings: { currency } } = db;
  const [editW, setEditW] = useState<Wallet | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(wallets[0]?.id ?? '');

  const total = totalWalletBalance(db);

  const handleDelete = (id: string) => {
    if (!deleteWallet(id)) {
      showToast('Cannot delete the only wallet.');
    }
    if (activeTab === id) setActiveTab(db.wallets.find(w => w.id !== id)?.id ?? '');
    setDelId(null);
  };

  const activeWallet = wallets.find(w => w.id === activeTab);
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallets</h1>
          <p className="page-subtitle">Total balance: {fmtMoney(total, currency)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <AddIcon fontSize="small" /> Add Wallet
        </button>
      </div>

      {/* Wallet Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {wallets.map(w => {
          const bal = walletBalance(db, w.id);
          return (
            <div key={w.id} className="wallet-card" style={{ '--wallet-color': w.color } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AccountBalanceWalletIcon style={{ color: w.color, fontSize: 20 }} />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{w.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" style={{ padding: 4 }} onClick={() => setEditW(w)}><EditIcon style={{ fontSize: 14 }} /></button>
                  <button className="btn-icon" style={{ padding: 4, color: 'var(--debit)' }} onClick={() => setDelId(w.id)} disabled={wallets.length <= 1}><DeleteIcon style={{ fontSize: 14 }} /></button>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)', marginBottom: 4 }}>
                {fmtMoney(bal, currency)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Opening: {fmtMoney(w.openingBalance, currency)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{expenses.filter(e => e.walletId === w.id).length} transactions</div>
              <button className={`tab-btn ${activeTab === w.id ? 'active' : ''}`}
                style={{ marginTop: 10, padding: '4px 10px', fontSize: 11.5 }}
                onClick={() => setActiveTab(w.id)}>View Transactions</button>
            </div>
          );
        })}
      </div>

      {/* Active Wallet Transactions */}
      {activeWallet && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: activeWallet.color, display: 'inline-block' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{activeWallet.name} — Transactions</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
              <span>This month out: <span className="debit">{fmtMoney(walletMonthSpend, currency)}</span></span>
              <span>in: <span className="credit">{fmtMoney(walletMonthIn, currency)}</span></span>
            </div>
          </div>
          {walletExpenses.length === 0 ? (
            <div className="empty-state"><p>No transactions in this wallet yet.</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Description</th><th>Amount</th><th>Date</th><th>Category</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {walletExpenses.slice(0, 30).map(e => {
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
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.type === 'personal' ? 'Personal' : e.type === 'for_friend' ? 'For Friend' : 'By Friend'}</td>
                      <td><span className={`badge badge-${e.settled ? 'settled' : e.status}`}>{e.settled ? 'Settled' : e.status.charAt(0).toUpperCase() + e.status.slice(1)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {walletExpenses.length > 30 && (
            <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
              Showing 30 of {walletExpenses.length} transactions
            </div>
          )}
        </div>
      )}

      {showAdd && <WalletModal onClose={() => setShowAdd(false)} />}
      {editW && <WalletModal wallet={editW} onClose={() => setEditW(null)} />}
      {delId && (
        <ConfirmDialog title="Delete Wallet"
          message="All expenses in this wallet will be moved to another wallet. Are you sure?"
          onConfirm={() => handleDelete(delId)} onClose={() => setDelId(null)} />
      )}
    </div>
  );
}
