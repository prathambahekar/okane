import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  Calendar,
  ArrowLeftRight,
} from 'lucide-react';
import { useStore } from '../../store';
import { fmtMoney, resolveCategoryMeta } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import { renderWalletIcon } from '../WalletIconRenderer';
import {
  calculateMonthReport,
  compareMonthReports,
  getPrevMonth,
  getNextMonth,
  type MonthReportData,
} from '../../utils/monthlyReport';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';

interface MonthlyReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string;
}

export const MonthlyReportDrawer: React.FC<MonthlyReportDrawerProps> = ({
  isOpen,
  onClose,
  initialMonth,
}) => {
  const { db, showToast } = useStore();
  const currency = db.settings?.currency || 'INR';

  const now = useMemo(() => new Date(), []);
  const currentYearMonth = useMemo(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [now]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) {
      return initialMonth;
    }
    return currentYearMonth;
  });

  const [compareEnabled, setCompareEnabled] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Back button handling
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  // Month report data for active month
  const report = useMemo<MonthReportData>(() => {
    return calculateMonthReport(db, selectedMonth);
  }, [db, selectedMonth]);

  // Previous month report for comparison
  const prevMonthStr = useMemo(() => getPrevMonth(selectedMonth), [selectedMonth]);
  const prevReport = useMemo<MonthReportData>(() => {
    return calculateMonthReport(db, prevMonthStr);
  }, [db, prevMonthStr]);

  // Comparison metrics
  const comparison = useMemo(() => {
    return compareMonthReports(report, prevReport);
  }, [report, prevReport]);

  const handlePrevMonth = useCallback(() => {
    setSelectedMonth(prev => getPrevMonth(prev));
  }, []);

  const handleNextMonth = useCallback(() => {
    if (selectedMonth >= currentYearMonth) return;
    setSelectedMonth(prev => getNextMonth(prev));
  }, [selectedMonth, currentYearMonth]);

  const isCurrent = selectedMonth === currentYearMonth;
  const isFuture = selectedMonth > currentYearMonth;

  // Copy monthly summary text
  const handleCopySummary = useCallback(() => {
    const lines = [
      `📊 ${report.monthLabel} Report`,
      `Start: ${fmtMoney(report.openingBalance, currency)} → End: ${fmtMoney(report.closingBalance, currency)}`,
      `Net Change: ${report.closingBalance >= report.openingBalance ? '+' : ''}${fmtMoney(report.closingBalance - report.openingBalance, currency)}`,
      `Got: ${fmtMoney(report.moneyIn, currency)} (${report.inflowCount} in)`,
      `Spent: ${fmtMoney(report.moneyOut, currency)} (${report.outflowCount} out)`,
      `Net Saved: ${report.netCashFlow >= 0 ? '+' : ''}${fmtMoney(report.netCashFlow, currency)} (${report.savingsRate}%)`,
    ];

    if (compareEnabled) {
      lines.push(
        `vs ${prevReport.shortMonthLabel}: Spend ${comparison.spendDiff <= 0 ? '-' : '+'}${fmtMoney(Math.abs(comparison.spendDiff), currency)} (${Math.abs(comparison.spendPctChange).toFixed(1)}%)`
      );
    }

    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      showToast('Summary copied!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showToast('Failed to copy');
    });
  }, [report, prevReport, comparison, compareEnabled, currency, showToast]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop-motion"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="monthly-report-drawer-title"
    >
      <div
        className="modal-dialog-panel monthly-report-drawer-panel"
        style={{
          maxWidth: 500,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--border2)',
            margin: '10px auto 2px',
            flexShrink: 0,
          }}
        />

        {/* Minimal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px 8px',
            flexShrink: 0,
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-soft)',
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Calendar size={16} />
            </div>
            <div>
              <h3
                id="monthly-report-drawer-title"
                style={{
                  fontSize: 'var(--fs-base)',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text)',
                  lineHeight: 1.2,
                }}
              >
                Monthly Report
              </h3>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                {report.monthLabel}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={handleCopySummary}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
              }}
              title="Copy clean summary"
            >
              {copied ? <Check size={12} style={{ color: 'var(--credit)' }} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
              aria-label="Close drawer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Minimal Month Switcher Row */}
        <div style={{ padding: '0 18px 8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 6px',
            }}
          >
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: 'var(--surface)',
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>
              {report.monthLabel} {isCurrent ? '(Active)' : ''}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrent || isFuture}
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: isCurrent || isFuture ? 'transparent' : 'var(--surface)',
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                cursor: isCurrent || isFuture ? 'not-allowed' : 'pointer',
                opacity: isCurrent || isFuture ? 0.35 : 1,
              }}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content (Minimal, No Lines, Generous Spacing) */}
        <div
          style={{
            padding: '4px 18px 18px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* 1. Minimal Balance Journey Card */}
          <div
            style={{
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.04em' }}>
                Wallet Balances
              </span>
              <span
                style={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: report.closingBalance >= report.openingBalance ? 'var(--credit-bg)' : 'var(--debit-bg)',
                  color: report.closingBalance >= report.openingBalance ? 'var(--credit)' : 'var(--debit)',
                }}
              >
                {report.closingBalance >= report.openingBalance ? '+' : ''}{fmtMoney(report.closingBalance - report.openingBalance, currency)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                  Start of Month
                </div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)' }}>
                  {fmtMoney(report.openingBalance, currency)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                  {isCurrent ? 'Current Balance' : 'End of Month'}
                </div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)' }}>
                  {fmtMoney(report.closingBalance, currency)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Minimal Got vs Spent Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Got (Inflow) */}
            <div
              style={{
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--credit)', textTransform: 'uppercase' }}>
                <ArrowDownLeft size={13} strokeWidth={2.5} />
                <span>Got</span>
              </div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--credit)' }}>
                +{fmtMoney(report.moneyIn, currency)}
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                {report.inflowCount} received
              </div>
            </div>

            {/* Spent (Outflow) */}
            <div
              style={{
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--debit)', textTransform: 'uppercase' }}>
                <ArrowUpRight size={13} strokeWidth={2.5} />
                <span>Spent</span>
              </div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--debit)' }}>
                -{fmtMoney(report.moneyOut, currency)}
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                {report.outflowCount} expenses
              </div>
            </div>
          </div>

          {/* Net Saved Pill Bar */}
          <div
            style={{
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {report.netCashFlow >= 0 ? (
                <TrendingUp size={15} style={{ color: 'var(--credit)' }} />
              ) : (
                <TrendingDown size={15} style={{ color: 'var(--debit)' }} />
              )}
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)' }}>
                Net Cash Saved:
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 'var(--fs-base)',
                  fontWeight: 800,
                  color: report.netCashFlow >= 0 ? 'var(--credit)' : 'var(--debit)',
                }}
              >
                {report.netCashFlow >= 0 ? '+' : ''}{fmtMoney(report.netCashFlow, currency)}
              </span>
              {report.moneyIn > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--accent-soft)',
                    color: 'var(--text)',
                  }}
                >
                  {report.savingsRate}% saved
                </span>
              )}
            </div>
          </div>

          {/* 3. Minimal Compare With Last Month Section */}
          <div
            style={{
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-xl)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeftRight size={13} style={{ color: 'var(--text-2)' }} />
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text)' }}>
                  Compare vs {prevReport.shortMonthLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCompareEnabled(c => !c)}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: compareEnabled ? 'var(--accent)' : 'var(--surface)',
                  color: compareEnabled ? 'var(--accent-contrast)' : 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                {compareEnabled ? 'Active' : 'Off'}
              </button>
            </div>

            {compareEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
                <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Spending Diff</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: comparison.spendDiff <= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                    {comparison.spendDiff <= 0 ? 'Saved ' : '+'}{fmtMoney(Math.abs(comparison.spendDiff), currency)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                    {comparison.spendDiff <= 0 ? 'Spent less' : 'Spent more'} ({Math.abs(comparison.spendPctChange).toFixed(0)}%)
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Income Diff</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: comparison.incomeDiff >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                    {comparison.incomeDiff >= 0 ? '+' : ''}{fmtMoney(comparison.incomeDiff, currency)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                    {comparison.incomeDiff >= 0 ? 'Higher income' : 'Lower income'} ({Math.abs(comparison.incomePctChange).toFixed(0)}%)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Minimal Top Categories (Top 4 only, clean pills, zero split lines) */}
          {report.categories.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  Top Categories
                </span>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                  {fmtMoney(report.moneyOut, currency)} total
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.categories.slice(0, 4).map(cat => {
                  const catObj = (db.settings?.categories || []).find(c => c.name.toLowerCase() === cat.name.toLowerCase());
                  const meta = resolveCategoryMeta(cat.name, catObj);

                  return (
                    <div
                      key={cat.name}
                      style={{
                        background: 'var(--surface2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <CategoryIcon category={cat.name} icon={meta.icon} size={16} />
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                          {cat.pct}%
                        </span>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>
                          {fmtMoney(cat.amount, currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Minimal Wallets Movement */}
          {report.wallets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.04em', padding: '0 2px' }}>
                Wallet Movement
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.wallets.map(w => (
                  <div
                    key={w.id}
                    style={{
                      background: 'var(--surface2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {renderWalletIcon(w.icon || w.name, 15, w.color)}
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
                        {w.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                        Bal: {fmtMoney(w.closingBalance, currency)}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          color: w.netChange >= 0 ? 'var(--credit)' : 'var(--debit)',
                        }}
                      >
                        {w.netChange >= 0 ? '+' : ''}{fmtMoney(w.netChange, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Quick Highlights Pill */}
          <div
            style={{
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-2)',
            }}
          >
            <span>Avg Spend: <strong>{fmtMoney(report.dailyAverageSpend, currency)}/day</strong></span>
            {report.highestExpense && (
              <span>Peak: <strong>{fmtMoney(report.highestExpense.amount, currency)}</strong></span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MonthlyReportDrawer;
