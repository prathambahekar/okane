import type { Category, Settings, AppDB } from '../types';
import { monthKey } from '../db';
import { getGroupedExpenseAmount, groupExpenses } from '../utils';

export interface CategoryBudgetStatus {
  category: Category;
  categoryName: string;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  isOverBudget: boolean;
  status: 'safe' | 'warning' | 'danger' | 'exceeded';
  projectedMonthEnd: number;
  projectedPercent: number;
  dailyAllowanceRemaining: number;
  expenseCount: number;
}

export interface OverallBudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  percent: number;
  status: 'safe' | 'warning' | 'danger' | 'exceeded';
  budgetedCategoriesCount: number;
  overBudgetCategoriesCount: number;
  nearLimitCategoriesCount: number;
  onTrackCategoriesCount: number;
}

/**
 * Returns the effective monthly budget for a category by checking category.budget or settings.categoryBudgets
 */
export function getCategoryBudget(category: Category | string, settings?: Settings): number | undefined {
  if (!settings) return undefined;
  const name = typeof category === 'string' ? category : category.name;
  if (!name) return undefined;

  // 1. Direct category object budget
  if (typeof category === 'object') {
    if (typeof category.budget === 'number' && category.budget > 0) return category.budget;
    if (typeof category.monthlyBudget === 'number' && category.monthlyBudget > 0) return category.monthlyBudget;
  }

  // 2. Settings categories list lookup
  const found = (settings.categories || []).find(c => c.name.toLowerCase() === name.toLowerCase());
  if (found) {
    if (typeof found.budget === 'number' && found.budget > 0) return found.budget;
    if (typeof found.monthlyBudget === 'number' && found.monthlyBudget > 0) return found.monthlyBudget;
  }

  // 3. Settings categoryBudgets map lookup
  if (settings.categoryBudgets && typeof settings.categoryBudgets[name] === 'number' && settings.categoryBudgets[name] > 0) {
    return settings.categoryBudgets[name];
  }

  return undefined;
}

/**
 * Calculates budget status for a specific category for the given month
 */
export function calculateCategoryBudgetStatus(
  categoryName: string,
  db: AppDB,
  targetMonthKey?: string
): CategoryBudgetStatus | null {
  const now = new Date();
  const currentMonth = targetMonthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const categories = db.settings?.categories || [];
  const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase()) || {
    name: categoryName,
    color: '#8B5CF6',
    icon: 'tag',
  };

  const budget = getCategoryBudget(category, db.settings);
  if (!budget || budget <= 0) return null;

  const [year, month] = currentMonth.split('-').map(Number);
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysPassed = isCurrentMonth ? Math.min(now.getDate(), totalDaysInMonth) : totalDaysInMonth;
  const remainingDays = Math.max(1, totalDaysInMonth - daysPassed + 1);

  const spendingMode = db.settings?.spendingMode || 'all';

  // Calculate spent in this category for this month
  let spent = 0;
  let count = 0;

  const grouped = groupExpenses(db.expenses || [], db.wallets, db.friends, db.settlements);
  grouped.forEach(ge => {
    if (ge.category === 'Transfer' || ge.category === 'Settlement' || ge.isSettlementGroup) return;
    if (ge.flow !== 'out') return;
    if (monthKey(ge.date) !== currentMonth) return;
    if (ge.category.toLowerCase() !== categoryName.toLowerCase()) return;

    const amt = getGroupedExpenseAmount(ge, spendingMode);
    spent += amt;
    count++;
  });

  const remaining = budget - spent;
  const percent = Math.round((spent / budget) * 100);
  const isOverBudget = spent > budget;

  let status: 'safe' | 'warning' | 'danger' | 'exceeded' = 'safe';
  if (percent >= 100) {
    status = 'exceeded';
  } else if (percent >= 85) {
    status = 'danger';
  } else if (percent >= 70) {
    status = 'warning';
  }

  // Projected spend at end of month based on daily pace
  const dailyRate = daysPassed > 0 ? spent / daysPassed : 0;
  const projectedMonthEnd = Math.round(dailyRate * totalDaysInMonth);
  const projectedPercent = Math.round((projectedMonthEnd / budget) * 100);
  const dailyAllowanceRemaining = Math.max(0, Math.round((remaining / remainingDays) * 100) / 100);

  return {
    category,
    categoryName: category.name,
    budget,
    spent: Math.round(spent * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    percent,
    isOverBudget,
    status,
    projectedMonthEnd,
    projectedPercent,
    dailyAllowanceRemaining,
    expenseCount: count,
  };
}

/**
 * Calculates budget statuses for all categories with a defined budget
 */
export function getAllCategoryBudgetStatuses(db: AppDB, targetMonthKey?: string): {
  budgetStatuses: CategoryBudgetStatus[];
  summary: OverallBudgetSummary;
  unbudgetedCategories: Category[];
} {
  const categories = db.settings?.categories || [];
  const budgetStatuses: CategoryBudgetStatus[] = [];
  const unbudgetedCategories: Category[] = [];

  categories.forEach(cat => {
    const budget = getCategoryBudget(cat, db.settings);
    if (budget && budget > 0) {
      const status = calculateCategoryBudgetStatus(cat.name, db, targetMonthKey);
      if (status) budgetStatuses.push(status);
    } else {
      unbudgetedCategories.push(cat);
    }
  });

  // Sort: Exceeded and highest percent first
  budgetStatuses.sort((a, b) => b.percent - a.percent);

  const totalBudget = budgetStatuses.reduce((acc, b) => acc + b.budget, 0);
  const totalSpent = budgetStatuses.reduce((acc, b) => acc + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const percent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  let overallStatus: 'safe' | 'warning' | 'danger' | 'exceeded' = 'safe';
  if (percent >= 100) overallStatus = 'exceeded';
  else if (percent >= 85) overallStatus = 'danger';
  else if (percent >= 70) overallStatus = 'warning';

  const overBudgetCategoriesCount = budgetStatuses.filter(b => b.percent >= 100).length;
  const nearLimitCategoriesCount = budgetStatuses.filter(b => b.percent >= 75 && b.percent < 100).length;
  const onTrackCategoriesCount = budgetStatuses.filter(b => b.percent < 75).length;

  return {
    budgetStatuses,
    summary: {
      totalBudget,
      totalSpent,
      totalRemaining,
      percent,
      status: overallStatus,
      budgetedCategoriesCount: budgetStatuses.length,
      overBudgetCategoriesCount,
      nearLimitCategoriesCount,
      onTrackCategoriesCount,
    },
    unbudgetedCategories,
  };
}
