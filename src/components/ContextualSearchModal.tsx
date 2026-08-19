import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  ReceiptText,
  Users,
  Wallet as WalletIcon,
  Handshake,
  Compass,
  RefreshCw,
  Store,
  Tv,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../store';
import type { ViewName, Trip } from '../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle } from '../utils';
import { friendBalance, walletBalance, expenseFlow } from '../db';
import CategoryIcon from './CategoryIcon';

interface Props {
  open: boolean;
  onClose: () => void;
  activeView: ViewName;
  onNavigate: (view: ViewName, arg?: string) => void;
}

type SearchTab = 'context' | 'all' | 'expenses' | 'contacts' | 'wallets' | 'settlements' | 'trips' | 'recurring';

export default function ContextualSearchModal({ open, onClose, activeView, onNavigate }: Props) {
  const { db } = useStore();
  const { expenses = [], friends = [], wallets = [], settlements = [], recurringRules = [], settings } = db;
  const trips: Trip[] = useMemo(() => {
    if (db.tripHistory && db.tripHistory.length > 0) return db.tripHistory;
    if (db.activeTrip) return [db.activeTrip];
    return [];
  }, [db.tripHistory, db.activeTrip]);
  const currency = settings?.currency || 'INR';

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('context');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = React.useCallback(() => {
    setQuery('');
    setActiveTab('context');
    onClose();
  }, [onClose]);

  // Auto focus input on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Determine what "context" means based on activeView
  const contextMeta = useMemo(() => {
    switch (activeView) {
      case 'expenses':
        return { name: 'Expenses', tab: 'expenses' as SearchTab, icon: <ReceiptText size={14} /> };
      case 'friends':
      case 'friend-detail':
        return { name: 'Contacts', tab: 'contacts' as SearchTab, icon: <Users size={14} /> };
      case 'wallets':
        return { name: 'Wallets', tab: 'wallets' as SearchTab, icon: <WalletIcon size={14} /> };
      case 'settlements':
        return { name: 'Settlements', tab: 'settlements' as SearchTab, icon: <Handshake size={14} /> };
      case 'split-trips':
        return { name: 'Trips', tab: 'trips' as SearchTab, icon: <Compass size={14} /> };
      case 'recurring':
        return { name: 'Subscriptions', tab: 'recurring' as SearchTab, icon: <RefreshCw size={14} /> };
      default:
        return { name: 'All Data', tab: 'all' as SearchTab, icon: <Sparkles size={14} /> };
    }
  }, [activeView]);

  const resolvedTab: SearchTab = activeTab === 'context' ? contextMeta.tab : activeTab;
  const q = query.trim().toLowerCase();

  // Search Expenses
  const matchingExpenses = useMemo(() => {
    if (resolvedTab !== 'all' && resolvedTab !== 'expenses') return [];
    if (!q) {
      // Return 8 most recent expenses for context
      return expenses.slice(0, 8);
    }
    return expenses.filter(e => {
      const descMatch = (e.description || '').toLowerCase().includes(q);
      const catMatch = (e.category || '').toLowerCase().includes(q);
      const notesMatch = (e.notes || '').toLowerCase().includes(q);
      const amtMatch = String(e.amount).includes(q);
      const dateMatch = (e.date || '').toLowerCase().includes(q);
      const friendMatch = e.friendId ? (friends.find(f => f.id === e.friendId)?.name || '').toLowerCase().includes(q) : false;
      const vendorMatch = e.vendorId ? (friends.find(f => f.id === e.vendorId)?.name || '').toLowerCase().includes(q) : false;
      return descMatch || catMatch || notesMatch || amtMatch || dateMatch || friendMatch || vendorMatch;
    }).slice(0, 25);
  }, [expenses, friends, q, resolvedTab]);

  // Search Contacts (Friends, Vendors, Subscriptions)
  const matchingContacts = useMemo(() => {
    if (resolvedTab !== 'all' && resolvedTab !== 'contacts') return [];
    if (!q) {
      // Return 8 contacts
      return friends.slice(0, 8);
    }
    return friends.filter(f => {
      const nameMatch = f.name.toLowerCase().includes(q);
      const catMatch = (f.category || '').toLowerCase().includes(q);
      const notesMatch = (f.notes || '').toLowerCase().includes(q);
      const webMatch = (f.website || '').toLowerCase().includes(q);
      return nameMatch || catMatch || notesMatch || webMatch;
    }).slice(0, 20);
  }, [friends, q, resolvedTab]);

  // Search Wallets
  const matchingWallets = useMemo(() => {
    if (resolvedTab !== 'all' && resolvedTab !== 'wallets') return [];
    if (!q) return wallets;
    return wallets.filter(w => {
      return w.name.toLowerCase().includes(q);
    });
  }, [wallets, q, resolvedTab]);

  // Search Settlements
  const matchingSettlements = useMemo(() => {
    if (resolvedTab !== 'all' && resolvedTab !== 'settlements') return [];
    if (!q) return settlements.slice(0, 8);
    return settlements.filter(s => {
      const friend = friends.find(f => f.id === s.friendId);
      const friendName = (friend?.name || '').toLowerCase();
      const friendMatch = friendName.includes(q);
      const notesMatch = (s.note || '').toLowerCase().includes(q);
      const amtMatch = String(s.amount).includes(q);
      const dateMatch = (s.date || '').toLowerCase().includes(q);
      return friendMatch || notesMatch || amtMatch || dateMatch;
    }).slice(0, 20);
  }, [settlements, friends, q, resolvedTab]);

  // Search Trips
  const matchingTrips = useMemo(() => {
    if (resolvedTab !== 'all' && resolvedTab !== 'trips') return [];
    if (!q) return trips.slice(0, 6);
    return trips.filter((t: Trip) => {
      const nameMatch = (t.name || '').toLowerCase().includes(q);
      const groupMatch = (t.groupName || '').toLowerCase().includes(q);
      const memberMatch = t.members ? t.members.some(m => m.name.toLowerCase().includes(q)) : false;
      return nameMatch || groupMatch || memberMatch;
    }).slice(0, 10);
  }, [trips, q, resolvedTab]);

  // Search Recurring Rules
  const matchingRecurring = useMemo(() => {
    if (resolvedTab !== 'all' && resolvedTab !== 'recurring') return [];
    if (!q) return recurringRules.slice(0, 6);
    return recurringRules.filter(r => {
      const titleMatch = r.title.toLowerCase().includes(q);
      const catMatch = (r.category || '').toLowerCase().includes(q);
      const freqMatch = (r.frequency || '').toLowerCase().includes(q);
      return titleMatch || catMatch || freqMatch;
    }).slice(0, 10);
  }, [recurringRules, q, resolvedTab]);

  const totalResultsCount =
    matchingExpenses.length +
    matchingContacts.length +
    matchingWallets.length +
    matchingSettlements.length +
    matchingTrips.length +
    matchingRecurring.length;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        animation: 'fadein 0.15s ease',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Search Input Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--surface2)',
          }}
        >
          <Search size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={
              resolvedTab === 'expenses'
                ? 'Search expenses by name, category, amount...'
                : resolvedTab === 'contacts'
                ? 'Search contacts, friends, vendors, subscriptions...'
                : resolvedTab === 'wallets'
                ? 'Search wallets and accounts...'
                : resolvedTab === 'settlements'
                ? 'Search settlement records...'
                : resolvedTab === 'trips'
                ? 'Search trips and split groups...'
                : resolvedTab === 'recurring'
                ? 'Search subscriptions & autopays...'
                : 'Search across expenses, contacts, wallets...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--text)',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3)',
                cursor: 'pointer',
                padding: '4px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '4px',
              }}
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface3)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--text-2)',
              cursor: 'pointer',
            }}
          >
            Esc
          </button>
        </div>

        {/* Dynamic Context Tabs */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            backgroundColor: 'var(--surface)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('context')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: activeTab === 'context' ? 700 : 500,
              background: activeTab === 'context' ? 'var(--accent)' : 'var(--surface2)',
              color: activeTab === 'context' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: activeTab === 'context' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {contextMeta.icon}
            <span>Current: {contextMeta.name}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: activeTab === 'all' ? 700 : 500,
              background: activeTab === 'all' ? 'var(--accent)' : 'var(--surface2)',
              color: activeTab === 'all' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: activeTab === 'all' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: activeTab === 'expenses' ? 700 : 500,
              background: activeTab === 'expenses' ? 'var(--accent)' : 'var(--surface2)',
              color: activeTab === 'expenses' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: activeTab === 'expenses' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <ReceiptText size={13} />
            <span>Expenses</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: activeTab === 'contacts' ? 700 : 500,
              background: activeTab === 'contacts' ? 'var(--accent)' : 'var(--surface2)',
              color: activeTab === 'contacts' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: activeTab === 'contacts' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={13} />
            <span>Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wallets')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: activeTab === 'wallets' ? 700 : 500,
              background: activeTab === 'wallets' ? 'var(--accent)' : 'var(--surface2)',
              color: activeTab === 'wallets' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: activeTab === 'wallets' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <WalletIcon size={13} />
            <span>Wallets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settlements')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: activeTab === 'settlements' ? 700 : 500,
              background: activeTab === 'settlements' ? 'var(--accent)' : 'var(--surface2)',
              color: activeTab === 'settlements' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
              border: '1px solid',
              borderColor: activeTab === 'settlements' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Handshake size={13} />
            <span>Settlements</span>
          </button>
        </div>

        {/* Results List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {totalResultsCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-3)' }}>
              <Search size={32} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-2)' }}>No results found</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                No matches for &ldquo;{query}&rdquo; in {resolvedTab}
              </div>
            </div>
          ) : (
            <>
              {/* Expenses Results */}
              {matchingExpenses.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Expenses ({matchingExpenses.length})</span>
                    {!q && <span style={{ fontSize: '10px', fontWeight: 500 }}>Recent</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchingExpenses.map(e => {
                      const isOut = expenseFlow(e) === 'out';
                      const friend = e.friendId ? friends.find(f => f.id === e.friendId) : null;
                      return (
                        <div
                          key={e.id}
                          onClick={() => {
                            onClose();
                            onNavigate('expenses');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--accent)';
                            ev.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                            ev.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <CategoryIcon category={e.category} size={15} />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {e.description}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                                <span>{e.category}</span>
                                <span>•</span>
                                <span>{fmtDate(e.date)}</span>
                                {friend && (
                                  <>
                                    <span>•</span>
                                    <span style={{ color: 'var(--accent)' }}>{friend.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
                            <div
                              style={{
                                fontSize: '13.5px',
                                fontWeight: 700,
                                color: isOut ? 'var(--debit)' : 'var(--credit)',
                              }}
                            >
                              {isOut ? '-' : '+'}{fmtMoney(Number(e.amount), currency)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contacts / Friends / Vendors / Subscriptions */}
              {matchingContacts.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Contacts & Vendors ({matchingContacts.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchingContacts.map(f => {
                      const bal = friendBalance(db, f.id);
                      const fType = f.type || 'friend';
                      const avatarStyle = getAvatarStyle(f.name);

                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            onClose();
                            onNavigate('friend-detail', f.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--accent)';
                            ev.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                            ev.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '12px',
                                fontWeight: 700,
                                flexShrink: 0,
                                ...avatarStyle,
                              }}
                            >
                              {fType === 'vendor' ? <Store size={14} /> : fType === 'subscription' ? <Tv size={14} /> : friendInitial(f.name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {f.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize', marginTop: '2px' }}>
                                {fType} {f.category ? `• ${f.category}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
                            {bal.net > 0.004 ? (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--credit)' }}>
                                Owes {fmtMoney(bal.owedToMe, currency)}
                              </span>
                            ) : bal.net < -0.004 ? (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--debit)' }}>
                                You owe {fmtMoney(bal.owedByMe, currency)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-3)' }}>
                                Settled
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Wallets */}
              {matchingWallets.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Wallets ({matchingWallets.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchingWallets.map(w => {
                      const bal = walletBalance(db, w.id);
                      return (
                        <div
                          key={w.id}
                          onClick={() => {
                            onClose();
                            onNavigate('wallets');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--accent)';
                            ev.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                            ev.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--surface3)',
                                border: '1px solid var(--border)',
                                color: 'var(--accent)',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              <WalletIcon size={16} />
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{w.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Wallet Account</div>
                            </div>
                          </div>

                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>
                            {fmtMoney(bal, currency)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Settlements */}
              {matchingSettlements.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Settlements ({matchingSettlements.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchingSettlements.map(s => {
                      const friend = friends.find(f => f.id === s.friendId);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            onClose();
                            onNavigate('settlements');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--accent)';
                            ev.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                            ev.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid var(--credit)',
                                color: 'var(--credit)',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              <Handshake size={15} />
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                                Settled with {friend?.name || 'Contact'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtDate(s.date)}</div>
                            </div>
                          </div>

                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--credit)' }}>
                            +{fmtMoney(Number(s.amount), currency)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trips */}
              {matchingTrips.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Trips ({matchingTrips.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchingTrips.map((t: Trip) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onClose();
                          onNavigate('split-trips');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={ev => {
                          ev.currentTarget.style.borderColor = 'var(--accent)';
                          ev.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={ev => {
                          ev.currentTarget.style.borderColor = 'var(--border)';
                          ev.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Compass size={18} style={{ color: 'var(--accent)' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{t.groupName || 'Trip Group'}</div>
                          </div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subscriptions / Recurring */}
              {matchingRecurring.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Recurring & Subscriptions ({matchingRecurring.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchingRecurring.map(r => (
                      <div
                        key={r.id}
                        onClick={() => {
                          onClose();
                          onNavigate('recurring');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={ev => {
                          ev.currentTarget.style.borderColor = 'var(--accent)';
                          ev.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={ev => {
                          ev.currentTarget.style.borderColor = 'var(--border)';
                          ev.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <RefreshCw size={16} style={{ color: 'var(--accent)' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>
                              {r.frequency} • {r.category}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {fmtMoney(Number(r.amount), currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-3)',
            backgroundColor: 'var(--surface2)',
          }}
        >
          <span>Context-aware search for <strong>{contextMeta.name}</strong></span>
          <span>Shortcut: <strong>Ctrl + K</strong></span>
        </div>
      </div>
    </div>
  );
}
