import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit2,
  Trash2,
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
  Users,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useStore } from '../store';
import type { Wallet, Envelope, Expense, Settlement } from '../types';
import { walletBalance, walletEnvelopeAllocated, walletUnallocatedBalance, expenseFlow, monthKey } from '../db';
import { fmtMoney, fmtDate, typeLabel, statusLabel, groupExpenses, resolveCategoryMeta, type GroupedExpense } from '../utils';
import WalletModal from '../components/WalletModal';
import { renderWalletIcon } from '../components/WalletIconRenderer';
import ConfirmDialog from '../components/ConfirmDialog';
import ExpenseModal from '../components/ExpenseModal';
import TransferModal from '../components/TransferModal';
import EnvelopeModal from '../components/EnvelopeModal';
import { getEnvelopeIconComponent } from '../utils/envelopeUtils';
import EnvelopeFundModal from '../components/EnvelopeFundModal';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import SettlementDetailModal from '../components/SettlementDetailModal';
import CategoryIcon from '../components/CategoryIcon';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

export default function Wallets({ initialArg, onClearViewArg }: { initialArg?: string; onClearViewArg?: () => void }) {
  const { db, deleteWallet, updateWallet, deleteSettlement, deleteEnvelope, deleteExpense, showToast } = useStore();
  const { wallets, expenses, envelopes = [], settings } = db;
  const currency = settings?.currency || 'INR';
  const enableEnvelopes = settings?.enableEnvelopes ?? false;

  const [editW, setEditW] = useState<Wallet | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [undoStlId, setUndoStlId] = useState<string | null>(null);
  const [selectedWalletForTx, setSelectedWalletForTx] = useState<Wallet | null>(null);

  useBackButtonModal(Boolean(selectedWalletForTx), () => setSelectedWalletForTx(null), { priority: BackPriority.SUBVIEW });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [delExpId, setDelExpId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      return;
    }

    const timer = setTimeout(() => {
      const targetW = wallets.find(w => w.id === initialArg || w.name.toLowerCase().includes(initialArg.toLowerCase()));
      if (targetW) {
        setSelectedWalletForTx(targetW);
      } else {
        setSearchQuery(initialArg);
      }
      onClearViewArg?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, wallets, onClearViewArg]);
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

  const categoriesMap = useMemo(() => new Map((settings?.categories || []).map(c => [c.name, c])), [settings?.categories]);
  const friendsMap = useMemo(() => new Map((db.friends || []).map(f => [f.id, f])), [db.friends]);

  useEffect(() => {
    if (!activeWallet) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedWalletForTx(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWallet]);

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
    const defaultWalId = settings?.defaultWalletId || wallets[0]?.id;
    const mapped = wallets.map(w => {
      const isDefault = w.id === defaultWalId || Boolean(w.isDefault);
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
        isDefault,
        bal,
        allocated,
        unallocated,
        wEnvelopes,
        wExpCount,
        wSpend,
      };
    });

    // Default wallet always shown on top / first
    return mapped.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
  }, [wallets, db, envelopes, expenses, thisKey, settings?.defaultWalletId]);

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
        <div className="page-header-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <button
            className="btn btn-secondary"
            style={{
              borderRadius: 10,
              padding: '9px 16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1.5px solid var(--border)',
            }}
            onClick={() => {
              setTransferFromId(undefined);
              setShowTransfer(true);
            }}
          >
            <ArrowLeftRight size={16} /> Transfer Funds
          </button>
          <button
            className="btn btn-primary"
            style={{
              borderRadius: 10,
              padding: '9px 20px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onClick={() => setShowAdd(true)}
          >
            <Plus size={16} /> Add Wallet
          </button>
        </div>
      </div>

      {/* Wallet Cards Grid Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
        {walletCardsData.map(({ wallet: w, isDefault, bal, allocated, unallocated, wEnvelopes, wExpCount, wSpend }) => {
          return (
            <div
              key={w.id}
              style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 16,
                padding: '24px',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow)',
                position: 'relative',
              }}
            >
              <div>
                {/* Top Card Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {renderWalletIcon(w.icon || 'wallet', 44, w.color || '#d97706')}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{w.name}</span>
                        {isDefault && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              fontSize: 10.5,
                              fontWeight: 700,
                              border: '1px solid var(--accent-border-soft, var(--accent))',
                              letterSpacing: '0.2px',
                            }}
                          >
                            Default
                          </span>
                        )}
                        {w.isHidden && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: 'var(--debit)',
                              fontSize: 10.5,
                              fontWeight: 700,
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              letterSpacing: '0.2px',
                            }}
                            title="Hidden from Dashboard & Total Net Worth"
                          >
                            <EyeOff size={11} /> Hidden
                          </span>
                        )}
                      </div>
                      {enableEnvelopes && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                          {wEnvelopes.length} {wEnvelopes.length === 1 ? 'Goal Envelope' : 'Goal Envelopes'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn-icon"
                      style={{
                        padding: 7,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                        color: 'var(--text-2)',
                      }}
                      onClick={() => setEditW(w)}
                      title="Edit Wallet"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!isDefault && (
                      <button
                        className="btn-icon"
                        style={{
                          padding: 7,
                          borderRadius: 8,
                          border: w.isHidden ? '1px solid var(--debit)' : '1px solid var(--border)',
                          background: w.isHidden ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface2)',
                          color: w.isHidden ? 'var(--debit)' : 'var(--text-2)',
                        }}
                        onClick={() => {
                          const nextState = !w.isHidden;
                          updateWallet(w.id, { isHidden: nextState });
                          showToast(nextState ? `Wallet "${w.name}" is now hidden` : `Wallet "${w.name}" is now visible`);
                        }}
                        title={w.isHidden ? 'Unhide Wallet (Show in Dashboard/Totals)' : 'Hide Wallet (Hide from Dashboard/Totals)'}
                      >
                        {w.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    )}
                    <button
                      className="btn-icon"
                      style={{
                        padding: 7,
                        borderRadius: 8,
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        background: 'var(--surface2)',
                        color: 'var(--debit)',
                      }}
                      onClick={() => setDelId(w.id)}
                      disabled={wallets.length <= 1}
                      title="Delete Wallet"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Total Balance Block */}
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      marginBottom: 4,
                    }}
                  >
                    TOTAL WALLET BALANCE
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: bal < 0 ? 'var(--debit)' : 'var(--text)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {fmtMoney(bal, currency)}
                  </div>

                  {/* Opening Balance Badge Pill */}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      Opening Balance: <strong style={{ color: 'var(--text)', marginLeft: 4 }}>{fmtMoney(w.openingBalance, currency)}</strong>
                    </span>
                  </div>

                  {/* Allocated vs Unallocated Breakdown Bar */}
                  {enableEnvelopes && bal > 0 && (
                    <div style={{ marginTop: 12 }}>
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
                </div>
              </div>

              <div>
                {/* Monthly Spend Row - Clean spacing without splitting border lines */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13.5,
                    color: 'var(--text-2)',
                    marginBottom: 14,
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Monthly Spend</span>
                  <span style={{ fontWeight: 700, color: 'var(--debit)' }}>-{fmtMoney(wSpend, currency)}</span>
                </div>

                {/* Bottom Action Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {enableEnvelopes && (
                    <button
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        padding: '9px 10px',
                        borderRadius: 10,
                        border: '1.5px solid var(--border)',
                        background: 'var(--surface2)',
                      }}
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
                  <button
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                    }}
                    onClick={() => {
                      setTransferFromId(w.id);
                      setShowTransfer(true);
                    }}
                    title="Transfer funds from this wallet"
                  >
                    <ArrowLeftRight size={15} />
                    Transfer
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                    }}
                    onClick={() => {
                      setSelectedWalletForTx(w);
                      setSearchQuery('');
                    }}
                  >
                    <ReceiptText size={15} />
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

      {/* Wallet Transactions Modern Drawer Modal */}
      {activeWallet && createPortal(
        <div
          className="modal-backdrop"
          style={{
            zIndex: 100040,
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setSelectedWalletForTx(null);
          }}
        >
          <div
            className="modal wallet-drawer-modal"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Bottom-Sheet Handle Indicator */}
            <div className="modal-handle-bar">
              <div className="modal-handle" />
            </div>

            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px 8px',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              {/* Wallet Info & Close */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {renderWalletIcon(activeWallet.icon, 40, activeWallet.color)}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                      {activeWallet.name}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: 2 }}>
                      Current Balance:{' '}
                      <strong style={{ color: walletBalance(db, activeWallet.id) < 0 ? 'var(--debit)' : 'var(--text)', fontWeight: 700 }}>
                        {fmtMoney(walletBalance(db, activeWallet.id), currency)}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  className="btn-icon"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text-2)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedWalletForTx(null)}
                  title="Close"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Monthly Stats Bar - Two balanced stat cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingDown size={13} style={{ color: 'var(--debit)' }} />
                    <span>This Month Spent</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--debit)', letterSpacing: '-0.2px' }}>
                    -{fmtMoney(walletMonthSpend, currency)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingUp size={13} style={{ color: 'var(--credit)' }} />
                    <span>This Month Inflow</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--credit)', letterSpacing: '-0.2px' }}>
                    +{fmtMoney(walletMonthIn, currency)}
                  </div>
                </div>
              </div>

              {/* Search Bar - Full Width without splitting lines or add transaction btn */}
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-3)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeWallet.name} transactions...`}
                  style={{
                    width: '100%',
                    height: 38,
                    paddingLeft: 34,
                    paddingRight: searchQuery ? 32 : 12,
                    fontSize: '13px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 2,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Subtitle Count Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 10,
                  fontSize: '11.5px',
                  color: 'var(--text-3)',
                  fontWeight: 500,
                }}
              >
                <span>{filteredTx.length} transaction{filteredTx.length === 1 ? '' : 's'} recorded</span>
                {searchQuery && <span>Filtered by "{searchQuery}"</span>}
              </div>
            </div>

            {/* Transactions Content List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 16px', background: 'var(--surface)' }}>
              {filteredTx.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-2)' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500 }}>
                    {searchQuery ? 'No matching transactions found.' : 'No transactions recorded yet.'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 4 }}>
                    {searchQuery ? 'Try searching with a different term' : 'Transactions associated with this wallet will appear here'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredTx.map(tx => {
                    const catMeta = resolveCategoryMeta(tx.category, categoriesMap.get(tx.category), tx.isSettlement, categoriesMap);
                    const isIn = tx.flow === 'in';
                    const rawExpense = !tx.isSettlement ? tx.rawExpense : undefined;
                    const rawSettlement = tx.isSettlement ? tx.rawSettlement : undefined;
                    const isSplit = Boolean(rawExpense && rawExpense.type !== 'personal');
                    const vendor = 'vendorId' in tx && tx.vendorId ? friendsMap.get(tx.vendorId) : null;
                    const friend = rawExpense?.friendId ? friendsMap.get(rawExpense.friendId) : null;

                    const handleRowClick = () => {
                      if (rawExpense) {
                        const rel = rawExpense.groupId
                          ? db.expenses.filter(x => x.groupId === rawExpense.groupId)
                          : [rawExpense];
                        const ge = groupExpenses(rel.length > 0 ? rel : [rawExpense], db.wallets, db.friends)[0];
                        if (ge) {
                          setSelectedDetailGe(ge);
                        }
                      } else if (rawSettlement) {
                        setSelectedSettlement(rawSettlement);
                      }
                    };

                    return (
                      <div
                        key={tx.id}
                        onClick={handleRowClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRowClick();
                          }
                        }}
                        style={{
                          padding: '11px 13px',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--surface2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        className="wallet-tx-item"
                      >
                        {/* Left Side: Icon + Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                          {/* Category / Settlement Icon Tile */}
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: catMeta.bg,
                              border: `1px solid ${catMeta.border}`,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              color: catMeta.color,
                            }}
                          >
                            {tx.isSettlement ? (
                              <Handshake size={18} style={{ color: '#10B981' }} />
                            ) : (
                              <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={18} style={{ color: catMeta.color }} />
                            )}
                          </div>

                          {/* Info Block */}
                          <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                            {/* Title Line */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: '13.5px',
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tx.description}
                              </span>
                              {isSplit && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    backgroundColor: 'var(--accent-soft)',
                                    color: 'var(--accent)',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Users size={10} />
                                  <span>Split</span>
                                </span>
                              )}
                            </div>

                            {/* Subtitle Hierarchy */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '11.5px',
                                color: 'var(--text-3)',
                                marginTop: 2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ flexShrink: 0 }}>{tx.category}</span>
                              <span style={{ flexShrink: 0 }}>•</span>
                              <span style={{ flexShrink: 0 }}>{fmtDate(tx.date)}</span>
                              {vendor && (
                                <>
                                  <span style={{ flexShrink: 0 }}>•</span>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      color: 'var(--text-2)',
                                      fontWeight: 500,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <Store size={11} style={{ color: 'var(--accent)' }} />
                                    {vendor.name}
                                  </span>
                                </>
                              )}
                              {friend && !vendor && (
                                <>
                                  <span style={{ flexShrink: 0 }}>•</span>
                                  <span
                                    style={{
                                      color: 'var(--text-2)',
                                      fontWeight: 500,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    with {friend.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Amount + Status */}
                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: isIn ? 'var(--credit)' : 'var(--debit)',
                            }}
                          >
                            {isIn ? '+' : '-'}{fmtMoney(tx.amount, currency)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                            {tx.statusKey && tx.statusKey !== 'none' && statusLabel(tx.statusKey) && (
                              <span className={`badge badge-${tx.statusKey}`} style={{ fontSize: 9.5, padding: '1px 5px' }}>
                                {statusLabel(tx.statusKey)}
                              </span>
                            )}
                            {tx.isSettlement && (
                              <button
                                className="btn-icon"
                                style={{
                                  color: '#d97706',
                                  padding: 2,
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                title="Undo Settlement"
                                onClick={e => {
                                  e.stopPropagation();
                                  setUndoStlId(tx.id);
                                }}
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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

      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={(exp) => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={(id) => {
            setSelectedDetailGe(null);
            setDelExpId(id);
          }}
        />
      )}

      {selectedSettlement && (
        <SettlementDetailModal
          settlement={selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
          onUndo={() => {
            setUndoStlId(selectedSettlement.id);
            setSelectedSettlement(null);
          }}
        />
      )}

      {editExp && (
        <ExpenseModal
          expense={editExp}
          onClose={() => setEditExp(null)}
        />
      )}

      {delExpId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Are you sure you want to delete this expense? Any amount deducted from your wallet will be added back automatically."
          onConfirm={() => {
            deleteExpense(delExpId);
            setDelExpId(null);
            showToast('Expense deleted & wallet balance restored');
          }}
          onClose={() => setDelExpId(null)}
        />
      )}
    </div>
  );
}
