import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Wallet as WalletIcon, TrendingDown, TrendingUp, ReceiptText, Search, X, RotateCcw, Handshake } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { useStore } from '../store';
import type { Wallet } from '../types';
import { walletBalance, expenseFlow, monthKey } from '../db';
import { fmtMoney, fmtDate, typeLabel, statusLabel } from '../utils';
import WalletModal from '../components/WalletModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExpenseModal from '../components/ExpenseModal';

export default function Wallets() {
  const { db, deleteWallet, deleteSettlement, showToast } = useStore();
  const { wallets, expenses, settings: { currency } } = db;
  const [editW, setEditW] = useState<Wallet | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [undoStlId, setUndoStlId] = useState<string | null>(null);
  const [selectedWalletForTx, setSelectedWalletForTx] = useState<Wallet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDelete = (id: string) => {
    if (!deleteWallet(id)) {
      showToast('Cannot delete the only wallet.');
      return;
    }
    if (selectedWalletForTx?.id === id) {
      setSelectedWalletForTx(null);
    }
    setDelId(null);
  };

  const activeWallet = selectedWalletForTx;

  const unifiedTransactions = useMemo(() => {
    if (!activeWallet) return [];
    const expItems = expenses
      .filter(e => e.walletId === activeWallet.id)
      .map(e => ({
        id: e.id,
        isSettlement: false as const,
        description: e.description,
        category: e.category,
        date: e.date,
        createdAt: e.createdAt,
        amount: Number(e.amount),
        flow: expenseFlow(e),
        statusKey: e.settled ? 'settled' : e.status,
        typeLabelStr: typeLabel(e.type),
        rawExpense: e,
      }));

    const stlItems = db.settlements
      .filter(s => s.walletId === activeWallet.id)
      .map(s => {
        const friend = db.friends.find(f => f.id === s.friendId);
        const friendName = friend ? friend.name : 'Friend';
        const flow = s.amount >= 0 ? 'in' : 'out';
        return {
          id: s.id,
          isSettlement: true as const,
          description: `Settlement: ${s.amount >= 0 ? 'Received from' : 'Paid to'} ${friendName}${s.note ? ` (${s.note})` : ''}`,
          category: 'Settlement',
          date: s.date,
          createdAt: s.createdAt,
          amount: Math.abs(s.amount),
          flow: flow as 'in' | 'out',
          statusKey: 'settled',
          typeLabelStr: 'Settlement',
          rawSettlement: s,
        };
      });

    const combined = [...expItems, ...stlItems];
    combined.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    return combined;
  }, [activeWallet, expenses, db.settlements, db.friends]);

  const filteredTx = useMemo(() => {
    if (!searchQuery.trim()) return unifiedTransactions;
    const q = searchQuery.toLowerCase();
    return unifiedTransactions.filter(t =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [unifiedTransactions, searchQuery]);

  const walletExpenses = activeWallet
    ? [...expenses.filter(e => e.walletId === activeWallet.id)].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const walletSettlements = activeWallet
    ? [...db.settlements.filter(s => s.walletId === activeWallet.id)].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const walletMonthSpend = walletExpenses
    .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'out' && e.status !== 'unpaid')
    .reduce((s, e) => s + Number(e.amount), 0) +
    walletSettlements
      .filter(s => monthKey(s.date) === thisKey && s.amount < 0)
      .reduce((acc, s) => acc + Math.abs(s.amount), 0);

  const walletMonthIn = walletExpenses
    .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'in' && e.status !== 'unpaid')
    .reduce((s, e) => s + Number(e.amount), 0) +
    walletSettlements
      .filter(s => monthKey(s.date) === thisKey && s.amount > 0)
      .reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="view-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallets</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Wallet
        </button>
      </div>

      {/* Wallet Cards Grid Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
        {wallets.map(w => {
          const bal = walletBalance(db, w.id);
          const wExpenses = expenses.filter(e => e.walletId === w.id);
          const wSettlements = db.settlements.filter(s => s.walletId === w.id);
          const wExpCount = wExpenses.length + wSettlements.length;

          const wSpend = wExpenses
            .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'out' && e.status !== 'unpaid')
            .reduce((s, e) => s + Number(e.amount), 0);

          return (
            <div
              key={w.id}
              style={{
                background: 'var(--surface)',
                border: `1.5px solid var(--border)`,
                borderRadius: 12,
                padding: '18px 20px',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow)',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: `${w.color}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <WalletIcon style={{ color: w.color }} size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{w.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Opening: {fmtMoney(w.openingBalance, currency)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="btn-icon" style={{ padding: 5 }} onClick={() => setEditW(w)} title="Edit Wallet">
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: 5, color: 'var(--debit)' }}
                      onClick={() => setDelId(w.id)}
                      disabled={wallets.length <= 1}
                      title="Delete Wallet"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 24, fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)', marginBottom: 14 }}>
                  {fmtMoney(bal, currency)}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-2)', marginBottom: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span>Monthly Spend</span>
                  <span style={{ fontWeight: 600, color: 'var(--debit)' }}>-{fmtMoney(wSpend, currency)}</span>
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}
                  onClick={() => {
                    setSelectedWalletForTx(w);
                    setSearchQuery('');
                  }}
                >
                  <ReceiptText size={16} />
                  View Transactions ({wExpCount})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wallet Transactions Slide-over Drawer */}
      <Drawer
        anchor={window.innerWidth < 600 ? 'bottom' : 'right'}
        open={Boolean(activeWallet)}
        onClose={() => setSelectedWalletForTx(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 540 },
            maxHeight: { xs: '85vh', sm: '100vh' },
            borderTopLeftRadius: { xs: 20, sm: 0 },
            borderTopRightRadius: { xs: 20, sm: 0 },
            bgcolor: 'var(--surface)',
            color: 'var(--text)',
            p: 0,
            backgroundImage: 'none',
            boxShadow: 'var(--shadow-lg)',
          }
        }}
      >
        {activeWallet && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'var(--surface)' }}>
            {/* Mobile Handle Indicator */}
            <Box sx={{ display: { xs: 'block', sm: 'none' }, width: 36, height: 4, bgcolor: 'var(--border2)', borderRadius: 99, mx: 'auto', mt: 1.2, mb: 0.5 }} />

            {/* Drawer Header */}
            <Box sx={{ p: 2.5, borderBottom: '1px solid var(--border)', bgcolor: 'var(--surface)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 2.5,
                      bgcolor: `${activeWallet.color}18`,
                      border: `1px solid ${activeWallet.color}33`,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <WalletIcon style={{ color: activeWallet.color }} size={20} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', leading: 1.2, color: 'var(--text)' }}>
                      {activeWallet.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-2)' }}>
                      Current Balance: <strong style={{ color: walletBalance(db, activeWallet.id) < 0 ? 'var(--debit)' : 'var(--text)' }}>
                        {fmtMoney(walletBalance(db, activeWallet.id), currency)}
                      </strong>
                    </Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setSelectedWalletForTx(null)} sx={{ color: 'var(--text-2)' }}>
                  <X size={18} />
                </IconButton>
              </Box>

              {/* Monthly Stats Bar */}
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                mt: 2, p: '12px 16px', borderRadius: 2.5,
                bgcolor: 'var(--surface2)', border: '1px solid var(--border)'
              }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block', fontSize: '0.72rem', fontWeight: 500, mb: 0.3 }}>
                    This Month Spent
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--debit)', display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: '0.92rem' }}>
                    <TrendingDown size={16} /> -{fmtMoney(walletMonthSpend, currency)}
                  </Typography>
                </Box>

                <Box sx={{ height: 28, width: '1px', bgcolor: 'var(--border)' }} />

                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block', fontSize: '0.72rem', fontWeight: 500, mb: 0.3 }}>
                    This Month Inflow
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--credit)', display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: '0.92rem' }}>
                    <TrendingUp size={16} /> +{fmtMoney(walletMonthIn, currency)}
                  </Typography>
                </Box>
              </Box>

              {/* Search & Action Bar */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search wallet transactions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} style={{ color: 'var(--text-3)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      fontSize: '0.85rem',
                      color: 'var(--text)',
                      bgcolor: 'var(--surface2)',
                      '& fieldset': { borderColor: 'var(--border)' },
                      '&:hover fieldset': { borderColor: 'var(--border2)' },
                      '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '0 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
                  onClick={() => setShowAddExp(true)}
                >
                  <Plus size={16} /> Add
                </button>
              </Box>
            </Box>

            {/* Transactions Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'var(--surface)' }}>
              {filteredTx.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'var(--text-2)' }}>
                  <Typography variant="body2">No matching transactions found.</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {filteredTx.map(tx => {
                    const cat = db.settings.categories.find(c => c.name === tx.category);
                    const isIn = tx.flow === 'in';

                    return (
                      <Box
                        key={tx.id}
                        sx={{
                          p: 1.75,
                          borderRadius: 2.5,
                          border: '1px solid var(--border)',
                          bgcolor: 'var(--surface2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          '&:hover': { bgcolor: 'var(--surface3)', borderColor: 'var(--border2)' },
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                          {tx.isSettlement ? (
                            <Box
                              sx={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                bgcolor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid var(--credit)',
                                color: 'var(--credit)',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Handshake size={14} />
                            </Box>
                          ) : (
                            cat && (
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: cat.color,
                                  flexShrink: 0,
                                }}
                              />
                            )
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                              {tx.description}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2 }}>
                              <span>{fmtDate(tx.date)}</span>
                              <span>·</span>
                              <span>{tx.category}</span>
                              <span>·</span>
                              <span>{tx.typeLabelStr}</span>
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: isIn ? 'var(--credit)' : 'var(--text)', fontSize: '0.92rem' }}>
                            {isIn ? '+' : '-'}{fmtMoney(tx.amount, currency)}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <span className={`badge badge-${tx.statusKey}`} style={{ fontSize: 10 }}>
                              {statusLabel(tx.statusKey)}
                            </span>
                            {tx.isSettlement && (
                              <button
                                className="btn-icon"
                                style={{ color: '#d97706', padding: 2 }}
                                title="Undo Settlement"
                                onClick={() => setUndoStlId(tx.id)}
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {showAdd && <WalletModal onClose={() => setShowAdd(false)} />}
      {editW && <WalletModal wallet={editW} onClose={() => setEditW(null)} />}
      {showAddExp && activeWallet && <ExpenseModal expense={{ walletId: activeWallet.id } as never} onClose={() => setShowAddExp(false)} />}
      {delId && (
        <ConfirmDialog
          title="Delete Wallet"
          message="All expenses in this wallet will be moved to another wallet. Are you sure?"
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
      {undoStlId && (
        <ConfirmDialog
          title="Undo Settlement"
          message="Are you sure you want to undo this settlement? The settlement will be deleted and associated expenses marked as unsettled again."
          confirmLabel="Undo Settlement"
          onConfirm={() => {
            deleteSettlement(undoStlId);
            setUndoStlId(null);
            showToast('Settlement undone. Balance restored.');
          }}
          onClose={() => setUndoStlId(null)}
        />
      )}
    </div>
  );
}
