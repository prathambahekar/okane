import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Layers, ArrowUpRight, ArrowDownLeft, ReceiptText, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../store';
import type { Expense, GroupedExpense } from '../types';
import { cleanExpenseDescription, getGroupSettlementStatus, groupExpenses, fmtMoney, fmtDate } from '../utils';
import { todayISO } from '../db';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseDetailDrawer from '../components/ExpenseDetailDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { ExpenseFilterBar } from '../components/expense/ExpenseFilterBar';
import { ExpenseTableRow } from '../components/expenses/ExpenseTableRow';
import { ExpenseMobileCard } from '../components/expenses/ExpenseMobileCard';

function getRelativeDateLabel(dateStr: string): string | null {
  const today = todayISO();
  if (dateStr === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  if (dateStr === yesterday) return 'Yesterday';
  return null;
}

function fmtDateWithDay(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return fmtDate(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Expenses({ initialArg, onClearViewArg }: { initialArg?: string; onClearViewArg?: () => void }) {
  const { db, deleteExpense, unsettleExpense, showToast } = useStore();
  const { expenses, settings: { currency } } = db;

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [flowFilter, setFlowFilter] = useState('');
  const [walletFilter, setWalletFilter] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);

  const grouped = useMemo(() => groupExpenses(expenses, db.wallets, db.friends), [expenses, db.wallets, db.friends]);

  const handledArgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }

    const timer = setTimeout(() => {
      const foundExp = expenses.find(e => e.id === initialArg);
      if (foundExp) {
        const foundGe = grouped.find(ge => ge.id === foundExp.id || (foundExp.groupId && ge.groupId === foundExp.groupId) || ge.items?.some(it => it.id === foundExp.id));
        if (foundGe) {
          setSelectedDetailGe(foundGe);
        } else {
          setSearch(foundExp.description);
        }
      } else {
        setSearch(initialArg);
      }
      onClearViewArg?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, expenses, grouped, onClearViewArg]);
  const [showAdd, setShowAdd] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [undoExpId, setUndoExpId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [displayLimit, setDisplayLimit] = useState(60);

  const activeFilterCount = (catFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (walletFilter ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0);

  // O(1) Lookup Maps for instant access during search and rendering
  const walletsMap = useMemo(() => new Map(db.wallets.map(w => [w.id, w])), [db.wallets]);
  const friendsMap = useMemo(() => new Map(db.friends.map(f => [f.id, f])), [db.friends]);
  const categoriesMap = useMemo(() => new Map(db.settings.categories.map(c => [c.name, c])), [db.settings.categories]);
  const settlementsMap = useMemo(() => new Map((db.settlements || []).map(s => [s.id, s])), [db.settlements]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleDateCollapse = useCallback((dateStr: string) => {
    setCollapsedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearch('');
    setCatFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setFlowFilter('');
    setWalletFilter('');
    setSort('date-desc');
  }, []);

  const handleUnsettleConfirm = () => {
    if (!undoExpId) return;
    unsettleExpense(undoExpId);
    setUndoExpId(null);
  };

  const handleDelete = (id: string) => {
    deleteExpense(id);
    setDelId(null);
    showToast('Expense deleted & money restored to wallet');
  };

  const filtered = useMemo(() => {
    let arr = [...grouped];
    if (search) {
      const q = search.toLowerCase().trim();
      arr = arr.filter(ge => {
        if (ge.description.toLowerCase().includes(q)) return true;
        if (cleanExpenseDescription(ge.description).toLowerCase().includes(q)) return true;
        if (ge.category.toLowerCase().includes(q)) return true;
        if (ge.settlementDateRange && ge.settlementDateRange.toLowerCase().includes(q)) return true;

        const walletObj = walletsMap.get(ge.walletId);
        if (walletObj && walletObj.name.toLowerCase().includes(q)) return true;

        if (ge.friendIds.some(fId => {
          const f = friendsMap.get(fId);
          return f && f.name.toLowerCase().includes(q);
        })) return true;

        if (ge.vendorId) {
          const v = friendsMap.get(ge.vendorId);
          if (v && v.name.toLowerCase().includes(q)) return true;
        }

        if (ge.settlementId) {
          const stl = settlementsMap.get(ge.settlementId);
          if (stl) {
            if (stl.note && stl.note.toLowerCase().includes(q)) return true;
            if (stl.date && stl.date.includes(q)) return true;
            if (stl.paymentMethod && stl.paymentMethod.toLowerCase().includes(q)) return true;
            if (String(stl.amount).includes(q)) return true;
            if (stl.originalTotal && String(stl.originalTotal).includes(q)) return true;
            if (stl.friendId) {
              const f = friendsMap.get(stl.friendId);
              if (f && f.name.toLowerCase().includes(q)) return true;
            }
          }
        }

        return ge.items.some(i => {
          if (i.description.toLowerCase().includes(q)) return true;
          if (cleanExpenseDescription(i.description).toLowerCase().includes(q)) return true;
          if (i.notes && i.notes.toLowerCase().includes(q)) return true;
          if (i.category && i.category.toLowerCase().includes(q)) return true;
          if (i.date && i.date.includes(q)) return true;
          if (i.originalDate && i.originalDate.includes(q)) return true;
          if (String(i.amount).includes(q)) return true;
          if (i.originalAmount && String(i.originalAmount).includes(q)) return true;
          if (i.friendId) {
            const f = friendsMap.get(i.friendId);
            if (f && f.name.toLowerCase().includes(q)) return true;
          }
          return false;
        });
      });
    }
    if (catFilter) arr = arr.filter(ge => ge.category === catFilter);
    if (typeFilter) {
      arr = arr.filter(ge =>
        ge.items.some(i => i.type === typeFilter) || (typeFilter === 'for_friend' && ge.isSplit)
      );
    }
    if (statusFilter) {
      if (statusFilter === 'settled') {
        arr = arr.filter(ge => getGroupSettlementStatus(ge).statusKey === 'settled');
      } else if (statusFilter === 'partial') {
        arr = arr.filter(ge => getGroupSettlementStatus(ge).statusKey === 'partial');
      } else if (statusFilter === 'unpaid') {
        arr = arr.filter(ge => getGroupSettlementStatus(ge).statusKey === 'unpaid');
      } else if (statusFilter === 'unsettled') {
        arr = arr.filter(ge => {
          const st = getGroupSettlementStatus(ge).statusKey;
          return st === 'unsettled' || st === 'partial';
        });
      } else {
        arr = arr.filter(ge => getGroupSettlementStatus(ge).statusKey === statusFilter);
      }
    }
    if (flowFilter) arr = arr.filter(ge => ge.flow === flowFilter);
    if (walletFilter) arr = arr.filter(ge => ge.walletId === walletFilter);

    arr.sort((a, b) => {
      switch (sort) {
        case 'date-desc': return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
        case 'date-asc': return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
        case 'amount-desc': return b.totalAmount - a.totalAmount;
        case 'amount-asc': return a.totalAmount - b.totalAmount;
        default: return 0;
      }
    });
    return arr;
  }, [grouped, search, catFilter, typeFilter, statusFilter, flowFilter, walletFilter, sort, walletsMap, friendsMap, settlementsMap]);

  // Group displayed items by date into distinct date cards
  const dateGroups = useMemo(() => {
    const displayed = filtered.slice(0, displayLimit);
    const groups: {
      date: string;
      items: typeof filtered;
      totalOut: number;
      totalIn: number;
    }[] = [];
    const map = new Map<string, typeof groups[0]>();

    for (const ge of displayed) {
      let group = map.get(ge.date);
      if (!group) {
        group = {
          date: ge.date,
          items: [],
          totalOut: 0,
          totalIn: 0,
        };
        map.set(ge.date, group);
        groups.push(group);
      }
      group.items.push(ge);
      if (ge.flow === 'out' && ge.category !== 'Transfer') {
        group.totalOut += ge.totalAmount;
      } else if (ge.flow === 'in' && ge.category !== 'Transfer') {
        group.totalIn += ge.totalAmount;
      }
    }

    return groups;
  }, [filtered, displayLimit]);

  const allCollapsed = useMemo(() => {
    return dateGroups.length > 0 && dateGroups.every(g => !!collapsedDates[g.date]);
  }, [dateGroups, collapsedDates]);

  const hasActiveFilters = Boolean(search || catFilter || typeFilter || statusFilter || walletFilter);

  const toggleAllDateCollapse = useCallback(() => {
    if (allCollapsed) {
      setCollapsedDates({});
    } else {
      const next: Record<string, boolean> = {};
      dateGroups.forEach(g => { next[g.date] = true; });
      setCollapsedDates(next);
    }
  }, [allCollapsed, dateGroups]);

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
        </div>
        <button className="btn btn-primary desktop-only" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Merged Clean Filter & Actions Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {/* Unified Top Control Bar - Strictly Single Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
          {/* Flow Filter Segmented Switch - Takes remaining horizontal space on mobile */}
          <div className="expense-flow-switch">
            <button
              type="button"
              className={`flow-btn ${flowFilter === '' ? 'active' : ''}`}
              onClick={() => setFlowFilter('')}
              title="All Transactions"
              aria-label="All Transactions"
            >
              <Layers size={14} style={{ opacity: flowFilter === '' ? 1 : 0.7 }} />
              <span>All</span>
            </button>

            <button
              type="button"
              className={`flow-btn flow-spent ${flowFilter === 'out' ? 'active' : ''}`}
              onClick={() => setFlowFilter('out')}
              title="Spent (Money Out)"
              aria-label="Spent"
            >
              <ArrowUpRight size={14} style={{ color: 'var(--debit, #ef4444)' }} />
              <span>Spent</span>
            </button>

            <button
              type="button"
              className={`flow-btn flow-received ${flowFilter === 'in' ? 'active' : ''}`}
              onClick={() => setFlowFilter('in')}
              title="Received (Money In)"
              aria-label="Received"
            >
              <ArrowDownLeft size={14} style={{ color: 'var(--credit, #22c55e)' }} />
              <span>Received</span>
            </button>
          </div>

          {/* Right Action: Filter Button (Icon-only on Mobile) */}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 36,
              padding: '0 10px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 600,
              backgroundColor: activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--surface2)',
              color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)',
              border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="Filters & Sorting"
            aria-label="Open Filters"
          >
            <SlidersHorizontal size={15} style={{ color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)' }} />
            <span className="desktop-only">Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  padding: '1px 5px',
                  lineHeight: 1.2,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips Only (Summary text removed) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0 2px' }}>
            {catFilter && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Category: {catFilter}
                <button
                  type="button"
                  onClick={() => setCatFilter('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </span>
            )}
            {typeFilter && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Type: {typeFilter.replace('_', ' ')}
                <button
                  type="button"
                  onClick={() => setTypeFilter('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </span>
            )}
            {walletFilter && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Wallet: {walletsMap.get(walletFilter)?.name || walletFilter}
                <button
                  type="button"
                  onClick={() => setWalletFilter('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </span>
            )}
            {sort !== 'date-desc' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Sort: {sort.replace('-', ' ')}
                <button
                  type="button"
                  onClick={() => setSort('date-desc')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearAllFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Mini Filter Drawer */}
      <ExpenseFilterBar
        search={search}
        setSearch={setSearch}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        activeFilterCount={activeFilterCount}
        catFilter={catFilter}
        setCatFilter={setCatFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        walletFilter={walletFilter}
        setWalletFilter={setWalletFilter}
        sort={sort}
        setSort={setSort}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        flowFilter={flowFilter}
        setFlowFilter={setFlowFilter}
        categories={db.settings.categories}
        wallets={db.wallets}
        onClearAll={handleClearAllFilters}
        filteredCount={filtered.length}
        allCollapsed={allCollapsed}
        toggleAllDateCollapse={toggleAllDateCollapse}
      />

      {filtered.length === 0 ? (
        <div className="card" style={{ border: '1px solid var(--border)' }}>
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div className="empty-state-icon" style={{ opacity: 0.65, color: 'var(--text-3)' }}>
              {hasActiveFilters ? (
                <SlidersHorizontal size={40} />
              ) : flowFilter === 'out' ? (
                <ArrowUpRight size={40} />
              ) : flowFilter === 'in' ? (
                <ArrowDownLeft size={40} />
              ) : (
                <ReceiptText size={40} />
              )}
            </div>
            <div className="empty-state-title" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
              {hasActiveFilters
                ? 'No matching expenses'
                : flowFilter === 'out'
                ? 'No spending yet'
                : flowFilter === 'in'
                ? 'No income yet'
                : 'No expenses yet'}
            </div>
            <p style={{ maxWidth: '340px', margin: '0 auto 20px', color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5 }}>
              {hasActiveFilters
                ? 'No transactions match your active filters or search.'
                : flowFilter === 'out'
                ? 'Track your daily spending and outgoing payments.'
                : flowFilter === 'in'
                ? 'Log incoming payments, refunds, and income.'
                : 'Log daily purchases, bills, and income to start tracking.'}
            </p>
            {hasActiveFilters ? (
              <button className="btn btn-ghost btn-sm" onClick={handleClearAllFilters}>
                Clear Filters
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                <Plus size={15} /> Add Expense
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* List of distinct date cards separated with gap */}
          <div className="expense-date-cards-container">
            {dateGroups.map(group => {
              const isCollapsed = !!collapsedDates[group.date];
              const relativeLabel = getRelativeDateLabel(group.date);

              return (
                <div key={group.date} className="expense-date-card">
                  {/* Collapsible Date Card Header */}
                  <div
                    className={`expense-date-card-header ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}
                    onClick={() => toggleDateCollapse(group.date)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={!isCollapsed}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleDateCollapse(group.date);
                      }
                    }}
                  >
                    <div className="expense-date-header-left">
                      <div className="expense-date-chevron">
                        <ChevronDown size={15} className={`chevron-icon ${isCollapsed ? 'rotated' : ''}`} />
                      </div>
                      <div className="expense-date-label-wrap">
                        <span className="expense-date-title">{fmtDateWithDay(group.date)}</span>
                        {relativeLabel && <span className="badge-relative-date">{relativeLabel}</span>}
                      </div>
                      <span className="expense-date-count">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="expense-date-header-right">
                      {group.totalOut > 0 && (
                        <span className="expense-date-stat debit">-{fmtMoney(group.totalOut, currency)}</span>
                      )}
                      {group.totalIn > 0 && (
                        <span className="expense-date-stat credit">+{fmtMoney(group.totalIn, currency)}</span>
                      )}
                    </div>
                  </div>

                  {/* Card Content when extended */}
                  {!isCollapsed && (
                    <div className="expense-date-card-body">
                      {/* Desktop Table View */}
                      <div className="table-wrapper desktop-only">
                        <table className="modern-tx-table">
                          <thead>
                            <tr>
                              <th style={{ width: '34%', textAlign: 'left' }}>Transaction</th>
                              <th style={{ width: '15%', textAlign: 'left' }}>Amount</th>
                              <th style={{ width: '13%', textAlign: 'left' }}>Type</th>
                              <th style={{ width: '14%', textAlign: 'left' }}>Wallet</th>
                              <th style={{ width: '13%', textAlign: 'left' }}>Status</th>
                              <th style={{ textAlign: 'right', width: '11%', minWidth: '90px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(ge => {
                              const cat = categoriesMap.get(ge.category);
                              const stl = ge.items.reduce<typeof db.settlements[0] | null | undefined>((found, item) => {
                                if (found) return found;
                                if (item.settlementId) return settlementsMap.get(item.settlementId);
                                return undefined;
                              }, null) || (ge.settlementId ? settlementsMap.get(ge.settlementId) : null);
                              const stlWallet = stl?.walletId ? walletsMap.get(stl.walletId) : undefined;
                              const wallet = ge.items.reduce<typeof db.wallets[0] | null | undefined>((found, item) => {
                                if (found) return found;
                                return item.walletId ? walletsMap.get(item.walletId) : null;
                              }, null) || walletsMap.get(ge.walletId) || stlWallet;

                              const groupStatus = getGroupSettlementStatus(ge);

                              return (
                                <ExpenseTableRow
                                  key={ge.id}
                                  ge={ge}
                                  currency={currency}
                                  onEdit={setEditExp}
                                  onDelete={setDelId}
                                  onUndo={setUndoExpId}
                                  groupStatus={groupStatus}
                                  categoryObj={cat}
                                  walletObj={wallet}
                                  friendsMap={friendsMap}
                                  walletsMap={walletsMap}
                                  settlementObj={stl}
                                  onSelectDetail={setSelectedDetailGe}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Expandable Cards View */}
                      <div className="mobile-expense-list mobile-only">
                        {group.items.map(ge => {
                          const cat = categoriesMap.get(ge.category);
                          const stl = ge.items.reduce<typeof db.settlements[0] | null | undefined>((found, item) => {
                            if (found) return found;
                            if (item.settlementId) return settlementsMap.get(item.settlementId);
                            return undefined;
                          }, null) || (ge.settlementId ? settlementsMap.get(ge.settlementId) : null);
                          const stlWallet = stl?.walletId ? walletsMap.get(stl.walletId) : undefined;
                          const wallet = ge.items.reduce<typeof db.wallets[0] | null | undefined>((found, item) => {
                            if (found) return found;
                            return item.walletId ? walletsMap.get(item.walletId) : null;
                          }, null) || walletsMap.get(ge.walletId) || stlWallet;

                          const isExpanded = !!expandedIds[ge.id];
                          const groupStatus = getGroupSettlementStatus(ge);

                          return (
                            <ExpenseMobileCard
                              key={ge.id}
                              ge={ge}
                              currency={currency}
                              isExpanded={isExpanded}
                              onToggleExpand={toggleExpand}
                              onEdit={setEditExp}
                              onDelete={setDelId}
                              onUndo={setUndoExpId}
                              groupStatus={groupStatus}
                              categoryObj={cat}
                              walletObj={wallet}
                              friendsMap={friendsMap}
                              walletsMap={walletsMap}
                              settlementObj={stl}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length > displayLimit && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12.5, padding: '8px 20px' }}
                onClick={() => setDisplayLimit(prev => prev + 60)}
              >
                Showing {displayLimit} of {filtered.length} transactions — Load More
              </button>
            </div>
          )}
        </>
      )}

      {showAdd && <ExpenseModal onClose={() => setShowAdd(false)} />}
      {editExp && <ExpenseModal expense={editExp} onClose={() => setEditExp(null)} />}
      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={(exp) => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={(id) => {
            setSelectedDetailGe(null);
            setDelId(id);
          }}
          currency={currency}
          friends={db.friends}
          wallets={db.wallets}
          categories={db.settings.categories}
          settlements={db.settlements}
        />
      )}
      {delId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Are you sure? This will remove the expense, adjust wallet balances, and update friend accounts."
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
      {undoExpId && (
        <ConfirmDialog
          title="Undo Settlement"
          message="Are you sure you want to undo this settlement? The settled money will be deducted/restored to your wallet, and this friend's debt balance will become unpaid again."
          confirmLabel="Undo Settlement"
          danger
          onConfirm={handleUnsettleConfirm}
          onClose={() => setUndoExpId(null)}
        />
      )}
    </div>
  );
}
