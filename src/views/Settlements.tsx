import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Handshake,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  Receipt,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  X,
  Calendar,
  Users,
  Filter,
  LayoutList,
  List
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, Settlement, Expense } from '../types';
import { friendBalance, todayISO } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle } from '../utils';
import SettleModal from '../components/SettleModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SettlementDetailModal from '../components/SettlementDetailModal';
import CategoryIcon from '../components/CategoryIcon';

export type SettlementTimeframe = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all';

export default function Settlements() {
  const { db, deleteSettlement, showToast } = useStore();
  const settlements = useMemo(() => db?.settlements || [], [db?.settlements]);
  const settings = db?.settings || {};
  const currency = settings?.currency || 'INR';
  const categories = settings?.categories || [];
  const friends = useMemo(() => db?.friends || [], [db?.friends]);
  const expenses = useMemo(() => db?.expenses || [], [db?.expenses]);
  const wallets = db?.wallets || [];

  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);

  // Timeframe, Search & Filter State
  const [timeframe, setTimeframe] = useState<SettlementTimeframe>('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendFilter, setFriendFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'paid'>('all');
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('compact');
  const [isPendingExpanded, setIsPendingExpanded] = useState<boolean>(true);

  // Expanded settlement rows state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const targetS = settlements.find(x => x && x.id === delId);
  const targetF = targetS ? friends.find(f => f && f.id === targetS.friendId) : null;
  const targetW = targetS?.walletId ? wallets.find(w => w && w.id === targetS.walletId) : null;
  const targetWName = targetW?.name || targetS?.paymentMethod || 'wallet';

  const friendsWithUnsettled = friends.filter(f =>
    f && expenses.some(e => e && e.friendId === f.id && !e.settled && e.type !== 'personal')
  );

  const sorted = useMemo(
    () => [...settlements].filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)),
    [settlements]
  );

  // Filter settlements by selected Timeframe (Default: Current Month)
  const timeframeFiltered = useMemo(() => {
    if (timeframe === 'all') return sorted;

    const today = todayISO();
    const curMonth = today.slice(0, 7);
    const curYear = today.slice(0, 4);

    if (timeframe === 'this_month') {
      return sorted.filter(s => s && s.date && s.date.slice(0, 7) === curMonth);
    }

    if (timeframe === 'last_month') {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const lastMonth = d.toISOString().slice(0, 7);
      return sorted.filter(s => s && s.date && s.date.slice(0, 7) === lastMonth);
    }

    if (timeframe === 'last_3_months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      const threeMonthsAgo = d.toISOString().slice(0, 10);
      return sorted.filter(s => s && s.date && s.date >= threeMonthsAgo);
    }

    if (timeframe === 'this_year') {
      return sorted.filter(s => s && s.date && s.date.slice(0, 4) === curYear);
    }

    return sorted;
  }, [sorted, timeframe]);

  // Pre-calculate mapped settled expenses per settlement for fast lookup
  const settlementExpensesMap = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    const expById = new Map(expenses.filter(Boolean).map(e => [e.id, e]));

    sorted.forEach(s => {
      if (!s) return;
      const idsSet = new Set(Array.isArray(s.expenseIds) ? s.expenseIds : []);
      const matched = expenses.filter(e => e && (idsSet.has(e.id) || (e.settlementId && e.settlementId === s.id)));
      
      // Fallback: if ids match from expById directly
      if (matched.length === 0 && Array.isArray(s.expenseIds)) {
        s.expenseIds.forEach(id => {
          const exp = expById.get(id);
          if (exp) matched.push(exp);
        });
      }
      map[s.id] = matched;
    });
    return map;
  }, [sorted, expenses]);

  // Overall KPI Summary for selected Timeframe
  const kpiSummary = useMemo(() => {
    let received = 0;
    let paid = 0;
    timeframeFiltered.forEach(s => {
      if (!s) return;
      const amt = Number(s.amount) || 0;
      if (amt >= 0) received += amt;
      else paid += Math.abs(amt);
    });
    return { received, paid, totalCount: timeframeFiltered.length };
  }, [timeframeFiltered]);

  // Filtered settlements list
  const filteredSettlements = useMemo(() => {
    return timeframeFiltered.filter(s => {
      if (!s) return false;
      const friend = friends.find(f => f && f.id === s.friendId);
      const friendName = (friend?.name || '').toLowerCase();
      const isReceived = (Number(s.amount) || 0) >= 0;

      // Friend filter
      if (friendFilter !== 'all' && s.friendId !== friendFilter) return false;

      // Type filter
      if (typeFilter === 'received' && !isReceived) return false;
      if (typeFilter === 'paid' && isReceived) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFriend = friendName.includes(q);
        const matchesNote = (s.note || '').toLowerCase().includes(q);
        const matchesMethod = (s.paymentMethod || '').toLowerCase().includes(q);
        const matchedExpenses = settlementExpensesMap[s.id] || [];
        const matchesExpenses = matchedExpenses.some(
          e => (e?.description || '').toLowerCase().includes(q) || (e?.category || '').toLowerCase().includes(q)
        );

        if (!matchesFriend && !matchesNote && !matchesMethod && !matchesExpenses) {
          return false;
        }
      }

      return true;
    });
  }, [timeframeFiltered, friendFilter, typeFilter, searchQuery, friends, settlementExpensesMap]);

  const dateGroupInfo = useMemo(() => {
    const groupMap: Record<string, number> = {};
    const isFirstMap: Record<string, boolean> = {};
    let currentGroup = 0;
    let prevDate: string | null = null;

    filteredSettlements.forEach(s => {
      const sDate = s.date || '';
      if (prevDate !== null && sDate !== prevDate) {
        currentGroup++;
        isFirstMap[s.id] = true;
      } else {
        isFirstMap[s.id] = prevDate === null;
      }
      groupMap[s.id] = currentGroup % 2;
      prevDate = sDate;
    });

    return { groupMap, isFirstMap };
  }, [filteredSettlements]);

  const handleDelete = (id: string) => {
    deleteSettlement(id);
    setDelId(null);
    showToast('Settlement undone. Money restored to wallet.');
  };

  return (
    <div className="view-container">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Settlements</h1>
        </div>
      </div>

      {/* Pending settlements section */}
      {friendsWithUnsettled.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            onClick={() => setIsPendingExpanded(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isPendingExpanded ? 12 : 0,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Handshake size={16} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Pending Settlements
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                {friendsWithUnsettled.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 4, width: 28, height: 28, borderRadius: 6, color: 'var(--text-3)' }}
              onClick={(e) => {
                e.stopPropagation();
                setIsPendingExpanded(prev => !prev);
              }}
              title={isPendingExpanded ? "Collapse pending settlements" : "Expand pending settlements"}
            >
              {isPendingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isPendingExpanded && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
            {friendsWithUnsettled.map(f => {
              if (!f) return null;
              const unsettledCount = expenses.filter(
                e => e && e.friendId === f.id && !e.settled && e.type !== 'personal'
              ).length;
              const bal = friendBalance(db, f.id) || { net: 0 };
              const netVal = bal.net || 0;
              const owesYou = netVal > 0.004;
              const youOwe = netVal < -0.004;

              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 12px',
                    background: 'var(--surface2)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      className="avatar"
                      style={{
                        ...getAvatarStyle(f.color),
                        width: 34,
                        height: 34,
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    >
                      {friendInitial(f.name, f.avatarNumber)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                        }}
                      >
                        {f.name || 'Friend'}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          flexWrap: 'nowrap',
                          overflow: 'hidden',
                          marginTop: 3,
                        }}
                      >
                        {owesYou ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--credit)',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <ArrowDownLeft size={12} /> {fmtMoney(netVal, currency)}
                          </span>
                        ) : youOwe ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--debit)',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <ArrowUpRight size={12} /> {fmtMoney(Math.abs(netVal), currency)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            Net 0
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.6 }}>•</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {unsettledCount} unsettled
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 8,
                      gap: 4,
                      background: 'var(--accent-gradient)',
                      color: 'var(--accent-contrast, #ffffff)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      height: 28,
                    }}
                    onClick={() => setSettleFriend(f)}
                  >
                    <Handshake size={13} /> Settle
                  </button>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* History Card Container */}
      <div className="card" style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
        {/* Header */}
        <div className="settlement-history-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} style={{ color: 'var(--accent)' }} />
            <span>Settlement History</span>
            <span className="settlement-count-badge">
              {filteredSettlements.length} transactions
            </span>
          </div>

          {/* Timeframe Date Filter Button on Right Side */}
          <div className="settlement-timeframe-btn-wrap" title="Filter timeframe">
            <Calendar size={13} className="timeframe-icon" />
            <span className="timeframe-label">
              {timeframe === 'this_month'
                ? 'This Month'
                : timeframe === 'last_month'
                ? 'Last Month'
                : timeframe === 'last_3_months'
                ? 'Last 3 Months'
                : timeframe === 'this_year'
                ? 'This Year'
                : 'All Time'}
            </span>
            <ChevronDown size={12} className="timeframe-chevron" />
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value as SettlementTimeframe)}
              className="settlement-timeframe-select"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="this_year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Summary KPI Cards inside History section */}
        {sorted.length > 0 && (
          <div className="settlement-section-padding">
            {/* 3 KPI Cards / Mobile Strip in 1 Row */}
            <div className="settlement-stats-grid">
              <div className="settlement-stat-card">
                <div className="settlement-stat-icon received">
                  <TrendingUp size={16} />
                </div>
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Received</div>
                  <div className="settlement-stat-value credit">
                    +{fmtMoney(kpiSummary.received, currency)}
                  </div>
                </div>
              </div>

              <div className="settlement-stat-card">
                <div className="settlement-stat-icon paid">
                  <TrendingDown size={16} />
                </div>
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Paid</div>
                  <div className="settlement-stat-value debit">
                    -{fmtMoney(kpiSummary.paid, currency)}
                  </div>
                </div>
              </div>

              <div className="settlement-stat-card">
                <div className="settlement-stat-icon total">
                  <Handshake size={16} />
                </div>
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Total</div>
                  <div className="settlement-stat-value">
                    {kpiSummary.totalCount} items
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar - ALL IN 1 ROW */}
            <div className="settlement-toolbar-row">
              {/* Search Bar */}
              <div className="settlement-search-wrap">
                <Search size={14} className="settlement-search-icon" />
                <input
                  type="text"
                  className="settlement-search-input"
                  placeholder="Search settlements..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 18,
                      height: 18,
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Compact vs Detailed */}
              <div className="settlement-view-toggle" title="Switch View Mode">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'detailed' ? 'active' : ''}`}
                  onClick={() => setViewMode('detailed')}
                  title="Detailed View"
                >
                  <LayoutList size={14} />
                  <span className="view-toggle-label">Detailed</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
                  onClick={() => setViewMode('compact')}
                  title="Compact View"
                >
                  <List size={14} />
                  <span className="view-toggle-label">Compact</span>
                </button>
              </div>

              {/* Friend Filter */}
              <div className={`settlement-filter-btn-wrap ${friendFilter !== 'all' ? 'active' : ''}`} title="Filter by Friend">
                <Users size={15} className="filter-btn-icon" />
                <span className="filter-btn-label">
                  {friendFilter === 'all' ? 'All Friends' : (friends.find(f => f?.id === friendFilter)?.name || 'Friend')}
                </span>
                <ChevronDown size={12} className="filter-btn-chevron" />
                <select
                  className="settlement-select-overlay"
                  value={friendFilter}
                  onChange={e => setFriendFilter(e.target.value)}
                >
                  <option value="all">All Friends</option>
                  {friends.map(f => f && (
                    <option key={f.id} value={f.id}>
                      {f.name || 'Friend'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className={`settlement-filter-btn-wrap ${typeFilter !== 'all' ? 'active' : ''}`} title="Filter by Type">
                {typeFilter === 'received' ? (
                  <TrendingUp size={15} className="filter-btn-icon credit" />
                ) : typeFilter === 'paid' ? (
                  <TrendingDown size={15} className="filter-btn-icon debit" />
                ) : (
                  <Filter size={15} className="filter-btn-icon" />
                )}
                <span className="filter-btn-label">
                  {typeFilter === 'all' ? 'All Types' : typeFilter === 'received' ? 'Received (+)' : 'Paid (-)'}
                </span>
                <ChevronDown size={12} className="filter-btn-chevron" />
                <select
                  className="settlement-select-overlay"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as 'all' | 'received' | 'paid')}
                >
                  <option value="all">All Types</option>
                  <option value="received">Received (+)</option>
                  <option value="paid">Paid (-)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Handshake size={36} />
            </div>
            <div className="empty-state-title">No settlements yet</div>
            <p>When you settle up with friends, detailed settlement records will appear here.</p>
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state-title">No matching settlements</div>
            <p>Try adjusting your search query or filters.</p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery('');
                setFriendFilter('all');
                setTypeFilter('all');
              }}
              style={{ marginTop: 8 }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-wrapper desktop-only">
              <table className={`data-table ${viewMode === 'compact' ? 'compact-table' : ''}`}>
                <thead>
                  <tr>
                    <th>Friend & Direction</th>
                    <th>Settlement Amount</th>
                    <th>Date</th>
                    <th>Wallet / Method</th>
                    <th>Settled Expenses</th>
                    <th>Note</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSettlements.map(s => {
                    if (!s) return null;
                    const friend = friends.find(f => f && f.id === s.friendId);
                    const wallet = wallets.find(w => w && w.id === s.walletId);
                    const walletName = wallet?.name || s.paymentMethod;
                    const isEvenGroup = dateGroupInfo.groupMap[s.id] === 0;
                    const isFirstOfDate = dateGroupInfo.isFirstMap[s.id];
                    const isExpanded = expandedIds.has(s.id);
                    const amtVal = Number(s.amount) || 0;
                    const isReceived = amtVal >= 0;
                    const matchedExpenses = settlementExpensesMap[s.id] || [];
                    const friendFirstName = (friend?.name || 'Friend').split(' ')[0] || 'Friend';

                    const rowClass = `${isEvenGroup ? 'date-row-even' : 'date-row-odd'}${
                      isFirstOfDate ? ' date-row-first' : ''
                    }`;

                    return (
                      <React.Fragment key={s.id}>
                        <tr className={rowClass} style={{ cursor: 'pointer' }}>
                          <td>
                            {friend ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="avatar avatar-sm" style={getAvatarStyle(friend.color)}>
                                  {friendInitial(friend.name, friend.avatarNumber)}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>{friend.name}</div>
                                  <div style={{ marginTop: 2 }}>
                                    {isReceived ? (
                                      <span className="settlement-badge-received">
                                        <ArrowDownLeft size={11} /> Received from {friendFirstName}
                                      </span>
                                    ) : (
                                      <span className="settlement-badge-paid">
                                        <ArrowUpRight size={11} /> Paid to {friendFirstName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-3)' }}>Deleted friend</span>
                            )}
                          </td>

                          {/* Settlement Amount */}
                          <td>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: isReceived ? 'var(--credit)' : 'var(--debit)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {isReceived ? '+' : '-'}{fmtMoney(Math.abs(amtVal), currency)}
                            </div>
                            {s.originalTotal && s.originalTotal > Math.abs(amtVal) ? (
                              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                                og {fmtMoney(s.originalTotal, currency)} • {fmtMoney(s.remainingAmount || 0, currency)} left
                              </div>
                            ) : null}
                          </td>

                          {/* Date */}
                          <td style={{ color: 'var(--text-2)', fontSize: 12.5, fontWeight: 500 }}>
                            {fmtDate(s.date)}
                          </td>

                          {/* Wallet / Payment Method */}
                          <td>
                            {wallet ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="cat-dot" style={{ background: wallet.color }} />
                                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{wallet.name}</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{walletName || '—'}</span>
                            )}
                          </td>

                          {/* Expenses Column - Interactive Button */}
                          <td>
                            <button
                              type="button"
                              className="settlement-exp-btn"
                              onClick={e => {
                                e.stopPropagation();
                                toggleExpand(s.id);
                              }}
                              title="Click to view settled expenses"
                            >
                              <Receipt size={13} />
                              <span>
                                {matchedExpenses.length} expense{matchedExpenses.length !== 1 ? 's' : ''}
                              </span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </td>

                          {/* Note */}
                          <td
                            style={{
                              fontSize: 12,
                              color: 'var(--text-2)',
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.note || '—'}
                          </td>

                          {/* Action Buttons */}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  setDetailSettlement(s);
                                }}
                                title="View settlement details & breakdown"
                                style={{ padding: '4px 8px', fontSize: 11.5, gap: 4 }}
                              >
                                <Eye size={13} /> Details
                              </button>
                              <button
                                className="btn btn-undo btn-sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  setDelId(s.id);
                                }}
                                title="Undo settlement"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11.5,
                                  gap: 4,
                                }}
                              >
                                <RotateCcw size={13} /> Undo
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Detail Accordion Row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="settlement-expanded-cell">
                              <div className="settlement-expanded-box">
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 10,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                      Expenses Settled in this Transaction ({matchedExpenses.length})
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                                    Net Settled: <strong style={{ color: isReceived ? 'var(--credit)' : 'var(--debit)' }}>{fmtMoney(Math.abs(amtVal), currency)}</strong>
                                  </div>
                                </div>

                                {matchedExpenses.length === 0 ? (
                                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                                    No linked expense items found (they may have been deleted or archived).
                                  </div>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                                    {matchedExpenses.map(exp => {
                                      if (!exp) return null;
                                      const cat = categories.find(c => c && c.name === exp.category);
                                      const isForFriend = exp.type === 'for_friend';
                                      return (
                                        <div key={exp.id} className="settlement-item-card">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <div
                                              style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 6,
                                                background: cat?.color ? `${cat.color}18` : 'var(--accent-soft)',
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: cat?.color || 'var(--accent)',
                                                flexShrink: 0,
                                              }}
                                            >
                                              <CategoryIcon category={exp.category} size={14} />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                              <div
                                                style={{
                                                  fontWeight: 600,
                                                  color: 'var(--text)',
                                                  whiteSpace: 'nowrap',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                }}
                                              >
                                                {exp.description || 'Expense'}
                                              </div>
                                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                                {fmtDate(exp.date)} • {isForFriend ? 'You paid' : 'Friend paid'}
                                              </div>
                                            </div>
                                          </div>

                                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 700, color: isForFriend ? 'var(--credit)' : 'var(--debit)' }}>
                                              {isForFriend ? '+' : '-'}{fmtMoney(Number(exp.amount) || 0, currency)}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Compact vs Detailed Cards */}
            {viewMode === 'compact' ? (
              <div className="settlement-compact-list mobile-only">
                {filteredSettlements.map(s => {
                  if (!s) return null;
                  const friend = friends.find(f => f && f.id === s.friendId);
                  const wallet = wallets.find(w => w && w.id === s.walletId);
                  const walletName = wallet?.name || s.paymentMethod;
                  const amtVal = Number(s.amount) || 0;
                  const isReceived = amtVal >= 0;

                  return (
                    <div
                      key={s.id}
                      className="settlement-compact-card"
                      onClick={() => setDetailSettlement(s)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        {friend && (
                          <div
                            className="avatar avatar-xs"
                            style={{ ...getAvatarStyle(friend.color), width: 28, height: 28, fontSize: 11, flexShrink: 0 }}
                          >
                            {friendInitial(friend.name, friend.avatarNumber)}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {friend ? friend.name : 'Deleted friend'}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                            {fmtDate(s.date)}{walletName ? ` · ${walletName}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: isReceived ? 'var(--credit)' : 'var(--debit)' }}>
                            {isReceived ? '+' : '-'}{fmtMoney(Math.abs(amtVal), currency)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-undo btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDelId(s.id);
                          }}
                          title="Undo settlement"
                          style={{ padding: '2px 6px', fontSize: 10.5, height: 24 }}
                        >
                          <RotateCcw size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="settlement-card-list mobile-only">
                {filteredSettlements.map(s => {
                  if (!s) return null;
                  const friend = friends.find(f => f && f.id === s.friendId);
                  const wallet = wallets.find(w => w && w.id === s.walletId);
                  const walletName = wallet?.name || s.paymentMethod;
                  const isExpanded = expandedIds.has(s.id);
                  const amtVal = Number(s.amount) || 0;
                  const isReceived = amtVal >= 0;
                  const matchedExpenses = settlementExpensesMap[s.id] || [];

                  return (
                    <div key={s.id} className="settlement-card">
                      {/* Header Row: Friend Avatar & Name + Amount */}
                      <div className="settlement-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          {friend && (
                            <div
                              className="avatar avatar-sm"
                              style={{ ...getAvatarStyle(friend.color), width: 28, height: 28, fontSize: 11, flexShrink: 0 }}
                            >
                              {friendInitial(friend.name, friend.avatarNumber)}
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {friend ? friend.name : 'Deleted friend'}
                            </div>
                            <div style={{ marginTop: 1 }}>
                              {isReceived ? (
                                <span className="settlement-badge-received" style={{ fontSize: 9.5, padding: '1px 6px' }}>
                                  <ArrowDownLeft size={9} /> Received
                                </span>
                              ) : (
                                <span className="settlement-badge-paid" style={{ fontSize: 9.5, padding: '1px 6px' }}>
                                  <ArrowUpRight size={9} /> Paid
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontWeight: 800, fontSize: 14, color: isReceived ? 'var(--credit)' : 'var(--debit)', whiteSpace: 'nowrap' }}>
                          {isReceived ? '+' : '-'}{fmtMoney(Math.abs(amtVal), currency)}
                        </div>
                      </div>

                      {/* Card Meta Row: Date, Wallet & Action Buttons */}
                      <div className="settlement-card-meta">
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {fmtDate(s.date)}{walletName ? ` · ${walletName}` : ''}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDetailSettlement(s)}
                            style={{ fontSize: 11, padding: '2px 6px', gap: 3, height: 24 }}
                          >
                            <Eye size={11} /> Details
                          </button>
                          <button
                            type="button"
                            className="btn btn-undo btn-sm"
                            onClick={() => setDelId(s.id)}
                            title="Undo settlement"
                            style={{ padding: '2px 8px', fontSize: 11, gap: 3, height: 24 }}
                          >
                            <RotateCcw size={11} /> Undo
                          </button>
                        </div>
                      </div>

                      {/* Expandable Expenses Button */}
                      <button
                        type="button"
                        className="settlement-exp-toggle-btn"
                        onClick={() => toggleExpand(s.id)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Receipt size={12} />
                          {matchedExpenses.length} expense{matchedExpenses.length !== 1 ? 's' : ''} settled
                        </span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {/* Expanded Expenses List */}
                      {isExpanded && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {matchedExpenses.map(exp => {
                            if (!exp) return null;
                            const isForFriend = exp.type === 'for_friend';
                            return (
                              <div
                                key={exp.id}
                                style={{
                                  padding: '6px 8px',
                                  background: 'var(--surface2)',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 11,
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1, marginRight: 6 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {exp.description || 'Expense'}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                                    {exp.category} • {fmtDate(exp.date)}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 700, color: isForFriend ? 'var(--credit)' : 'var(--debit)', whiteSpace: 'nowrap' }}>
                                  {isForFriend ? '+' : '-'}{fmtMoney(Number(exp.amount) || 0, currency)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {settleFriend && <SettleModal friend={settleFriend} onClose={() => setSettleFriend(null)} />}
      {detailSettlement && (
        <SettlementDetailModal
          settlement={detailSettlement}
          onClose={() => setDetailSettlement(null)}
          onUndo={id => {
            setDelId(id);
          }}
        />
      )}
      {delId && (
        <ConfirmDialog
          title="Undo Settlement"
          message={`Are you sure you want to undo this settlement with ${
            targetF?.name || 'friend'
          }? ${fmtMoney(Math.abs(Number(targetS?.amount) || 0), currency)} will be restored to your ${targetWName} wallet and ${
            Array.isArray(targetS?.expenseIds) ? targetS.expenseIds.length : 0
          } expense(s) will be marked as unsettled again.`}
          confirmLabel="Undo Settlement"
          danger={false}
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
