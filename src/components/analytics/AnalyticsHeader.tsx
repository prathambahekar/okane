import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ViewName } from '../../types';

interface AnalyticsHeaderProps {
  period: 'week' | 'month';
  setPeriod: (p: 'week' | 'month') => void;
  dateRangeLabel: string;
  onPrevDate: () => void;
  onNextDate: () => void;
  onResetDate?: () => void;
  isCurrentPeriod?: boolean;
  onNavigate?: (v: ViewName) => void;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  period,
  setPeriod,
  dateRangeLabel,
  onPrevDate,
  onNextDate,
  onResetDate,
  isCurrentPeriod = false,
}) => {
  return (
    <div style={{ width: '100%', marginBottom: 12 }}>
      {/* Period Selector [Week | Month] & Date Range Navigator [📅 Range < >] side by side */}
      <div className="analytics-v2-nav-bar">
        {/* Week / Month Segmented Switch */}
        <div className="analytics-v2-segmented">
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`analytics-v2-segment-btn ${period === 'week' ? 'active' : ''}`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`analytics-v2-segment-btn ${period === 'month' ? 'active' : ''}`}
          >
            Month
          </button>
        </div>

        {/* Date Range Navigation Capsule */}
        <div className="analytics-v2-date-capsule">
          <button
            type="button"
            onClick={onResetDate}
            className="analytics-v2-date-label-btn"
            title="Click to jump to current period"
          >
            <Calendar size={14} color="var(--text-3)" strokeWidth={2.2} />
            <span>{dateRangeLabel}</span>
          </button>

          <div className="analytics-v2-date-arrows">
            <button
              type="button"
              onClick={onPrevDate}
              className="analytics-v2-arrow-btn"
              aria-label="Previous period"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={onNextDate}
              disabled={isCurrentPeriod}
              className="analytics-v2-arrow-btn"
              aria-label="Next period"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsHeader;

