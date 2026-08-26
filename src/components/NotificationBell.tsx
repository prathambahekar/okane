import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, RefreshCw, Zap, CheckCircle2, ArrowUpCircle, Sparkles, X } from 'lucide-react';
import { useStore } from '../store';
import { todayISO } from '../db';
import { fmtMoney } from '../utils';
import type { ViewName } from '../types';

interface Props {
  onNavigate: (v: ViewName) => void;
  placement?: 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right';
}

export default function NotificationBell({ onNavigate }: Props) {
  const { db, triggerAutopayDeduct, quickLogRecurringRule, availableUpdate } = useStore();
  const [open, setOpen] = useState(false);

  const today = todayISO();
  const currency = db.settings.currency;
  const rules = db.recurringRules || [];

  const autopayEnabled = db.settings.enableAutopay ?? false;

  const dueAutopays = rules.filter(
    r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today
  );

  const unloggedQuickLogs = rules.filter(
    r => r.kind === 'quick_log' && r.status === 'active' && r.lastLoggedDate !== today
  );

  const totalCount = dueAutopays.length + unloggedQuickLogs.length + (availableUpdate ? 1 : 0);

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

  return (
    <>
      <button
        type="button"
        className={`btn-icon notification-bell-btn ${totalCount > 0 ? 'has-badge' : ''}`}
        onClick={() => setOpen(true)}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 10,
          background: open ? 'var(--surface3)' : 'var(--surface2)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: totalCount > 0 ? 'var(--text)' : 'var(--text-2)',
          flexShrink: 0,
        }}
        title="Notifications"
      >
        <Bell size={18} className="bell-icon" />
        {totalCount > 0 && (
          <span className="bell-badge">
            {totalCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={e => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="modal" style={{ maxWidth: 460, borderRadius: 16 }}>
              {/* Drag Handle Indicator for Mobile Bottom Sheet */}
              <div className="modal-handle-bar">
                <div className="modal-handle" />
              </div>

              {/* Header */}
              <div
                style={{
                  padding: '18px 20px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bell size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: 'var(--text)' }}>
                      Notifications
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {totalCount > 0
                        ? `${totalCount} pending item${totalCount > 1 ? 's' : ''} ${totalCount === 1 ? 'requires' : 'require'} attention`
                        : 'All caught up!'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {autopayEnabled && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => {
                        setOpen(false);
                        onNavigate('recurring');
                      }}
                      title="Manage Subscriptions"
                      aria-label="Manage Subscriptions"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-icon drawer-close-btn"
                    onClick={() => setOpen(false)}
                    title="Close"
                    aria-label="Close dialog"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '6px 20px 20px' }}>
                {totalCount === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: 'var(--credit)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <CheckCircle2 size={26} />
                    </div>
                    <p style={{ fontSize: 14.5, margin: 0, fontWeight: 650, color: 'var(--text)' }}>
                      All caught up!
                    </p>
                    <p style={{ fontSize: 12.5, margin: '6px 0 0 0', color: 'var(--text-2)' }}>
                      All subscriptions and quick logs are up to date.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Software Update Card */}
                    {availableUpdate && (
                      <div
                        style={{
                          padding: '12px 14px',
                          background: 'var(--accent-soft)',
                          border: '1px solid var(--accent-border-soft, var(--accent))',
                          borderRadius: 12,
                          boxShadow: '0 2px 8px var(--accent-soft)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: 'var(--accent-gradient, var(--accent))',
                              color: 'var(--accent-contrast, #ffffff)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Sparkles size={16} style={{ color: 'var(--accent-contrast, #ffffff)' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                              Software Update Available: v{availableUpdate.version}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                              Build #{availableUpdate.buildNumber} · Released {availableUpdate.releaseDate}
                            </div>
                          </div>
                        </div>

                        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '6px 0 10px 0', lineHeight: 1.4 }}>
                          {availableUpdate.releaseNotes}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary active-accent"
                            style={{
                              fontSize: 12,
                              fontWeight: 650,
                              padding: '6px 14px',
                              borderRadius: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'var(--accent-gradient, var(--accent))',
                              color: 'var(--accent-contrast, #ffffff)',
                              border: 'none',
                              boxShadow: '0 2px 8px var(--accent-soft)',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setOpen(false);
                              onNavigate('settings');
                            }}
                          >
                            <ArrowUpCircle size={14} style={{ color: 'var(--accent-contrast, #ffffff)' }} />
                            <span>Download in Settings</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Due Subscriptions Section */}
                    {dueAutopays.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--debit)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <RefreshCw size={13} style={{ color: 'var(--debit)' }} />
                          <span>Due Subscriptions ({dueAutopays.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {dueAutopays.map(r => (
                            <div
                              key={r.id}
                              style={{
                                padding: '12px 14px',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text)' }}>
                                  {r.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--debit)' }}>{fmtMoney(r.amount, currency)}</span> · Due Today
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  background: 'var(--debit)',
                                  color: '#ffffff',
                                  fontSize: 12,
                                  fontWeight: 650,
                                  padding: '6px 14px',
                                  height: 32,
                                  borderRadius: 8,
                                  border: 'none',
                                  flexShrink: 0,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 6px rgba(224,92,92,0.25)',
                                }}
                                onClick={() => {
                                  triggerAutopayDeduct(r.id);
                                }}
                              >
                                Pay Now
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Logs Section */}
                    {unloggedQuickLogs.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--accent)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Zap size={13} style={{ color: 'var(--accent)' }} />
                          <span>Due Logs ({unloggedQuickLogs.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {unloggedQuickLogs.map(r => (
                            <div
                              key={r.id}
                              style={{
                                padding: '12px 14px',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text)' }}>
                                  {r.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtMoney(r.amount, currency)}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary active-accent"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 650,
                                  padding: '6px 14px',
                                  height: 32,
                                  borderRadius: 8,
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: 'var(--accent-gradient, var(--accent))',
                                  color: 'var(--accent-contrast, #ffffff)',
                                  border: 'none',
                                  boxShadow: '0 2px 8px var(--accent-soft)',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  quickLogRecurringRule(r.id);
                                }}
                              >
                                <Zap size={12} style={{ color: 'var(--accent-contrast, #ffffff)' }} />
                                <span>Log Expense</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
