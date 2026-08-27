import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Wallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { useStore } from '../store';
import { fmtMoney, cleanExpenseDescription } from '../utils';
import { expenseFlow, expenseWalletDelta } from '../db';
import type { Expense, Settlement, Wallet } from '../types';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string | null;
  initialDate?: string | null;
}

interface DayTransaction {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  category: string;
  amount: number;
  flow: 'in' | 'out';
  walletId: string;
  walletName: string;
  walletColor: string;
  time?: string;
  rawExpense?: Expense;
  rawSettlement?: Settlement;
}

interface DayBalanceRecord {
  dateStr: string;
  dayNumber: number;
  dayName: string;
  fullDateLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  isFuture: boolean;
  closingBalance: number;
  previousBalance: number;
  dayCashIn: number;
  dayCashOut: number;
  dayNetChange: number;
  transactions: DayTransaction[];
  walletBreakdown: Array<{
    walletId: string;
    walletName: string;
    walletColor: string;
    closingBalance: number;
    dayNetChange: number;
  }>;
}

export default function DailyWalletBalanceDrawer({
  isOpen,
  onClose,
  initialMonth,
  initialDate,
}: Props) {
  const { db } = useStore();
  const { wallets, expenses, settlements = [], settings } = db;
  const currency = settings?.currency || 'INR';

  const [prevIsOpen, setPrevIsOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const yesterdayStr = useMemo(() => {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const y = yest.getFullYear();
    const m = String(yest.getMonth() + 1).padStart(2, '0');
    const d = String(yest.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  // Selected Month State (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) return initialMonth;
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return initialDate.slice(0, 7);
    return todayStr.slice(0, 7);
  });

  // Selected Wallet Filter ('all' or walletId)
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');

  // Filter mode: 'all_days' or 'activity_only'
  const [filterMode, setFilterMode] = useState<'all_days' | 'activity_only'>('all_days');

  // Sort order: 'desc' (newest first) or 'asc' (oldest first)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter popup/panel open state
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedWalletId !== 'all') count++;
    if (filterMode !== 'all_days') count++;
    if (sortOrder !== 'desc') count++;
    return count;
  }, [selectedWalletId, filterMode, sortOrder]);

  const resetFilters = () => {
    setSelectedWalletId('all');
    setFilterMode('all_days');
    setSortOrder('desc');
  };

  // Expanded / Selected day state for detail modal
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Search query within the drawer
  const [searchQuery, setSearchQuery] = useState<string>('');

  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });
  useBackButtonModal(Boolean(selectedDayDate), () => setSelectedDayDate(null), { priority: BackPriority.DIALOG });
  useBackButtonModal(showFilterPanel, () => setShowFilterPanel(false), { priority: BackPriority.DIALOG });

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
        setSelectedMonth(initialDate.slice(0, 7));
        setSelectedDayDate(initialDate);
      } else if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) {
        setSelectedMonth(initialMonth);
        setSelectedDayDate(null);
      }
    }
  }

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Map for fast wallet lookups
  const walletMap = useMemo(() => {
    const map = new Map<string, Wallet>();
    wallets.forEach(w => map.set(w.id, w));
    return map;
  }, [wallets]);

  // Calculate daily balance records for the active selectedMonth
  const {
    dailyRecords,
    monthOpeningBalance,
    monthClosingBalance,
    monthTotalInflow,
    monthTotalOutflow,
    monthNetChange,
    monthDaysCount,
    activeDaysCount,
  } = useMemo(() => {
    const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
    const daysInCurrentMonth = new Date(yearNum, monthNum, 0).getDate();
    const monthStartIso = `${selectedMonth}-01`;

    // Target wallets to evaluate
    const targetWallets = selectedWalletId === 'all'
      ? wallets
      : wallets.filter(w => w.id === selectedWalletId);

    const targetWalletIds = new Set(targetWallets.map(w => w.id));

    const spendingMode = db.settings?.spendingMode || 'all';

    let openingBeforeMonth = 0;
    targetWallets.forEach(w => {
      openingBeforeMonth += Number(w.openingBalance) || 0;
    });

    const dateWalletActivity = new Map<
      string,
      Map<string, { cashIn: number; cashOut: number; txs: DayTransaction[] }>
    >();

    const getActivityEntry = (dStr: string, wId: string) => {
      let dayMap = dateWalletActivity.get(dStr);
      if (!dayMap) {
        dayMap = new Map();
        dateWalletActivity.set(dStr, dayMap);
      }
      let entry = dayMap.get(wId);
      if (!entry) {
        entry = { cashIn: 0, cashOut: 0, txs: [] };
        dayMap.set(wId, entry);
      }
      return entry;
    };

    // Process expenses
    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      if (amt === 0) return;

      const effectiveWId = e.walletId || db.settings?.defaultWalletId || (wallets[0]?.id || 'wal_cash');
      const wObj = walletMap.get(effectiveWId);
      const wName = wObj?.name || 'Cash / Default';
      const wColor = wObj?.color || 'var(--accent)';

      const isIncoming = expenseFlow(e) === 'in';
      const delta = expenseWalletDelta(e, db);

      let baseDesc = cleanExpenseDescription(e.description) || (isIncoming ? 'Income Received' : 'Expense');
      if (e.status === 'unpaid') {
        baseDesc = `${baseDesc} (Unpaid)`;
      } else if (spendingMode !== 'me' && e.type === 'for_friend' && e.friendId) {
        const friend = db.friends?.find(f => f.id === e.friendId);
        const fName = friend ? friend.name : 'Friend';
        baseDesc = `${baseDesc} (${fName}'s share)`;
      } else if (spendingMode !== 'me' && e.type === 'personal' && e.groupId) {
        const isSplitGroup = expenses.some(other => other.groupId === e.groupId && other.id !== e.id);
        if (isSplitGroup) {
          baseDesc = `${baseDesc} (My share)`;
        }
      }

      if (delta !== 0) {
        if (e.date < monthStartIso) {
          if (targetWalletIds.has(effectiveWId)) {
            openingBeforeMonth += delta;
          }
        }

        const entry = getActivityEntry(e.date, effectiveWId);
        if (delta > 0) {
          entry.cashIn += delta;
        } else {
          entry.cashOut += Math.abs(delta);
        }
      }

      // If spendingMode === 'me', do not include items paid for friends in the transactions list
      if (spendingMode === 'me' && e.type === 'for_friend') {
        return;
      }

      const entry = getActivityEntry(e.date, effectiveWId);
      entry.txs.push({
        id: e.id,
        type: 'expense',
        description: baseDesc,
        category: e.category,
        amount: amt,
        flow: isIncoming ? 'in' : 'out',
        walletId: effectiveWId,
        walletName: wName,
        walletColor: wColor,
        rawExpense: e,
      });
    });

    // Process settlements
    settlements.forEach(s => {
      if (!s.walletId) return;
      const amt = Number(s.amount) || 0;
      if (amt === 0) return;

      const wObj = walletMap.get(s.walletId);
      const wName = wObj?.name || 'Wallet';
      const wColor = wObj?.color || 'var(--accent)';
      const isIncoming = amt > 0;
      const absAmt = Math.abs(amt);

      const friend = db.friends.find(f => f.id === s.friendId);
      const friendName = friend ? friend.name : 'Friend';
      const desc = `${isIncoming ? 'Received from' : 'Paid to'} ${friendName}${s.note ? ` (${s.note})` : ''}`;

      if (s.date < monthStartIso) {
        if (targetWalletIds.has(s.walletId)) {
          openingBeforeMonth += amt;
        }
      }

      const entry = getActivityEntry(s.date, s.walletId);
      if (isIncoming) {
        entry.cashIn += absAmt;
      } else {
        entry.cashOut += absAmt;
      }
      entry.txs.push({
        id: s.id,
        type: 'settlement',
        description: desc,
        category: 'Settlement',
        amount: absAmt,
        flow: isIncoming ? 'in' : 'out',
        walletId: s.walletId,
        walletName: wName,
        walletColor: wColor,
        rawSettlement: s,
      });
    });

    // Running balances
    const walletRunningBalances = new Map<string, number>();
    wallets.forEach(w => {
      let bal = Number(w.openingBalance) || 0;
      expenses.forEach(e => {
        const effWId = e.walletId || db.settings?.defaultWalletId || (wallets[0]?.id || 'wal_cash');
        if (effWId === w.id && e.date < monthStartIso) {
          bal += expenseWalletDelta(e, db);
        }
      });
      settlements.forEach(s => {
        if (s.walletId === w.id && s.date < monthStartIso) {
          bal += Number(s.amount) || 0;
        }
      });
      walletRunningBalances.set(w.id, bal);
    });

    const records: DayBalanceRecord[] = [];
    let totInflow = 0;
    let totOutflow = 0;
    let activeDays = 0;

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(yearNum, monthNum - 1, day);
      const dayName = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
      const fullDateLabel = dayDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const dayActivityMap = dateWalletActivity.get(dateStr);
      let dayCashIn = 0;
      let dayCashOut = 0;
      const dayTransactions: DayTransaction[] = [];

      const breakdown: Array<{
        walletId: string;
        walletName: string;
        walletColor: string;
        closingBalance: number;
        dayNetChange: number;
      }> = [];

      wallets.forEach(w => {
        const prevBal = walletRunningBalances.get(w.id) || 0;
        const wActivity = dayActivityMap?.get(w.id);
        const wIn = wActivity?.cashIn || 0;
        const wOut = wActivity?.cashOut || 0;
        const wNet = wIn - wOut;
        const newBal = prevBal + wNet;

        walletRunningBalances.set(w.id, newBal);

        if (targetWalletIds.has(w.id)) {
          dayCashIn += wIn;
          dayCashOut += wOut;
          if (wActivity?.txs) {
            dayTransactions.push(...wActivity.txs);
          }
        }

        breakdown.push({
          walletId: w.id,
          walletName: w.name,
          walletColor: w.color || 'var(--accent)',
          closingBalance: newBal,
          dayNetChange: wNet,
        });
      });

      const dayNetChange = dayCashIn - dayCashOut;
      totInflow += dayCashIn;
      totOutflow += dayCashOut;

      if (dayTransactions.length > 0) {
        activeDays++;
      }

      let currentTotalClosing = 0;
      targetWallets.forEach(w => {
        currentTotalClosing += walletRunningBalances.get(w.id) || 0;
      });

      const previousTotal = currentTotalClosing - dayNetChange;

      records.push({
        dateStr,
        dayNumber: day,
        dayName,
        fullDateLabel,
        isToday: dateStr === todayStr,
        isYesterday: dateStr === yesterdayStr,
        isFuture: dateStr > todayStr,
        closingBalance: currentTotalClosing,
        previousBalance: previousTotal,
        dayCashIn,
        dayCashOut,
        dayNetChange,
        transactions: dayTransactions,
        walletBreakdown: breakdown,
      });
    }

    const eligibleRecords = records.filter(r => !r.isFuture || r.transactions.length > 0);
    const monthClosingBalance = eligibleRecords.length > 0
      ? eligibleRecords[eligibleRecords.length - 1].closingBalance
      : (records.length > 0 ? records[records.length - 1].closingBalance : openingBeforeMonth);
    const monthNetChange = totInflow - totOutflow;

    return {
      dailyRecords: records,
      monthOpeningBalance: openingBeforeMonth,
      monthClosingBalance,
      monthTotalInflow: totInflow,
      monthTotalOutflow: totOutflow,
      monthNetChange,
      monthDaysCount: eligibleRecords.length,
      activeDaysCount: activeDays,
    };
  }, [selectedMonth, selectedWalletId, wallets, expenses, settlements, walletMap, todayStr, yesterdayStr, db]);

  // Max available month (current month or any future month containing transactions)
  const maxAvailableMonth = useMemo(() => {
    let maxM = todayStr.slice(0, 7);
    expenses.forEach(e => {
      if (e.date && e.date.slice(0, 7) > maxM) {
        maxM = e.date.slice(0, 7);
      }
    });
    settlements.forEach(s => {
      if (s.date && s.date.slice(0, 7) > maxM) {
        maxM = s.date.slice(0, 7);
      }
    });
    return maxM;
  }, [expenses, settlements, todayStr]);

  const displayedRecords = useMemo(() => {
    // Filter out future dates that have no transactions
    let list = dailyRecords.filter(r => !r.isFuture || r.transactions.length > 0);

    if (filterMode === 'activity_only') {
      list = list.filter(r => r.transactions.length > 0 || r.isToday);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        if (r.dateStr.includes(q) || r.dayName.toLowerCase().includes(q) || r.fullDateLabel.toLowerCase().includes(q)) {
          return true;
        }
        return r.transactions.some(
          t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.walletName.toLowerCase().includes(q)
        );
      });
    }

    if (sortOrder === 'desc') {
      list.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    } else {
      list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    return list;
  }, [dailyRecords, filterMode, searchQuery, sortOrder]);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevKey);
  };

  const handleNextMonth = () => {
    if (selectedMonth >= maxAvailableMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextKey);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(todayStr.slice(0, 7));
  };

  const formattedMonthTitle = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [selectedMonth]);

  const isCurrentMonth = selectedMonth === todayStr.slice(0, 7);

  const selectedDayRecord = useMemo(() => {
    if (!selectedDayDate) return null;
    return dailyRecords.find(r => r.dateStr === selectedDayDate) || null;
  }, [dailyRecords, selectedDayDate]);

  const selectedDayIndexInList = useMemo(() => {
    if (!selectedDayDate) return -1;
    return displayedRecords.findIndex(r => r.dateStr === selectedDayDate);
  }, [displayedRecords, selectedDayDate]);

  const handlePrevDayInDetail = () => {
    if (selectedDayIndexInList > 0) {
      setSelectedDayDate(displayedRecords[selectedDayIndexInList - 1].dateStr);
    }
  };

  const handleNextDayInDetail = () => {
    if (selectedDayIndexInList >= 0 && selectedDayIndexInList < displayedRecords.length - 1) {
      setSelectedDayDate(displayedRecords[selectedDayIndexInList + 1].dateStr);
    }
  };

  if (!isOpen) return null;

  // If a day is selected, directly render the single clean Day Details Modal without any background drawer underneath
  if (selectedDayRecord) {
    return createPortal(
      <div
        className="modal-backdrop"
        onClick={e => {
          if (e.target === e.currentTarget) {
            setSelectedDayDate(null);
            onClose();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-details-title"
        style={{ zIndex: 100050 }}
      >
        <div
          className="modal"
          style={{
            maxWidth: 500,
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--radius-xl, 16px)',
            overflow: 'hidden',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Day Details Header */}
          <div
            style={{
              padding: '14px 18px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--surface)',
              flexShrink: 0,
              borderBottom: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: selectedDayRecord.isToday ? 'var(--accent)' : 'var(--surface2)',
                  color: selectedDayRecord.isToday ? 'var(--accent-contrast, #fff)' : 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  border: selectedDayRecord.isToday ? 'none' : '1px solid var(--border)',
                }}
              >
                <Calendar size={18} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h3
                    id="day-details-title"
                    style={{
                      fontSize: 15.5,
                      fontWeight: 750,
                      color: 'var(--text)',
                      margin: 0,
                      lineHeight: 1.2,
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {selectedDayRecord.fullDateLabel}
                  </h3>
                  {selectedDayRecord.isToday && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--accent-soft)',
                        padding: '1px 6px',
                        borderRadius: 99,
                        lineHeight: 1.4,
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                  Daily balance details & movements
                </div>
              </div>
            </div>

            <button
              type="button"
              className="compact-close-btn"
              onClick={() => {
                setSelectedDayDate(null);
                onClose();
              }}
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Day Details Content */}
          <div
            className="filter-drawer-content"
            style={{
              padding: '12px 18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflowY: 'auto',
              flex: '1 1 auto',
            }}
          >
            {/* Day Metrics Bento Card (Clean, no split lines) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                background: 'var(--surface2)',
                borderRadius: 12,
                padding: '12px 14px',
                gap: 8,
                border: '1px solid var(--border)',
              }}
            >
              {/* Start of Day Opening */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 650,
                    color: 'var(--text-3)',
                    letterSpacing: '0.2px',
                    textTransform: 'uppercase',
                  }}
                >
                  Opening
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginTop: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtMoney(selectedDayRecord.previousBalance, currency)}
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2 }}>Start of Day</span>
              </div>

              {/* Day Net Movement */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 650,
                    color: 'var(--text-3)',
                    letterSpacing: '0.2px',
                    textTransform: 'uppercase',
                  }}
                >
                  Day Flow
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 750,
                    color:
                      selectedDayRecord.dayNetChange > 0
                        ? 'var(--credit)'
                        : selectedDayRecord.dayNetChange < 0
                        ? 'var(--debit)'
                        : 'var(--text-3)',
                    marginTop: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {selectedDayRecord.dayNetChange > 0
                    ? `+${fmtMoney(selectedDayRecord.dayNetChange, currency)}`
                    : selectedDayRecord.dayNetChange < 0
                    ? `-${fmtMoney(Math.abs(selectedDayRecord.dayNetChange), currency)}`
                    : fmtMoney(0, currency)}
                </span>
                {(selectedDayRecord.dayCashIn > 0 || selectedDayRecord.dayCashOut > 0) && (
                  <span
                    style={{
                      fontSize: 9.5,
                      marginTop: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ color: 'var(--credit)', fontWeight: 600 }}>+{fmtMoney(selectedDayRecord.dayCashIn, currency)}</span>
                    <span style={{ color: 'var(--text-3)', opacity: 0.5 }}>·</span>
                    <span style={{ color: 'var(--debit)', fontWeight: 600 }}>-{fmtMoney(selectedDayRecord.dayCashOut, currency)}</span>
                  </span>
                )}
              </div>

              {/* End of Day Closing */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 650,
                    color: 'var(--accent)',
                    letterSpacing: '0.2px',
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedDayRecord.isToday ? 'Current' : 'Closing'}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 750,
                    color: 'var(--text)',
                    marginTop: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtMoney(selectedDayRecord.closingBalance, currency)}
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {selectedDayRecord.isToday ? 'As of now' : 'End of Day'}
                </span>
              </div>
            </div>

            {/* Account Balances at End of Day */}
            {selectedWalletId === 'all' && wallets.length > 1 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    marginBottom: 7,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Accounts Breakdown</span>
                  <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'none', color: 'var(--text-3)' }}>
                    End of Day
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedDayRecord.walletBreakdown.map(wb => (
                    <div
                      key={wb.walletId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 9px',
                        borderRadius: 8,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        fontSize: 11.5,
                        color: 'var(--text-2)',
                      }}
                    >
                      <span
                        style={{
                          width: 6.5,
                          height: 6.5,
                          borderRadius: '50%',
                          backgroundColor: wb.walletColor,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 500 }}>{wb.walletName}</span>
                      <strong style={{ color: 'var(--text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(wb.closingBalance, currency)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions Section */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  marginBottom: 7,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Transactions</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'none', color: 'var(--text-3)' }}>
                  {selectedDayRecord.transactions.length} {selectedDayRecord.transactions.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {selectedDayRecord.transactions.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {selectedDayRecord.transactions.map(tx => {
                    const isCredit = tx.flow === 'in';
                    return (
                      <div
                        key={tx.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 12px',
                          borderRadius: 9,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: isCredit
                                ? 'var(--credit-soft, rgba(16, 185, 129, 0.12))'
                                : 'var(--debit-soft, rgba(239, 68, 68, 0.12))',
                              color: isCredit ? 'var(--credit)' : 'var(--debit)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isCredit ? <ArrowDownLeft size={13} strokeWidth={2.5} /> : <ArrowUpRight size={13} strokeWidth={2.5} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: 'var(--text)',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: 1.3,
                              }}
                            >
                              {tx.description}
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                color: 'var(--text-3)',
                                lineHeight: 1.2,
                                marginTop: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <span>{tx.category}</span>
                              <span>·</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5 }}>
                                <span
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    backgroundColor: tx.walletColor,
                                    display: 'inline-block',
                                  }}
                                />
                                <span>{tx.walletName}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 750,
                            color: isCredit ? 'var(--credit)' : 'var(--debit)',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {isCredit ? `+${fmtMoney(tx.amount, currency)}` : `-${fmtMoney(tx.amount, currency)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    borderRadius: 10,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text-2)' }}>No transactions on this date</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    The balance carried forward without any inflows or outflows.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Day Details Drawer Footer with Quick Step Navigation */}
          <div
            style={{
              padding: '10px 18px',
              borderTop: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--surface)',
              flexShrink: 0,
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={handlePrevDayInDetail}
              disabled={selectedDayIndexInList <= 0}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: selectedDayIndexInList <= 0 ? 'var(--text-3)' : 'var(--text-2)',
                opacity: selectedDayIndexInList <= 0 ? 0.35 : 1,
                cursor: selectedDayIndexInList <= 0 ? 'not-allowed' : 'pointer',
                fontSize: 11.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={14} />
              <span>Prev Day</span>
            </button>

            <button
              type="button"
              onClick={handleNextDayInDetail}
              disabled={selectedDayIndexInList < 0 || selectedDayIndexInList >= displayedRecords.length - 1}
              style={{
                height: 34,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color:
                  selectedDayIndexInList < 0 || selectedDayIndexInList >= displayedRecords.length - 1
                    ? 'var(--text-3)'
                    : 'var(--text-2)',
                opacity: selectedDayIndexInList < 0 || selectedDayIndexInList >= displayedRecords.length - 1 ? 0.35 : 1,
                cursor:
                  selectedDayIndexInList < 0 || selectedDayIndexInList >= displayedRecords.length - 1
                    ? 'not-allowed'
                    : 'pointer',
                fontSize: 11.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Next Day</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-wallet-balance-title"
    >
      <div
        className="modal category-dist-modal"
        style={{
          maxWidth: 620,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl, 16px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="category-dist-header"
          style={{
            padding: '12px 18px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
            flexShrink: 0,
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <WalletIcon size={17} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                id="daily-wallet-balance-title"
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text)',
                  letterSpacing: '-0.2px',
                  lineHeight: 1.2,
                }}
              >
                Daily Balance
              </h3>
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-3)',
                  margin: '2px 0 0',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Day-by-day cash balance history
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Compact Month Switcher */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--surface2)',
                borderRadius: 99,
                height: 28,
                padding: '2px 3px',
                border: '1px solid var(--border)',
                gap: 1,
              }}
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous Month"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 99,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'var(--surface3, rgba(255,255,255,0.06))';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-2)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <ChevronLeft size={14} />
              </button>

              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text)',
                  padding: '0 4px',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.1px',
                }}
              >
                {formattedMonthTitle}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                title={selectedMonth >= maxAvailableMonth ? 'Cannot navigate past current month' : 'Next Month'}
                disabled={selectedMonth >= maxAvailableMonth}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 99,
                  border: 'none',
                  background: 'transparent',
                  color: selectedMonth >= maxAvailableMonth ? 'var(--text-3)' : 'var(--text-2)',
                  opacity: selectedMonth >= maxAvailableMonth ? 0.3 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: selectedMonth >= maxAvailableMonth ? 'not-allowed' : 'pointer',
                  padding: 0,
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (selectedMonth < maxAvailableMonth) {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.background = 'var(--surface3, rgba(255,255,255,0.06))';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = selectedMonth >= maxAvailableMonth ? 'var(--text-3)' : 'var(--text-2)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {!isCurrentMonth && (
              <button
                type="button"
                onClick={handleCurrentMonth}
                title="Jump to current month"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 99,
                  border: 'none',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <RotateCcw size={13} />
              </button>
            )}

            <button
              type="button"
              className="compact-close-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          className="category-dist-body"
          style={{
            padding: '14px 18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            flex: '1 1 auto',
          }}
        >
          {/* Month Cashflow Overview Bento Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: 'var(--surface2)',
              borderRadius: 12,
              padding: '12px 14px',
              gap: 8,
              border: '1px solid var(--border)',
            }}
          >
            {/* Month Opening */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  letterSpacing: '0.1px',
                  textTransform: 'uppercase',
                }}
              >
                Opening
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(monthOpeningBalance, currency)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-3)',
                  marginTop: 2,
                  opacity: 0.85,
                }}
              >
                1st of {formattedMonthTitle.split(' ')[0]}
              </span>
            </div>

            {/* Net Cash Flow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  letterSpacing: '0.1px',
                  textTransform: 'uppercase',
                }}
              >
                Net Flow
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 750,
                  color: monthNetChange > 0 ? 'var(--credit)' : monthNetChange < 0 ? 'var(--debit)' : 'var(--text-3)',
                  marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {monthNetChange > 0
                  ? `+${fmtMoney(monthNetChange, currency)}`
                  : monthNetChange < 0
                  ? `-${fmtMoney(Math.abs(monthNetChange), currency)}`
                  : fmtMoney(0, currency)}
              </span>
              {(monthTotalInflow > 0 || monthTotalOutflow > 0) && (
                <span
                  style={{
                    fontSize: 9.5,
                    marginTop: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: 'var(--credit)', fontWeight: 600 }}>+{fmtMoney(monthTotalInflow, currency)}</span>
                  <span style={{ color: 'var(--text-3)', opacity: 0.5 }}>·</span>
                  <span style={{ color: 'var(--debit)', fontWeight: 600 }}>-{fmtMoney(monthTotalOutflow, currency)}</span>
                </span>
              )}
            </div>

            {/* Current / Closing Balance */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 650,
                  color: 'var(--accent)',
                  letterSpacing: '0.1px',
                  textTransform: 'uppercase',
                }}
              >
                {isCurrentMonth ? 'Balance' : 'Closing'}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 750,
                  color: 'var(--text)',
                  marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(monthClosingBalance, currency)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-3)',
                  marginTop: 2,
                  opacity: 0.85,
                }}
              >
                {isCurrentMonth ? 'End of Today' : 'End of Month'}
              </span>
            </div>
          </div>

          {/* Search and Filter Button Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--surface2)',
                borderRadius: 8,
                padding: '4px 10px',
                border: '1px solid var(--border)',
                flex: 1,
                minWidth: 0,
                height: 34,
              }}
            >
              <Search size={13} style={{ color: 'var(--text-3)', marginRight: 6, flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search by note, category, or account..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: 'var(--text)',
                  padding: '2px 0',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilterPanel(true)}
              aria-expanded={showFilterPanel}
              title="Filters & Sorting"
              style={{
                height: 34,
                padding: '0 11px',
                borderRadius: 8,
                border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--surface2)',
                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 12,
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <SlidersHorizontal size={14} style={{ color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)' }} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-contrast, #ffffff)',
                    fontSize: 10,
                    fontWeight: 750,
                    borderRadius: 99,
                    padding: '1px 5px',
                    lineHeight: 1.2,
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Active Filter Chips Summary (when filter drawer is closed) */}
          {!showFilterPanel && activeFilterCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {selectedWalletId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedWalletId('all')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 99,
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                  title="Remove account filter"
                >
                  <span>Account: {walletMap.get(selectedWalletId)?.name || 'Selected'}</span>
                  <X size={12} />
                </button>
              )}

              {filterMode === 'activity_only' && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all_days')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 99,
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                  title="Show all days"
                >
                  <span>Active days only</span>
                  <X size={12} />
                </button>
              )}

              {sortOrder === 'asc' && (
                <button
                  type="button"
                  onClick={() => setSortOrder('desc')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 99,
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                  title="Reset to newest first"
                >
                  <span>Oldest first (1 → 31)</span>
                  <X size={12} />
                </button>
              )}

              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  textDecoration: 'underline',
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Daily Records List or Month Empty State */}
          {activeDaysCount === 0 && !searchQuery.trim() ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '44px 20px',
                textAlign: 'center',
                background: 'var(--surface2)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                margin: '4px 0',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--surface3, rgba(255,255,255,0.05))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                  marginBottom: 2,
                }}
              >
                <Calendar size={22} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
                {selectedWalletId !== 'all' && walletMap.get(selectedWalletId)
                  ? `No Cash Movements for ${walletMap.get(selectedWalletId)?.name}`
                  : `No Cash Movements in ${formattedMonthTitle}`}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-3)',
                  maxWidth: 320,
                  lineHeight: 1.45,
                  margin: 0,
                }}
              >
                No expenses, income, or settlements occurred in this period. Balance remained at{' '}
                <strong style={{ color: 'var(--text)', fontWeight: 650 }}>{fmtMoney(monthOpeningBalance, currency)}</strong>.
              </p>
            </div>
          ) : displayedRecords.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--text-3)',
                fontSize: 13,
              }}
            >
              <Calendar size={28} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>No matching days found</div>
              <div style={{ fontSize: 11.5, marginTop: 2 }}>Try clearing the search query or changing filters</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {displayedRecords.map(dayRow => {
                const isSelected = selectedDayDate === dayRow.dateStr;

                return (
                  <button
                    key={dayRow.dateStr}
                    type="button"
                    onClick={() => setSelectedDayDate(dayRow.dateStr)}
                    style={{
                      background: dayRow.isToday
                        ? 'var(--accent-surface-gradient, var(--surface2))'
                        : isSelected
                        ? 'var(--surface3, var(--surface2))'
                        : 'var(--surface2)',
                      borderRadius: 10,
                      border: dayRow.isToday
                        ? '1px solid var(--accent-border-soft, var(--accent))'
                        : isSelected
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: 10,
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                  >
                    {/* Left: Date & Subtitle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      {/* Day badge */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: dayRow.isToday ? 'var(--accent)' : 'var(--surface)',
                          color: dayRow.isToday ? 'var(--accent-contrast, #fff)' : 'var(--text)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: dayRow.isToday ? 'none' : '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: 750, lineHeight: 1 }}>
                          {dayRow.dayNumber}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            opacity: dayRow.isToday ? 0.9 : 0.65,
                            marginTop: 1.5,
                            letterSpacing: '0.2px',
                          }}
                        >
                          {dayRow.dayName}
                        </span>
                      </div>

                      {/* Title & Activity Note */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 650,
                              color: dayRow.isToday ? 'var(--accent)' : 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {dayRow.fullDateLabel}
                          </span>
                          {dayRow.isToday && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: 'var(--accent)',
                                background: 'var(--accent-soft)',
                                padding: '1px 6px',
                                borderRadius: 99,
                                flexShrink: 0,
                                lineHeight: 1.4,
                              }}
                            >
                              Today
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {dayRow.dayNetChange !== 0 ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                lineHeight: 1.3,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 650,
                                  color: dayRow.dayNetChange > 0 ? 'var(--credit)' : 'var(--debit)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {dayRow.dayNetChange > 0 ? (
                                  <>
                                    <TrendingUp size={11} strokeWidth={2.5} /> +{fmtMoney(dayRow.dayNetChange, currency)}
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown size={11} strokeWidth={2.5} /> -{fmtMoney(Math.abs(dayRow.dayNetChange), currency)}
                                  </>
                                )}
                              </span>
                              <span style={{ color: 'var(--text-3)', fontSize: 10.5 }}>
                                · {dayRow.transactions.length} {dayRow.transactions.length === 1 ? 'transaction' : 'transactions'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              No transactions
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Closing Balance & Arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--text)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtMoney(dayRow.closingBalance, currency)}
                        </div>
                      </div>

                      <span
                        style={{
                          color: 'var(--text-3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 18,
                          height: 18,
                          opacity: 0.6,
                        }}
                      >
                        <ChevronRight size={15} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filter Bottom Sheet Drawer */}
      {showFilterPanel && (
        <div
          className="filter-drawer-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) setShowFilterPanel(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-balance-filter-title"
        >
          <div className="filter-drawer-panel" style={{ maxWidth: 480 }}>
            {/* Drawer Header */}
            <div
              style={{
                padding: '14px 18px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--surface)',
                borderBottom: 'none',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    backgroundColor: 'var(--accent-soft)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <SlidersHorizontal size={17} strokeWidth={2.2} />
                </div>
                <div>
                  <div
                    id="daily-balance-filter-title"
                    style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}
                  >
                    Filters & Sort
                  </div>
                  <div style={{ fontSize: '11.5px', color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-3)', fontWeight: 500 }}>
                    {activeFilterCount > 0
                      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
                      : 'Choose accounts, days to show, and order'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 6,
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="button"
                  className="compact-close-btn"
                  onClick={() => setShowFilterPanel(false)}
                  title="Close"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div
              className="filter-drawer-content"
              style={{
                padding: '16px 18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* 1. Accounts Section */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Accounts
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedWalletId('all')}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: selectedWalletId === 'all' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: selectedWalletId === 'all' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: selectedWalletId === 'all' ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: selectedWalletId === 'all' ? 700 : 550,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {selectedWalletId === 'all' && <Check size={13} strokeWidth={2.5} />}
                      <span>All Accounts</span>
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        opacity: 0.8,
                        padding: '1px 5px',
                        borderRadius: 99,
                        background: selectedWalletId === 'all' ? 'var(--accent)' : 'var(--surface3)',
                        color: selectedWalletId === 'all' ? 'var(--accent-contrast, #fff)' : 'var(--text-3)',
                      }}
                    >
                      {wallets.length}
                    </span>
                  </button>

                  {wallets.map(w => {
                    const isSelected = selectedWalletId === w.id;
                    const wColor = w.color || 'var(--accent)';
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWalletId(w.id)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: isSelected ? `1.5px solid ${wColor}` : '1px solid var(--border)',
                          background: isSelected ? 'var(--surface3, var(--surface2))' : 'var(--surface2)',
                          color: isSelected ? 'var(--text)' : 'var(--text-2)',
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: wColor,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {w.name}
                          </span>
                        </span>
                        {isSelected && <Check size={13} strokeWidth={2.5} style={{ color: wColor, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Days to Show Filter */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Days to Show
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all_days')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: filterMode === 'all_days' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: filterMode === 'all_days' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: filterMode === 'all_days' ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: filterMode === 'all_days' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>All Days</span>
                    <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{monthDaysCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('activity_only')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: filterMode === 'activity_only' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: filterMode === 'activity_only' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: filterMode === 'activity_only' ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: filterMode === 'activity_only' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Active Days Only</span>
                    <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{activeDaysCount}</span>
                  </button>
                </div>
              </div>

              {/* 3. Sort By */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Sort By
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSortOrder('desc')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: sortOrder === 'desc' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: sortOrder === 'desc' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: sortOrder === 'desc' ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: sortOrder === 'desc' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Newest First</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>31 → 1</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortOrder('asc')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: sortOrder === 'asc' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: sortOrder === 'asc' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: sortOrder === 'asc' ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: sortOrder === 'asc' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Oldest First</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>1 → 31</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 9,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowFilterPanel(false)}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 9,
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
