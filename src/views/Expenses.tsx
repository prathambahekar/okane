import { useState, useMemo, useCallback } from 'react';
import { Plus, Layers, ArrowUpRight, ArrowDownLeft, ReceiptText } from 'lucide-react';
import { useStore } from '../store';
import type { Expense } from '../types';
import { cleanExpenseDescription, getGroupSettlementStatus, groupExpenses } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ExpenseFilterBar } from '../components/expense/ExpenseFilterBar';
import { ExpenseTableRow } from '../components/expenses/ExpenseTableRow';
import { ExpenseMobileCard } from '../components/expenses/ExpenseMobileCard';

export default function Expenses() {
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

  const grouped = useMemo(() => groupExpenses(expenses, db.wallets, db.friends), [expenses, db.wallets, db.friends]);

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

  const dateGroupInfo = useMemo(() => {
    const groupMap: Record<string, number> = {};
    const isFirstMap: Record<string, boolean> = {};
    let currentGroup = 0;
    let prevDate: string | null = null;

    filtered.forEach((ge) => {
      if (prevDate !== null && ge.date !== prevDate) {
        currentGroup++;
        isFirstMap[ge.id] = true;
      } else {
        isFirstMap[ge.id] = prevDate === null;
      }
      groupMap[ge.id] = currentGroup % 2;
      prevDate = ge.date;
    });

    return { groupMap, isFirstMap };
  }, [filtered]);

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

      {/* Spent / Received Main Tabs */}
      <div className="tab-list" style={{ marginBottom: 14 }}>
        <button className={`tab-btn ${flowFilter === '' ? 'active' : ''}`} onClick={() => setFlowFilter('')}>
          <Layers size={14} /> All
        </button>
        <button className={`tab-btn ${flowFilter === 'out' ? 'active' : ''}`} onClick={() => setFlowFilter('out')}>
          <ArrowUpRight size={14} /> Spent
        </button>
        <button className={`tab-btn ${flowFilter === 'in' ? 'active' : ''}`} onClick={() => setFlowFilter('in')}>
          <ArrowDownLeft size={14} /> Received
        </button>
      </div>

      {/* Filter & Search Toolbar Sub-component */}
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
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ReceiptText size={36} /></div>
            <div className="empty-state-title">No expenses found</div>
            <p>Try adjusting your filters or add a new expense.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Expense</button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-wrapper desktop-only">
              <table className="modern-tx-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%', textAlign: 'left' }}>Transaction</th>
                    <th style={{ width: '13%', textAlign: 'left' }}>Amount</th>
                    <th style={{ width: '16%', textAlign: 'left' }}>Type</th>
                    <th style={{ width: '18%', textAlign: 'left' }}>Wallet</th>
                    <th style={{ width: '19%', textAlign: 'left' }}>Status</th>
                    <th style={{ textAlign: 'right', width: '12%', minWidth: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let prevDateStr = '';
                    const displayed = filtered.slice(0, displayLimit);
                    return displayed.map(ge => {
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

                      const isNewDateHeader = sort.startsWith('date') && ge.date !== prevDateStr;
                      if (isNewDateHeader) {
                        prevDateStr = ge.date;
                      }

                      const dateExpenses = isNewDateHeader ? filtered.filter(x => x.date === ge.date) : [];
                      const dateOutSum = isNewDateHeader ? dateExpenses.reduce((sum, x) => (x.flow === 'out' && x.category !== 'Transfer') ? sum + x.totalAmount : sum, 0) : 0;
                      const dateInSum = isNewDateHeader ? dateExpenses.reduce((sum, x) => (x.flow === 'in' && x.category !== 'Transfer') ? sum + x.totalAmount : sum, 0) : 0;
                      const isDateCollapsed = sort.startsWith('date') && !!collapsedDates[ge.date];

                      return (
                        <ExpenseTableRow
                          key={ge.id}
                          ge={ge}
                          currency={currency}
                          isExpanded={isExpanded}
                          onToggleExpand={toggleExpand}
                          onEdit={setEditExp}
                          onDelete={setDelId}
                          onUndo={setUndoExpId}
                          groupStatus={groupStatus}
                          isNewDateHeader={isNewDateHeader}
                          isDateCollapsed={isDateCollapsed}
                          onToggleDateCollapse={toggleDateCollapse}
                          dateExpensesCount={dateExpenses.length}
                          dateOutSum={dateOutSum}
                          dateInSum={dateInSum}
                          categoryObj={cat}
                          walletObj={wallet}
                          friendsMap={friendsMap}
                          walletsMap={walletsMap}
                          settlementObj={stl}
                        />
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Expandable Cards View */}
            <div className="mobile-expense-list mobile-only">
              {filtered.slice(0, displayLimit).map(ge => {
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
                const isEvenGroup = dateGroupInfo.groupMap[ge.id] === 0;
                const isFirstOfDate = dateGroupInfo.isFirstMap[ge.id];
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
                    isEvenGroup={isEvenGroup}
                    isFirstOfDate={isFirstOfDate}
                    categoryObj={cat}
                    walletObj={wallet}
                    friendsMap={friendsMap}
                    walletsMap={walletsMap}
                    settlementObj={stl}
                  />
                );
              })}
            </div>

            {filtered.length > displayLimit && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12.5, padding: '6px 18px' }}
                  onClick={() => setDisplayLimit(prev => prev + 60)}
                >
                  Showing {displayLimit} of {filtered.length} transactions — Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && <ExpenseModal onClose={() => setShowAdd(false)} />}
      {editExp && <ExpenseModal expense={editExp} onClose={() => setEditExp(null)} />}
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
