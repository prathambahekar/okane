import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Wallet as WalletIcon,
  TrendingDown,
  TrendingUp,
  ReceiptText,
  X,
  RotateCcw,
  Handshake,
  ArrowLeftRight,
  PiggyBank,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  FolderPlus,
  Store,
} from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useStore } from '../store';
import type { Wallet, Envelope } from '../types';
import { walletBalance, walletEnvelopeAllocated, walletUnallocatedBalance, expenseFlow, monthKey } from '../db';
import { fmtMoney, fmtDate, typeLabel, statusLabel } from '../utils';
import WalletModal from '../components/WalletModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExpenseModal from '../components/ExpenseModal';
import TransferModal from '../components/TransferModal';
import EnvelopeModal from '../components/EnvelopeModal';
import { getEnvelopeIconComponent } from '../utils/envelopeUtils';
import EnvelopeFundModal from '../components/EnvelopeFundModal';

export default function Wallets() {
  const { db, deleteWallet, deleteSettlement, deleteEnvelope, showToast } = useStore();
  const { wallets, expenses, envelopes = [], settings } = db;
  const currency = settings?.currency || 'INR';
  const enableEnvelopes = settings?.enableEnvelopes ?? false;

  const [editW, setEditW] = useState<Wallet | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [undoStlId, setUndoStlId] = useState<string | null>(null);
  const [selectedWalletForTx, setSelectedWalletForTx] = useState<Wallet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | undefined>(undefined);

  // Envelope state
  const [showEnvelopeModal, setShowEnvelopeModal] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [fundingEnvelope, setFundingEnvelope] = useState<Envelope | null>(null);
  const [deletingEnvelopeId, setDeletingEnvelopeId] = useState<string | null>(null);
  const [envelopeWalletFilter, setEnvelopeWalletFilter] = useState<string>('all');
  const [defaultEnvelopeWalletId, setDefaultEnvelopeWalletId] = useState<string | undefined>(undefined);

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

  const handleDeleteEnvelope = (id: string) => {
    deleteEnvelope(id);
    setDeletingEnvelopeId(null);
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
        statusKey: expenseFlow(e) === 'in' ? 'none' : (e.settled ? 'settled' : (e.type === 'for_friend' || e.type === 'by_friend' ? 'unsettled' : (e.status || 'paid'))),
        typeLabelStr: typeLabel(e.type),
        rawExpense: e,
        vendorId: e.vendorId,
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

  const now = useMemo(() => new Date(), []);
  const thisKey = useMemo(() => now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), [now]);

  const walletExpenses = useMemo(() => {
    if (!activeWallet) return [];
    return [...expenses.filter(e => e.walletId === activeWallet.id)].sort((a, b) => b.date.localeCompare(a.date));
  }, [activeWallet, expenses]);

  const walletSettlements = useMemo(() => {
    if (!activeWallet) return [];
    return [...db.settlements.filter(s => s.walletId === activeWallet.id)].sort((a, b) => b.date.localeCompare(a.date));
  }, [activeWallet, db.settlements]);

  const walletMonthSpend = useMemo(() => {
    return walletExpenses
      .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'out' && e.status !== 'unpaid')
      .reduce((s, e) => s + Number(e.amount), 0) +
      walletSettlements
        .filter(s => monthKey(s.date) === thisKey && s.amount < 0)
        .reduce((acc, s) => acc + Math.abs(s.amount), 0);
  }, [walletExpenses, walletSettlements, thisKey]);

  const walletMonthIn = useMemo(() => {
    return walletExpenses
      .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'in' && e.status !== 'unpaid')
      .reduce((s, e) => s + Number(e.amount), 0) +
      walletSettlements
        .filter(s => monthKey(s.date) === thisKey && s.amount > 0)
        .reduce((acc, s) => acc + s.amount, 0);
  }, [walletExpenses, walletSettlements, thisKey]);

  const walletCardsData = useMemo(() => {
    return wallets.map(w => {
      const bal = walletBalance(db, w.id);
      const allocated = walletEnvelopeAllocated(db, w.id);
      const unallocated = walletUnallocatedBalance(db, w.id);
      const wEnvelopes = envelopes.filter(e => e.walletId === w.id);
      const wExpenses = expenses.filter(e => e.walletId === w.id);
      const wSettlements = (db.settlements || []).filter(s => s.walletId === w.id);
      const wExpCount = wExpenses.length + wSettlements.length;

      const wSpend = wExpenses
        .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'out' && e.status !== 'unpaid')
        .reduce((s, e) => s + Number(e.amount), 0) +
        wSettlements
          .filter(s => monthKey(s.date) === thisKey && s.amount < 0)
          .reduce((acc, s) => acc + Math.abs(s.amount), 0);

      return {
        wallet: w,
        bal,
        allocated,
        unallocated,
        wEnvelopes,
        wExpCount,
        wSpend,
      };
    });
  }, [wallets, db, envelopes, expenses, thisKey]);

  // Envelopes statistics
  const filteredEnvelopes = useMemo(() => {
    if (envelopeWalletFilter === 'all') return envelopes;
    return envelopes.filter(e => e.walletId === envelopeWalletFilter);
  }, [envelopes, envelopeWalletFilter]);

  const totalGoalTarget = useMemo(() => {
    return filteredEnvelopes.reduce((sum, e) => sum + (Number(e.targetAmount) || 0), 0);
  }, [filteredEnvelopes]);

  const totalGoalCurrent = useMemo(() => {
    return filteredEnvelopes.reduce((sum, e) => sum + (Number(e.currentAmount) || 0), 0);
  }, [filteredEnvelopes]);

  const overallProgressPct = totalGoalTarget > 0 ? Math.min(100, Math.round((totalGoalCurrent / totalGoalTarget) * 100)) : 0;

  return (
    <div className="view-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{enableEnvelopes ? 'Wallets & Envelopes' : 'Wallets'}</h1>
          <p className="page-subtitle desktop-only">
            {enableEnvelopes
              ? 'Manage your physical wallets, bank accounts, and goal-based envelopes.'
              : 'Manage your physical wallets and bank accounts.'}
          </p>
        </div>
        <div className="page-header-actions">
          {enableEnvelopes && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setDefaultEnvelopeWalletId(undefined);
                setEditingEnvelope(null);
                setShowEnvelopeModal(true);
              }}
            >
              <FolderPlus size={16} /> New Goal Envelope
            </button>
          )}
          {wallets.length >= 2 && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setTransferFromId(undefined);
                setShowTransfer(true);
              }}
            >
              <ArrowLeftRight size={16} /> Transfer Funds
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Wallet
          </button>
        </div>
      </div>

      {/* Wallet Cards Grid Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {walletCardsData.map(({ wallet: w, bal, allocated, unallocated, wEnvelopes, wExpCount, wSpend }) => {
          return (
            <div
              key={w.id}
              style={{
                background: 'var(--surface)',
                border: `1.5px solid var(--border)`,
                borderRadius: 14,
                padding: '20px',
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
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: `${w.color}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <WalletIcon style={{ color: w.color }} size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{w.name}</div>
                      {enableEnvelopes && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {wEnvelopes.length} {wEnvelopes.length === 1 ? 'Goal Envelope' : 'Goal Envelopes'}
                        </div>
                      )}
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

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    Total Wallet Balance
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>
                    {fmtMoney(bal, currency)}
                  </div>

                  {/* Allocated vs Unallocated Breakdown Bar */}
                  {enableEnvelopes && bal > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>
                        <span>Available: <strong style={{ color: 'var(--text)' }}>{fmtMoney(unallocated, currency)}</strong></span>
                        <span>Saved Goals: <strong style={{ color: w.color }}>{fmtMoney(allocated, currency)}</strong></span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden', display: 'flex' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, (allocated / bal) * 100))}%`,
                            background: w.color,
                            transition: 'width 0.3s ease',
                          }}
                          title={`Allocated to goals: ${fmtMoney(allocated, currency)}`}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--surface-hover)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                      Opening Balance: <strong style={{ color: 'var(--text)' }}>{fmtMoney(w.openingBalance, currency)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-2)', marginBottom: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span>Monthly Spend</span>
                  <span style={{ fontWeight: 600, color: 'var(--debit)' }}>-{fmtMoney(wSpend, currency)}</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {enableEnvelopes && (
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 8px' }}
                      onClick={() => {
                        setDefaultEnvelopeWalletId(w.id);
                        setEditingEnvelope(null);
                        setShowEnvelopeModal(true);
                      }}
                      title="Add envelope to this wallet"
                    >
                      <Plus size={14} />
                      Goal
                    </button>
                  )}
                  {wallets.length >= 2 && (
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 8px' }}
                      onClick={() => {
                        setTransferFromId(w.id);
                        setShowTransfer(true);
                      }}
                      title="Transfer funds from this wallet"
                    >
                      <ArrowLeftRight size={14} />
                      Transfer
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 8px' }}
                    onClick={() => {
                      setSelectedWalletForTx(w);
                      setSearchQuery('');
                    }}
                  >
                    <ReceiptText size={14} />
                    Tx ({wExpCount})
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Envelopes Section */}
      {enableEnvelopes && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 16,
            padding: 24,
            boxShadow: 'var(--shadow)',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3B82F6',
              }}
            >
              <PiggyBank size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Goal-Based Envelopes</h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '2px 0 0 0' }}>
                Track dedicated savings targets (e.g. Emergency reserve, Vacation, Buying a gadget) inside your wallets.
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setDefaultEnvelopeWalletId(undefined);
              setEditingEnvelope(null);
              setShowEnvelopeModal(true);
            }}
          >
            <Plus size={16} /> Create Goal Envelope
          </button>
        </div>

        {/* Filters & Overall Stats */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {/* Wallet Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setEnvelopeWalletFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 600,
                border: envelopeWalletFilter === 'all' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: envelopeWalletFilter === 'all' ? 'var(--accent)18' : 'var(--surface2)',
                color: envelopeWalletFilter === 'all' ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              All Wallets ({envelopes.length})
            </button>
            {wallets.map(w => {
              const count = envelopes.filter(e => e.walletId === w.id).length;
              const isSel = envelopeWalletFilter === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setEnvelopeWalletFilter(w.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: isSel ? `1.5px solid ${w.color}` : '1px solid var(--border)',
                    background: isSel ? `${w.color}18` : 'var(--surface2)',
                    color: isSel ? w.color : 'var(--text-2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: w.color }} />
                  {w.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Goal Progress Summary Badge */}
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Saved
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {fmtMoney(totalGoalCurrent, currency)}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', marginLeft: 4 }}>
                  / {fmtMoney(totalGoalTarget, currency)}
                </span>
              </div>
            </div>

            <div style={{ width: 100 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-2)', marginBottom: 3 }}>
                <span>Achieved</span>
                <span style={{ fontWeight: 700, color: 'var(--credit)' }}>{overallProgressPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface3)', overflow: 'hidden' }}>
                <div style={{ width: `${overallProgressPct}%`, height: '100%', background: 'var(--credit)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Envelope Grid */}
        {filteredEnvelopes.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: 'var(--surface2)',
              borderRadius: 12,
              border: '1px dashed var(--border2)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto',
                color: '#3B82F6',
              }}
            >
              <PiggyBank size={24} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>No envelopes yet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 400, margin: '0 auto 16px auto' }}>
              Create goal-based envelopes like Emergency Reserve, Vacation, or Tech Upgrade to allocate your savings purposefully.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setDefaultEnvelopeWalletId(envelopeWalletFilter !== 'all' ? envelopeWalletFilter : undefined);
                setEditingEnvelope(null);
                setShowEnvelopeModal(true);
              }}
            >
              <Plus size={16} /> Add First Savings Goal
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filteredEnvelopes.map(env => {
              const targetWal = wallets.find(w => w.id === env.walletId);
              const pct = env.targetAmount > 0 ? Math.min(100, Math.round((env.currentAmount / env.targetAmount) * 100)) : 100;
              const isCompleted = env.targetAmount > 0 && env.currentAmount >= env.targetAmount;
              const remaining = Math.max(0, env.targetAmount - env.currentAmount);

              return (
                <div
                  key={env.id}
                  style={{
                    background: 'var(--surface2)',
                    border: `1.5px solid ${isCompleted ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)'}`,
                    borderRadius: 14,
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: `${env.color}22`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: env.color,
                            flexShrink: 0,
                          }}
                        >
                          {React.createElement(getEnvelopeIconComponent(env.icon), { size: 20 })}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {env.name}
                            {isCompleted && <CheckCircle2 size={16} style={{ color: 'var(--credit)' }} />}
                          </div>
                          {targetWal && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: targetWal.color }} />
                              {targetWal.name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          className="btn-icon"
                          style={{ padding: 4 }}
                          onClick={() => {
                            setEditingEnvelope(env);
                            setShowEnvelopeModal(true);
                          }}
                          title="Edit Envelope Goal"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ padding: 4, color: 'var(--debit)' }}
                          onClick={() => setDeletingEnvelopeId(env.id)}
                          title="Delete Envelope"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Numbers */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                        {fmtMoney(env.currentAmount, currency)}
                        {env.targetAmount > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 6 }}>
                            / {fmtMoney(env.targetAmount, currency)}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {env.targetAmount > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>
                            <span>{pct}% complete</span>
                            <span>{remaining > 0 ? `${fmtMoney(remaining, currency)} left` : 'Goal Reached!'}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface3)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: isCompleted ? 'var(--credit)' : env.color,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata Badges */}
                    {(env.targetDate || env.notes) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {env.targetDate && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'var(--surface3)',
                              border: '1px solid var(--border)',
                              fontSize: 10.5,
                              color: 'var(--text-2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Calendar size={11} /> Target: {fmtDate(env.targetDate)}
                          </span>
                        )}
                        {env.notes && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'var(--surface3)',
                              border: '1px solid var(--border)',
                              fontSize: 10.5,
                              color: 'var(--text-2)',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={env.notes}
                          >
                            {env.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fund Actions */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <button
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 10px',
                        color: 'var(--credit)',
                      }}
                      onClick={() => setFundingEnvelope(env)}
                    >
                      <ArrowDownLeft size={14} /> Deposit
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 10px',
                        color: 'var(--debit)',
                      }}
                      onClick={() => setFundingEnvelope(env)}
                    >
                      <ArrowUpRight size={14} /> Withdraw
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Wallet Transactions Slide-over Drawer */}
      <Drawer
        anchor={window.innerWidth < 600 ? 'bottom' : 'right'}
        open={Boolean(activeWallet)}
        onClose={() => setSelectedWalletForTx(null)}
        disableAutoFocus
        disableRestoreFocus
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
                <IconButton size="small" onClick={() => setSelectedWalletForTx(null)} sx={{ color: 'var(--text-2)', display: { xs: 'none', md: 'inline-flex' } }}>
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

              {/* Action Bar */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-3)', fontWeight: 600 }}>
                  {filteredTx.length} transaction{filteredTx.length === 1 ? '' : 's'} recorded
                </Typography>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '0 14px', flexShrink: 0, whiteSpace: 'nowrap', height: 32 }}
                  onClick={() => setShowAddExp(true)}
                >
                  <Plus size={16} /> Add Transaction
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                                {tx.description}
                              </Typography>
                              {(() => {
                                const vendor = 'vendorId' in tx && tx.vendorId ? db.friends.find(f => f.id === tx.vendorId) : null;
                                if (!vendor) return null;
                                return (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '1px 6px',
                                      borderRadius: 6,
                                      background: 'var(--surface3)',
                                      border: '1px solid var(--border)',
                                      fontSize: 10,
                                      color: 'var(--text-2)',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={`Vendor: ${vendor.name}`}
                                  >
                                    <Store size={10} style={{ color: 'var(--accent)' }} />
                                    {vendor.name}
                                  </span>
                                );
                              })()}
                            </Box>
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
                            {tx.statusKey && tx.statusKey !== 'none' && statusLabel(tx.statusKey) && (
                              <span className={`badge badge-${tx.statusKey}`} style={{ fontSize: 10 }}>
                                {statusLabel(tx.statusKey)}
                              </span>
                            )}
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

      {/* Wallet Modals */}
      {showAdd && <WalletModal onClose={() => setShowAdd(false)} />}
      {editW && <WalletModal wallet={editW} onClose={() => setEditW(null)} />}
      {showAddExp && activeWallet && <ExpenseModal expense={{ walletId: activeWallet.id } as never} onClose={() => setShowAddExp(false)} />}
      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        defaultFromWalletId={transferFromId}
      />

      {/* Envelope Modals */}
      {showEnvelopeModal && (
        <EnvelopeModal
          envelope={editingEnvelope}
          defaultWalletId={defaultEnvelopeWalletId}
          onClose={() => {
            setShowEnvelopeModal(false);
            setEditingEnvelope(null);
            setDefaultEnvelopeWalletId(undefined);
          }}
        />
      )}

      {fundingEnvelope && (
        <EnvelopeFundModal
          envelope={fundingEnvelope}
          onClose={() => setFundingEnvelope(null)}
        />
      )}

      {delId && (
        <ConfirmDialog
          title="Delete Wallet"
          message="All expenses in this wallet will be moved to another wallet. Are you sure?"
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}

      {deletingEnvelopeId && (
        <ConfirmDialog
          title="Delete Goal Envelope"
          message="Are you sure you want to delete this savings goal envelope?"
          confirmLabel="Delete Envelope"
          onConfirm={() => handleDeleteEnvelope(deletingEnvelopeId)}
          onClose={() => setDeletingEnvelopeId(null)}
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
