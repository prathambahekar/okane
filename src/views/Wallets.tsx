import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit2,
  Trash2,
  TrendingDown,
  TrendingUp,
  ReceiptText,
  X,
  Handshake,
  ArrowLeftRight,
  Users,
  Search,
  Eye,
  EyeOff,
  MoreVertical,
} from 'lucide-react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useStore } from '../store';
import type { Wallet, Expense, Settlement } from '../types';
import { walletBalance, expenseFlow, monthKey } from '../db';
import DesktopSearchBar from '../components/DesktopSearchBar';
import SettlementBadge from '../components/common/SettlementBadge';
import { fmtMoney, fmtDate, typeLabel, statusLabel, groupExpenses, resolveCategoryMeta, cleanSettlementDescription, currencySymbol, type GroupedExpense } from '../utils';
import WalletModal from '../components/WalletModal';
import { renderWalletIcon } from '../components/WalletIconRenderer';
import ConfirmDialog from '../components/ConfirmDialog';
import ExpenseModal from '../components/ExpenseModal';
import TransferModal from '../components/TransferModal';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import SettlementDetailModal from '../components/SettlementDetailModal';
import CategoryIcon from '../components/CategoryIcon';
import { SmartExpenseMeta } from '../components/expenses/SmartExpenseMeta';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

export default function Wallets({ initialArg, onClearViewArg }: { initialArg?: string; onClearViewArg?: () => void }) {
  const { db, deleteWallet, updateWallet, deleteSettlement, deleteExpense, showToast } = useStore();
  const { wallets, expenses, settings } = db;
  const currency = settings?.currency || 'INR';

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

  // Overflow menu state for wallet cards
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuWallet, setMenuWallet] = useState<Wallet | null>(null);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, wallet: Wallet) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setMenuWallet(wallet);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuWallet(null);
  };

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
        const flow = s.amount >= 0 ? 'in' : 'out';
        return {
          id: s.id,
          isSettlement: true as const,
          description: `Settlement: ${s.amount >= 0 ? 'Received' : 'Paid'}${s.note ? ` (${s.note})` : ''}`,
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
  }, [activeWallet, expenses, db.settlements]);

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
  }, [wallets, db, expenses, thisKey, settings?.defaultWalletId]);

  return (
    <div className="view-container">
      {/* Page Header */}
      <div className="page-header wallets-page-header">
        <div className="desktop-only">
          <h1 className="page-title">Wallets</h1>
        </div>
        <DesktopSearchBar placeholder="Search wallets, transactions..." defaultTab="wallets" />
        <div className="page-header-actions wallets-header-actions">
          <button
            type="button"
            className="btn wallet-action-btn wallet-transfer-btn"
            title="Transfer Funds"
            aria-label="Transfer Funds"
            onClick={() => {
              setTransferFromId(undefined);
              setShowTransfer(true);
            }}
          >
            <ArrowLeftRight size={16} />
            <span className="wallet-transfer-btn-text">Transfer Funds</span>
          </button>
          <button
            type="button"
            className="btn btn-primary wallet-action-btn"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={16} /> Add Wallet
          </button>
        </div>
      </div>

      {/* Wallet Cards Grid Row */}
      <div
        className="wallet-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {walletCardsData.map(({ wallet: w, isDefault, bal, wExpCount, wSpend }, idx) => {
          return (
            <div
              key={`${w.id}-${idx}`}
              className="wallet-item-card"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 18,
                boxSizing: 'border-box',
                width: '100%',
                minHeight: 220,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                {/* Top Card Row: Icon, Title, Subtitle, and Action Icons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {renderWalletIcon(w.icon || w.name, 46, w.color || 'var(--accent)')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 'var(--fs-lg)',
                          color: 'var(--text)',
                          lineHeight: 1.25,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          flexWrap: 'wrap',
                        }}
                        title={w.name}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w.name}
                        </span>
                        {isDefault && (
                          <span className="wallet-badge-pill wallet-badge-default" style={{ flexShrink: 0 }}>
                            Default
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--fs-xs)',
                          color: 'var(--text-3)',
                          fontWeight: 500,
                          marginTop: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <span>Opening:</span>
                        <span style={{ color: 'var(--text)', fontWeight: 600, letterSpacing: '-0.1px' }}>
                          {fmtMoney(w.openingBalance, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Right More Options Button */}
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="wallet-more-btn"
                      onClick={(e) => handleMenuOpen(e, w)}
                      title="Wallet options"
                    >
                      <MoreVertical size={17} />
                    </button>
                  </div>
                </div>

                {/* Inner Balance Section */}
                <div
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="text-caption" style={{ marginBottom: 4 }}>
                      TOTAL BALANCE
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--fs-hero-sm)',
                        fontWeight: 800,
                        color: bal < 0 ? 'var(--debit)' : 'var(--text)',
                        lineHeight: 1.15,
                        letterSpacing: '-0.4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {fmtMoney(bal, currency)}
                    </div>
                  </div>

                  {/* Badges / Pill Tags on the Right */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {w.isHidden && (
                      <span
                        className="wallet-badge-pill wallet-badge-hidden"
                        title="Hidden from Dashboard"
                      >
                        <EyeOff size={11} /> <span className="wallet-badge-text">Hidden</span>
                      </span>
                    )}
                    <span
                      className={`wallet-badge-pill ${wSpend > 0 ? 'wallet-badge-spend-active' : 'wallet-badge-spend-zero'}`}
                      title={wSpend > 0 ? `Monthly spend: ${fmtMoney(wSpend, currency)}` : 'No expenses this month'}
                    >
                      <span>
                        {wSpend > 0
                          ? (wSpend >= 10000
                              ? `${currencySymbol(currency)}${(wSpend / 1000).toFixed(1)}k spent`
                              : `${fmtMoney(wSpend, currency)} spent`)
                          : 'No spend'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button
                  type="button"
                  className="btn"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 'var(--fs-base)',
                    fontWeight: 600,
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => {
                    setTransferFromId(w.id);
                    setShowTransfer(true);
                  }}
                  title="Transfer funds from this wallet"
                >
                  <ArrowLeftRight size={14} />
                  Transfer
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--fs-base)',
                    fontWeight: 600,
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => {
                    setSelectedWalletForTx(w);
                    setSearchQuery('');
                  }}
                >
                  <ReceiptText size={14} />
                  <span>History</span>
                  {wExpCount > 0 && (
                    <span
                      className="pill-badge"
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface3)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                        lineHeight: 1,
                        marginLeft: 2,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {wExpCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
            className="modal wallet-drawer-modal modal-dialog-panel"
            style={{ maxWidth: 480, width: '100%', borderRadius: 'var(--radius-2xl)' }}
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
                    {renderWalletIcon(activeWallet.icon || activeWallet.name, 40, activeWallet.color)}
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                      {activeWallet.name}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)', marginTop: 2 }}>
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
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setSelectedWalletForTx(null)}
                  title="Close"
                  aria-label="Close"
                >
                  <X size={16} />
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
                    padding: '13px 16px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingDown size={13} style={{ color: 'var(--debit)' }} />
                    <span>This Month Spent</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--debit)', letterSpacing: '-0.2px' }}>
                    -{fmtMoney(walletMonthSpend, currency)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '13px 16px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingUp size={13} style={{ color: 'var(--credit)' }} />
                    <span>This Month Inflow</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--credit)', letterSpacing: '-0.2px' }}>
                    +{fmtMoney(walletMonthIn, currency)}
                  </div>
                </div>
              </div>

              {/* Search Bar - Full Width without splitting lines */}
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
                    height: 42,
                    paddingLeft: 36,
                    paddingRight: searchQuery ? 32 : 12,
                    fontSize: 'var(--fs-base)',
                    borderRadius: 'var(--radius-md)',
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

              {searchQuery && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 500,
                    color: 'var(--text-2)',
                    marginTop: 8,
                  }}
                >
                  <span>Filtered by</span>
                  <span
                    style={{
                      fontWeight: 650,
                      color: 'var(--accent)',
                      backgroundColor: 'var(--accent-soft)',
                      padding: '2px 9px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    "{searchQuery}"
                  </span>
                </div>
              )}
            </div>

            {/* Transactions Content List - Single Card wrapping all items */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '4px 16px calc(24px + env(safe-area-inset-bottom, 0px))', background: 'var(--surface)' }}>
              {filteredTx.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-2)' }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>
                    {searchQuery ? 'No matching transactions found.' : 'No transactions recorded yet.'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)', marginTop: 4 }}>
                    {searchQuery ? 'Try searching with a different term' : 'Transactions associated with this wallet will appear here'}
                  </div>
                </div>
              ) : (
                <div
                  className="card"
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '8px 6px',
                    boxSizing: 'border-box',
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Transactions Card Title Header (Fixed) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px 6px 10px',
                      marginBottom: 2,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 'var(--fs-md)',
                          fontWeight: 700,
                          color: 'var(--text)',
                          letterSpacing: '-0.2px',
                        }}
                      >
                        Transactions
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 650,
                          color: 'var(--text-3)',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          lineHeight: 1.2,
                        }}
                      >
                        {filteredTx.length}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Container for Inner Cards/Rows */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      paddingRight: 2,
                    }}
                  >
                    {filteredTx.map((tx, idx) => {
                    let effectiveCategory = tx.category;
                    const descLower = (tx.description || '').toLowerCase();
                    if (descLower.includes('zepto') || descLower.includes('zeptoo') || descLower.includes('blinkit') || descLower.includes('instamart')) {
                      effectiveCategory = 'Groceries';
                    } else if ((descLower.includes('from idbi') || descLower.startsWith('from ') || tx.flow === 'in') && !tx.isSettlement && tx.category !== 'Transfer') {
                      effectiveCategory = 'Income';
                    }

                    const catMeta = resolveCategoryMeta(effectiveCategory, categoriesMap.get(effectiveCategory), tx.isSettlement, categoriesMap);
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

                    const getBadgeColors = (sKey: string) => {
                      if (sKey === 'settled' || sKey === 'paid' || sKey === 'completed') {
                        return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--credit)', border: 'rgba(16, 185, 129, 0.25)' };
                      }
                      if (sKey === 'unsettled' || sKey === 'unpaid' || sKey === 'overdue') {
                        return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--debit)', border: 'rgba(239, 68, 68, 0.25)' };
                      }
                      if (sKey === 'partial') {
                        return { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)', border: 'rgba(245, 158, 11, 0.25)' };
                      }
                      return { bg: 'var(--surface3)', color: 'var(--text-2)', border: 'var(--border)' };
                    };

                    return (
                      <div
                        key={`${tx.id}-${idx}`}
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
                          padding: '9px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-md)',
                          transition: 'background-color 0.15s ease, transform 0.1s ease',
                        }}
                        className="recent-expense-row-inside-card"
                      >
                        {/* Left Side: Icon + Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                          {/* Category / Settlement Icon Tile */}
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: catMeta.bg,
                              border: `1px solid ${catMeta.border}`,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              color: catMeta.color,
                            }}
                          >
                            {tx.isSettlement ? (
                              <Handshake size={19} style={{ color: 'var(--credit)' }} />
                            ) : (
                              <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={19} style={{ color: catMeta.color }} />
                            )}
                          </div>

                          {/* Info Block */}
                          <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                            {/* Title Line with Split Badge next to title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                               <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: 'var(--fs-base)',
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cleanSettlementDescription(tx.description)}
                              </span>
                              {tx.isSettlement ? (
                                <SettlementBadge settlementObj={tx.rawSettlement} flow={tx.flow} isForgiven={tx.rawSettlement?.isForgiven} />
                              ) : (
                                isSplit && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '1.5px 6px',
                                      borderRadius: 'var(--radius-xs)',
                                      fontSize: 'var(--fs-caption)',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(99, 102, 241, 0.14)',
                                      color: 'var(--accent)',
                                      border: '1px solid rgba(99, 102, 241, 0.25)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                      lineHeight: 1.1,
                                    }}
                                  >
                                    <Users size={9} />
                                    <span>Split</span>
                                  </span>
                                )
                              )}
                            </div>

                            {/* Subtitle Hierarchy */}
                            <SmartExpenseMeta
                              category={!tx.isSettlement ? tx.category : undefined}
                              dateText={fmtDate(tx.date)}
                              vendor={vendor}
                              friends={friend && !vendor ? [friend] : []}
                              style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}
                            />
                          </div>
                        </div>

                        {/* Right Side: Amount + Status */}
                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                          <div
                            style={{
                              fontSize: 'var(--fs-base)',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: isIn ? 'var(--credit)' : 'var(--debit)',
                            }}
                          >
                            {isIn ? '+' : '-'}{fmtMoney(tx.amount, currency)}
                          </div>
                          {tx.statusKey && tx.statusKey !== 'none' && statusLabel(tx.statusKey) && (() => {
                            const bCol = getBadgeColors(tx.statusKey);
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: 'var(--fs-caption)',
                                    fontWeight: 600,
                                    padding: '1px 7px',
                                    borderRadius: 'var(--radius-full)',
                                    backgroundColor: bCol.bg,
                                    color: bCol.color,
                                    border: `1px solid ${bCol.border}`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {statusLabel(tx.statusKey)}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                  </div>
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

      {delId && (
        <ConfirmDialog
          title="Delete Wallet"
          message="Expenses in this wallet will be moved to another wallet before deletion."
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}

      {undoStlId && (
        <ConfirmDialog
          title="Undo Settlement"
          message="Restores your wallet balance and marks this balance as unpaid."
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
          message="Removes this expense and restores the amount to your wallet."
          onConfirm={() => {
            deleteExpense(delExpId);
            setDelExpId(null);
            showToast('Expense deleted & wallet balance restored');
          }}
          onClose={() => setDelExpId(null)}
        />
      )}

      {/* Overflow Menu for Edit / Hide / Delete */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 'var(--radius-md)',
              minWidth: 160,
              boxShadow: 'var(--shadow)',
              bgcolor: 'var(--surface)',
              border: '1px solid var(--border)',
              backgroundImage: 'none',
              p: 0.5,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuWallet) setEditW(menuWallet);
            handleMenuClose();
          }}
          sx={{
            fontSize: 'var(--fs-sm)',
            py: 1,
            px: 1.5,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Edit2 size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>Edit Wallet</span>
        </MenuItem>
        {menuWallet && menuWallet.id !== settings.defaultWalletId && (
          <MenuItem
            onClick={() => {
              if (menuWallet) {
                const nextState = !menuWallet.isHidden;
                updateWallet(menuWallet.id, { isHidden: nextState });
                showToast(nextState ? `Wallet "${menuWallet.name}" is now hidden` : `Wallet "${menuWallet.name}" is now visible`);
              }
              handleMenuClose();
            }}
            sx={{
              fontSize: 'var(--fs-sm)',
              py: 1,
              px: 1.5,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {menuWallet.isHidden ? (
              <Eye size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            ) : (
              <EyeOff size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>
              {menuWallet.isHidden ? 'Unhide Wallet' : 'Hide Wallet'}
            </span>
          </MenuItem>
        )}
        <MenuItem
          disabled={wallets.length <= 1}
          onClick={() => {
            if (menuWallet) setDelId(menuWallet.id);
            handleMenuClose();
          }}
          sx={{
            fontSize: 'var(--fs-sm)',
            py: 1,
            px: 1.5,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--debit)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            '&.Mui-disabled': {
              opacity: 0.5,
              color: 'var(--debit)',
            },
          }}
        >
          <Trash2 size={15} style={{ color: 'var(--debit)', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--debit)' }}>Delete Wallet</span>
        </MenuItem>
      </Menu>
    </div>
  );
}
