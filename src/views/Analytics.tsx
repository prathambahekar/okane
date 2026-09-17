import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { groupExpenses, getGroupedExpenseAmount, type GroupedExpense } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseDetailDrawer from '../components/ExpenseDetailDrawer';
import DailyWalletBalanceDrawer from '../components/DailyWalletBalanceDrawer';
import CategoryDetailDrawer from '../components/analytics/CategoryDetailDrawer';
import PacingComparisonDrawer from '../components/analytics/PacingComparisonDrawer';
import AnalyticsHeader from '../components/analytics/AnalyticsHeader';
import TotalSpendingCard, { type ChartDayData } from '../components/analytics/TotalSpendingCard';
import CategoryDistributionCard from '../components/analytics/CategoryDistributionCard';
import DailyExpenditureCard, { type DayExpenditureRow } from '../components/analytics/DailyExpenditureCard';
import CategoryIcon from '../components/CategoryIcon';
import { renderWalletIcon } from '../components/WalletIconRenderer';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';
import type { Expense, ViewName } from '../types';
import { DesktopSearchBar } from '../components/DesktopSearchBar';
import {
  X,
  Filter,
  Check,
  RotateCcw,
} from 'lucide-react';

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

interface AnalyticsProps {
  onNavigate?: (v: ViewName) => void;
}

export default function Analytics({ onNavigate }: AnalyticsProps = {}) {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, settings: { currency } } = db;
  const spendingMode = db.settings?.spendingMode || 'all';

  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleSetPeriod = (p: 'week' | 'month') => {
    setSlideDirection(null);
    setSelectedDate(null);
    setPeriod(p);
  };
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const selectedCategory = useMemo(() => {
    return selectedCategories.length === 1 ? selectedCategories[0] : null;
  }, [selectedCategories]);

  const setSelectedCategory = useCallback((catName: string | null) => {
    if (!catName) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([catName]);
    }
  }, []);

  const allCategoryNames = useMemo(() => {
    return (db.settings?.categories || [])
      .map((c) => c.name)
      .filter((n) => n.toLowerCase() !== 'refund' && n.toLowerCase() !== 'transfer');
  }, [db.settings?.categories]);

  const isAllCategoriesSelected = useMemo(() => {
    return (
      selectedCategories.length === 0 ||
      selectedCategories.length === allCategoryNames.length ||
      (selectedCategories.length === 1 && selectedCategories[0] === '__ALL__')
    );
  }, [selectedCategories, allCategoryNames]);

  const effectiveSelectedCount = useMemo(() => {
    if (isAllCategoriesSelected) return allCategoryNames.length;
    if (selectedCategories.length === 1 && selectedCategories[0] === '__NONE__') return 0;
    return selectedCategories.length;
  }, [isAllCategoriesSelected, selectedCategories, allCategoryNames]);

  const handleToggleCategoryInDrawer = useCallback((catName: string) => {
    const currentSelected = isAllCategoriesSelected
      ? allCategoryNames
      : selectedCategories.filter((c) => c !== '__NONE__' && c !== '__ALL__');
    const isCurrentlySelected = currentSelected.includes(catName);

    if (isCurrentlySelected) {
      // Deselect
      const next = currentSelected.filter((c) => c !== catName);
      if (next.length === 0) {
        setSelectedCategories(['__NONE__']);
      } else {
        setSelectedCategories(next);
      }
    } else {
      // Select
      const next = [...currentSelected, catName];
      if (next.length >= allCategoryNames.length) {
        setSelectedCategories([]);
      } else {
        setSelectedCategories(next);
      }
    }
  }, [isAllCategoriesSelected, allCategoryNames, selectedCategories]);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatISO(now), [now]);
  const currentWeekMonStr = useMemo(() => formatISO(getMonday(now)), [now]);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const currentWeekSunStr = useMemo(() => {
    const [wy, wm, wd] = currentWeekMonStr.split('-').map(Number);
    const sunDate = new Date(wy, wm - 1, wd + 6);
    return formatISO(sunDate);
  }, [currentWeekMonStr]);

  const prevWeekMonStr = useMemo(() => {
    const [y, m, d] = currentWeekMonStr.split('-').map(Number);
    const prevMon = new Date(y, m - 1, d - 7);
    return formatISO(prevMon);
  }, [currentWeekMonStr]);

  // Check if current week has any logged outflow spending
  const hasCurrentWeekSpending = useMemo(() => {
    return expenses.some(exp => {
      if (exp.flow !== 'out') return false;
      const expDate = (exp.date || '').slice(0, 10);
      return expDate >= currentWeekMonStr && expDate <= currentWeekSunStr;
    });
  }, [expenses, currentWeekMonStr, currentWeekSunStr]);

  // When no spending for current week is found, default to previous week so the analytics page isn't empty
  const [activeWeekMonStr, setActiveWeekMonStr] = useState<string>(() => {
    const hasSpending = expenses.some(exp => {
      if (exp.flow !== 'out') return false;
      const expDate = (exp.date || '').slice(0, 10);
      return expDate >= currentWeekMonStr && expDate <= currentWeekSunStr;
    });
    return hasSpending ? currentWeekMonStr : prevWeekMonStr;
  });
  const [activeMonthStr, setActiveMonthStr] = useState<string>(currentMonthStr);

  // Ref to ensure auto-switch only happens once automatically, allowing user to navigate freely
  const hasAutoSwitchedRef = useRef<boolean>(!hasCurrentWeekSpending);

  useEffect(() => {
    if (!hasAutoSwitchedRef.current && expenses.length > 0 && !hasCurrentWeekSpending && activeWeekMonStr === currentWeekMonStr) {
      setActiveWeekMonStr(prevWeekMonStr);
      hasAutoSwitchedRef.current = true;
    }
  }, [expenses.length, hasCurrentWeekSpending, activeWeekMonStr, currentWeekMonStr, prevWeekMonStr]);

  const [selectedGroupExpense, setSelectedGroupExpense] = useState<GroupedExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDailyBalanceDrawer, setShowDailyBalanceDrawer] = useState(false);
  const [inspectCategoryName, setInspectCategoryName] = useState<string | null>(null);
  const [showPacingDrawer, setShowPacingDrawer] = useState(false);

  useBackButtonModal(showFilterDrawer, () => setShowFilterDrawer(false), { priority: BackPriority.DIALOG });

  useEffect(() => {
    if (!showFilterDrawer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFilterDrawer(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilterDrawer]);

  // Grouped expenses base
  const groupedExpenses = useMemo(() => groupExpenses(expenses, wallets), [expenses, wallets]);

  // Slide direction tracking for smooth horizontal transition animations
  const [slideDirection, setSlideDirection] = useState<'prev' | 'next' | null>(null);

  // Handle Date Navigation (Prev / Next)
  const handlePrevDate = () => {
    hasAutoSwitchedRef.current = true;
    setSlideDirection('prev');
    if (period === 'week') {
      const [y, m, d] = activeWeekMonStr.split('-').map(Number);
      const prevMon = new Date(y, m - 1, d - 7);
      setActiveWeekMonStr(formatISO(prevMon));
      setSelectedDate(null);
    } else {
      const [y, m] = activeMonthStr.split('-').map(Number);
      const prevM = new Date(y, m - 2, 1);
      setActiveMonthStr(`${prevM.getFullYear()}-${padZero(prevM.getMonth() + 1)}`);
      setSelectedDate(null);
    }
  };

  const handleNextDate = () => {
    hasAutoSwitchedRef.current = true;
    if (period === 'week') {
      if (activeWeekMonStr >= currentWeekMonStr) return;
      setSlideDirection('next');
      const [y, m, d] = activeWeekMonStr.split('-').map(Number);
      const nextMon = new Date(y, m - 1, d + 7);
      setActiveWeekMonStr(formatISO(nextMon));
      setSelectedDate(null);
    } else {
      if (activeMonthStr >= currentMonthStr) return;
      setSlideDirection('next');
      const [y, m] = activeMonthStr.split('-').map(Number);
      const nextM = new Date(y, m, 1);
      setActiveMonthStr(`${nextM.getFullYear()}-${padZero(nextM.getMonth() + 1)}`);
      setSelectedDate(null);
    }
  };

  const handleResetDate = () => {
    hasAutoSwitchedRef.current = true;
    setSlideDirection(isCurrentPeriod ? null : 'next');
    if (period === 'week') {
      setActiveWeekMonStr(currentWeekMonStr);
    } else {
      setActiveMonthStr(currentMonthStr);
    }
    setSelectedDate(null);
  };

  const isCurrentPeriod = useMemo(() => {
    return period === 'week'
      ? activeWeekMonStr >= currentWeekMonStr
      : activeMonthStr >= currentMonthStr;
  }, [period, activeWeekMonStr, currentWeekMonStr, activeMonthStr, currentMonthStr]);

  // Date Range Label (e.g. "Sep 8 – Sep 14" or "September 2026")
  const dateRangeLabel = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const monDate = new Date(wy, wm - 1, wd);
      const sunDate = new Date(wy, wm - 1, wd + 6);
      const monMonth = monDate.toLocaleDateString('en-US', { month: 'short' });
      const sunMonth = sunDate.toLocaleDateString('en-US', { month: 'short' });
      const monD = monDate.getDate();
      const sunD = sunDate.getDate();

      if (monMonth === sunMonth) {
        return `${monMonth} ${monD} – ${sunD}`;
      }
      return `${monMonth} ${monD} – ${sunMonth} ${sunD}`;
    } else {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const mDate = new Date(my, mm - 1, 1);
      const shortM = mDate.toLocaleDateString('en-US', { month: 'short' });
      const monthFormatted = shortM === 'Sep' ? 'Sept' : shortM;
      return `${monthFormatted} ${mDate.getFullYear()}`;
    }
  }, [period, activeWeekMonStr, activeMonthStr]);

  // Period badge descriptor (e.g., "This Week", "Prev Week", "This Month", "Prev Month")
  const periodBadge = useMemo(() => {
    if (period === 'week') {
      if (activeWeekMonStr === currentWeekMonStr) {
        return { label: 'This Week', isCurrent: true, isPrev: false };
      }
      if (activeWeekMonStr === prevWeekMonStr) {
        return { label: 'Prev Week', isCurrent: false, isPrev: true };
      }
      const [ay, am, ad] = activeWeekMonStr.split('-').map(Number);
      const [cy, cm, cd] = currentWeekMonStr.split('-').map(Number);
      const aDate = new Date(ay, am - 1, ad);
      const cDate = new Date(cy, cm - 1, cd);
      const diffWeeks = Math.round((cDate.getTime() - aDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks > 0) {
        return { label: `${diffWeeks}w ago`, isCurrent: false, isPrev: false };
      }
      return null;
    } else {
      if (activeMonthStr === currentMonthStr) {
        return { label: 'This Month', isCurrent: true, isPrev: false };
      }
      const [cy, cm] = currentMonthStr.split('-').map(Number);
      const prevM = new Date(cy, cm - 2, 1);
      const prevMStr = `${prevM.getFullYear()}-${padZero(prevM.getMonth() + 1)}`;
      if (activeMonthStr === prevMStr) {
        return { label: 'Prev Month', isCurrent: false, isPrev: true };
      }
      const [ay, am] = activeMonthStr.split('-').map(Number);
      const diffMonths = (cy - ay) * 12 + (cm - am);
      if (diffMonths > 0) {
        return { label: `${diffMonths}m ago`, isCurrent: false, isPrev: false };
      }
      return null;
    }
  }, [period, activeWeekMonStr, currentWeekMonStr, prevWeekMonStr, activeMonthStr, currentMonthStr]);

  // Active period boundaries
  const activeDateRange = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const monDate = new Date(wy, wm - 1, wd);
      const sunDate = new Date(wy, wm - 1, wd + 6);
      return {
        startDate: formatISO(monDate),
        endDate: formatISO(sunDate),
      };
    } else {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const firstDay = new Date(my, mm - 1, 1);
      const lastDay = new Date(my, mm, 0);
      return {
        startDate: formatISO(firstDay),
        endDate: formatISO(lastDay),
      };
    }
  }, [period, activeWeekMonStr, activeMonthStr]);

  // Preceding period boundaries for comparison (Pair / Same-period comparison when in current period)
  const prevDateRange = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const isCurrentWeek = activeWeekMonStr === currentWeekMonStr;
      const prevMon = new Date(wy, wm - 1, wd - 7);

      let prevEndDate: Date;
      if (isCurrentWeek) {
        // Compare same elapsed days of week (e.g. Mon-Wed vs Mon-Wed of last week)
        const [ty, tm, td] = todayStr.split('-').map(Number);
        const todayDate = new Date(ty, tm - 1, td);
        const activeMon = new Date(wy, wm - 1, wd);
        const elapsedDays = Math.max(0, Math.min(6, Math.floor((todayDate.getTime() - activeMon.getTime()) / (1000 * 60 * 60 * 24))));
        prevEndDate = new Date(wy, wm - 1, wd - 7 + elapsedDays);
      } else {
        prevEndDate = new Date(wy, wm - 1, wd - 1);
      }
      return {
        startDate: formatISO(prevMon),
        endDate: formatISO(prevEndDate),
      };
    } else {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const isCurrentMonth = activeMonthStr === currentMonthStr;
      const firstDay = new Date(my, mm - 2, 1);

      let lastDay: Date;
      if (isCurrentMonth) {
        // Same-period Month-to-Date: Day 1 to Today's day-of-month in previous month (e.g. 1st-16th vs 1st-16th)
        const td = Number(todayStr.split('-')[2]);
        const todayDayNum = td || new Date().getDate();
        const daysInPrevMonth = new Date(my, mm - 1, 0).getDate();
        const compareDayNum = Math.min(todayDayNum, daysInPrevMonth);
        lastDay = new Date(my, mm - 2, compareDayNum);
      } else {
        lastDay = new Date(my, mm - 1, 0);
      }
      return {
        startDate: formatISO(firstDay),
        endDate: formatISO(lastDay),
      };
    }
  }, [period, activeWeekMonStr, currentWeekMonStr, activeMonthStr, currentMonthStr, todayStr]);

  // Filtered expenses for active period
  const periodExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (ge.category === 'Transfer' || ge.items?.some(i => i.category === 'Transfer')) return false;
      if (ge.date < activeDateRange.startDate || ge.date > activeDateRange.endDate) return false;
      if (!isAllCategoriesSelected && !selectedCategories.includes(ge.category)) return false;
      if (selectedWalletId && ge.walletId !== selectedWalletId) return false;
      return true;
    });
  }, [groupedExpenses, activeDateRange, isAllCategoriesSelected, selectedCategories, selectedWalletId]);

  // Preceding period expenses
  const prevPeriodExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (ge.category === 'Transfer' || ge.items?.some(i => i.category === 'Transfer')) return false;
      if (ge.date < prevDateRange.startDate || ge.date > prevDateRange.endDate) return false;
      if (!isAllCategoriesSelected && !selectedCategories.includes(ge.category)) return false;
      if (selectedWalletId && ge.walletId !== selectedWalletId) return false;
      return true;
    });
  }, [groupedExpenses, prevDateRange, isAllCategoriesSelected, selectedCategories, selectedWalletId]);

  // Total spent in active period & previous period
  const totalSpent = useMemo(() => {
    return periodExpenses
      .filter(ge => ge.flow === 'out')
      .reduce((sum, ge) => sum + getGroupedExpenseAmount(ge, spendingMode), 0);
  }, [periodExpenses, spendingMode]);

  const prevPeriodSpent = useMemo(() => {
    return prevPeriodExpenses
      .filter(ge => ge.flow === 'out')
      .reduce((sum, ge) => sum + getGroupedExpenseAmount(ge, spendingMode), 0);
  }, [prevPeriodExpenses, spendingMode]);

  // Chart days computation
  const chartDays: ChartDayData[] = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const days: ChartDayData[] = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(wy, wm - 1, wd + i);
        const dateStr = formatISO(cur);
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = cur.getDate();
        const fullDateLabel = cur.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        
        const dayExps = periodExpenses.filter(ge => ge.date === dateStr);
        const spend = dayExps
          .filter(ge => ge.flow === 'out')
          .reduce((s, ge) => s + getGroupedExpenseAmount(ge, spendingMode), 0);

        days.push({
          dateStr,
          dayName,
          dayNum,
          fullDateLabel,
          spend,
          count: dayExps.length,
          isToday: dateStr === todayStr,
          isYesterday: false,
        });
      }
      return days;
    } else {
      // Month mode: 7 days or days of month (for clean visual display, provide days in month or 4-5 weekly buckets)
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const totalDays = new Date(my, mm, 0).getDate();
      const days: ChartDayData[] = [];

      for (let d = 1; d <= totalDays; d++) {
        const cur = new Date(my, mm - 1, d);
        const dateStr = formatISO(cur);
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'narrow' });
        const fullDateLabel = cur.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        
        const dayExps = periodExpenses.filter(ge => ge.date === dateStr);
        const spend = dayExps
          .filter(ge => ge.flow === 'out')
          .reduce((s, ge) => s + getGroupedExpenseAmount(ge, spendingMode), 0);

        days.push({
          dateStr,
          dayName,
          dayNum: d,
          fullDateLabel,
          spend,
          count: dayExps.length,
          isToday: dateStr === todayStr,
          isYesterday: false,
        });
      }
      return days;
    }
  }, [period, activeWeekMonStr, activeMonthStr, periodExpenses, spendingMode, todayStr]);

  // Highest day amount & No-spend days
  const highestDayAmount = useMemo(() => {
    return Math.max(...chartDays.map(d => d.spend), 0);
  }, [chartDays]);

  const noSpendDaysCount = useMemo(() => {
    // Count days where spend is 0, up to today if in current period
    return chartDays.filter(d => {
      if (d.dateStr > todayStr) return false; // Don't count future days in current week as no-spend
      return d.spend === 0;
    }).length;
  }, [chartDays, todayStr]);

  const daysPassedCount = useMemo(() => {
    // If viewing the current active period, count days elapsed up to today; if past period, count all days in period
    const elapsed = chartDays.filter(d => d.dateStr <= todayStr).length;
    return Math.max(1, elapsed);
  }, [chartDays, todayStr]);

  const totalDaysInPeriod = useMemo(() => {
    return Math.max(1, chartDays.length);
  }, [chartDays]);

  const dailyAvg = useMemo(() => {
    return totalSpent / daysPassedCount;
  }, [totalSpent, daysPassedCount]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (!isAllCategoriesSelected) c++;
    if (selectedWalletId) c++;
    return c;
  }, [isAllCategoriesSelected, selectedWalletId]);

  const handleDeleteExpense = (id: string) => {
    deleteExpense(id);
    showToast('Expense deleted');
    setDeletingId(null);
  };

  const yesterdayStr = useMemo(() => {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return formatISO(y);
  }, [now]);

  // Filtered expenses according to category, wallet, or specific selected date
  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter(ge => {
      if (selectedDate && ge.date !== selectedDate) return false;
      return true;
    });
  }, [periodExpenses, selectedDate]);

  // Base scope expenses across active categories for the active scope (specific selectedDate or active period)
  const basePeriodExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (ge.category === 'Transfer' || ge.items?.some(i => i.category === 'Transfer')) return false;
      if (selectedDate) {
        if (ge.date !== selectedDate) return false;
      } else {
        if (ge.date < activeDateRange.startDate || ge.date > activeDateRange.endDate) return false;
      }
      if (!isAllCategoriesSelected && !selectedCategories.includes(ge.category)) return false;
      if (selectedWalletId && ge.walletId !== selectedWalletId) return false;
      return true;
    });
  }, [groupedExpenses, activeDateRange, selectedDate, isAllCategoriesSelected, selectedCategories, selectedWalletId]);

  const basePeriodTotalSpent = useMemo(() => {
    return basePeriodExpenses
      .filter(ge => ge.flow === 'out')
      .reduce((sum, ge) => sum + getGroupedExpenseAmount(ge, spendingMode), 0);
  }, [basePeriodExpenses, spendingMode]);

  // Daily log breakdown
  const perDayList = useMemo(() => {
    const map: Record<string, { spend: number; income: number; items: GroupedExpense[]; categories: Record<string, number> }> = {};

    filteredExpenses.forEach(ge => {
      const d = ge.date;
      if (!map[d]) {
        map[d] = { spend: 0, income: 0, items: [], categories: {} };
      }
      map[d].items.push(ge);
      const amt = getGroupedExpenseAmount(ge, spendingMode);
      if (ge.flow === "out") {
        map[d].spend += amt;
        map[d].categories[ge.category] = (map[d].categories[ge.category] || 0) + amt;
      } else {
        map[d].income += amt;
        map[d].categories[ge.category] = (map[d].categories[ge.category] || 0) + amt;
      }
    });

    // In monthly view without a single-day filter or category filter, populate all days of the month (past/today first, future dates at end)
    if (period === 'month' && !selectedDate && isAllCategoriesSelected) {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const totalDays = new Date(my, mm, 0).getDate();
      const pastOrTodayDays: DayExpenditureRow[] = [];
      const futureDays: DayExpenditureRow[] = [];

      for (let d = totalDays; d >= 1; d--) {
        const cur = new Date(my, mm - 1, d);
        const dateStr = formatISO(cur);
        const isFuture = dateStr > todayStr;
        const data = map[dateStr] || { spend: 0, income: 0, items: [], categories: {} };
        const topCatEntry = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0];
        const dayName = cur.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

        const rowItem = {
          dateStr,
          dayName,
          spend: data.spend,
          income: data.income,
          count: data.items.length,
          items: data.items,
          topCategory: topCatEntry ? topCatEntry[0] : (data.items[0]?.category || "General"),
          isToday: dateStr === todayStr,
          isYesterday: dateStr === yesterdayStr,
          isFuture,
        };

        if (isFuture) {
          futureDays.push(rowItem);
        } else {
          pastOrTodayDays.push(rowItem);
        }
      }

      // Past & today days are in descending order (e.g. 16, 15, ..., 1)
      // Future/yet-to-come days appear at the end in ascending order (e.g. 17, 18, ..., 30)
      futureDays.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      return [...pastOrTodayDays, ...futureDays];
    }

    return Object.entries(map)
      .map(([dateStr, data]) => {
        const topCatEntry = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0];
        const [y, m, d] = dateStr.split("-").map(Number);
        const dObj = new Date(y, m - 1, d);
        const dayName = isNaN(dObj.getTime())
          ? dateStr
          : dObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        return {
          dateStr,
          dayName,
          spend: data.spend,
          income: data.income,
          count: data.items.length,
          items: data.items,
          topCategory: topCatEntry ? topCatEntry[0] : (data.items[0]?.category || "General"),
          isToday: dateStr === todayStr,
          isYesterday: dateStr === yesterdayStr,
        };
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredExpenses, period, activeMonthStr, selectedDate, isAllCategoriesSelected, todayStr, yesterdayStr, spendingMode]);

  // Category breakdown across all categories for the active period
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    basePeriodExpenses.forEach(ge => {
      if (ge.flow !== "out") return;
      const amt = getGroupedExpenseAmount(ge, spendingMode);
      if (amt === 0) return;
      if (!map[ge.category]) map[ge.category] = { amount: 0, count: 0 };
      map[ge.category].amount += amt;
      map[ge.category].count += 1;
    });

    return Object.entries(map)
      .map(([cat, data]) => ({
        cat,
        amount: data.amount,
        count: data.count,
        pct: basePeriodTotalSpent > 0 ? (data.amount / basePeriodTotalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [basePeriodExpenses, basePeriodTotalSpent, spendingMode]);

  // Toggle date selection from bar chart or list
  const handleToggleDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
    }
  };

  return (
    <div className="view-container">
      {/* Desktop Top Bar: Title & Search Bar */}
      <div className="page-header stats-page-header">
        <div>
          <h1 className="page-title">Statistics</h1>
        </div>
        <DesktopSearchBar placeholder="Search expenses, contacts, wallets..." defaultTab="all" />
      </div>

      <div className="analytics-v2-container">
        {/* 1. Header & Period / Date Range Navigator */}
        <AnalyticsHeader
          period={period}
          setPeriod={handleSetPeriod}
          dateRangeLabel={dateRangeLabel}
          onPrevDate={handlePrevDate}
          onNextDate={handleNextDate}
          onResetDate={handleResetDate}
          isCurrentPeriod={isCurrentPeriod}
          onNavigate={onNavigate}
        />

        {/* 2. Card 1: Total Spending Overview & Interactive Visual Bar Chart */}
        <div style={{ width: '100%' }}>
          <TotalSpendingCard
            period={period}
            periodBadge={periodBadge}
            periodKey={period === 'week' ? activeWeekMonStr : activeMonthStr}
            slideDirection={slideDirection}
            onPrevDate={handlePrevDate}
            onNextDate={handleNextDate}
            isCurrentPeriod={isCurrentPeriod}
            totalSpent={totalSpent}
            prevPeriodSpent={prevPeriodSpent}
            dailyAvg={dailyAvg}
            daysPassedCount={daysPassedCount}
            totalDaysInPeriod={totalDaysInPeriod}
            highestDayAmount={highestDayAmount}
            noSpendDaysCount={noSpendDaysCount}
            chartDays={chartDays}
            currency={currency}
            onOpenFilter={() => setShowFilterDrawer(true)}
            activeFilterCount={activeFilterCount}
            onSelectDay={handleToggleDate}
            selectedDateStr={selectedDate}
            selectedCategory={selectedCategory}
            onOpenPacingDrawer={() => setShowPacingDrawer(true)}
          />
        </div>

      {/* Quick Filter Modal / Drawer */}
      {showFilterDrawer && createPortal(
        <div
          className="filter-drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFilterDrawer(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="analytics-filter-title"
        >
          <div
            className="filter-drawer-panel"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 4px', flexShrink: 0 }} />

            {/* Header (No splitting lines) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px 8px',
                backgroundColor: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text)',
                    backgroundColor: 'transparent',
                    flexShrink: 0,
                  }}
                >
                  <Filter size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <h3
                    id="analytics-filter-title"
                    style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}
                  >
                    Filter Statistics
                  </h3>
                  <div style={{ fontSize: '11.5px', color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                    {activeFilterCount > 0
                      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
                      : 'Filter by category and wallet'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFilterDrawer(false)}
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

            {/* Scrollable Filter Content */}
            <div
              className="filter-drawer-content"
              style={{
                padding: '14px 20px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {/* Category Filter */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Category
                    </label>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 9999 }}>
                      {isAllCategoriesSelected ? 'All selected' : `${effectiveSelectedCount} of ${allCategoryNames.length}`}
                    </span>
                  </div>
                  {!isAllCategoriesSelected ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      style={{ fontSize: 11, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Select All
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(['__NONE__'])}
                      style={{ fontSize: 11, color: 'var(--text-3)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
                  <button
                    type="button"
                    onClick={() => isAllCategoriesSelected ? setSelectedCategories(['__NONE__']) : setSelectedCategories([])}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 9999,
                      border: isAllCategoriesSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isAllCategoriesSelected ? 'var(--accent)' : 'var(--surface2)',
                      color: isAllCategoriesSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: isAllCategoriesSelected ? 650 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: isAllCategoriesSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isAllCategoriesSelected && <Check size={13} strokeWidth={2.5} />}
                    <span>All Categories</span>
                  </button>

                  {db.settings.categories
                    .filter((c) => c.name.toLowerCase() !== 'refund' && c.name.toLowerCase() !== 'transfer')
                    .map((c) => {
                    const isSelected = isAllCategoriesSelected || selectedCategories.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleToggleCategoryInDrawer(c.name)}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 'var(--radius-full)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent)' : 'var(--surface2)',
                          color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? (
                          <Check size={13} strokeWidth={2.5} />
                        ) : (
                          <CategoryIcon category={c.name} icon={c.icon} size={13} style={{ color: 'inherit' }} />
                        )}
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wallet Filter */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Wallet / Account
                  </label>
                  {selectedWalletId && (
                    <button
                      type="button"
                      onClick={() => setSelectedWalletId(null)}
                      style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 170, overflowY: 'auto', paddingRight: 2 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedWalletId(null)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 'var(--radius-full)',
                      border: !selectedWalletId ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: !selectedWalletId ? 'var(--accent)' : 'var(--surface2)',
                      color: !selectedWalletId ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: !selectedWalletId ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: !selectedWalletId ? '0 2px 8px var(--accent-soft)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {!selectedWalletId && <Check size={13} strokeWidth={2.5} />}
                    <span>All Wallets</span>
                  </button>

                  {wallets.map((w) => {
                    const isSelected = selectedWalletId === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWalletId(isSelected ? null : w.id)}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 'var(--radius-full)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent)' : 'var(--surface2)',
                          color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? (
                          <Check size={13} strokeWidth={2.5} />
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {renderWalletIcon(w.icon || w.name, 13, w.color)}
                          </span>
                        )}
                        <span>{w.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions / Bottom buttons (No splitting line, rounded aesthetic matching Image 3) */}
            <div
              style={{
                padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedWalletId(null);
                }}
                disabled={activeFilterCount === 0}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: activeFilterCount > 0 ? 'var(--text)' : 'var(--text-3)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  cursor: activeFilterCount > 0 ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: activeFilterCount > 0 ? 1 : 0.5,
                  transition: 'all 0.15s ease',
                }}
              >
                <RotateCcw size={14} />
                <span>Clear</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFilterDrawer(false)}
                style={{
                  flex: 1.5,
                  height: 42,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 3px 12px var(--accent-soft)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Check size={16} strokeWidth={2.5} />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Cards Grid: Category Breakdown & Activity */}
      <div className="analytics-v2-grid">
        {/* Category Breakdown Card */}
        <CategoryDistributionCard
          className="analytics-v2-card-category"
          categories={categoryBreakdown}
          totalOutflow={basePeriodTotalSpent}
          currency={currency}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onOpenCategoryDrawer={(cat) => setInspectCategoryName(cat)}
          selectedDate={selectedDate}
          onClearDate={() => setSelectedDate(null)}
          categorySettings={db.settings.categories}
          period={period}
        />

        {/* Activity Card */}
        <DailyExpenditureCard
          className="analytics-v2-card-activity"
          days={perDayList}
          currency={currency}
          selectedDate={selectedDate}
          onSelectDate={handleToggleDate}
          onOpenDayDetails={(dateStr) => {
            setSelectedDate(dateStr);
            setShowDailyBalanceDrawer(true);
          }}
          categorySettings={db.settings.categories}
          period={period}
          selectedCategory={selectedCategory}
          onClearCategory={() => setSelectedCategory(null)}
          categoryExpenses={filteredExpenses}
          onSelectExpense={(ge) => setSelectedGroupExpense(ge)}
          spendingMode={spendingMode}
          wallets={db.wallets}
          friends={db.friends}
        />
      </div>

      {/* Transaction Detail Drawer */}
      {selectedGroupExpense && (
        <ExpenseDetailDrawer
          ge={selectedGroupExpense}
          onClose={() => setSelectedGroupExpense(null)}
          onEdit={(item) => {
            setSelectedGroupExpense(null);
            setEditingExpense(item);
          }}
          onDelete={(id) => {
            setSelectedGroupExpense(null);
            setDeletingId(id);
          }}
          currency={currency}
          friends={db.friends}
          wallets={db.wallets}
          categories={db.settings.categories}
          settlements={db.settlements}
        />
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Daily Wallet Balance Drawer */}
      <DailyWalletBalanceDrawer
        isOpen={showDailyBalanceDrawer}
        onClose={() => setShowDailyBalanceDrawer(false)}
        initialMonth={period === 'month' ? activeMonthStr : undefined}
        initialDate={selectedDate || undefined}
      />

      {/* Category Detail Breakdown Drawer */}
      <CategoryDetailDrawer
        isOpen={!!inspectCategoryName}
        onClose={() => setInspectCategoryName(null)}
        categoryName={inspectCategoryName}
        period={period}
        activeMonthStr={activeMonthStr}
        expenses={db.expenses}
        currency={currency}
        wallets={db.wallets}
      />

      {/* Spending Pacing & Period Comparison Drawer */}
      <PacingComparisonDrawer
        isOpen={showPacingDrawer}
        onClose={() => setShowPacingDrawer(false)}
        period={period}
        activeWeekMonStr={activeWeekMonStr}
        activeMonthStr={activeMonthStr}
        currentWeekMonStr={currentWeekMonStr}
        currentMonthStr={currentMonthStr}
        todayStr={todayStr}
        totalSpent={totalSpent}
        prevPeriodSpent={prevPeriodSpent}
        currency={currency}
        periodExpenses={periodExpenses}
        prevPeriodExpenses={prevPeriodExpenses}
        daysPassedCount={daysPassedCount}
        totalDaysInPeriod={totalDaysInPeriod}
        isCurrentPeriod={isCurrentPeriod}
      />

      {/* Confirmation Delete Dialog */}
      {deletingId && (
        <div className="modal-backdrop" onClick={() => setDeletingId(null)}>
          <div className="modal" style={{ maxWidth: 360, padding: 20, borderRadius: 'var(--radius-xl)' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Delete Expense?</h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', marginBottom: 16 }}>
              Are you sure you want to delete this expense transaction? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 'var(--radius-full)' }} onClick={() => setDeletingId(null)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                style={{ background: 'var(--debit)', borderRadius: 'var(--radius-full)' }}
                onClick={() => handleDeleteExpense(deletingId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
