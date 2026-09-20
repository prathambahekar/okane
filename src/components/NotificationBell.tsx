import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  RefreshCw,
  Zap,
  CheckCircle2,
  ArrowUpCircle,
  Sparkles,
  X,
  Check,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../store';
import { todayISO, DEFAULT_CATEGORIES, computeNextDueDate } from '../db';
import { fmtMoney, resolveCategoryMeta } from '../utils';
import CategoryIcon from './CategoryIcon';
import { renderWalletIcon } from './WalletIconRenderer';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';
import type { ViewName, Category } from '../types';

interface Props {
  onNavigate: (v: ViewName) => void;
  placement?: 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right';
}

export default function NotificationBell({ onNavigate }: Props) {
  const {
    db,
    triggerAutopayDeduct,
    quickLogRecurringRule,
    updateRecurringRule,
    availableUpdate,
    dismissUpdateNotification,
    showToast,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [subscriptionsCollapsed, setSubscriptionsCollapsed] = useState(false);
  const [quickLogsCollapsed, setQuickLogsCollapsed] = useState(false);

  useBackButtonModal(open, () => setOpen(false), { priority: BackPriority.MODAL });

  const today = todayISO();
  const currency = db.settings.currency;
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
  const categories: Category[] = db.settings.categories || DEFAULT_CATEGORIES;
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.name, c])), [categories]);
  const wallets = db.wallets || [];

  const dueAutopays = rules.filter(
    r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today
  );

  const unloggedQuickLogs = rules.filter(
    r => r.kind === 'quick_log' && r.status === 'active' && r.lastLoggedDate !== today
  );

  const totalPendingRules = dueAutopays.length + unloggedQuickLogs.length;
  const totalCount = totalPendingRules + (availableUpdate ? 1 : 0);

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleResolveAll = () => {
    dueAutopays.forEach(r => triggerAutopayDeduct(r.id));
    unloggedQuickLogs.forEach(r => quickLogRecurringRule(r.id));
    showToast(`Resolved ${totalPendingRules} pending item${totalPendingRules > 1 ? 's' : ''}`);
  };

  const handleClearAll = () => {
    let cleared = 0;
    if (availableUpdate) {
      dismissUpdateNotification();
      cleared += 1;
    }
    dueAutopays.forEach(r => {
      const nextDue = computeNextDueDate(r.nextDueDate || today, r.frequency, r.intervalValue);
      updateRecurringRule(r.id, { nextDueDate: nextDue });
      cleared += 1;
    });
    unloggedQuickLogs.forEach(r => {
      updateRecurringRule(r.id, { lastLoggedDate: today });
      cleared += 1;
    });
    showToast(`Cleared ${cleared} notification${cleared > 1 ? 's' : ''}`);
  };

  return (
    <>
      <button
        type="button"
        className={`btn-icon notification-bell-btn topbar-bell-btn ${totalCount > 0 ? 'has-badge' : ''}`}
        onClick={() => setOpen(true)}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: open ? 'var(--surface2)' : 'transparent',
          border: `1px solid ${open ? 'var(--border)' : 'transparent'}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          flexShrink: 0,
          transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} className="bell-icon" />
        {totalCount > 0 && (
          <span className="bell-badge">
            {totalCount}
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="modal-backdrop-motion">
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="modal-backdrop-overlay"
                onClick={() => setOpen(false)}
              />

              {/* Sheet panel / Desktop center dialog */}
              <motion.div
                initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
                animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
                transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="modal modal-dialog-panel"
                style={{ maxWidth: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Drag Handle Pill for Mobile Bottom Sheet */}
                <div className="modal-drag-handle" />

                {/* Modal Header (Transfer Drawer Style) */}
                <div className="modal-header" style={{ padding: '16px 20px 14px', borderBottom: 'none', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        background: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                        flexShrink: 0,
                      }}
                    >
                      <Bell size={22} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="modal-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, lineHeight: 1.2, color: 'var(--text)' }}>
                        Notifications
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                        {totalCount > 0
                          ? `${totalCount} pending item${totalCount > 1 ? 's' : ''} require attention`
                          : 'All caught up!'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setOpen(false)}
                      title="Close"
                      aria-label="Close dialog"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Modal Body with Transfer Drawer spacing & cards */}
                <div
                  className="modal-body"
                  style={{
                    padding: '8px 20px 20px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {totalCount === 0 ? (
                    <div
                      style={{
                        padding: '36px 16px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <CheckCircle2 size={24} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>
                        All Caught Up
                      </div>
                      <p style={{ fontSize: 'var(--fs-xs)', margin: 0, color: 'var(--text-3)', maxWidth: 280, lineHeight: 1.5 }}>
                        No pending subscriptions or daily expense logs require your attention right now.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Software Update Card */}
                      {availableUpdate && (
                        <div className="notification-card-update">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                color: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Sparkles size={19} style={{ color: 'var(--accent)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)' }}>
                                Software Update: v{availableUpdate.version}
                              </div>
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1 }}>
                                Build #{availableUpdate.buildNumber} · {availableUpdate.releaseDate}
                              </div>
                            </div>
                          </div>

                          {availableUpdate.releaseNotes && (
                            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
                              {availableUpdate.releaseNotes}
                            </p>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                onNavigate('settings');
                              }}
                              style={{
                                height: 34,
                                borderRadius: 'var(--radius-full)',
                                padding: '0 16px',
                                fontSize: 'var(--fs-xs)',
                                fontWeight: 700,
                                background: 'var(--text)',
                                border: 'none',
                                color: 'var(--bg)',
                                boxShadow: 'var(--shadow)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <ArrowUpCircle size={14} style={{ color: 'inherit' }} />
                              <span>Update in Settings</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Due Subscriptions Section */}
                      {dueAutopays.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Collapsible Section Header */}
                          <div
                            onClick={() => setSubscriptionsCollapsed(prev => !prev)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSubscriptionsCollapsed(prev => !prev);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            title={subscriptionsCollapsed ? 'Click to expand' : 'Click to collapse'}
                          >
                            <span
                              style={{
                                fontSize: 'var(--fs-caption)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.6px',
                                color: 'var(--text-3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <RefreshCw size={13} style={{ color: 'var(--text-3)' }} />
                              <span>DUE SUBSCRIPTIONS</span>
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 'var(--fs-caption)',
                                  fontWeight: 700,
                                  padding: '1.5px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  background: 'var(--surface2)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-2)',
                                }}
                              >
                                {dueAutopays.length}
                              </span>
                              <ChevronDown
                                size={15}
                                style={{
                                  color: 'var(--text-3)',
                                  transform: subscriptionsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease',
                                }}
                              />
                            </div>
                          </div>

                          {/* Collapsible Subscriptions List */}
                          <AnimatePresence initial={false}>
                            {!subscriptionsCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}
                              >
                                {dueAutopays.map(r => {
                                  const categoryObj = categoriesMap.get(r.category || '') || categories.find(c => c.name === r.category);
                                  const catMeta = resolveCategoryMeta(r.category || 'Subscription', categoryObj, false, categoriesMap);
                                  const walletObj = wallets.find(w => w.id === r.walletId);
                                  return (
                                    <div
                                      key={`due-${r.id}`}
                                      className="notification-card"
                                    >
                                      {/* Left: Category Icon Tile + Info */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                                        <div
                                          style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 'var(--radius-md)',
                                            background: catMeta.bg,
                                            border: `1px solid ${catMeta.border}`,
                                            color: catMeta.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={19} style={{ color: catMeta.color }} />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                            <span
                                              style={{
                                                fontSize: 'var(--fs-base)',
                                                fontWeight: 650,
                                                color: 'var(--text)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                              }}
                                            >
                                              {r.title}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: 9.5,
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                                padding: '2px 6px',
                                                borderRadius: 'var(--radius-xs)',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: 'var(--debit)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                flexShrink: 0,
                                                lineHeight: 1.2,
                                              }}
                                            >
                                              Due Today
                                            </span>
                                          </div>

                                          <div
                                            style={{
                                              fontSize: 'var(--fs-xs)',
                                              color: 'var(--text-3)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                            }}
                                          >
                                            <span style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                                              {fmtMoney(r.amount, currency)}
                                            </span>
                                            {walletObj && (
                                              <>
                                                <span style={{ opacity: 0.5 }}>•</span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                  {renderWalletIcon(walletObj.icon || walletObj.name, 13, walletObj.color)}
                                                  <span>{walletObj.name}</span>
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Right: High-contrast Pill Pay Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          triggerAutopayDeduct(r.id);
                                          showToast(`Paid ${r.title} (${fmtMoney(r.amount, currency)})`);
                                        }}
                                        style={{
                                          height: 34,
                                          borderRadius: 'var(--radius-full)',
                                          padding: '0 16px',
                                          fontSize: 'var(--fs-xs)',
                                          fontWeight: 700,
                                          background: 'var(--text)',
                                          border: 'none',
                                          color: 'var(--bg)',
                                          boxShadow: 'var(--shadow)',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 6,
                                          flexShrink: 0,
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        <CheckCircle2 size={14} style={{ color: 'inherit' }} />
                                        <span>Pay</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Quick Logs Section */}
                      {unloggedQuickLogs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Collapsible Section Header */}
                          <div
                            onClick={() => setQuickLogsCollapsed(prev => !prev)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setQuickLogsCollapsed(prev => !prev);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            title={quickLogsCollapsed ? 'Click to expand' : 'Click to collapse'}
                          >
                            <span
                              style={{
                                fontSize: 'var(--fs-caption)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.6px',
                                color: 'var(--text-3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Zap size={13} style={{ color: 'var(--text-3)' }} />
                              <span>DUE LOGS</span>
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 'var(--fs-caption)',
                                  fontWeight: 700,
                                  padding: '1.5px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  background: 'var(--surface2)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-2)',
                                }}
                              >
                                {unloggedQuickLogs.length}
                              </span>
                              <ChevronDown
                                size={15}
                                style={{
                                  color: 'var(--text-3)',
                                  transform: quickLogsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease',
                                }}
                              />
                            </div>
                          </div>

                          {/* Collapsible Quick Logs List */}
                          <AnimatePresence initial={false}>
                            {!quickLogsCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}
                              >
                                {unloggedQuickLogs.map(r => {
                                  const categoryObj = categoriesMap.get(r.category || '') || categories.find(c => c.name === r.category);
                                  const catMeta = resolveCategoryMeta(r.category || 'Other', categoryObj, false, categoriesMap);
                                  const walletObj = wallets.find(w => w.id === r.walletId);
                                  return (
                                    <div
                                      key={`log-${r.id}`}
                                      className="notification-card"
                                    >
                                      {/* Left: Category Icon Tile + Info */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                                        <div
                                          style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 'var(--radius-md)',
                                            background: catMeta.bg,
                                            border: `1px solid ${catMeta.border}`,
                                            color: catMeta.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={19} style={{ color: catMeta.color }} />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                                          <div
                                            style={{
                                              fontSize: 'var(--fs-base)',
                                              fontWeight: 650,
                                              color: 'var(--text)',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                            }}
                                          >
                                            {r.title}
                                          </div>

                                          <div
                                            style={{
                                              fontSize: 'var(--fs-xs)',
                                              color: 'var(--text-3)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                            }}
                                          >
                                            <span style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                                              {fmtMoney(r.amount, currency)}
                                            </span>
                                            {walletObj && (
                                              <>
                                                <span style={{ opacity: 0.5 }}>•</span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                  {renderWalletIcon(walletObj.icon || walletObj.name, 13, walletObj.color)}
                                                  <span>{walletObj.name}</span>
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Right: High-contrast Pill Log Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          quickLogRecurringRule(r.id);
                                          showToast(`Logged ${r.title} (${fmtMoney(r.amount, currency)})`);
                                        }}
                                        style={{
                                          height: 34,
                                          borderRadius: 'var(--radius-full)',
                                          padding: '0 16px',
                                          fontSize: 'var(--fs-xs)',
                                          fontWeight: 700,
                                          background: 'var(--text)',
                                          border: 'none',
                                          color: 'var(--bg)',
                                          boxShadow: 'var(--shadow)',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 6,
                                          flexShrink: 0,
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        <Zap size={14} style={{ color: 'inherit' }} />
                                        <span>Log</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer Action Bar (No splitting line) */}
                {totalCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 20px 18px',
                      borderTop: 'none',
                      background: 'transparent',
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleClearAll}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 650,
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        padding: '0 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <RotateCcw size={15} style={{ color: 'var(--text)' }} />
                      <span>Clear</span>
                    </button>

                    {totalPendingRules > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleResolveAll}
                        style={{
                          flex: 1.4,
                          height: 44,
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: 700,
                          background: 'var(--text)',
                          border: 'none',
                          color: 'var(--bg)',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.22)',
                          cursor: 'pointer',
                          padding: '0 18px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Check size={16} style={{ color: 'inherit' }} />
                        <span>{totalPendingRules === 1 ? 'Resolve' : `Resolve All (${totalPendingRules})`}</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
