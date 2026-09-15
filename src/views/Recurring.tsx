import { useState, useMemo, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Zap,
  Plus,
  Filter,
  X,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../store';
import type { RecurringRule, RecurringKind, ViewName } from '../types';
import { todayISO } from '../db';
import { fmtMoney } from '../utils';
import RecurringModal from '../components/RecurringModal';
import ConfirmDialog from '../components/ConfirmDialog';
import AutopayCard from '../components/recurring/AutopayCard';
import AutopayFilterBar from '../components/recurring/AutopayFilterBar';
import DesktopSearchBar from '../components/DesktopSearchBar';
import type { AutopayStatusFilter, AutopayFreqFilter, AutopaySortOption } from '../components/recurring/AutopayFilterBar';

interface Props {
  onNavigate?: (v: ViewName, arg?: string) => void;
  initialArg?: string;
  onClearViewArg?: () => void;
}

export default function Recurring({ onNavigate, initialArg }: Props) {
  const {
    db,
    triggerAutopayDeduct,
    quickLogRecurringRule,
    deleteRecurringRule,
    updateRecurringRule,
    showToast,
  } = useStore();

  const currency = db.settings.currency;
  const today = todayISO();

  // Filters & Drawer State
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<RecurringKind>('autopay');
  const [statusFilter, setStatusFilter] = useState<AutopayStatusFilter>('all');
  const [freqFilter, setFreqFilter] = useState<AutopayFreqFilter>('all');
  const [sortBy, setSortBy] = useState<AutopaySortOption>('due_asc');
  const [showFilters, setShowFilters] = useState(false);

  // Modals & Selection State
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  const handledArgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }
    if (handledArgRef.current === initialArg) return;
    handledArgRef.current = initialArg;

    const timer = setTimeout(() => {
      const rule = (db.recurringRules || []).find(r => r.id === initialArg);
      if (rule) {
        setEditingRule(rule);
      } else {
        setSearch(initialArg);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, db.recurringRules]);
  const [modalDefaultKind, setModalDefaultKind] = useState<RecurringKind>('autopay');
  const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null);

  const rules = useMemo(() => {
    const rawRules = db.recurringRules || [];
    const seen = new Set<string>();
    return rawRules.filter(r => {
      if (!r || !r.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [db.recurringRules]);
  const autopayRules = useMemo(() => rules.filter(r => r.kind === 'autopay'), [rules]);
  const quickLogRules = useMemo(() => rules.filter(r => r.kind === 'quick_log'), [rules]);

  const dueAutopays = useMemo(() => {
    return rules.filter(r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today);
  }, [rules, today]);

  const pausedRules = useMemo(() => rules.filter(r => r.status === 'paused'), [rules]);

  // Projected Monthly Spend calculation
  const totalMonthlySubCost = useMemo(() => {
    return autopayRules
      .filter(r => r.status === 'active')
      .reduce((sum, r) => {
        let amt = Number(r.amount) || 0;
        const val = r.intervalValue || 1;
        if (r.frequency === 'daily') amt *= 30;
        else if (r.frequency === 'weekly') amt *= 4.33;
        else if (r.frequency === 'custom_months') amt = amt / val;
        else if (r.frequency === 'custom_days') amt = (amt / val) * 30;
        return sum + amt;
      }, 0);
  }, [autopayRules]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim() !== '') count++;
    if (statusFilter !== 'all') count++;
    if (freqFilter !== 'all') count++;
    if (sortBy !== 'due_asc') count++;
    return count;
  }, [search, statusFilter, freqFilter, sortBy]);

  // Listen for top bar events (mobile filter and add buttons)
  useEffect(() => {
    const handleOpenFilters = () => {
      setShowFilters(true);
    };
    const handleAddRecurring = () => {
      setModalDefaultKind(kindFilter === 'quick_log' ? 'quick_log' : 'autopay');
      setEditingRule(null);
      setShowModal(true);
    };
    window.addEventListener('app-open-filters', handleOpenFilters);
    window.addEventListener('app-add-recurring', handleAddRecurring);
    return () => {
      window.removeEventListener('app-open-filters', handleOpenFilters);
      window.removeEventListener('app-add-recurring', handleAddRecurring);
    };
  }, [kindFilter]);

  // Sync active filter count with top bar badge
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-filter-count-update', {
      detail: { view: 'recurring', count: activeFilterCount }
    }));
  }, [activeFilterCount]);

  const handleClearAll = () => {
    setSearch('');
    setStatusFilter('all');
    setFreqFilter('all');
    setSortBy('due_asc');
  };

  // Filtered & Sorted Rules
  const filteredRules = useMemo(() => {
    let list = rules.filter(r => r.kind === kindFilter);

    // Status filter
    if (statusFilter === 'active') {
      list = list.filter(r => r.status !== 'paused');
    } else if (statusFilter === 'paused') {
      list = list.filter(r => r.status === 'paused');
    } else if (statusFilter === 'due') {
      list = list.filter(r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today);
    }

    // Frequency filter
    if (freqFilter !== 'all') {
      list = list.filter(r => {
        if (freqFilter === 'daily') return r.frequency === 'daily';
        if (freqFilter === 'weekly') return r.frequency === 'weekly' || (r.frequency === 'custom_days' && r.intervalValue === 7);
        if (freqFilter === 'monthly') return r.frequency === 'monthly' || (r.frequency === 'custom_months' && r.intervalValue === 1);
        if (freqFilter === 'yearly') return r.frequency === 'custom_months' && r.intervalValue === 12;
        return true;
      });
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r => {
        const titleMatch = r.title.toLowerCase().includes(q);
        const catMatch = r.category.toLowerCase().includes(q);
        const noteMatch = (r.notes || '').toLowerCase().includes(q);
        const friend = r.friendId ? db.friends?.find(f => f.id === r.friendId) : null;
        const friendMatch = friend ? friend.name.toLowerCase().includes(q) : false;
        return titleMatch || catMatch || noteMatch || friendMatch;
      });
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === 'due_asc') {
        const dateA = a.nextDueDate || '9999-99-99';
        const dateB = b.nextDueDate || '9999-99-99';
        return dateA.localeCompare(dateB);
      }
      if (sortBy === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === 'amount_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      if (sortBy === 'name_asc') return a.title.localeCompare(b.title);
      if (sortBy === 'recent') {
        const dA = String(a.lastLoggedDate || a.createdAt || '');
        const dB = String(b.lastLoggedDate || b.createdAt || '');
        return dB.localeCompare(dA);
      }
      return 0;
    });
  }, [rules, kindFilter, statusFilter, freqFilter, search, sortBy, today, db.friends]);

  // Handlers
  const handlePayDeduct = (rule: RecurringRule) => {
    triggerAutopayDeduct(rule.id);
  };

  const handleQuickLogToday = (rule: RecurringRule) => {
    quickLogRecurringRule(rule.id);
  };

  const handleTogglePause = (rule: RecurringRule) => {
    const nextStatus = rule.status === 'paused' ? 'active' : 'paused';
    updateRecurringRule(rule.id, { status: nextStatus });
    showToast(nextStatus === 'paused' ? `Paused "${rule.title}"` : `Resumed "${rule.title}"`);
  };

  const handleEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDelete = (rule: RecurringRule) => {
    setDeletingRule(rule);
  };

  const sortLabel = useMemo(() => {
    switch (sortBy) {
      case 'due_asc': return 'Soonest Due';
      case 'amount_desc': return 'Amount: High to Low';
      case 'amount_asc': return 'Amount: Low to High';
      case 'name_asc': return 'Name (A-Z)';
      case 'recent': return 'Recent Log';
      default: return 'Soonest Due';
    }
  }, [sortBy]);

  const statusLabel = useMemo(() => {
    switch (statusFilter) {
      case 'active': return 'Active';
      case 'paused': return 'Paused';
      case 'due': return 'Due / Overdue';
      default: return 'All';
    }
  }, [statusFilter]);

  return (
    <div className="view-container">
      {/* Page Header Bar matching Expenses / Settlements */}
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="page-title">Autopay</h1>
        </div>
        <div className="desktop-search-filter-wrap desktop-only">
          <DesktopSearchBar placeholder="Search subscriptions, autopay..." defaultTab="recurring" />
          <button
            type="button"
            id="desktop-filter-recurring-btn"
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilters(true)}
            title={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'Filters'}
            aria-label="Filter recurring"
            style={{
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
              background: activeFilterCount > 0 ? 'var(--surface2)' : undefined,
              borderColor: activeFilterCount > 0 ? 'var(--border2)' : undefined,
              color: 'var(--text)',
            }}
          >
            <Filter size={17} strokeWidth={2} />
            {activeFilterCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: 'var(--text)',
                  color: 'var(--surface)',
                  fontSize: 10,
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="page-header-actions desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setModalDefaultKind(kindFilter === 'quick_log' ? 'quick_log' : 'autopay');
              setEditingRule(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Create {kindFilter === 'quick_log' ? 'Custom Rule' : 'Subscription'}
          </button>
        </div>
      </div>

      {/* Clean Full-Width Segment Switcher */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <div className="contact-type-switch" style={{ width: '100%' }}>
          <button
            type="button"
            className={`type-btn ${kindFilter === 'autopay' ? 'active' : ''}`}
            onClick={() => setKindFilter('autopay')}
            title="Subscriptions"
            aria-label="Subscriptions"
            style={{ fontSize: 'var(--fs-sm)', fontWeight: kindFilter === 'autopay' ? 600 : 500 }}
          >
            <RefreshCw size={15} style={{ flexShrink: 0, color: 'inherit' }} />
            <span className="type-label" style={{ fontSize: 'var(--fs-sm)', letterSpacing: '-0.01em' }}>Subscriptions</span>
          </button>

          <button
            type="button"
            className={`type-btn ${kindFilter === 'quick_log' ? 'active' : ''}`}
            onClick={() => setKindFilter('quick_log')}
            title="Custom Quick Log"
            aria-label="Custom Quick Log"
            style={{ fontSize: 'var(--fs-sm)', fontWeight: kindFilter === 'quick_log' ? 600 : 500 }}
          >
            <Zap size={15} style={{ flexShrink: 0, color: 'inherit' }} />
            <span className="type-label" style={{ fontSize: 'var(--fs-sm)', letterSpacing: '-0.01em' }}>Custom</span>
          </button>
        </div>

        {/* Active Filter Chips (Accent Themed) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 2px' }}>
            {search && (
              <span key="chip-search" className="app-filter-chip">
                <span className="app-filter-chip-label">Search:</span>
                <span className="app-filter-chip-value">"{search}"</span>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="app-filter-chip-remove"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span key="chip-status" className="app-filter-chip">
                <span className="app-filter-chip-label">Status:</span>
                <span className="app-filter-chip-value">{statusLabel}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="app-filter-chip-remove"
                  title="Clear status filter"
                  aria-label="Clear status filter"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            {freqFilter !== 'all' && (
              <span key="chip-freq" className="app-filter-chip" style={{ textTransform: 'capitalize' }}>
                <span className="app-filter-chip-label">Freq:</span>
                <span className="app-filter-chip-value">{freqFilter}</span>
                <button
                  type="button"
                  onClick={() => setFreqFilter('all')}
                  className="app-filter-chip-remove"
                  title="Clear frequency filter"
                  aria-label="Clear frequency filter"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            {sortBy !== 'due_asc' && (
              <span key="chip-sort" className="app-filter-chip">
                <span className="app-filter-chip-label">Sort:</span>
                <span className="app-filter-chip-value">{sortLabel}</span>
                <button
                  type="button"
                  onClick={() => setSortBy('due_asc')}
                  className="app-filter-chip-remove"
                  title="Reset sort"
                  aria-label="Reset sort"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            <button
              key="chip-clear-all"
              type="button"
              onClick={handleClearAll}
              className="app-filter-clear-btn"
              title="Clear all filters"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>

      {/* Header Metric Card (Contextual to active tab, Clean Minimal Theme) */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="card"
          style={{
            padding: '16px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            transition: 'all 0.15s ease',
          }}
        >
          {kindFilter === 'autopay' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                  Projected spend
                </span>
                <span
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    background: 'var(--surface2)',
                    padding: '2.5px 8.5px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border)',
                    letterSpacing: '0.01em',
                    lineHeight: '1.3',
                  }}
                >
                  {autopayRules.filter(r => r.status === 'active').length} active
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <div
                  style={{
                    fontSize: 'var(--fs-hero-sm)',
                    fontWeight: 700,
                    color: 'var(--text)',
                    letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.1,
                  }}
                >
                  {fmtMoney(totalMonthlySubCost, currency)}
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-3)' }}>/ month</span>
              </div>

              {dueAutopays.length > 0 && (
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--debit)',
                    fontWeight: 600,
                    marginTop: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '3.5px 9px',
                    borderRadius: 'var(--radius-sm)',
                    alignSelf: 'flex-start',
                  }}
                >
                  <AlertTriangle size={12} strokeWidth={2.2} />
                  <span>{dueAutopays.length} {dueAutopays.length === 1 ? 'bill' : 'bills'} due or overdue</span>
                </div>
              )}
            </>
          ) : (
            <>
              {(() => {
                const activeQuickLogs = quickLogRules.filter(r => r.status === 'active');
                const loggedTodayCount = activeQuickLogs.filter(r => r.lastLoggedDate === today).length;
                const totalActive = activeQuickLogs.length;
                const isAllDone = totalActive > 0 && loggedTodayCount === totalActive;

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                      <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                        Today's logs
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 600,
                          color: isAllDone ? 'var(--credit, #10b981)' : 'var(--text-2)',
                          background: isAllDone ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface2)',
                          padding: '2.5px 8.5px',
                          borderRadius: 'var(--radius-full)',
                          border: `1px solid ${isAllDone ? 'rgba(16, 185, 129, 0.2)' : 'var(--border)'}`,
                          letterSpacing: '0.01em',
                          lineHeight: '1.3',
                        }}
                      >
                        {totalActive === 0
                          ? '0 active'
                          : isAllDone
                          ? 'All logged'
                          : `${totalActive - loggedTodayCount} left`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <div
                        style={{
                          fontSize: 'var(--fs-hero-sm)',
                          fontWeight: 700,
                          color: 'var(--text)',
                          letterSpacing: '-0.03em',
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1.1,
                          display: 'inline-flex',
                          alignItems: 'baseline',
                          gap: 3,
                        }}
                      >
                        <span>{loggedTodayCount}</span>
                        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-3)' }}>
                          / {totalActive}
                        </span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-3)' }}>logged today</span>
                    </div>

                    {totalActive > 0 && (
                      <div
                        style={{
                          width: '100%',
                          height: 4,
                          borderRadius: 9999,
                          background: 'var(--surface2)',
                          overflow: 'hidden',
                          marginTop: 1,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((loggedTodayCount / totalActive) * 100)}%`,
                            height: '100%',
                            borderRadius: 9999,
                            background: isAllDone ? 'var(--credit, #10b981)' : 'var(--accent)',
                            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state">
            <div className="empty-state-icon-badge">
              {activeFilterCount > 0 ? (
                <Filter size={24} strokeWidth={1.8} />
              ) : kindFilter === 'quick_log' ? (
                <Zap size={24} strokeWidth={1.8} />
              ) : (
                <RefreshCw size={24} strokeWidth={1.8} />
              )}
            </div>
            <div className="empty-state-title">
              {activeFilterCount > 0
                ? 'No recurring rules found'
                : kindFilter === 'quick_log'
                ? 'No custom rules yet'
                : 'No subscriptions yet'}
            </div>
            <p className="empty-state-desc">
              {activeFilterCount > 0
                ? 'No subscriptions match your active filters or search keywords.'
                : kindFilter === 'quick_log'
                ? 'Add custom recurring templates for one-tap daily or frequent expense logging.'
                : 'Add subscriptions or fixed recurring bills to track automatic deductions.'}
            </p>
            {activeFilterCount > 0 ? (
              <button className="btn btn-secondary btn-sm" onClick={handleClearAll} style={{ borderRadius: '9999px', padding: '0 20px', height: 38 }}>
                Clear Filters
              </button>
            ) : (
              <button
                className="empty-state-btn"
                onClick={() => {
                  setModalDefaultKind(kindFilter === 'quick_log' ? 'quick_log' : 'autopay');
                  setEditingRule(null);
                  setShowModal(true);
                }}
              >
                <Plus size={16} strokeWidth={2.2} />
                <span>Create {kindFilter === 'quick_log' ? 'Custom Rule' : 'Subscription'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 80 }}>
          {filteredRules.map((r) => {
            const cat = db.settings?.categories?.find(c => c.name.toLowerCase() === r.category.toLowerCase());
            const linkedFriend = r.friendId ? db.friends?.find(f => f.id === r.friendId) : null;
            const wallet = r.walletId ? db.wallets?.find(w => w.id === r.walletId) : null;

            return (
              <AutopayCard
                key={r.id}
                rule={r}
                category={cat}
                linkedFriend={linkedFriend}
                wallet={wallet}
                currency={currency}
                today={today}
                onPay={handlePayDeduct}
                onQuickLog={handleQuickLogToday}
                onTogglePause={handleTogglePause}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}

      {/* Floating Filter Drawer */}
      <AutopayFilterBar
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        kindFilter={kindFilter}
        setKindFilter={setKindFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        freqFilter={freqFilter}
        setFreqFilter={setFreqFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        search={search}
        setSearch={setSearch}
        activeFilterCount={activeFilterCount}
        onClearAll={handleClearAll}
        counts={{
          all: rules.length,
          autopay: autopayRules.length,
          quick_log: quickLogRules.length,
          due: dueAutopays.length,
          paused: pausedRules.length,
        }}
        totalMonthlySpend={totalMonthlySubCost}
        currency={currency}
      />

      {/* Modal Dialog */}
      {showModal && (
        <RecurringModal
          rule={editingRule}
          defaultKind={modalDefaultKind}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRule && (
        <ConfirmDialog
          title="Delete Recurring Rule"
          message={`Are you sure you want to delete "${deletingRule.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteRecurringRule(deletingRule.id);
            showToast(`Deleted "${deletingRule.title}"`);
            setDeletingRule(null);
          }}
          onClose={() => setDeletingRule(null)}
        />
      )}
    </div>
  );
}
