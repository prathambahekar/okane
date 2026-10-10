import React, { useMemo } from 'react';
import { Calendar, ChevronRight, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore } from '../../store';
import { fmtMoney } from '../../utils';
import { calculateMonthReport, type MonthReportData } from '../../utils/monthlyReport';

interface MonthlyReportCardProps {
  onOpenReportDrawer: () => void;
  selectedMonth?: string;
  className?: string;
}

export const MonthlyReportCard: React.FC<MonthlyReportCardProps> = ({
  onOpenReportDrawer,
  selectedMonth,
  className = '',
}) => {
  const { db } = useStore();
  const currency = db.settings?.currency || 'INR';

  const now = useMemo(() => new Date(), []);
  const activeMonthStr = useMemo(() => {
    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      return selectedMonth;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth, now]);

  const report: MonthReportData = useMemo(() => {
    return calculateMonthReport(db, activeMonthStr);
  }, [db, activeMonthStr]);

  const netGrowth = report.closingBalance - report.openingBalance;

  return (
    <div
      className={`card ${className}`}
      onClick={onOpenReportDrawer}
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        background: 'var(--card-surface)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--card-radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow: 'var(--shadow)',
        userSelect: 'none',
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenReportDrawer();
        }
      }}
      title="Click to view full Monthly Report"
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}>
              Monthly Report
            </h3>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
              {report.monthLabel}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
          <span>View Report</span>
          <ChevronRight size={15} />
        </div>
      </div>

      {/* Minimal Balance Journey Row */}
      <div
        style={{
          background: 'var(--surface2)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Start of Month</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>
              {fmtMoney(report.openingBalance, currency)}
            </div>
          </div>

          <div style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>→</div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>
              {report.isCurrentMonth ? 'Current' : 'End of Month'}
            </div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>
              {fmtMoney(report.closingBalance, currency)}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            background: netGrowth >= 0 ? 'var(--credit-bg)' : 'var(--debit-bg)',
            color: netGrowth >= 0 ? 'var(--credit)' : 'var(--debit)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {netGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{netGrowth >= 0 ? '+' : ''}{fmtMoney(netGrowth, currency)}</span>
        </div>
      </div>

      {/* Minimal Flow Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div
          style={{
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--credit)', fontWeight: 600 }}>
            <ArrowDownLeft size={13} strokeWidth={2.5} />
            <span>Got</span>
          </div>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--credit)' }}>
            +{fmtMoney(report.moneyIn, currency)}
          </span>
        </div>

        <div
          style={{
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--debit)', fontWeight: 600 }}>
            <ArrowUpRight size={13} strokeWidth={2.5} />
            <span>Spent</span>
          </div>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--debit)' }}>
            -{fmtMoney(report.moneyOut, currency)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportCard;
