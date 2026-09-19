import { useState, useMemo, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Handshake,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Search,
  X,
  Store,
  Tv,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, Settlement, Expense } from '../types';
import { friendBalance, todayISO, unsettledExpensesForFriend } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle } from '../utils';
import SettleModal from '../components/SettleModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SettlementDetailModal from '../components/SettlementDetailModal';
import SettlementFilterDrawer from '../components/SettlementFilterDrawer';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScrollMargin } from '../hooks/useScrollMargin';
import { SettlementCompactCard } from '../components/settlements/SettlementCompactCard';

export type SettlementTimeframe = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all';

export default function Settlements({ initialArg }: { initialArg?: string; onClearViewArg?: () => void }) {
  const { db, deleteSettlement, showToast } = useStore();
  const settlements = useMemo(() => db?.settlements || [], [db?.settlements]);
  const settings = db?.settings || {};
  const currency = settings?.currency || 'INR';
  const friends = useMemo(() => db?.friends || [], [db?.friends]);
  const expenses = useMemo(() => db?.expenses || [], [db?.expenses]);
  const wallets = useMemo(() => db?.wallets || [], [db?.wallets]);

  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);

  // Timeframe, Search & Filter State
  const [timeframe, setTimeframe] = useState<SettlementTimeframe>('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendFilter, setFriendFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'paid'>('all');

  const handledArgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }
    if (handledArgRef.current === initialArg) return;
    handledArgRef.current = initialArg;

    const timer = setTimeout(() => {
      const foundS = settlements.find(s => s.id === initialArg);
      if (foundS) {
        setTimeframe('all');
        setDetailSettlement(foundS);
      } else {
        const foundF = friends.find(f => f.id === initialArg);
        if (foundF) {
          setFriendFilter(foundF.id);
        } else {
          setSearchQuery(initialArg);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, settlements, friends]);
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);
  const [isPendingExpanded, setIsPendingExpanded] = useState<boolean>(true);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (friendFilter !== 'all') count++;
    if (timeframe !== 'this_month') count++;
    return count;
  }, [typeFilter, friendFilter, timeframe]);

  // Listen for top bar filter button trigger
  useEffect(() => {
    const handleOpenFilters = () => {
      setShowFilterDrawer(true);
    };
    window.addEventListener('app-open-filters', handleOpenFilters);
    return () => window.removeEventListener('app-open-filters', handleOpenFilters);
  }, []);

  // Sync active filter count with top bar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-filter-count-update', {
      detail: { view: 'settlements', count: activeFilterCount }
    }));
  }, [activeFilterCount]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setFriendFilter('all');
    setTimeframe('this_month');
  };

  const targetS = settlements.find(x => x && x.id === delId);
  const targetF = targetS ? friends.find(f => f && f.id === targetS.friendId) : null;
  const targetW = targetS?.walletId ? wallets.find(w => w && w.id === targetS.walletId) : null;
  const targetWName = targetW?.name || targetS?.paymentMethod || 'wallet';

  const friendsWithUnsettled = useMemo(() => {
    const friendMap = new Map<string, typeof friends[0]>();
    (friends || []).forEach(f => {
      if (f && f.id) friendMap.set(String(f.id).trim(), f);
    });

    (db?.expenses || []).forEach(e => {
      const fId = e.friendId ? String(e.friendId).trim() : '';
      const vId = e.vendorId ? String(e.vendorId).trim() : '';
      if (fId && !friendMap.has(fId)) {
        friendMap.set(fId, {
          id: fId,
          name: 'Contact',
          notes: '',
          color: '#6366f1',
          createdAt: e.createdAt || 0,
          type: 'friend',
        });
      }
      if (vId && !friendMap.has(vId)) {
        friendMap.set(vId, {
          id: vId,
          name: 'Vendor',
          notes: '',
          color: '#f59e0b',
          createdAt: e.createdAt || 0,
          type: 'vendor',
        });
      }
    });

    return Array.from(friendMap.values()).filter(f => f && unsettledExpensesForFriend(db, f.id).length > 0);
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

    if (timeframe === 'today') {
      return sorted.filter(s => s && s.date === today);
    }

    if (timeframe === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = d.toISOString().slice(0, 10);
      return sorted.filter(s => s && s.date === yesterday);
    }

    if (timeframe === 'this_week') {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMon);
      const weekStart = monday.toISOString().slice(0, 10);
      return sorted.filter(s => s && s.date && s.date >= weekStart && s.date <= today);
    }

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
      const matched = expenses.filter(e => e && (idsSet.has(e.id) || (e.settlementId && e.settlementId === s.id) || (e.vendorSettlementId && e.vendorSettlementId === s.id)));
      
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
        const isForgiven = Boolean(s.isForgiven);
        const matchesForgiven = isForgiven && (
          'forgiven'.includes(q) || 'waived'.includes(q) || 'forgotten'.includes(q) ||
          q.includes('forgiv') || q.includes('waiv') || q.includes('forgot')
        );
        const matchedExpenses = settlementExpensesMap[s.id] || [];
        const matchesExpenses = matchedExpenses.some(
          e => (e?.description || '').toLowerCase().includes(q) || (e?.category || '').toLowerCase().includes(q)
        );

        if (!matchesFriend && !matchesNote && !matchesMethod && !matchesForgiven && !matchesExpenses) {
          return false;
        }
      }

      return true;
    });
  }, [timeframeFiltered, friendFilter, typeFilter, searchQuery, friends, settlementExpensesMap]);

  // Virtualization setup for Settlement History
  const friendsMap = useMemo(() => new Map(friends.map(f => [f.id, f])), [friends]);
  const walletsMap = useMemo(() => new Map(wallets.map(w => [w.id, w])), [wallets]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  const scrollMargin = useScrollMargin(listContainerRef, [timeframe, friendFilter, typeFilter, searchQuery]);

  const virtualizer = useVirtualizer({
    count: filteredSettlements.length,
    getScrollElement: () => listContainerRef.current?.closest<HTMLElement>('.main-content') || document.querySelector<HTMLElement>('.main-content'),
    estimateSize: () => 56,
    getItemKey: (index) => {
      const s = filteredSettlements[index];
      return s?.id ? `st-${s.id}-${index}` : `st-${index}`;
    },
    overscan: 5,
    scrollMargin,
    gap: 4,
    paddingEnd: 16,
  });

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
        <div className="desktop-search-filter-wrap desktop-only">
          <DesktopSearchBar placeholder="Search settlements, debts..." defaultTab="settlements" />
          <button
            type="button"
            id="desktop-filter-settlement-btn"
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilterDrawer(true)}
            title={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'Filter settlements'}
            aria-label="Filter settlements"
            style={{
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: '9999px',
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
                  fontSize: 10,
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
      </div>

      {/* Pending settlements section */}
      {friendsWithUnsettled.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 18,
            padding: '14px 16px',
            borderRadius: 'var(--radius-lg)',
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
              marginBottom: isPendingExpanded ? 12 : 0,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Handshake size={18} strokeWidth={2.2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
                Pending Settlements
              </h2>
              <span
                style={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 700,
                  color: 'var(--text-2)',
                  background: 'var(--surface2)',
                  padding: '1.5px 7.5px',
                  borderRadius: 'var(--radius-full)',
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}
              >
                {friendsWithUnsettled.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 2, width: 26, height: 26, borderRadius: 'var(--radius-sm)', color: 'var(--text-3)' }}
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
            <div className="pending-settlements-desktop-grid">
              {friendsWithUnsettled.map((f, idx) => {
                if (!f) return null;
                const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
                const bal = friendBalance(db, f.id) || { net: 0 };
                const netVal = bal.net || 0;
                const owesYou = netVal > 0.004;
                const youOwe = netVal < -0.004;

                return (
                  <div
                    key={`${f.id}-${idx}`}
                    className="pending-settlement-subcard"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSettleFriend(f)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSettleFriend(f);
                      }
                    }}
                    title={`Settle with ${f.name || 'Friend'}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                      <div
                        className="avatar"
                        style={{
                          ...getAvatarStyle(f.color),
                          width: 38,
                          height: 38,
                          fontSize: 'var(--fs-sm)',
                          fontWeight: 700,
                          borderRadius: 'var(--radius-sm)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {f.type === 'vendor' ? <Store size={16} /> : f.type === 'subscription' ? <Tv size={16} /> : friendInitial(f.name, f.avatarNumber)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--fs-base)',
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.3,
                          }}
                        >
                          {f.name || 'Friend'}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'nowrap',
                            overflow: 'hidden',
                            marginTop: 2.5,
                          }}
                        >
                          {youOwe ? (
                            <span
                              style={{
                                fontSize: 'var(--fs-xs)',
                                fontWeight: 700,
                                color: 'var(--debit)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2.5,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              <ArrowUpRight size={12.5} strokeWidth={2.6} /> {fmtMoney(Math.abs(netVal), currency)}
                            </span>
                          ) : owesYou ? (
                            <span
                              style={{
                                fontSize: 'var(--fs-xs)',
                                fontWeight: 700,
                                color: 'var(--credit)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2.5,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              <ArrowDownLeft size={12.5} strokeWidth={2.6} /> {fmtMoney(netVal, currency)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              Net 0
                            </span>
                          )}
                          <span style={{ opacity: 0.5, lineHeight: 1 }}>•</span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {unsettledCount} unsettled
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="pending-settle-btn"
                      aria-hidden="true"
                    >
                      <Handshake size={13.5} strokeWidth={2} />
                      <span>Settle</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Card Container */}
      <div
        className="card"
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} strokeWidth={2.2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              Settlement History
            </h2>
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                color: 'var(--text-2)',
                background: 'var(--surface2)',
                padding: '1.5px 7.5px',
                borderRadius: 'var(--radius-full)',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}
            >
              {filteredSettlements.length}
            </span>
          </div>

          {/* Controls on Right Side (Filter funnel on left, Calendar on right) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Filter Funnel Button */}
            <button
              type="button"
              className={`settlement-filter-btn-wrap ${activeFilterCount > 0 ? 'active' : ''}`}
              onClick={() => setShowFilterDrawer(true)}
              title="Filter settlements"
              aria-label="Filter settlements"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                border: 'none',
                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Filter size={16} strokeWidth={2.1} />
              {activeFilterCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    fontSize: 9,
                    fontWeight: 800,
                    minWidth: 14,
                    height: 14,
                    padding: '0 3px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Summary KPI Cards inside History section */}
        {sorted.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {/* 2 KPI Modern Discrete Cards: Received and Paid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ArrowDownLeft size={14} strokeWidth={2.4} style={{ color: 'var(--credit)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '-0.01em' }}>
                    Received
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--fs-md)',
                    fontWeight: 700,
                    color: 'var(--credit)',
                    marginTop: 2,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  +{fmtMoney(kpiSummary.received, currency)}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ArrowUpRight size={14} strokeWidth={2.4} style={{ color: 'var(--debit)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '-0.01em' }}>
                    Paid
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--fs-md)',
                    fontWeight: 700,
                    color: 'var(--debit)',
                    marginTop: 2,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  -{fmtMoney(kpiSummary.paid, currency)}
                </div>
              </div>
            </div>

            {/* Search and Filter Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {/* Search Input */}
                <div className="card-search-pill">
                  <div className="card-search-pill-icon">
                    <Search size={15} strokeWidth={2} />
                  </div>
                  <input
                    type="text"
                    className="card-search-pill-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search settlements by friend, note, wallet, or expense..."
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="card-search-pill-clear"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <X size={13} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filter Chips Bar (if active filters exist) */}
              {activeFilterCount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    padding: '2px 0',
                  }}
                  className="no-scrollbar"
                >
                  {friendFilter !== 'all' && (
                    <span className="app-filter-chip">
                      <span className="app-filter-chip-label">Friend:</span>
                      <span className="app-filter-chip-value">{friends.find(f => f.id === friendFilter)?.name || 'Friend'}</span>
                      <button
                        type="button"
                        onClick={() => setFriendFilter('all')}
                        className="app-filter-chip-remove"
                        title="Clear friend filter"
                        aria-label="Clear friend filter"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  )}

                  {typeFilter !== 'all' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: typeFilter === 'received' ? 'var(--credit-bg)' : 'var(--debit-bg)',
                        border: `1px solid ${typeFilter === 'received' ? 'var(--credit-border, rgba(74,222,128,0.3))' : 'var(--debit-border, rgba(248,113,113,0.3))'}`,
                        color: typeFilter === 'received' ? 'var(--credit)' : 'var(--debit)',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 600,
                      }}
                    >
                      <span>{typeFilter === 'received' ? 'Received' : 'Paid'}</span>
                      <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          padding: 0,
                        }}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  )}

                  {timeframe !== 'this_month' && (
                    <span className="app-filter-chip">
                      <span className="app-filter-chip-label">Period:</span>
                      <span className="app-filter-chip-value">
                        {timeframe === 'today'
                          ? 'Today'
                          : timeframe === 'yesterday'
                          ? 'Yesterday'
                          : timeframe === 'this_week'
                          ? 'This Week'
                          : timeframe === 'last_month'
                          ? 'Last Month'
                          : timeframe === 'last_3_months'
                          ? 'Last 3M'
                          : timeframe === 'this_year'
                          ? 'This Year'
                          : 'All Time'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTimeframe('this_month')}
                        className="app-filter-chip-remove"
                        title="Reset timeframe"
                        aria-label="Reset timeframe"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 13px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--surface3)';
                      e.currentTarget.style.color = 'var(--text)';
                      e.currentTarget.style.borderColor = 'var(--border2, var(--border))';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--surface2)';
                      e.currentTarget.style.color = 'var(--text-2)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                    title="Clear all filters"
                  >
                    <RotateCcw size={13} strokeWidth={2.2} />
                    <span>Clear all</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--surface2)',
                color: 'var(--text-3)',
                margin: '0 auto 10px',
              }}
            >
              <Handshake size={20} strokeWidth={1.8} />
            </div>
            <div className="empty-state-title" style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)', marginBottom: 4 }}>
              No settlements yet
            </div>
            <p className="empty-state-desc" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', maxWidth: 300, margin: '0 auto', lineHeight: 1.45 }}>
              When you settle up with friends, detailed settlement records will appear here.
            </p>
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--surface2)',
                color: 'var(--text-3)',
                margin: '0 auto 10px',
              }}
            >
              <Filter size={20} strokeWidth={1.8} />
            </div>
            <div className="empty-state-title" style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)', marginBottom: 4 }}>
              No matching settlements
            </div>
            <p className="empty-state-desc" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', maxWidth: 300, margin: '0 auto 16px', lineHeight: 1.45 }}>
              Try adjusting your search query or filters.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} strokeWidth={2} />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
          <div
            ref={listContainerRef}
            className="settlement-compact-list"
            style={{
              position: 'relative',
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              display: 'block',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const s = filteredSettlements[virtualRow.index];
              if (!s) return null;

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                  }}
                >
                  <SettlementCompactCard
                    settlement={s}
                    friend={friendsMap.get(s.friendId)}
                    wallet={s.walletId ? walletsMap.get(s.walletId) : undefined}
                    currency={currency}
                    onSelect={setDetailSettlement}
                    onUndo={setDelId}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SettlementFilterDrawer
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        friendFilter={friendFilter}
        setFriendFilter={setFriendFilter}
        timeframeFriends={timeframeFriends}
        totalTimeframeCount={timeframeFiltered.length}
        filteredCount={filteredSettlements.length}
        onResetFilters={handleResetFilters}
        activeFilterCount={activeFilterCount}
      />

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
          message={`Restores ${fmtMoney(Math.abs(Number(targetS?.amount) || 0), currency)} to ${targetWName} and marks expenses with ${
            targetF?.name || 'friend'
          } as unpaid.`}
          confirmLabel="Undo Settlement"
          danger={true}
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
