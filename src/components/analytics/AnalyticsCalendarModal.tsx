import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { fmtMoney, type GroupedExpense, getGroupedExpenseAmount, type SpendingMode } from '../../utils';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';

export type AnalyticsPeriodScope = 'day' | 'week' | 'month' | 'year';

interface AnalyticsCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScope: AnalyticsPeriodScope;
  initialDateStr: string; // YYYY-MM-DD
  groupedExpenses: GroupedExpense[];
  currency: string;
  spendingMode?: SpendingMode;
  onApply: (selection: { scope: AnalyticsPeriodScope; dateStr: string }) => void;
}

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export const AnalyticsCalendarModal: React.FC<AnalyticsCalendarModalProps> = ({
  isOpen,
  onClose,
  initialScope,
  initialDateStr,
  groupedExpenses,
  currency,
  spendingMode = 'all',
  onApply,
}) => {
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Parse initial date
  const parsedDate = useMemo(() => {
    if (!initialDateStr) return new Date();
    const parts = initialDateStr.split('-').map(Number);
    if (parts.length >= 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  }, [initialDateStr]);

  const [scope, setScope] = useState<AnalyticsPeriodScope>(initialScope);
  const [selectedDate, setSelectedDate] = useState<Date>(parsedDate);
  const [viewYear, setViewYear] = useState<number>(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsedDate.getMonth()); // 0-11
  const [showMonthPicker, setShowMonthPicker] = useState<boolean>(false);
  const [showYearPicker, setShowYearPicker] = useState<boolean>(false);

  // Today reference
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatISO(today), [today]);

  // Sync state when modal opens
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setScope(initialScope);
      const d = initialDateStr ? new Date(initialDateStr.split('-').map(Number)[0], initialDateStr.split('-').map(Number)[1] - 1, initialDateStr.split('-').map(Number)[2]) : new Date();
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setShowMonthPicker(false);
      setShowYearPicker(false);
    }
  }, [isOpen, initialScope, initialDateStr]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DIALOG });

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Days in current view month
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  // First day of month (Monday = 0 ... Sunday = 6)
  const firstDayIndex = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1).getDay();
    return (first + 6) % 7;
  }, [viewYear, viewMonth]);

  // Selected date ISO string
  const selectedDateStr = useMemo(() => formatISO(selectedDate), [selectedDate]);

  // Selected week boundaries (Monday to Sunday)
  const selectedWeekRange = useMemo(() => {
    const mon = getMonday(selectedDate);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return {
      startStr: formatISO(mon),
      endStr: formatISO(sun),
      startDate: mon,
      endDate: sun,
    };
  }, [selectedDate]);

  // Map of days with spending in viewMonth to display subtle dots
  const datesWithSpend = useMemo(() => {
    const set = new Set<string>();
    groupedExpenses.forEach(ge => {
      if (ge.flow === 'out' && ge.date.startsWith(`${viewYear}-${padZero(viewMonth + 1)}`)) {
        set.add(ge.date);
      }
    });
    return set;
  }, [groupedExpenses, viewYear, viewMonth]);

  // Real-time preview calculation based on active scope & selection
  const previewStats = useMemo(() => {
    let startStr = selectedDateStr;
    let endStr = selectedDateStr;
    let label = '';
    let sublabel = '';

    if (scope === 'day') {
      startStr = selectedDateStr;
      endStr = selectedDateStr;
      label = selectedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      sublabel = selectedDateStr === todayStr ? 'Today' : 'Single day';
    } else if (scope === 'week') {
      startStr = selectedWeekRange.startStr;
      endStr = selectedWeekRange.endStr;
      const m1 = selectedWeekRange.startDate.toLocaleDateString('en-US', { month: 'short' });
      const m2 = selectedWeekRange.endDate.toLocaleDateString('en-US', { month: 'short' });
      const d1 = selectedWeekRange.startDate.getDate();
      const d2 = selectedWeekRange.endDate.getDate();
      const yr = selectedWeekRange.endDate.getFullYear();
      label = m1 === m2 ? `${m1} ${d1} – ${d2}, ${yr}` : `${m1} ${d1} – ${m2} ${d2}, ${yr}`;
      sublabel = '7 days';
    } else if (scope === 'month') {
      const first = new Date(viewYear, viewMonth, 1);
      const last = new Date(viewYear, viewMonth + 1, 0);
      startStr = formatISO(first);
      endStr = formatISO(last);
      label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      sublabel = `${last.getDate()} days`;
    } else if (scope === 'year') {
      startStr = `${viewYear}-01-01`;
      endStr = `${viewYear}-12-31`;
      label = `Year ${viewYear}`;
      sublabel = '12 months';
    }

    // Filter expenses in this range
    const filtered = groupedExpenses.filter(ge => ge.date >= startStr && ge.date <= endStr && ge.flow === 'out');
    const total = filtered.reduce((acc, ge) => acc + getGroupedExpenseAmount(ge, spendingMode), 0);
    const count = filtered.length;

    return {
      startStr,
      endStr,
      label,
      sublabel,
      total,
      count,
    };
  }, [scope, selectedDate, selectedDateStr, selectedWeekRange, viewYear, viewMonth, groupedExpenses, spendingMode, todayStr]);

  // Navigate Month
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Month Names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Handle native input change
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    const newDate = new Date(y, m - 1, d);
    setSelectedDate(newDate);
    setViewYear(y);
    setViewMonth(m - 1);
  };

  // Apply handler
  const handleApply = () => {
    let dateStr = selectedDateStr;
    if (scope === 'week') {
      dateStr = selectedWeekRange.startStr;
    } else if (scope === 'month') {
      dateStr = `${viewYear}-${padZero(viewMonth + 1)}-01`;
    } else if (scope === 'year') {
      dateStr = `${viewYear}-01-01`;
    }
    onApply({ scope, dateStr });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="filter-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-modal-title"
      style={{
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="filter-drawer-panel"
        style={{
          maxWidth: 420,
          width: '100%',
          maxHeight: '92vh',
          borderRadius: 24,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          animation: 'modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--border2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: 'var(--accent, #8b5cf6)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarIcon size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3
                id="calendar-modal-title"
                style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}
              >
                Date & Period
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                Select specific day, week, month, or year
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scope Selector: Day / Week / Month / Year */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              View Scope
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                background: 'var(--surface2)',
                padding: 4,
                borderRadius: 14,
                border: '1px solid var(--border)',
                gap: 4,
              }}
              role="tablist"
              aria-label="Select scope"
            >
              {(['day', 'week', 'month', 'year'] as AnalyticsPeriodScope[]).map((s) => {
                const isActive = scope === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setScope(s);
                      setShowMonthPicker(false);
                      setShowYearPicker(false);
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                      fontSize: 12.5,
                      fontWeight: isActive ? 700 : 550,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 8px var(--accent-soft)' : 'none',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Native Picker Shortcut Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                Native Calendar
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (nativeInputRef.current && typeof nativeInputRef.current.showPicker === 'function') {
                  try {
                    nativeInputRef.current.showPicker();
                  } catch {
                    nativeInputRef.current.click();
                  }
                } else if (nativeInputRef.current) {
                  nativeInputRef.current.click();
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 11.5,
                fontWeight: 650,
                cursor: 'pointer',
              }}
            >
              <CalendarIcon size={12} />
              <span>Choose Date</span>
            </button>

            {/* Hidden native HTML5 date input with showPicker */}
            <input
              ref={nativeInputRef}
              type="date"
              value={selectedDateStr}
              onChange={handleNativeChange}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 1,
                height: 1,
                right: 12,
                top: 8,
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          {/* Scope Content: Calendar Grid / Month Selector / Year Selector */}
          {scope === 'year' ? (
            /* Year Grid */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Select Year
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[2023, 2024, 2025, 2026, 2027, 2028].map((yr) => {
                  const isSelected = viewYear === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setViewYear(yr)}
                      style={{
                        padding: '12px 6px',
                        borderRadius: 12,
                        border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'var(--surface2)',
                        color: isSelected ? 'var(--accent-contrast, #ffffff)' : 'var(--text)',
                        fontSize: 14,
                        fontWeight: isSelected ? 750 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : scope === 'month' ? (
            /* Month Grid */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Year Navigation for Month mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setViewYear(prev => prev - 1)}
                  className="btn-icon"
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)' }}>
                  {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => setViewYear(prev => prev + 1)}
                  className="btn-icon"
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {shortMonthNames.map((mName, idx) => {
                  const isSelected = viewMonth === idx;
                  const isThisMonth = today.getFullYear() === viewYear && today.getMonth() === idx;
                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => setViewMonth(idx)}
                      style={{
                        padding: '12px 6px',
                        borderRadius: 12,
                        border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'var(--surface2)',
                        color: isSelected ? 'var(--accent-contrast, #ffffff)' : 'var(--text)',
                        fontSize: 13,
                        fontWeight: isSelected ? 750 : 600,
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {mName}
                      {isThisMonth && !isSelected && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 6,
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Day or Week Calendar View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Month / Year Navigator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 4px',
                }}
              >
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="btn-icon"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setShowMonthPicker(prev => !prev)}
                    style={{
                      background: showMonthPicker ? 'var(--accent)' : 'var(--surface2)',
                      color: showMonthPicker ? 'var(--accent-contrast)' : 'var(--text)',
                      border: '1px solid var(--border)',
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {monthNames[viewMonth]}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowYearPicker(prev => !prev)}
                    style={{
                      background: showYearPicker ? 'var(--accent)' : 'var(--surface2)',
                      color: showYearPicker ? 'var(--accent-contrast)' : 'var(--text)',
                      border: '1px solid var(--border)',
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {viewYear}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="btn-icon"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Pop-in Month Selector if opened */}
              {showMonthPicker && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                    padding: 8,
                    borderRadius: 12,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {shortMonthNames.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewMonth(idx);
                        setShowMonthPicker(false);
                      }}
                      style={{
                        padding: '6px 2px',
                        borderRadius: 6,
                        border: 'none',
                        background: viewMonth === idx ? 'var(--accent)' : 'transparent',
                        color: viewMonth === idx ? 'var(--accent-contrast)' : 'var(--text)',
                        fontSize: 12,
                        fontWeight: viewMonth === idx ? 750 : 550,
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Pop-in Year Selector if opened */}
              {showYearPicker && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                    padding: 8,
                    borderRadius: 12,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {[2023, 2024, 2025, 2026, 2027, 2028].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setViewYear(yr);
                        setShowYearPicker(false);
                      }}
                      style={{
                        padding: '6px 2px',
                        borderRadius: 6,
                        border: 'none',
                        background: viewYear === yr ? 'var(--accent)' : 'transparent',
                        color: viewYear === yr ? 'var(--accent-contrast)' : 'var(--text)',
                        fontSize: 12,
                        fontWeight: viewYear === yr ? 750 : 550,
                        cursor: 'pointer',
                      }}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              )}

              {/* Weekday Labels Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  textAlign: 'center',
                  gap: 2,
                }}
              >
                {weekDays.map(wd => (
                  <div
                    key={wd}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-3)',
                      padding: '4px 0',
                    }}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 3,
                  rowGap: 4,
                }}
              >
                {/* Empty cells before month start */}
                {Array.from({ length: firstDayIndex }).map((_, idx) => (
                  <div key={`empty-${idx}`} style={{ height: 36 }} />
                ))}

                {/* Days 1..daysInMonth */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateObj = new Date(viewYear, viewMonth, dayNum);
                  const dateStr = formatISO(dateObj);

                  const isTodayDate = dateStr === todayStr;
                  const isDaySelected = scope === 'day' && dateStr === selectedDateStr;
                  const isWeekSelected =
                    scope === 'week' &&
                    dateStr >= selectedWeekRange.startStr &&
                    dateStr <= selectedWeekRange.endStr;
                  const hasSpend = datesWithSpend.has(dateStr);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dateObj);
                      }}
                      style={{
                        height: 36,
                        borderRadius: scope === 'week' ? 6 : 10,
                        border: isDaySelected
                          ? '1.5px solid var(--accent)'
                          : isTodayDate
                          ? '1px solid var(--accent-border-soft, rgba(139, 92, 246, 0.4))'
                          : '1px solid transparent',
                        background: isDaySelected
                          ? 'var(--accent)'
                          : isWeekSelected
                          ? 'rgba(139, 92, 246, 0.18)'
                          : 'transparent',
                        color: isDaySelected
                          ? 'var(--accent-contrast, #ffffff)'
                          : isWeekSelected
                          ? 'var(--accent)'
                          : 'var(--text)',
                        fontSize: 12.5,
                        fontWeight: isDaySelected || isWeekSelected ? 750 : isTodayDate ? 700 : 550,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span>{dayNum}</span>
                      {hasSpend && (
                        <span
                          style={{
                            width: 3.5,
                            height: 3.5,
                            borderRadius: '50%',
                            background: isDaySelected ? 'var(--accent-contrast)' : 'var(--accent)',
                            position: 'absolute',
                            bottom: 3,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginRight: 2 }}>
              Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                setScope('day');
                setSelectedDate(today);
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              style={{
                fontSize: 11,
                fontWeight: 650,
                padding: '4px 9px',
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('week');
                setSelectedDate(today);
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              style={{
                fontSize: 11,
                fontWeight: 650,
                padding: '4px 9px',
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('month');
                setSelectedDate(today);
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              style={{
                fontSize: 11,
                fontWeight: 650,
                padding: '4px 9px',
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('year');
                setViewYear(today.getFullYear());
              }}
              style={{
                fontSize: 11,
                fontWeight: 650,
                padding: '4px 9px',
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              This Year
            </button>
          </div>

          {/* Live Statistics Preview Box */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {previewStats.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {previewStats.sublabel} • {previewStats.count} {previewStats.count === 1 ? 'transaction' : 'transactions'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {fmtMoney(previewStats.total, currency)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 650, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                Total Spending
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderTop: '1px solid var(--border2)',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 9999,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            style={{
              flex: 1.6,
              height: 42,
              borderRadius: 9999,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 3px 12px var(--accent-soft)',
            }}
          >
            <Check size={16} strokeWidth={2.5} />
            <span>Apply Selection</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AnalyticsCalendarModal;
