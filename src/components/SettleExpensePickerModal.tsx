import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, ReceiptText } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import type { Friend, Expense, AppDB } from '../types';
import { expenseFlow } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription } from '../utils';

interface SettleExpensePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: Friend;
  expenses: Expense[];
  selectedIds: Set<string> | string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  currency: string;
  db: AppDB;
  title?: string;
}

export default function SettleExpensePickerModal({
  isOpen,
  onClose,
  friend,
  expenses,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  currency,
  db,
  title = 'Select Expenses to Settle',
}: SettleExpensePickerModalProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'owed_to_me' | 'owed_by_me'>('all');

  const selectedSet = useMemo(() => {
    return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  }, [selectedIds]);

  const isOwedToMe = useCallback((e: Expense) => {
    return e.friendId === friend.id && e.type === 'for_friend' && expenseFlow(e) === 'out';
  }, [friend.id]);

  const hasMixedFlows = useMemo(() => {
    let hasToMe = false;
    let hasByMe = false;
    for (const e of expenses) {
      if (isOwedToMe(e)) hasToMe = true;
      else hasByMe = true;
      if (hasToMe && hasByMe) return true;
    }
    return false;
  }, [expenses, isOwedToMe]);

  const filteredExpenses = useMemo(() => {
    let list = expenses;

    if (filterType === 'owed_to_me') {
      list = list.filter(isOwedToMe);
    } else if (filterType === 'owed_by_me') {
      list = list.filter(e => !isOwedToMe(e));
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(e => {
        const desc = (e.description || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const date = (e.date || '').toLowerCase();
        const amt = String(e.amount || '');
        return desc.includes(q) || cat.includes(q) || date.includes(q) || amt.includes(q);
      });
    }

    return list;
  }, [expenses, filterType, search, isOwedToMe]);

  // Calculate selected total in modal
  const selectedExpenses = useMemo(() => {
    return expenses.filter(e => selectedSet.has(e.id));
  }, [expenses, selectedSet]);

  const owedToMeAmt = selectedExpenses
    .filter(isOwedToMe)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const owedByMeAmt = selectedExpenses
    .filter(e => !isOwedToMe(e))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const netTotal = owedToMeAmt - owedByMeAmt;
  const absNet = Math.abs(netTotal);
  const allSelected = expenses.length > 0 && selectedSet.size === expenses.length;

  if (!isOpen) return null;

  return createPortal(
    <div className="friend-picker-overlay" onClick={onClose}>
      <div
        className="friend-picker-sheet"
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Mobile Drag Handle */}
        <div className="friend-picker-handle">
          <div style={{ width: 36, height: 4.5, borderRadius: 99, background: 'var(--border2)' }} />
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              className="avatar"
              style={{
                ...getAvatarStyle(friend.color),
                width: 36,
                height: 36,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {friendInitial(friend.name, friend.avatarNumber)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                {friend.name} • {expenses.length} pending expense{expenses.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ width: 32, height: 32, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ padding: '4px 20px 10px', background: 'var(--surface)', flexShrink: 0 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', marginBottom: hasMixedFlows ? 8 : 6 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-3)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses by name or category..."
              style={{
                paddingLeft: 32,
                paddingRight: search ? 28 : 12,
                height: 36,
                fontSize: 12.5,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills + Select All Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
            {hasMixedFlows ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`pill-btn ${filterType === 'all' ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  All ({expenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('owed_to_me')}
                  className={`pill-btn ${filterType === 'owed_to_me' ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  Owed to you
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('owed_by_me')}
                  className={`pill-btn ${filterType === 'owed_by_me' ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  You owe
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? 's' : ''}
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={allSelected ? onDeselectAll : onSelectAll}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: allSelected ? 'var(--text-2)' : 'var(--accent)',
                background: allSelected ? 'var(--surface2)' : 'var(--accent-soft)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 10px',
                height: 28,
                marginLeft: 'auto',
                cursor: 'pointer',
              }}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>

        {/* Scrollable Expense List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredExpenses.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
              <ReceiptText size={28} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>No expenses found</div>
              <div style={{ fontSize: 11.5, marginTop: 2 }}>
                {search ? 'Try adjusting your search query' : 'No unsettled transactions for this filter'}
              </div>
            </div>
          ) : (
            filteredExpenses.map(e => {
              const cat = db.settings.categories?.find(c => c.name === e.category);
              const isToMe = isOwedToMe(e);
              const isSelected = selectedSet.has(e.id);
              const origAmt = typeof e.originalAmount === 'number' ? e.originalAmount : null;
              const hasDiffOrig = origAmt !== null && origAmt > 0 && Math.abs(origAmt - e.amount) > 0.01;

              return (
                <div
                  key={e.id}
                  onClick={() => onToggle(e.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                    border: isSelected ? '1px solid var(--accent-border-soft)' : '1px solid transparent',
                    borderRadius: 10,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {/* Custom Checkbox */}
                  <div
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: 5,
                      border: isSelected ? '1.5px solid var(--accent)' : '1.5px solid var(--border2)',
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      color: 'var(--accent-contrast, #ffffff)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>

                  {/* Category Icon */}
                  <CategoryIcon
                    category={e.category}
                    size={16}
                    style={{ color: cat?.color ?? 'var(--accent)', flexShrink: 0 }}
                  />

                  {/* Expense Description & Date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {cleanExpenseDescription(e.description)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{fmtDate(e.originalDate || e.date)}</span>
                      {e.category ? (
                        <>
                          <span>•</span>
                          <span>{e.category}</span>
                        </>
                      ) : null}
                      {hasDiffOrig ? (
                        <>
                          <span>•</span>
                          <span>Orig {fmtMoney(origAmt!, currency)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Amount Badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        color: isToMe ? 'var(--credit)' : 'var(--debit)',
                      }}
                    >
                      {isToMe ? '+' : '-'}{fmtMoney(e.amount, currency)}
                    </div>
                    {hasDiffOrig ? (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                        og {fmtMoney(origAmt!, currency)}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Sticky Footer with Summary & Confirm Action */}
        <div
          style={{
            padding: '14px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {selectedSet.size} of {expenses.length} selected
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
              Net:{' '}
              <strong style={{ color: netTotal >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                {netTotal >= 0 ? '+' : '-'}{fmtMoney(absNet, currency)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
            style={{
              padding: '8px 22px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              minWidth: 100,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
