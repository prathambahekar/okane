import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Handshake,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Receipt,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
  Users,
  LayoutList,
  List,
  Store,
  Tv,
  Search,
  X,
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, Settlement, Expense } from '../types';
import { friendBalance, todayISO, unsettledExpensesForFriend } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription } from '../utils';
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

  const friendsWithUnsettled = useMemo(() => {
    return friends.filter(f => f && unsettledExpensesForFriend(db, f.id).length > 0);
  }, [friends, db]);

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

  // Friends who have settlements in the current timeframe
  const timeframeFriends = useMemo(() => {
    const map = new Map<string, { friend: Friend; count: number }>();
    timeframeFiltered.forEach(s => {
      if (!s || !s.friendId) return;
      const f = friends.find(fr => fr && fr.id === s.friendId);
      if (f) {
        const existing = map.get(f.id);
        if (existing) existing.count += 1;
        else map.set(f.id, { friend: f, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [timeframeFiltered, friends]);

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
    return { received, paid, net: received - paid, totalCount: timeframeFiltered.length };
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
            marginBottom: 18,
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            onClick={() => setIsPendingExpanded(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isPendingExpanded ? 10 : 0,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Handshake size={16} strokeWidth={2.2} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.1px' }}>
                Pending Settlements
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '1px 7px',
                  borderRadius: 999,
                  minWidth: 18,
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                {friendsWithUnsettled.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 2, width: 26, height: 26, borderRadius: 6, color: 'var(--text-3)' }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {friendsWithUnsettled.map(f => {
              if (!f) return null;
              const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
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
                    gap: 10,
                    padding: '8px 12px',
                    background: 'var(--surface2)',
                    borderRadius: 11,
                    border: '1px solid var(--border)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      className="avatar"
                      style={{
                        ...getAvatarStyle(f.color),
                        width: 34,
                        height: 34,
                        fontSize: 12.5,
                        fontWeight: 700,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {f.type === 'vendor' ? <Store size={15} /> : f.type === 'subscription' ? <Tv size={15} /> : friendInitial(f.name, f.avatarNumber)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
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
                          gap: 4.5,
                          flexWrap: 'nowrap',
                          overflow: 'hidden',
                          marginTop: 2,
                        }}
                      >
                        {youOwe ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--debit)',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2.5,
                            }}
                          >
                            <ArrowUpRight size={11.5} strokeWidth={2.6} /> {fmtMoney(Math.abs(netVal), currency)}
                          </span>
                        ) : owesYou ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--credit)',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2.5,
                            }}
                          >
                            <ArrowDownLeft size={11.5} strokeWidth={2.6} /> {fmtMoney(netVal, currency)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            Net 0
                          </span>
                        )}
                        <span style={{ fontSize: 10.5, color: 'var(--text-3)', opacity: 0.5 }}>•</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {unsettledCount} unsettled
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: 12,
                      fontWeight: 650,
                      padding: '4px 12px',
                      borderRadius: 8,
                      gap: 4,
                      background: 'var(--accent-gradient)',
                      color: 'var(--accent-contrast, #ffffff)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      height: 28,
                      boxShadow: '0 1px 4px var(--accent-shadow, rgba(225, 29, 72, 0.2))',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onClick={() => setSettleFriend(f)}
                  >
                    <Handshake size={13} strokeWidth={2.2} /> Settle
                  </button>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* History Card Container */}
      <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div className="settlement-history-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={16} strokeWidth={2.3} />
            </div>
            <h2 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', letterSpacing: '-0.1px' }}>
              Settlement History
            </h2>
            <span className="settlement-count-badge">
              {filteredSettlements.length}
            </span>
          </div>

          {/* Timeframe Date Filter Button on Right Side */}
          <div className="settlement-timeframe-btn-wrap" title="Filter timeframe">
            <Calendar size={13.5} strokeWidth={2.2} className="timeframe-icon" />
            <span className="timeframe-label">
              {timeframe === 'this_month'
                ? 'This Month'
                : timeframe === 'last_month'
                ? 'Last Month'
                : timeframe === 'last_3_months'
                ? 'Last 3M'
                : timeframe === 'this_year'
                ? 'This Year'
                : 'All Time'}
            </span>
            <ChevronDown size={11} className="timeframe-chevron" />
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
            {/* 3 KPI Columns in 1 Unified Rounded Strip */}
            <div className="settlement-stats-grid">
              <div className="settlement-stat-card">
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Received</div>
                  <div className="settlement-stat-value credit">
                    +{fmtMoney(kpiSummary.received, currency)}
                  </div>
                </div>
              </div>

              <div className="settlement-stat-card">
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Paid</div>
                  <div className="settlement-stat-value debit">
                    -{fmtMoney(kpiSummary.paid, currency)}
                  </div>
                </div>
              </div>

              <div className="settlement-stat-card">
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Net Flow</div>
                  <div className={`settlement-stat-value ${kpiSummary.net >= 0 ? 'credit' : 'debit'}`}>
                    {kpiSummary.net >= 0 ? '+' : '-'}{fmtMoney(Math.abs(kpiSummary.net), currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Toolbar Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {/* Search Bar + Layout Toggle Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '0 10px',
                    height: 36,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <Search size={14.5} style={{ color: 'var(--text-3)', marginRight: 8, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search settlements by friend, note, wallet, or expense..."
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 12.5,
                      color: 'var(--text)',
                      padding: '5px 0',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-3)',
                        cursor: 'pointer',
                        padding: 3,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* View Mode Toggle: Detailed Table vs Compact Cards */}
                <div className="settlement-view-toggle-mini" title="Switch layout">
                  <button
                    type="button"
                    className={`settlement-view-toggle-btn ${viewMode === 'detailed' ? 'active' : ''}`}
                    onClick={() => setViewMode('detailed')}
                    title="Detailed table view"
                  >
                    <LayoutList size={13.5} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className={`settlement-view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
                    onClick={() => setViewMode('compact')}
                    title="Compact card view"
                  >
                    <List size={13.5} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Filter Pills Row: Friend Pills + Type Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {/* Friend Filter Pills (Scrollable) */}
                <div
                  className="no-scrollbar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    padding: '2px 0',
                    maxWidth: '100%',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFriendFilter('all')}
                    style={{
                      border: friendFilter === 'all' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: friendFilter === 'all' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: friendFilter === 'all' ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 11.5,
                      fontWeight: friendFilter === 'all' ? 700 : 500,
                      padding: '3.5px 9px',
                      borderRadius: 18,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4.5,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                      boxShadow: friendFilter === 'all' ? '0 1px 3px var(--accent-soft)' : 'none',
                    }}
                  >
                    <Users size={12} strokeWidth={2.4} />
                    <span>All Friends</span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '1px 5.5px',
                        borderRadius: 99,
                        background: friendFilter === 'all' ? 'var(--accent)' : 'var(--surface3)',
                        color: friendFilter === 'all' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                      }}
                    >
                      {timeframeFiltered.length}
                    </span>
                  </button>

                  {timeframeFriends.map(({ friend: f, count }) => {
                    const isActive = friendFilter === f.id;
                    const avatar = getAvatarStyle(f.color);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFriendFilter(f.id)}
                        style={{
                          border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          background: isActive ? 'var(--accent-soft)' : 'var(--surface2)',
                          color: isActive ? 'var(--accent)' : 'var(--text-2)',
                          fontSize: 11.5,
                          fontWeight: isActive ? 700 : 500,
                          padding: '3.5px 9px',
                          borderRadius: 18,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4.5,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                          boxShadow: isActive ? '0 1px 3px var(--accent-soft)' : 'none',
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: avatar.background,
                            color: avatar.color,
                            fontSize: 8.5,
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                            lineHeight: 1,
                            flexShrink: 0,
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                          }}
                        >
                          {friendInitial(f.name, f.avatarNumber)}
                        </span>
                        <span>{f.name}</span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 5.5px',
                            borderRadius: 99,
                            background: isActive ? 'var(--accent)' : 'var(--surface3)',
                            color: isActive ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Type Filter Segmented Tabs */}
                <div className="settlement-type-tabs" style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className={`settlement-type-tab ${typeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`settlement-type-tab credit ${typeFilter === 'received' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('received')}
                  >
                    <TrendingUp size={12} strokeWidth={2.4} /> Received
                  </button>
                  <button
                    type="button"
                    className={`settlement-type-tab debit ${typeFilter === 'paid' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('paid')}
                  >
                    <TrendingDown size={12} strokeWidth={2.4} /> Paid
                  </button>
                </div>
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
                                      const isVendorSettlement = friend?.type === 'vendor';
                                      const expFriend = (isVendorSettlement && exp.friendId && exp.friendId !== friend?.id) ? friends.find(f => f && f.id === exp.friendId) : null;
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
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 4,
                                                }}
                                              >
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {cleanExpenseDescription(exp.description) || 'Expense'}
                                                </span>
                                                {expFriend ? (
                                                  <span
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: 3.5,
                                                      fontSize: 10,
                                                      fontWeight: 650,
                                                      padding: '1.5px 6px',
                                                      borderRadius: 5,
                                                      background: 'var(--surface3)',
                                                      color: 'var(--text)',
                                                      border: '1px solid var(--border)',
                                                      whiteSpace: 'nowrap',
                                                      flexShrink: 0,
                                                    }}
                                                  >
                                                    <span
                                                      style={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        background: getAvatarStyle(expFriend.color).background,
                                                        color: '#ffffff',
                                                        fontSize: 7.5,
                                                        fontWeight: 700,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        lineHeight: 1,
                                                      }}
                                                    >
                                                      {friendInitial(expFriend.name, expFriend.avatarNumber)}
                                                    </span>
                                                    <span>{expFriend.name}</span>
                                                  </span>
                                                ) : null}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                        {friend && (
                          <div
                            className="avatar avatar-sm"
                            style={{
                              ...getAvatarStyle(friend.color),
                              width: 36,
                              height: 36,
                              fontSize: 13,
                              fontWeight: 700,
                              flexShrink: 0,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            {friendInitial(friend.name, friend.avatarNumber)}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {friend ? friend.name : 'Deleted friend'}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                            {fmtDate(s.date)}{walletName ? ` · ${walletName}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 750, fontSize: 14, color: isReceived ? 'var(--credit)' : 'var(--debit)' }}>
                            {isReceived ? '+' : '-'}{fmtMoney(Math.abs(amtVal), currency)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-undo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDelId(s.id);
                          }}
                          title="Undo settlement"
                          style={{
                            width: 30,
                            height: 30,
                            padding: 0,
                            borderRadius: 8,
                            display: 'grid',
                            placeItems: 'center',
                            border: '1px solid rgba(217, 119, 6, 0.35)',
                            background: 'rgba(217, 119, 6, 0.08)',
                            color: '#d97706',
                            cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={13} strokeWidth={2.2} />
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
                            const isVendorSettlement = friend?.type === 'vendor';
                            const expFriend = (isVendorSettlement && exp.friendId && exp.friendId !== friend?.id) ? friends.find(f => f && f.id === exp.friendId) : null;
                            return (
                              <div
                                key={exp.id}
                                style={{
                                  padding: '7px 9px',
                                  background: 'var(--surface2)',
                                  borderRadius: 7,
                                  border: '1px solid var(--border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 11,
                                  gap: 6,
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontWeight: 650, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    <span>{cleanExpenseDescription(exp.description) || 'Expense'}</span>
                                    {expFriend ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                          fontSize: 9.5,
                                          fontWeight: 650,
                                          padding: '1px 5px',
                                          borderRadius: 4,
                                          background: 'var(--surface3)',
                                          color: 'var(--text)',
                                          border: '1px solid var(--border)',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 11,
                                            height: 11,
                                            borderRadius: '50%',
                                            background: getAvatarStyle(expFriend.color).background,
                                            color: '#ffffff',
                                            fontSize: 7,
                                            fontWeight: 700,
                                            display: 'grid',
                                            placeItems: 'center',
                                            lineHeight: 1,
                                          }}
                                        >
                                          {friendInitial(expFriend.name, expFriend.avatarNumber)}
                                        </span>
                                        <span>{expFriend.name}</span>
                                      </span>
                                    ) : null}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1.5 }}>
                                    {exp.category} • {fmtDate(exp.date)}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 700, color: isForFriend ? 'var(--credit)' : 'var(--debit)', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
