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
    <div style={{ width: '100%' }}>
      {/* Nav bar: Left-aligned grouped controls with refined gap */}
      <div className="analytics-v2-nav-bar">
        {/* Week / Month Segmented Switch (Accent color for selected) */}
        <div className="analytics-v2-segmented" role="tablist" aria-label="Period selector">
          <button
            type="button"
            role="tab"
            aria-selected={period === 'week'}
            onClick={() => setPeriod('week')}
            className={`analytics-v2-segment-btn ${period === 'week' ? 'active' : ''}`}
          >
            Week
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'month'}
            onClick={() => setPeriod('month')}
            className={`analytics-v2-segment-btn ${period === 'month' ? 'active' : ''}`}
          >
            Month
          </button>
        </div>

        {/* Date Range Navigation Capsule: [ < ] [ 📅 Sep 14 – 20 ] [ > ] */}
        <div className="analytics-v2-date-capsule" aria-label="Date range navigation">
          <button
            type="button"
            onClick={onPrevDate}
            className="analytics-v2-arrow-btn"
            aria-label="Previous period"
            title="Previous period"
          >
            <ChevronLeft size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            onClick={onResetDate}
            className="analytics-v2-date-label-btn"
            title={isCurrentPeriod ? 'Current period' : 'Jump to current period'}
          >
            <Calendar size={15} className="analytics-v2-date-icon" strokeWidth={2.2} />
            <span className="analytics-v2-date-text">{dateRangeLabel}</span>
          </button>

          <button
            type="button"
            onClick={onNextDate}
            disabled={isCurrentPeriod}
            className="analytics-v2-arrow-btn"
            aria-label="Next period"
            title={isCurrentPeriod ? 'Current period' : 'Next period'}
          >
            <ChevronRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsHeader;

