import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, RefreshCw, Zap, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useStore } from '../store';
import { todayISO } from '../db';
import { fmtMoney } from '../utils';
import type { ViewName } from '../types';

interface Props {
  onNavigate: (v: ViewName) => void;
  placement?: 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right';
}

export default function NotificationBell({ onNavigate }: Props) {
  const { db, triggerAutopayDeduct, quickLogRecurringRule } = useStore();
  const [open, setOpen] = useState(false);

  const today = todayISO();
  const currency = db.settings.currency;
  const rules = db.recurringRules || [];

  const dueAutopays = rules.filter(
    r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today
  );

  const unloggedQuickLogs = rules.filter(
    r => r.kind === 'quick_log' && r.status === 'active' && r.lastLoggedDate !== today
  );

  const totalCount = dueAutopays.length + unloggedQuickLogs.length;

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
          borderRadius: 18,
          background: open ? 'var(--surface3)' : 'var(--surface2)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: totalCount > 0 ? 'var(--text)' : 'var(--text-2)',
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
            <div className="modal" style={{ maxWidth: 460 }}>
              {/* Drag Handle Indicator for Mobile Bottom Sheet */}
              <div className="modal-handle-bar">
                <div className="modal-handle" />
              </div>

              {/* Header */}
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
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
                  <div>
                    <div className="modal-title" style={{ fontSize: 16, lineHeight: 1.2 }}>
                      Notifications
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      {totalCount > 0
                        ? `${totalCount} pending item${totalCount > 1 ? 's' : ''} require attention`
                        : 'All caught up!'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {totalCount === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'rgba(102, 187, 106, 0.12)',
                        color: '#66bb6a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <CheckCircle2 size={26} />
                    </div>
                    <p style={{ fontSize: 14, margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                      No pending prompts!
                    </p>
                    <p style={{ fontSize: 12.5, margin: '6px 0 0 0', opacity: 0.85, color: 'var(--text-2)' }}>
                      All subscriptions and quick logs are up to date.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Due Autopays Section */}
                    {dueAutopays.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#ef5350',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <RefreshCw size={13} />
                          <span>Due Subscriptions ({dueAutopays.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {dueAutopays.map(r => (
                            <div
                              key={r.id}
                              style={{
                                padding: '10px 12px',
                                background: 'rgba(239, 83, 80, 0.08)',
                                border: '1px solid rgba(239, 83, 80, 0.25)',
                                borderRadius: 'var(--radius-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                                  {r.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                                  <span style={{ fontWeight: 700, color: '#ef5350' }}>{fmtMoney(r.amount, currency)}</span> · Due Today
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  background: '#ef5350',
                                  color: '#ffffff',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '6px 14px',
                                  height: 32,
                                  borderRadius: 16,
                                  flexShrink: 0,
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
                            color: '#d97706',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Zap size={13} />
                          <span>Due Logs({unloggedQuickLogs.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {unloggedQuickLogs.map(r => (
                            <div
                              key={r.id}
                              style={{
                                padding: '10px 12px',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                                  {r.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtMoney(r.amount, currency)}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{
                                  fontSize: 12,
                                  padding: '6px 14px',
                                  height: 32,
                                  borderRadius: 16,
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                onClick={() => {
                                  quickLogRecurringRule(r.id);
                                }}
                              >
                                <Zap size={12} /> Log Expense
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    setOpen(false);
                    onNavigate('recurring');
                  }}
                >
                  <span>Manage Subscriptions</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
