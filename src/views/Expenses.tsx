import { useState, useMemo, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AnimatePresence } from 'motion/react';
import { Plus, ArrowUpRight, ArrowDownLeft, ReceiptText, Filter, X, Layers, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import type { Expense, GroupedExpense } from '../types';
import { cleanExpenseDescription, getGroupSettlementStatus, groupExpenses } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseDetailDrawer from '../components/ExpenseDetailDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { ExpenseFilterBar } from '../components/expense/ExpenseFilterBar';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScrollMargin } from '../hooks/useScrollMargin';
import { ExpenseDateCard } from '../components/expenses/ExpenseDateCard';

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

  const isMobileScreen = useSyncExternalStore(
    (callback) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia('(max-width: 768px)');
      mq.addEventListener('change', callback);
      return () => mq.removeEventListener('change', callback);
    },
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
    () => false
  );

  const grouped = useMemo(() => groupExpenses(expenses, db.wallets, db.friends, db.settlements), [expenses, db.wallets, db.friends, db.settlements]);

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
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [displayLimit, setDisplayLimit] = useState(120);

  const activeFilterCount = (catFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (walletFilter ? 1 : 0) + (sort !== 'date-desc' ? 1 : 0);

  // Listen for top bar filter button trigger
  useEffect(() => {
    const handleOpenFilters = () => {
      setShowFilters(true);
    };
    window.addEventListener('app-open-filters', handleOpenFilters);
    return () => window.removeEventListener('app-open-filters', handleOpenFilters);
  }, []);

  // Sync active filter count with top bar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-filter-count-update', {
      detail: { view: 'expenses', count: activeFilterCount }
    }));
  }, [activeFilterCount]);

  // O(1) Lookup Maps for instant access during search and rendering
  const walletsMap = useMemo(() => new Map(db.wallets.map(w => [w.id, w])), [db.wallets]);
  const friendsMap = useMemo(() => new Map(db.friends.map(f => [f.id, f])), [db.friends]);
  const categoriesMap = useMemo(() => new Map(db.settings.categories.map(c => [c.name, c])), [db.settings.categories]);
  const settlementsMap = useMemo(() => new Map((db.settlements || []).map(s => [s.id, s])), [db.settlements]);

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

  // Virtualization setup for Expenses view
  const listContainerRef = useRef<HTMLDivElement>(null);
  const scrollMargin = useScrollMargin(listContainerRef, [
    search,
    catFilter,
    typeFilter,
    statusFilter,
    flowFilter,
    walletFilter,
    sort,
    dateGroups.length,
  ]);

  const virtualizer = useVirtualizer({
    count: dateGroups.length,
    getScrollElement: () => listContainerRef.current?.closest<HTMLElement>('.main-content') || document.querySelector<HTMLElement>('.main-content'),
    estimateSize: (index) => {
      const group = dateGroups[index];
      if (!group || collapsedDates[group.date]) return 56;
      return 56 + group.items.length * (isMobileScreen ? 76 : 52);
    },
    getItemKey: (index) => {
      const group = dateGroups[index];
      return group?.date ? `dg-${group.date}-${index}` : `dg-${index}`;
    },
    overscan: 4,
    scrollMargin,
    gap: 12,
    paddingEnd: 90,
  });

  // Seamless auto-pagination as user approaches the bottom of loaded set
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualIndex = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

  useEffect(() => {
    if (lastVirtualIndex < 0) return;
    if (lastVirtualIndex >= dateGroups.length - 2 && filtered.length > displayLimit) {
      setDisplayLimit(prev => Math.min(filtered.length, prev + 80));
    }
  }, [lastVirtualIndex, dateGroups.length, filtered.length, displayLimit]);

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
        </div>
        <div className="desktop-search-filter-wrap desktop-only">
          <DesktopSearchBar placeholder="Search expenses..." defaultTab="expenses" />
          <button
            type="button"
            id="desktop-filter-expense-btn"
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilters(true)}
            title={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'Filters'}
            aria-label="Filter expenses"
            style={{
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: 'var(--radius-full)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
              background: activeFilterCount > 0 ? 'var(--surface2)' : undefined,
              borderColor: activeFilterCount > 0 ? 'var(--border2)' : undefined,
              color: 'var(--text)',
            }}
          >
            <Filter size={17} strokeWidth={2} />
            {activeFilterCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--text)',
                  color: 'var(--surface)',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="page-header-actions desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Merged Clean Filter & Actions Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {/* Unified Single-Row Flow & Filter Control Bar (Takes Full Horizontal Space) */}
        <div className="expense-flow-switch" style={{ width: '100%' }}>
          <button
            type="button"
            className={`flow-btn ${flowFilter === '' ? 'active' : ''}`}
            onClick={() => setFlowFilter('')}
            title="All Transactions"
            aria-label="All Transactions"
          >
            <Layers size={16} style={{ flexShrink: 0, opacity: flowFilter === '' ? 1 : 0.7 }} />
            <span>All</span>
          </button>

          <button
            type="button"
            className={`flow-btn flow-spent ${flowFilter === 'out' ? 'active' : ''}`}
            onClick={() => setFlowFilter('out')}
            title="Spent (Money Out)"
            aria-label="Spent"
          >
            <ArrowUpRight size={16} style={{ flexShrink: 0, color: flowFilter === 'out' ? 'inherit' : 'var(--debit)' }} />
            <span>Spent</span>
          </button>

          <button
            type="button"
            className={`flow-btn flow-received ${flowFilter === 'in' ? 'active' : ''}`}
            onClick={() => setFlowFilter('in')}
            title="Received (Money In)"
            aria-label="Received"
          >
            <ArrowDownLeft size={16} style={{ flexShrink: 0, color: flowFilter === 'in' ? 'inherit' : 'var(--credit)' }} />
            <span>Received</span>
          </button>
        </div>

        {/* Active Filter Chips Only (Accent Themed) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 2px' }}>
            {catFilter && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Category:</span>
                <span className="app-filter-chip-value">{catFilter}</span>
                <button
                  type="button"
                  onClick={() => setCatFilter('')}
                  className="app-filter-chip-remove"
                  title="Remove category filter"
                  aria-label="Remove category filter"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}
            {typeFilter && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Type:</span>
                <span className="app-filter-chip-value">{typeFilter.replace('_', ' ')}</span>
                <button
                  type="button"
                  onClick={() => setTypeFilter('')}
                  className="app-filter-chip-remove"
                  title="Remove type filter"
                  aria-label="Remove type filter"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}
            {walletFilter && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Wallet:</span>
                <span className="app-filter-chip-value">{walletsMap.get(walletFilter)?.name || walletFilter}</span>
                <button
                  type="button"
                  onClick={() => setWalletFilter('')}
                  className="app-filter-chip-remove"
                  title="Remove wallet filter"
                  aria-label="Remove wallet filter"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}
            {sort !== 'date-desc' && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Sort:</span>
                <span className="app-filter-chip-value">{sort.replace('-', ' ')}</span>
                <button
                  type="button"
                  onClick={() => setSort('date-desc')}
                  className="app-filter-chip-remove"
                  title="Reset sort"
                  aria-label="Reset sort"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="app-filter-clear-btn"
              title="Clear all filters"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
              <span>Clear all</span>
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
        <div className="card empty-state-card">
          <div className="empty-state">
            <div className="empty-state-icon-badge">
              {hasActiveFilters ? (
                <Filter size={24} strokeWidth={1.8} />
              ) : flowFilter === 'out' ? (
                <ArrowUpRight size={24} strokeWidth={1.8} />
              ) : flowFilter === 'in' ? (
                <ArrowDownLeft size={24} strokeWidth={1.8} />
              ) : (
                <ReceiptText size={24} strokeWidth={1.8} />
              )}
            </div>
            <div className="empty-state-title">
              {hasActiveFilters
                ? 'No matching expenses'
                : flowFilter === 'out'
                ? 'No spending yet'
                : flowFilter === 'in'
                ? 'No income yet'
                : 'No expenses yet'}
            </div>
            <p className="empty-state-desc">
              {hasActiveFilters
                ? 'No transactions match your active filters or search.'
                : flowFilter === 'out'
                ? 'Track your daily spending and outgoing payments.'
                : flowFilter === 'in'
                ? 'Log incoming payments, refunds, and income.'
                : 'Log daily purchases, bills, and income to start tracking.'}
            </p>
            {hasActiveFilters ? (
              <button className="btn btn-secondary btn-sm" onClick={handleClearAllFilters}>
                Clear Filters
              </button>
            ) : (
              <button className="empty-state-btn" onClick={() => setShowAdd(true)}>
                <Plus size={16} strokeWidth={2.2} />
                <span>Add Expense</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* List of distinct date cards rendered via virtualizer */}
          <div
            ref={listContainerRef}
            className="expense-date-cards-container"
            style={{
              position: 'relative',
              height: `${virtualizer.getTotalSize()}px`,
              display: 'block',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const group = dateGroups[virtualItem.index];
              if (!group) return null;
              const isCollapsed = !!collapsedDates[group.date];

              return (
                <div
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                  }}
                >
                  <ExpenseDateCard
                    group={group}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleDateCollapse}
                    currency={currency}
                    isMobileScreen={isMobileScreen}
                    categoriesMap={categoriesMap}
                    settlementsMap={settlementsMap}
                    walletsMap={walletsMap}
                    friendsMap={friendsMap}
                    onSelectDetail={setSelectedDetailGe}
                    onEdit={setEditExp}
                    onDelete={setDelId}
                    onUndo={setUndoExpId}
                    getGroupSettlementStatus={getGroupSettlementStatus}
                  />
                </div>
              );
            })}
          </div>

          {filtered.length > displayLimit && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 'var(--fs-xs)', padding: '8px 20px', borderRadius: 'var(--radius-md)' }}
                onClick={() => setDisplayLimit(prev => Math.min(filtered.length, prev + 120))}
              >
                Showing {displayLimit} of {filtered.length} transactions — Load More
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 'var(--fs-xs)', padding: '8px 16px', borderRadius: 'var(--radius-md)' }}
                onClick={() => setDisplayLimit(filtered.length)}
              >
                Show All
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showAdd && <ExpenseModal key="add-modal" onClose={() => setShowAdd(false)} />}
        {editExp && <ExpenseModal key="edit-modal" expense={editExp} onClose={() => setEditExp(null)} />}
        {selectedDetailGe && (
          <ExpenseDetailDrawer
            key="detail-drawer"
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
            onUndo={(id) => {
              setSelectedDetailGe(null);
              setUndoExpId(id);
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
            key="delete-dialog"
            title="Delete Expense"
            message="Removes this expense and restores the amount to your wallet."
            confirmLabel="Delete"
            danger
            onConfirm={() => handleDelete(delId)}
            onClose={() => setDelId(null)}
          />
        )}
        {undoExpId && (
          <ConfirmDialog
            key="undo-dialog"
            title="Undo Settlement"
            message="Restores your wallet balance and marks this balance as unpaid."
            confirmLabel="Undo Settlement"
            danger
            onConfirm={handleUnsettleConfirm}
            onClose={() => setUndoExpId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
