import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Target,
  Check,
  HelpCircle,
  Search,
} from 'lucide-react';
import { useStore } from '../../store';
import { fmtMoney, currencySymbol } from '../../utils';
import type { Category } from '../../types';
import CategoryIcon from '../CategoryIcon';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import { getCategoryBudget } from '../../utils/budget';

interface BudgetSetupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategoryName?: string | null;
}

const BudgetSetupDrawerContent: React.FC<{
  onClose: () => void;
  initialCategoryName?: string | null;
}> = ({ onClose, initialCategoryName }) => {
  const { db, updateSettings, showToast } = useStore();
  const currency = db.settings?.currency || 'INR';
  const sym = currencySymbol(currency);

  const categories = useMemo(() => {
    return (db.settings?.categories || []).filter(
      (c) => c.name.toLowerCase() !== 'transfer' && c.name.toLowerCase() !== 'refund'
    );
  }, [db.settings?.categories]);

  // Lazy map initialization
  const [budgetsMap, setBudgetsMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    (db.settings?.categories || []).forEach((c) => {
      if (c.name.toLowerCase() === 'transfer' || c.name.toLowerCase() === 'refund') return;
      const b = getCategoryBudget(c, db.settings);
      initialMap[c.name] = b && b > 0 ? String(b) : '';
    });
    return initialMap;
  });

  const [activeSearch, setActiveSearch] = useState('');

  // Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBudgetChange = (catName: string, val: string) => {
    // Only allow numbers and decimal
    const cleaned = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    setBudgetsMap((prev) => ({
      ...prev,
      [catName]: cleaned,
    }));
  };

  const handleApplyPreset = (catName: string, amount: number) => {
    setBudgetsMap((prev) => ({
      ...prev,
      [catName]: String(amount),
    }));
  };

  const handleClearBudget = (catName: string) => {
    setBudgetsMap((prev) => ({
      ...prev,
      [catName]: '',
    }));
  };

  const handleSave = () => {
    const updatedCategories: Category[] = (db.settings?.categories || []).map((c) => {
      const budgetValStr = budgetsMap[c.name];
      const parsed = parseFloat(budgetValStr);
      const budget = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
      return {
        ...c,
        budget,
        monthlyBudget: budget,
      };
    });

    const categoryBudgetsRecord: Record<string, number> = {};
    updatedCategories.forEach((c) => {
      if (typeof c.budget === 'number' && c.budget > 0) {
        categoryBudgetsRecord[c.name] = c.budget;
      }
    });

    updateSettings({
      categories: updatedCategories,
      categoryBudgets: categoryBudgetsRecord,
    });

    showToast('Category budgets saved successfully');
    onClose();
  };

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!activeSearch.trim()) return categories;
    const q = activeSearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, activeSearch]);

  // Total planned budget sum
  const totalPlannedBudget = useMemo(() => {
    return Object.values(budgetsMap).reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (!isNaN(num) && num > 0 ? num : 0);
    }, 0);
  }, [budgetsMap]);

  const budgetedCount = useMemo(() => {
    return Object.values(budgetsMap).filter((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }).length;
  }, [budgetsMap]);

  return (
    <div
      className="filter-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-setup-title"
    >
      <div
        className="filter-drawer-panel category-detail-drawer"
        style={{ maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="sheet-drag-handle" />

        {/* Fixed Header */}
        <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Target size={20} strokeWidth={2.4} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 id="budget-setup-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Category Spending Limits
              </h3>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                {budgetedCount} of {categories.length} categories budgeted ({fmtMoney(totalPlannedBudget, currency)})
              </div>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="sheet-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick Tip Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-2)',
              lineHeight: 1.4,
            }}
          >
            <HelpCircle size={16} strokeWidth={2.2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>
              Set monthly spending limits for each category. Okane will monitor your pacing and warn you when you approach or exceed limits.
            </span>
          </div>

          {/* Search Filter if many categories */}
          {categories.length > 4 && (
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-3)',
                }}
              />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
                placeholder="Search categories..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {activeSearch && (
                <button
                  type="button"
                  onClick={() => setActiveSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Category Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {filteredCategories.map((c) => {
              const bgTint = c.color.startsWith('#') && c.color.length === 7 ? `${c.color}1c` : 'var(--accent-soft)';
              const borderTint = c.color.startsWith('#') && c.color.length === 7 ? `${c.color}35` : 'var(--border)';
              const currentVal = budgetsMap[c.name] || '';
              const hasBudget = Boolean(currentVal && parseFloat(currentVal) > 0);
              const isInitial = initialCategoryName && initialCategoryName.toLowerCase() === c.name.toLowerCase();

              return (
                <div
                  key={c.name}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-lg)',
                    background: isInitial ? 'var(--surface)' : 'var(--surface2)',
                    border: isInitial ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    boxShadow: isInitial ? '0 0 0 3px var(--accent-soft)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius-md)',
                          background: bgTint,
                          border: `1px solid ${borderTint}`,
                          color: c.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <CategoryIcon category={c.name} icon={c.icon} size={16} style={{ color: c.color }} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-caption)', color: hasBudget ? 'var(--credit)' : 'var(--text-3)', fontWeight: hasBudget ? 600 : 400 }}>
                          {hasBudget ? `Monthly limit: ${fmtMoney(parseFloat(currentVal), currency)}` : 'No budget set'}
                        </div>
                      </div>
                    </div>

                    {/* Amount Input Box */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--surface)',
                        border: hasBudget ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px 10px',
                        width: 130,
                        flexShrink: 0,
                        gap: 4,
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-3)', userSelect: 'none' }}>
                        {sym}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        placeholder="Limit"
                        value={currentVal}
                        onChange={(e) => handleBudgetChange(c.name, e.target.value)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: 700,
                          color: 'var(--text)',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      {currentVal && (
                        <button
                          type="button"
                          onClick={() => handleClearBudget(c.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'var(--text-3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Clear limit"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Preset Amount Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                    {[500, 1000, 2500, 5000, 10000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleApplyPreset(c.name, amt)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: currentVal === String(amt) ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: currentVal === String(amt) ? 'var(--accent-soft)' : 'var(--surface)',
                          color: currentVal === String(amt) ? 'var(--accent)' : 'var(--text-2)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          userSelect: 'none',
                        }}
                      >
                        +{amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div
          style={{
            padding: '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
              fontSize: 'var(--fs-sm)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            style={{
              flex: 1.5,
              height: 44,
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: 'var(--fs-sm)',
              background: 'var(--text)',
              color: 'var(--surface)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Check size={16} strokeWidth={2.4} />
            <span>Save Limits</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const BudgetSetupDrawer: React.FC<BudgetSetupDrawerProps> = ({
  isOpen,
  onClose,
  initialCategoryName,
}) => {
  // Back button handling
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  if (!isOpen) return null;

  return createPortal(
    <BudgetSetupDrawerContent
      onClose={onClose}
      initialCategoryName={initialCategoryName}
    />,
    document.body
  );
};

export default BudgetSetupDrawer;
