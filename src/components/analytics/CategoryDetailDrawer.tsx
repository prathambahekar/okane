import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  ShoppingBag,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../store';
import { fmtMoney, groupExpenses, getGroupedExpenseAmount, type GroupedExpense } from '../../utils';
import type { Expense, Wallet } from '../../types';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import CategoryIcon from '../CategoryIcon';
import { ExpenseDetailDrawer } from '../ExpenseDetailDrawer';
import { renderWalletIcon } from '../WalletIconRenderer';

interface CategoryDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string | null;
  period?: 'week' | 'month';
  activeMonthStr?: string; // YYYY-MM
  expenses: Expense[];
  currency: string;
  wallets: Wallet[];
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
}

export const CategoryDetailDrawer: React.FC<CategoryDetailDrawerProps> = ({
  isOpen,
  onClose,
  categoryName,
  period = 'month',
  activeMonthStr,
  expenses,
  currency,
  wallets,
  onEditExpense,
  onDeleteExpense,
}) => {
  const { db } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string>('all');
  const [selectedGroupExpense, setSelectedGroupExpense] = useState<GroupedExpense | null>(null);

  // Back button handling
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  // Escape key handling
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Category Metadata
  const catMeta = useMemo(() => {
    if (!categoryName) return { color: '#8B5CF6', icon: 'Tag' };
    const found = db.settings.categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    return {
      color: found?.color || '#8B5CF6',
      icon: found?.icon || 'Tag',
    };
  }, [categoryName, db.settings.categories]);

  // Filter expenses for this category & active month/period
  const categoryExpenses = useMemo(() => {
    if (!categoryName) return [];
    return expenses.filter((e) => {
      if (e.flow !== 'out') return false;
      const isCatMatch = e.category.toLowerCase() === categoryName.toLowerCase();
      if (!isCatMatch) return false;

      if (activeMonthStr) {
        return e.date.startsWith(activeMonthStr);
      }
      return true;
    });
  }, [expenses, categoryName, activeMonthStr]);

  // Previous Period Expenses for Trend Comparison
  const prevPeriodTotal = useMemo(() => {
    if (!categoryName || !activeMonthStr) return 0;
    const [y, m] = activeMonthStr.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    return expenses
      .filter((e) => e.flow === 'out' && e.category.toLowerCase() === categoryName.toLowerCase() && e.date.startsWith(prevMonthStr))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [expenses, categoryName, activeMonthStr]);

  // Summary Metrics
  const totalSpent = useMemo(() => {
    return categoryExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [categoryExpenses]);

  const avgSpent = useMemo(() => {
    if (categoryExpenses.length === 0) return 0;
    return totalSpent / categoryExpenses.length;
  }, [totalSpent, categoryExpenses]);

  const maxExpense = useMemo(() => {
    if (categoryExpenses.length === 0) return null;
    return categoryExpenses.reduce((max, e) => (Math.abs(e.amount) > Math.abs(max.amount) ? e : max), categoryExpenses[0]);
  }, [categoryExpenses]);

  // Top Wallet Used
  const topWallet = useMemo(() => {
    if (categoryExpenses.length === 0) return null;
    const walletTotals: Record<string, number> = {};
    categoryExpenses.forEach((e) => {
      const wId = e.walletId || 'default';
      walletTotals[wId] = (walletTotals[wId] || 0) + Math.abs(e.amount);
    });

    let topId = '';
    let topVal = 0;
    Object.entries(walletTotals).forEach(([wId, amount]) => {
      if (amount > topVal) {
        topVal = amount;
        topId = wId;
      }
    });

    return wallets.find((w) => w.id === topId) || null;
  }, [categoryExpenses, wallets]);

  // Trend Comparison Calculation
  const trendComparison = useMemo(() => {
    if (prevPeriodTotal === 0) {
      if (totalSpent === 0) return { diffPct: 0, label: 'No change', type: 'neutral' };
      return { diffPct: 100, label: 'New spending', type: 'up' };
    }
    const diff = totalSpent - prevPeriodTotal;
    const pct = (diff / prevPeriodTotal) * 100;

    if (Math.abs(pct) < 0.5) {
      return { diffPct: 0, label: 'Same as last period', type: 'neutral' };
    }
    if (pct > 0) {
      return { diffPct: Math.round(pct), label: `+${Math.round(pct)}% vs last period`, type: 'up' };
    }
    return { diffPct: Math.abs(Math.round(pct)), label: `-${Math.abs(Math.round(pct))}% vs last period`, type: 'down' };
  }, [totalSpent, prevPeriodTotal]);

  // Filtered List based on search query & selected wallet filter
  const filteredList = useMemo(() => {
    return categoryExpenses.filter((e) => {
      if (selectedWalletFilter !== 'all' && e.walletId !== selectedWalletFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const notesMatch = (e.notes || '').toLowerCase().includes(q);
        const amountMatch = e.amount.toString().includes(q);
        return descMatch || notesMatch || amountMatch;
      }
      return true;
    });
  }, [categoryExpenses, searchQuery, selectedWalletFilter]);

  // Group filtered expenses into display groups
  const groupedDisplayExpenses = useMemo(() => {
    return groupExpenses(filteredList);
  }, [filteredList]);

  if (!isOpen || !categoryName) return null;

  return createPortal(
    <div
      className="filter-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-drawer-title"
    >
      <div
        className="filter-drawer-panel category-detail-drawer"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Bar */}
        <div className="drawer-drag-handle" />

        {/* Header */}
        <div className="drawer-header" style={{ padding: '16px 20px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="category-drawer-icon-avatar"
              style={{
                backgroundColor: `${catMeta.color}18`,
                color: catMeta.color,
                border: `1.5px solid ${catMeta.color}30`,
              }}
            >
              <CategoryIcon category={categoryName} icon={catMeta.icon} size={20} style={{ color: catMeta.color }} />
            </div>
            <div>
              <h3 id="category-drawer-title" className="drawer-title" style={{ fontSize: '18px', fontWeight: 700 }}>
                {categoryName}
              </h3>
              <p className="drawer-subtitle" style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                {period === 'week' ? 'Weekly' : 'Monthly'} Category Breakdown • {activeMonthStr ? new Date(activeMonthStr + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Overview'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="drawer-body" style={{ padding: '0 20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Hero Spending Card */}
          <div
            className="category-hero-card"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Category Outflow
              </span>
              <span className="analytics-v2-pill-badge" style={{ margin: 0 }}>
                {categoryExpenses.length} {categoryExpenses.length === 1 ? 'transaction' : 'transactions'}
              </span>
            </div>

            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '12px' }}>
              {fmtMoney(totalSpent, currency)}
            </div>

            {/* Trend & Average Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className={`analytics-v2-trend-badge ${trendComparison.type}`} style={{ margin: 0 }}>
                {trendComparison.type === 'down' ? (
                  <ArrowDownRight size={14} strokeWidth={2.5} />
                ) : trendComparison.type === 'up' ? (
                  <ArrowUpRight size={14} strokeWidth={2.5} />
                ) : null}
                <span>{trendComparison.label}</span>
              </div>

              {categoryExpenses.length > 0 && (
                <div className="analytics-v2-pace-pill" style={{ margin: 0 }}>
                  <Sparkles size={13} strokeWidth={2.2} />
                  <span>Avg: {fmtMoney(avgSpent, currency)} / tx</span>
                </div>
              )}
            </div>
          </div>

          {/* Key Metric Highlights Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            {/* Top Wallet Card */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-2)',
                  flexShrink: 0,
                }}
              >
                {topWallet ? renderWalletIcon(topWallet.icon || 'Wallet', 18) : <CreditCard size={18} />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Primary Wallet</div>
                <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {topWallet ? topWallet.name : 'N/A'}
                </div>
              </div>
            </div>

            {/* Max Single Expense Card */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--debit-bg)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--debit)',
                  flexShrink: 0,
                }}
              >
                <ShoppingBag size={18} strokeWidth={2.2} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Largest Charge</div>
                <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 700 }}>
                  {maxExpense ? fmtMoney(Math.abs(maxExpense.amount), currency) : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Header */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                Transactions ({filteredList.length})
              </h4>

              {/* Wallet Filter Selector */}
              {wallets.length > 1 && (
                <select
                  value={selectedWalletFilter}
                  onChange={(e) => setSelectedWalletFilter(e.target.value)}
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text-2)',
                    fontWeight: 500,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Wallets</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Search Input */}
            <div className="search-bar" style={{ width: '100%' }}>
              <Search size={15} style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${categoryName}...`}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  color: 'var(--text)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-3)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Transactions List */}
          {filteredList.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border)',
              }}
            >
              <Layers size={24} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-2)' }}>
                {searchQuery ? 'No matching expenses found' : 'No transactions in this category'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 4 }}>
                {searchQuery ? 'Try searching for a different keyword or amount.' : 'Expenses in this category will show up here.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groupedDisplayExpenses.map((ge) => {
                const w = wallets.find((wal) => wal.id === ge.walletId);
                return (
                  <div
                    key={ge.id}
                    className="expense-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                    onClick={() => setSelectedGroupExpense(ge)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: `${catMeta.color}18`,
                          color: catMeta.color,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <CategoryIcon category={categoryName} icon={catMeta.icon} size={18} style={{ color: catMeta.color }} />
                      </div>

                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {ge.description || categoryName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                          <span>{ge.date}</span>
                          {w && (
                            <>
                              <span>•</span>
                              <span style={{ fontWeight: 500 }}>{w.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                        {fmtMoney(Math.abs(getGroupedExpenseAmount(ge)), currency)}
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Sub-Drawer */}
      {selectedGroupExpense && (
        <ExpenseDetailDrawer
          ge={selectedGroupExpense}
          onClose={() => setSelectedGroupExpense(null)}
          onEdit={(item) => {
            setSelectedGroupExpense(null);
            if (onEditExpense) onEditExpense(item);
          }}
          onDelete={(id) => {
            setSelectedGroupExpense(null);
            if (onDeleteExpense) onDeleteExpense(id);
          }}
          currency={currency}
          friends={db.friends}
          wallets={db.wallets}
          categories={db.settings.categories}
          settlements={db.settlements}
        />
      )}
    </div>,
    document.body
  );
};

export default CategoryDetailDrawer;
