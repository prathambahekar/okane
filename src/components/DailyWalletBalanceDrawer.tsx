import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Wallet as WalletIcon,
  Activity,
  Flag,
  Layers,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { useStore } from '../store';
import { fmtMoney, cleanExpenseDescription, resolveCategoryMeta, groupExpenses, type GroupedExpense } from '../utils';
import { expenseFlow, expenseWalletDelta } from '../db';
import type { Expense, Settlement, Wallet, Category } from '../types';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';
import CategoryIcon from './CategoryIcon';
import { renderWalletIcon } from './WalletIconRenderer';
import WalletDetailDrawer from './WalletDetailDrawer';
import { ExpenseDetailDrawer } from './ExpenseDetailDrawer';
import SettlementDetailModal from './SettlementDetailModal';
import ExpenseModal from './ExpenseModal';

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
  const { db, deleteExpense, deleteSettlement, showToast } = useStore();
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

  // Inspected wallet state for opening Wallet Detail Drawer from wallet page
  const [inspectWallet, setInspectWallet] = useState<Wallet | null>(null);

  // Selected transaction detail states
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);

  // Search query within the drawer
  const [searchQuery, setSearchQuery] = useState<string>('');

  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });
  useBackButtonModal(Boolean(selectedDayDate), () => setSelectedDayDate(null), { priority: BackPriority.DIALOG });
  useBackButtonModal(showFilterPanel, () => setShowFilterPanel(false), { priority: BackPriority.DIALOG });
  useBackButtonModal(Boolean(inspectWallet), () => setInspectWallet(null), { priority: BackPriority.SUBVIEW });
  useBackButtonModal(Boolean(selectedDetailGe), () => setSelectedDetailGe(null), { priority: BackPriority.SUBVIEW });
  useBackButtonModal(Boolean(selectedSettlement), () => setSelectedSettlement(null), { priority: BackPriority.SUBVIEW });
  useBackButtonModal(Boolean(editExp), () => setEditExp(null), { priority: BackPriority.SUBVIEW });

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

  // Map for category lookups
  const categoriesMap = useMemo(() => {
    const map = new Map<string, Category>();
    (settings?.categories || []).forEach(c => map.set(c.name.toLowerCase(), c));
    return map;
  }, [settings?.categories]);

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

  const formattedDateTitle = useMemo(() => {
    if (!selectedDayRecord) return '';
    const [y, m, d] = selectedDayRecord.dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNum = dateObj.getDate();
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const yearNum = dateObj.getFullYear();
    return `${dayNum} ${monthName} ${yearNum}`;
  }, [selectedDayRecord]);

  const handlePrevDayInDetail = () => {
    if (!selectedDayRecord) return;
    const [y, m, d] = selectedDayRecord.dateStr.split('-').map(Number);
    const prevDate = new Date(y, m - 1, d - 1);
    const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
    setSelectedDayDate(prevStr);
    if (prevStr.slice(0, 7) !== selectedMonth) {
      setSelectedMonth(prevStr.slice(0, 7));
    }
  };

  const handleNextDayInDetail = () => {
    if (!selectedDayRecord) return;
    const [y, m, d] = selectedDayRecord.dateStr.split('-').map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    if (nextStr <= todayStr) {
      setSelectedDayDate(nextStr);
      if (nextStr.slice(0, 7) !== selectedMonth) {
        setSelectedMonth(nextStr.slice(0, 7));
      }
    }
  };

  if (!isOpen) return null;

  // If a day is selected, render the clean Day Details sheet matching the reference design with app color consistency
  if (selectedDayRecord) {
    return (
      <>
        {createPortal(
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
        <div className="day-sheet-modal-container">
          {/* Drag Handle */}
          <div className="day-sheet-drag-pill" />

          {/* Header */}
          <div className="day-sheet-top-header">
            <div className="day-sheet-header-left">
              <div className="day-sheet-cal-icon-box">
                <Calendar size={18} strokeWidth={2.2} />
              </div>
              <div className="day-sheet-title-group">
                <div className="day-sheet-title-row">
                  <h3 id="day-details-title" className="day-sheet-title-text">
                    {formattedDateTitle}
                  </h3>
                  {selectedDayRecord.isToday && (
                    <span className="day-sheet-today-badge">Today</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="day-sheet-close-btn"
              onClick={() => {
                setSelectedDayDate(null);
                onClose();
              }}
              title="Close"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="day-sheet-scrollable-body">
            {/* 1. Hero 3-column Metrics Card */}
            <div className="day-sheet-hero-card">
              {/* Opening */}
              <div className="day-sheet-hero-col col-left">
                <div className="day-sheet-hero-label-row">
                  <WalletIcon size={13} strokeWidth={2} />
                  <span>Opening</span>
                </div>
                <span
                  className={`day-sheet-hero-amount ${
                    selectedDayRecord.previousBalance < 0 ? 'amount-negative' : ''
                  }`}
                >
                  {fmtMoney(selectedDayRecord.previousBalance, currency)}
                </span>
              </div>

              {/* Day Flow */}
              <div className="day-sheet-hero-col col-mid">
                <div className="day-sheet-hero-label-row">
                  <Activity size={13} strokeWidth={2} />
                  <span>Day Flow</span>
                </div>
                <span
                  className={`day-sheet-hero-amount ${
                    selectedDayRecord.dayNetChange < 0
                      ? 'amount-negative'
                      : selectedDayRecord.dayNetChange > 0
                      ? 'amount-positive'
                      : 'amount-zero'
                  }`}
                >
                  {selectedDayRecord.dayNetChange > 0
                    ? `+${fmtMoney(selectedDayRecord.dayNetChange, currency)}`
                    : selectedDayRecord.dayNetChange < 0
                    ? `-${fmtMoney(Math.abs(selectedDayRecord.dayNetChange), currency)}`
                    : fmtMoney(0, currency)}
                </span>
              </div>

              {/* Closing */}
              <div className="day-sheet-hero-col col-right">
                <div className="day-sheet-hero-label-row">
                  <Flag size={13} strokeWidth={2} />
                  <span>{selectedDayRecord.isToday ? 'Current' : 'Closing'}</span>
                </div>
                <span
                  className={`day-sheet-hero-amount ${
                    selectedDayRecord.closingBalance < 0 ? 'amount-negative' : ''
                  }`}
                >
                  {fmtMoney(selectedDayRecord.closingBalance, currency)}
                </span>
              </div>
            </div>

            {/* 2. Accounts Breakdown Card */}
            {(() => {
              const visibleWalletBreakdown = (selectedDayRecord.walletBreakdown || []).filter(wb => {
                const w = wallets.find(wallet => wallet.id === wb.walletId);
                return !w?.isHidden;
              });

              if (visibleWalletBreakdown.length === 0) return null;

              return (
                <div className="day-sheet-section-card">
                  <div className="day-sheet-sec-header">
                    <div className="day-sheet-sec-title-wrap">
                      <span className="day-sheet-sec-icon-pill">
                        <Layers size={15} strokeWidth={2} />
                      </span>
                      <span>Accounts Breakdown</span>
                    </div>
                    <span className="day-sheet-sec-badge">End of Day</span>
                  </div>

                  <div className={`day-sheet-accounts-grid ${visibleWalletBreakdown.length === 1 ? 'is-single' : ''}`}>
                    {visibleWalletBreakdown.map(wb => {
                      const walletObj = wallets.find(w => w.id === wb.walletId);
                      const color = wb.walletColor || walletObj?.color || 'var(--accent)';
                      const iconKey = walletObj?.icon;
                      const isSingle = visibleWalletBreakdown.length === 1;

                      if (isSingle) {
                        return (
                          <div
                            key={wb.walletId}
                            className="day-account-item-card is-single-account"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (walletObj) {
                                setInspectWallet(walletObj);
                              }
                            }}
                            onKeyDown={e => {
                              if ((e.key === 'Enter' || e.key === ' ') && walletObj) {
                                e.preventDefault();
                                setInspectWallet(walletObj);
                              }
                            }}
                            title={`Open ${walletObj?.name || wb.walletName} transactions`}
                            aria-label={`Open ${walletObj?.name || wb.walletName} transactions`}
                          >
                            <div className="day-account-single-left">
                              <div
                                className="day-account-icon-wrap"
                                style={{
                                  background: `${color}18`,
                                  color: color,
                                }}
                              >
                                {iconKey ? (
                                  renderWalletIcon(iconKey, 16, color)
                                ) : (
                                  <WalletIcon size={16} color={color} strokeWidth={2} />
                                )}
                              </div>
                              <span className="day-account-name" title={walletObj?.name || wb.walletName}>
                                {walletObj?.name || wb.walletName}
                              </span>
                            </div>
                            <div className="day-account-single-right">
                              <span
                                className={`day-account-bal ${
                                  wb.closingBalance < 0 ? 'amount-negative' : ''
                                }`}
                              >
                                {fmtMoney(wb.closingBalance, currency)}
                              </span>
                              <ChevronRight size={14} className="day-account-chevron" />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={wb.walletId}
                          className="day-account-item-card"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (walletObj) {
                              setInspectWallet(walletObj);
                            }
                          }}
                          onKeyDown={e => {
                            if ((e.key === 'Enter' || e.key === ' ') && walletObj) {
                              e.preventDefault();
                              setInspectWallet(walletObj);
                            }
                          }}
                          title={`Open ${walletObj?.name || wb.walletName} transactions`}
                          aria-label={`Open ${walletObj?.name || wb.walletName} transactions`}
                        >
                          <div
                            className="day-account-icon-wrap"
                            style={{
                              background: `${color}18`,
                              color: color,
                            }}
                          >
                            {iconKey ? (
                              renderWalletIcon(iconKey, 16, color)
                            ) : (
                              <WalletIcon size={16} color={color} strokeWidth={2} />
                            )}
                          </div>
                          <div className="day-account-meta">
                            <span className="day-account-name" title={walletObj?.name || wb.walletName}>
                              {walletObj?.name || wb.walletName}
                            </span>
                            <span
                              className={`day-account-bal ${
                                wb.closingBalance < 0 ? 'amount-negative' : ''
                              }`}
                            >
                              {fmtMoney(wb.closingBalance, currency)}
                            </span>
                          </div>
                          <ChevronRight size={13} className="day-account-chevron" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 3. Transactions Card */}
            <div className="day-sheet-section-card">
              <div className="day-sheet-sec-header">
                <div className="day-sheet-sec-title-wrap">
                  <span className="day-sheet-sec-icon-pill">
                    <Receipt size={15} strokeWidth={2} />
                  </span>
                  <span>Transactions</span>
                </div>
                <span className="day-sheet-sec-badge">
                  {selectedDayRecord.transactions.length}{' '}
                  {selectedDayRecord.transactions.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {selectedDayRecord.transactions.length > 0 ? (
                <div className="day-sheet-tx-list">
                  {selectedDayRecord.transactions.map(tx => {
                    const isCredit = tx.flow === 'in';
                    const cleanDesc = cleanExpenseDescription(tx.description);
                    const walletObj = wallets.find(w => w.id === tx.walletId) ||
                      wallets.find(w => w.name.toLowerCase() === tx.walletName.toLowerCase());
                    const catObj = categoriesMap.get((tx.category || '').toLowerCase());
                    const catMeta = resolveCategoryMeta(tx.category, catObj, tx.type === 'settlement', categoriesMap);

                    const handleTxClick = () => {
                      if (tx.rawExpense) {
                        const rawExpense = tx.rawExpense;
                        const rel = rawExpense.groupId
                          ? db.expenses.filter(x => x.groupId === rawExpense.groupId)
                          : [rawExpense];
                        const ge = groupExpenses(
                          rel.length > 0 ? rel : [rawExpense],
                          db.wallets,
                          db.friends
                        )[0];
                        if (ge) {
                          setSelectedDetailGe(ge);
                          return;
                        }
                      } else if (tx.rawSettlement) {
                        setSelectedSettlement(tx.rawSettlement);
                        return;
                      }

                      // Fallback lookup
                      const exp = db.expenses.find(x => x.id === tx.id);
                      if (exp) {
                        const rel = exp.groupId
                          ? db.expenses.filter(x => x.groupId === exp.groupId)
                          : [exp];
                        const ge = groupExpenses(
                          rel.length > 0 ? rel : [exp],
                          db.wallets,
                          db.friends
                        )[0];
                        if (ge) {
                          setSelectedDetailGe(ge);
                          return;
                        }
                      }
                      const stl = (db.settlements || []).find(x => x.id === tx.id);
                      if (stl) {
                        setSelectedSettlement(stl);
                      }
                    };

                    return (
                      <div
                        key={tx.id}
                        className="day-tx-item-card"
                        role="button"
                        tabIndex={0}
                        onClick={handleTxClick}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleTxClick();
                          }
                        }}
                        title={`View ${cleanDesc || tx.description} details`}
                        aria-label={`View ${cleanDesc || tx.description} details`}
                      >
                        <div className="day-tx-item-left">
                          <div
                            className="day-tx-icon-wrap"
                            style={{
                              background: catMeta.bg,
                              border: `1px solid ${catMeta.border}`,
                              color: catMeta.color,
                            }}
                          >
                            <CategoryIcon
                              category={catMeta.name}
                              icon={catMeta.icon}
                              size={17}
                              style={{ color: catMeta.color }}
                            />
                          </div>
                          <div className="day-tx-meta">
                            <span className="day-tx-title">{cleanDesc || tx.description}</span>
                            <div className="day-tx-subtitle">
                              <span className="day-tx-cat-tag">{tx.category}</span>
                              <span className="day-tx-bullet">•</span>
                              <span className="day-tx-wallet-tag">
                                <span className="day-tx-wallet-icon-box">
                                  {renderWalletIcon(walletObj?.icon || tx.walletName, 13, tx.walletColor)}
                                </span>
                                <span className="day-tx-wallet-name">{tx.walletName}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="day-tx-right">
                          <span
                            className={`day-tx-amount ${isCredit ? 'tx-credit' : 'tx-debit'}`}
                          >
                            {isCredit
                              ? `+${fmtMoney(tx.amount, currency)}`
                              : `-${fmtMoney(tx.amount, currency)}`}
                          </span>
                          <ChevronRight size={15} className="day-tx-chevron" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="day-sheet-empty-tx">
                  <span className="day-sheet-empty-tx-title">No transactions on this date</span>
                  <span className="day-sheet-empty-tx-sub">
                    The balance carried forward without any inflows or outflows.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="day-sheet-footer">
            <button
              type="button"
              className="day-sheet-nav-pill-btn"
              onClick={handlePrevDayInDetail}
            >
              <ArrowLeft size={15} strokeWidth={2.2} />
              <span>Prev Day</span>
            </button>

            <button
              type="button"
              className="day-sheet-nav-pill-btn"
              onClick={handleNextDayInDetail}
              disabled={selectedDayRecord.dateStr >= todayStr}
            >
              <span>Next Day</span>
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {inspectWallet && (
      <WalletDetailDrawer
        wallet={inspectWallet}
        zIndex={100070}
        onClose={() => setInspectWallet(null)}
      />
    )}
    {selectedDetailGe && (
      <ExpenseDetailDrawer
        ge={selectedDetailGe}
        currency={currency}
        zIndex={100070}
        onClose={() => setSelectedDetailGe(null)}
        onEdit={exp => {
          setSelectedDetailGe(null);
          setEditExp(exp);
        }}
        onDelete={id => {
          setSelectedDetailGe(null);
          deleteExpense(id);
          showToast('Expense deleted.');
        }}
      />
    )}
    {selectedSettlement && (
      <SettlementDetailModal
        settlement={selectedSettlement}
        zIndex={100070}
        onClose={() => setSelectedSettlement(null)}
        onUndo={stlId => {
          setSelectedSettlement(null);
          deleteSettlement(stlId);
          showToast('Settlement undone. Balance restored.');
        }}
      />
    )}
    {editExp && (
      <ExpenseModal
        expense={editExp}
        zIndex={100080}
        onClose={() => setEditExp(null)}
      />
    )}
    </>
  );
}

  return (
    <>
      {createPortal(
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
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <WalletIcon size={19} strokeWidth={2.2} />
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
              className="btn-icon"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
              title="Close"
              aria-label="Close"
            >
              <X size={18} />
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
                border: activeFilterCount > 0 ? '1px solid var(--border2)' : '1px solid var(--border)',
                background: activeFilterCount > 0 ? 'var(--surface)' : 'var(--surface2)',
                color: activeFilterCount > 0 ? 'var(--text)' : 'var(--text-2)',
                fontSize: 12,
                fontWeight: activeFilterCount > 0 ? 650 : 500,
                boxShadow: activeFilterCount > 0 ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {selectedWalletId !== 'all' && (
                <span className="app-filter-chip">
                  <span className="app-filter-chip-label">Account:</span>
                  <span className="app-filter-chip-value">{walletMap.get(selectedWalletId)?.name || 'Selected'}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedWalletId('all')}
                    className="app-filter-chip-remove"
                    title="Remove account filter"
                    aria-label="Remove account filter"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              )}

              {filterMode === 'activity_only' && (
                <span className="app-filter-chip">
                  <span className="app-filter-chip-value">Active days only</span>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all_days')}
                    className="app-filter-chip-remove"
                    title="Show all days"
                    aria-label="Show all days"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              )}

              {sortOrder === 'asc' && (
                <span className="app-filter-chip">
                  <span className="app-filter-chip-value">Oldest first (1 → 31)</span>
                  <button
                    type="button"
                    onClick={() => setSortOrder('desc')}
                    className="app-filter-chip-remove"
                    title="Reset to newest first"
                    aria-label="Reset to newest first"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={resetFilters}
                className="app-filter-clear-btn"
                title="Clear all filters"
              >
                <RotateCcw size={13} strokeWidth={2.2} />
                <span>Clear all</span>
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
                        ? '1px solid var(--border2)'
                        : isSelected
                        ? '1px solid var(--border2)'
                        : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
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
            {/* Drawer Drag Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 4px', flexShrink: 0 }} />

            {/* Drawer Header */}
            <div
              style={{
                padding: '12px 18px 8px',
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
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'transparent',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text)',
                  }}
                >
                  <SlidersHorizontal size={19} strokeWidth={2.2} />
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
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowFilterPanel(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  title="Close"
                  aria-label="Close"
                >
                  <X size={18} />
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
                      border: selectedWalletId === 'all' ? '1px solid var(--border2)' : '1px solid var(--border)',
                      background: selectedWalletId === 'all' ? 'var(--surface)' : 'var(--surface2)',
                      color: selectedWalletId === 'all' ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: selectedWalletId === 'all' ? 650 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: selectedWalletId === 'all' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
                        fontWeight: 650,
                        opacity: 0.8,
                        padding: '1px 5px',
                        borderRadius: 99,
                        background: selectedWalletId === 'all' ? 'var(--surface2)' : 'var(--surface3)',
                        color: selectedWalletId === 'all' ? 'var(--text)' : 'var(--text-3)',
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
                      border: filterMode === 'all_days' ? '1px solid var(--border2)' : '1px solid var(--border)',
                      background: filterMode === 'all_days' ? 'var(--surface)' : 'var(--surface2)',
                      color: filterMode === 'all_days' ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: filterMode === 'all_days' ? 650 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: filterMode === 'all_days' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
                      border: filterMode === 'activity_only' ? '1px solid var(--border2)' : '1px solid var(--border)',
                      background: filterMode === 'activity_only' ? 'var(--surface)' : 'var(--surface2)',
                      color: filterMode === 'activity_only' ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: filterMode === 'activity_only' ? 650 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: filterMode === 'activity_only' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
                      border: sortOrder === 'desc' ? '1px solid var(--border2)' : '1px solid var(--border)',
                      background: sortOrder === 'desc' ? 'var(--surface)' : 'var(--surface2)',
                      color: sortOrder === 'desc' ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: sortOrder === 'desc' ? 650 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: sortOrder === 'desc' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
                      border: sortOrder === 'asc' ? '1px solid var(--border2)' : '1px solid var(--border)',
                      background: sortOrder === 'asc' ? 'var(--surface)' : 'var(--surface2)',
                      color: sortOrder === 'asc' ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: sortOrder === 'asc' ? 650 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: sortOrder === 'asc' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
                padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
                borderTop: 'none',
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
                  className="btn"
                  style={{
                    height: 40,
                    borderRadius: 9999,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    gap: 6,
                  }}
                >
                  <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                  <span>Reset</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowFilterPanel(false)}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 9999,
                  background: 'var(--text)',
                  border: '1px solid var(--text)',
                  color: 'var(--bg)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}
              >
                <Check size={15} style={{ color: 'inherit' }} />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>,
        document.body
      )}
      {inspectWallet && (
        <WalletDetailDrawer
          wallet={inspectWallet}
          zIndex={100070}
          onClose={() => setInspectWallet(null)}
        />
      )}
      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          zIndex={100070}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={exp => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={id => {
            setSelectedDetailGe(null);
            deleteExpense(id);
            showToast('Expense deleted.');
          }}
        />
      )}
      {selectedSettlement && (
        <SettlementDetailModal
          settlement={selectedSettlement}
          zIndex={100070}
          onClose={() => setSelectedSettlement(null)}
          onUndo={stlId => {
            setSelectedSettlement(null);
            deleteSettlement(stlId);
            showToast('Settlement undone. Balance restored.');
          }}
        />
      )}
      {editExp && (
        <ExpenseModal
          expense={editExp}
          zIndex={100080}
          onClose={() => setEditExp(null)}
        />
      )}
    </>
  );
}
