import { useState, useRef, useEffect } from 'react';
import { Bell, RefreshCw, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { todayISO } from '../db';
import { fmtMoney } from '../utils';
import type { ViewName } from '../types';

interface Props {
  onNavigate: (v: ViewName) => void;
  placement?: 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right';
}

export default function NotificationBell({ onNavigate, placement = 'bottom-right' }: Props) {
  const { db, triggerAutopayDeduct, quickLogRecurringRule, showToast } = useStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPopoverStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 320,
      maxWidth: 'calc(100vw - 24px)',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      zIndex: 1200,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn 0.15s ease-out',
    };

    if (placement === 'top-left') {
      return {
        ...base,
        bottom: 'calc(100% + 10px)',
        left: 0,
      };
    } else if (placement === 'top-right') {
      return {
        ...base,
        bottom: 'calc(100% + 10px)',
        right: 0,
      };
    } else if (placement === 'bottom-left') {
      return {
        ...base,
        top: 'calc(100% + 8px)',
        left: 0,
      };
    } else {
      return {
        ...base,
        top: 'calc(100% + 8px)',
        right: 0,
      };
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn-icon"
        onClick={() => setOpen(!open)}
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
        title="Notifications & Prompts"
      >
        <Bell size={18} />
        {totalCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: '#ef5350',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 800,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--surface)',
              lineHeight: 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div style={getPopoverStyle()}>
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Action Prompts
              </span>
            </div>
            {totalCount > 0 ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(239, 83, 80, 0.15)',
                  color: '#ef5350',
                }}
              >
                {totalCount} Pending
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>All caught up</span>
            )}
          </div>

          {/* List Content */}
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 12px' }}>
            {totalCount === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-3)' }}>
                <CheckCircle2 size={24} style={{ color: '#66bb6a', marginBottom: 6 }} />
                <p style={{ fontSize: 13, margin: 0, fontWeight: 500 }}>No pending prompts!</p>
                <p style={{ fontSize: 11.5, margin: '4px 0 0 0', opacity: 0.8 }}>
                  All subscriptions & quick logs are up to date.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Due Autopays Section */}
                {dueAutopays.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#ef5350',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <RefreshCw size={12} />
                      <span>Due Subscriptions ({dueAutopays.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dueAutopays.map(r => (
                        <div
                          key={r.id}
                          style={{
                            padding: '8px 10px',
                            background: 'rgba(239, 83, 80, 0.08)',
                            border: '1px solid rgba(239, 83, 80, 0.2)',
                            borderRadius: 'var(--radius)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                              {r.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {fmtMoney(r.amount, currency)} · Due Today
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: '#ef5350',
                              color: '#ffffff',
                              fontSize: 11.5,
                              padding: '4px 10px',
                              height: 28,
                              borderRadius: 14,
                              flexShrink: 0,
                            }}
                            onClick={() => {
                              triggerAutopayDeduct(r.id);
                              showToast(`Paid ${fmtMoney(r.amount, currency)} for "${r.title}"`);
                            }}
                          >
                            Pay
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
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#d97706',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 6,
                        marginTop: dueAutopays.length > 0 ? 6 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Zap size={12} />
                      <span>1-Tap Daily Logs ({unloggedQuickLogs.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {unloggedQuickLogs.map(r => (
                        <div
                          key={r.id}
                          style={{
                            padding: '8px 10px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                              {r.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {fmtMoney(r.amount, currency)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{
                              fontSize: 11.5,
                              padding: '4px 10px',
                              height: 28,
                              borderRadius: 14,
                              flexShrink: 0,
                            }}
                            onClick={() => {
                              quickLogRecurringRule(r.id);
                              showToast(`Logged ${fmtMoney(r.amount, currency)} for "${r.title}"`);
                            }}
                          >
                            <Zap size={11} /> Log
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
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface2)',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => {
                setOpen(false);
                onNavigate('recurring');
              }}
            >
              <span>Manage Subscriptions & Recurring</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
