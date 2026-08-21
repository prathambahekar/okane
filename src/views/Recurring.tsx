import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  Zap,
  Plus,
  SlidersHorizontal,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../store';
import type { RecurringRule, RecurringKind, ViewName } from '../types';
import { todayISO } from '../db';
import { fmtMoney } from '../utils';
import RecurringModal from '../components/RecurringModal';
import ConfirmDialog from '../components/ConfirmDialog';
import AutopayCard from '../components/recurring/AutopayCard';
import AutopayFilterBar from '../components/recurring/AutopayFilterBar';
import type { AutopayStatusFilter, AutopayFreqFilter, AutopaySortOption } from '../components/recurring/AutopayFilterBar';

interface Props {
  onNavigate?: (v: ViewName, arg?: string) => void;
}

export default function Recurring({ onNavigate }: Props) {
  const {
    db,
    triggerAutopayDeduct,
    quickLogRecurringRule,
    deleteRecurringRule,
    updateRecurringRule,
    showToast,
  } = useStore();

  const currency = db.settings.currency;
  const enableAIAssistant = db.settings.enableAIAssistant !== false;
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
  const [modalDefaultKind, setModalDefaultKind] = useState<RecurringKind>('autopay');
  const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null);

  // Floating Action Button Portal Target
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.getElementById('floating-extra-actions-slot');
    }
    return null;
  });

  useEffect(() => {
    if (!portalTarget) {
      const interval = setInterval(() => {
        const slot = document.getElementById('floating-extra-actions-slot');
        if (slot) {
          setPortalTarget(slot);
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [portalTarget]);

  const rules = useMemo(() => db.recurringRules || [], [db.recurringRules]);
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
      {/* Header Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title" style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Autopay
            </h1>
          </div>
        </div>

        {/* Segment Tabs + Filter Button (No Top Search Bar) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          {/* Segment Pill Switcher */}
          <div
            className="contact-type-switch"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--surface2)',
              borderRadius: '12px',
              padding: '3px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className={`type-btn ${kindFilter === 'autopay' ? 'active' : ''}`}
              onClick={() => setKindFilter('autopay')}
              title="Subscriptions"
              aria-label="Subscriptions"
            >
              <RefreshCw size={13} style={{ flexShrink: 0, color: kindFilter === 'autopay' ? 'var(--accent)' : 'inherit' }} />
              <span className="type-label">Subscriptions</span>
              <span className="type-badge">{autopayRules.length}</span>
            </button>

            <button
              type="button"
              className={`type-btn ${kindFilter === 'quick_log' ? 'active' : ''}`}
              onClick={() => setKindFilter('quick_log')}
              title="Custom Quick Log"
              aria-label="Custom Quick Log"
            >
              <Zap size={13} style={{ flexShrink: 0, color: kindFilter === 'quick_log' ? 'var(--accent)' : 'inherit' }} />
              <span className="type-label">Custom</span>
              <span className="type-badge">{quickLogRules.length}</span>
            </button>
          </div>

          {/* Filter Drawer Trigger Button */}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              height: 38,
              padding: '0 10px',
              borderRadius: '11px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--surface2)',
              color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)',
              border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="Filters & Search"
            aria-label="Open Filters"
          >
            <SlidersHorizontal size={14} style={{ color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)' }} />
            <span className="desktop-only">Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '1px 5px',
                  lineHeight: 1.2,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips (if any filter is applied) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0 2px' }}>
            {search && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2.5px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Search: "{search}"
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2.5px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Status: {statusLabel}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {freqFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2.5px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
              >
                Freq: {freqFilter}
                <button
                  type="button"
                  onClick={() => setFreqFilter('all')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {sortBy !== 'due_asc' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2.5px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Sort: {sortLabel}
                <button
                  type="button"
                  onClick={() => setSortBy('due_asc')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-3)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 6px',
                textDecoration: 'underline',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Header Metric Card (Contextual to active tab, Clean Theme, Zero Divider Lines) */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="card"
          style={{
            padding: '14px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            transition: 'all 0.15s ease',
          }}
        >
          {kindFilter === 'autopay' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                <span>SUBSCRIPTION SPEND</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                  <RefreshCw size={12} />
                  <span style={{ fontSize: 11 }}>{autopayRules.length} active</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <div style={{ fontSize: 20, fontWeight: 750, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {fmtMoney(totalMonthlySubCost, currency)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>/month projected</span>
              </div>

              {dueAutopays.length > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#ef4444',
                    fontWeight: 650,
                    marginTop: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  <AlertTriangle size={12} />
                  <span>{dueAutopays.length} bill{dueAutopays.length > 1 ? 's' : ''} due or overdue</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                <span>CUSTOM RECURRING</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                  <Zap size={12} />
                  <span style={{ fontSize: 11 }}>{quickLogRules.length} rules</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <div style={{ fontSize: 20, fontWeight: 750, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {quickLogRules.filter(r => r.lastLoggedDate === today).length} of {quickLogRules.filter(r => r.status === 'active').length}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>logged today</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 36,
            textAlign: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            color: 'var(--text-3)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: 'var(--surface2)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <Sparkles size={20} />
          </div>
          <p style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--text)', margin: '0 0 6px 0' }}>
            No recurring rules found
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 16px 0', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
            {activeFilterCount > 0
              ? 'Try changing your search keywords or resetting filters.'
              : 'Add subscriptions or custom recurring expenses for one-tap tracking.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ margin: '0 auto', padding: '0 16px', height: 34, borderRadius: 8, fontWeight: 600 }}
            onClick={() => {
              setModalDefaultKind(kindFilter === 'quick_log' ? 'quick_log' : 'autopay');
              setEditingRule(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} /> Create {kindFilter === 'quick_log' ? 'Custom Rule' : 'Subscription'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 80 }}>
          {filteredRules.map(r => {
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

      {/* Floating Add Button - placed in floating action stack like in Contact Tab */}
      {portalTarget ? (
        createPortal(
          <button
            type="button"
            id="floating-add-autopay-btn"
            className="floating-add-autopay-btn"
            onClick={() => {
              setModalDefaultKind(kindFilter === 'quick_log' ? 'quick_log' : 'autopay');
              setEditingRule(null);
              setShowModal(true);
            }}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface3)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface2)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.transform = 'none';
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            title={kindFilter === 'quick_log' ? 'Add Custom Recurring Rule' : 'Add Subscription'}
            aria-label={kindFilter === 'quick_log' ? 'Add Custom Recurring Rule' : 'Add Subscription'}
          >
            <Plus size={19} />
          </button>,
          portalTarget
        )
      ) : (
        <button
          type="button"
          id="floating-add-autopay-btn"
          className="floating-add-autopay-btn"
          onClick={() => {
            setModalDefaultKind(kindFilter === 'quick_log' ? 'quick_log' : 'autopay');
            setEditingRule(null);
            setShowModal(true);
          }}
          style={{
            position: 'fixed',
            bottom: enableAIAssistant
              ? 'calc(env(safe-area-inset-bottom, 0px) + 192px)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 134px)',
            right: '16px',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 998,
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'var(--surface3)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'var(--surface2)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.transform = 'none';
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          title={kindFilter === 'quick_log' ? 'Add Custom Recurring Rule' : 'Add Subscription'}
          aria-label={kindFilter === 'quick_log' ? 'Add Custom Recurring Rule' : 'Add Subscription'}
        >
          <Plus size={19} />
        </button>
      )}

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
