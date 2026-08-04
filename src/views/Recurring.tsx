import { useState, useMemo } from 'react';
import { RefreshCw, Zap, Plus, CheckCircle2, Trash2, Edit2, AlertTriangle, Search, User, Store, Tv } from 'lucide-react';
import { useStore } from '../store';
import type { RecurringRule, RecurringKind, ViewName } from '../types';
import { todayISO } from '../db';
import { fmtMoney, fmtDate } from '../utils';
import RecurringModal from '../components/RecurringModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CategoryIcon from '../components/CategoryIcon';

interface Props {
  onNavigate?: (v: ViewName, arg?: string) => void;
}

export default function Recurring({ onNavigate }: Props) {
  const { db, triggerAutopayDeduct, quickLogRecurringRule, deleteRecurringRule, showToast } = useStore();
  const currency = db.settings.currency;
  const today = todayISO();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'subscriptions' | 'logs'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [modalDefaultKind, setModalDefaultKind] = useState<RecurringKind>('autopay');
  const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null);

  const rules = useMemo(() => db.recurringRules || [], [db.recurringRules]);

  const autopayRules = useMemo(() => rules.filter(r => r.kind === 'autopay'), [rules]);
  const quickLogRules = useMemo(() => rules.filter(r => r.kind === 'quick_log'), [rules]);

  const filteredRules = useMemo(() => {
    let list = rules;
    if (activeTab === 'subscriptions') list = autopayRules;
    else if (activeTab === 'logs') list = quickLogRules;

    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  }, [rules, autopayRules, quickLogRules, activeTab, search]);

  const dueAutopays = useMemo(() => {
    return rules.filter(r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today);
  }, [rules, today]);

  const totalMonthlySubCost = useMemo(() => {
    return autopayRules
      .filter(r => r.status === 'active')
      .reduce((sum, r) => {
        let amt = Number(r.amount) || 0;
        const val = r.intervalValue || 1;
        if (r.frequency === 'daily') amt *= 30;
        else if (r.frequency === 'weekly') amt *= 4.33;
        else if (r.frequency === 'custom_months') amt = amt / val;
        else if (r.frequency === 'custom_days') amt = (amt / val) * 30;
        return sum + amt;
      }, 0);
  }, [autopayRules]);

  const handlePayDeduct = (rule: RecurringRule) => {
    triggerAutopayDeduct(rule.id);
  };

  const handleQuickLogToday = (rule: RecurringRule) => {
    quickLogRecurringRule(rule.id);
  };

  const handleDelete = (rule: RecurringRule) => {
    setDeletingRule(rule);
  };

  const getFrequencyLabel = (r: RecurringRule) => {
    const val = r.intervalValue || 1;
    switch (r.frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'custom_days': return `Every ${val}d`;
      case 'custom_months': return `Every ${val}mo`;
      default: return 'Monthly';
    }
  };

  return (
    <div className="view-container">
      {/* Top Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>Autopay</h1>
        </div>

        {/* Side-by-side Search Bar + Add New Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search..."
              style={{
                width: '100%',
                height: 40,
                fontSize: 13,
                paddingLeft: 36
              }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          </div>
          <button
            className="btn btn-primary"
            style={{
              height: 40,
              padding: '0 14px',
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onClick={() => {
              setModalDefaultKind('autopay');
              setEditingRule(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Add New
          </button>
        </div>
      </div>

      {/* Header Metric Card: Subscription Spend */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="card"
          style={{
            padding: '12px 14px',
            background: 'var(--surface)',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('subscriptions')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.4px' }}>
            <span>SUBSCRIPTION SPEND</span>
            <RefreshCw size={13} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>
            {fmtMoney(totalMonthlySubCost, currency)}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 3 }}>/mo</span>
          </div>
          {dueAutopays.length > 0 && (
            <div style={{ fontSize: 10.5, color: '#d32f2f', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} /> {dueAutopays.length} bill{dueAutopays.length > 1 ? 's' : ''} due
            </div>
          )}
        </div>
      </div>

      {/* Category / Part Tabs: Subscriptions vs Logs vs All */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        <button
          className={`btn btn-sm ${activeTab === 'subscriptions' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12, padding: '0 12px', height: 32, borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('subscriptions')}
        >
          <RefreshCw size={13} /> Subscriptions ({autopayRules.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12, padding: '0 12px', height: 32, borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('logs')}
        >
          <Zap size={13} /> Logs ({quickLogRules.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12, padding: '0 12px', height: 32, borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('all')}
        >
          All ({rules.length})
        </button>
      </div>


      {/* Subscriptions List - Stacked Vertically, Compact & Scannable */}
      {filteredRules.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 6px 0' }}>No items found</p>
          <button className="btn btn-primary btn-sm" style={{ margin: '8px auto 0 auto' }} onClick={() => setShowModal(true)}>
            <Plus size={14} /> Create Subscription or Quick Log
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredRules.map(r => {
            const isAutopay = r.kind === 'autopay';
            const isLoggedToday = r.lastLoggedDate === today;
            const isDueToday = isAutopay && r.nextDueDate === today;
            const isOverdue = isAutopay && r.nextDueDate && r.nextDueDate < today;
            const isDue = isDueToday || isOverdue;

            const cat = db.settings?.categories?.find(c => c.name.toLowerCase() === r.category.toLowerCase());
            const catColor = cat?.color || '#f87171';
            const catColorBg = catColor.startsWith('#') && catColor.length === 7
              ? `${catColor}25`
              : 'rgba(239, 68, 68, 0.2)';

            let dueText = '';
            let dueTextColor = 'var(--text-3)';
            if (isAutopay) {
              if (isDueToday) {
                dueText = 'Due today';
                dueTextColor = '#f87171';
              } else if (isOverdue) {
                dueText = `Overdue (${fmtDate(r.nextDueDate!)})`;
                dueTextColor = '#ef4444';
              } else if (r.nextDueDate) {
                dueText = `Due ${fmtDate(r.nextDueDate)}`;
                dueTextColor = 'var(--text-2)';
              } else {
                dueText = 'No due date';
              }
            } else {
              if (isLoggedToday) {
                dueText = 'Logged today ✓';
                dueTextColor = '#34d399';
              } else {
                dueText = 'Not logged today';
                dueTextColor = 'var(--text-3)';
              }
            }

            const linkedFriend = r.friendId ? db.friends.find(f => f.id === r.friendId) : null;

            return (
              <div
                key={r.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  background: 'var(--surface)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  borderLeft: isDue ? '4px solid #f87171' : (isAutopay ? '4px solid #38bdf8' : '4px solid var(--border)'),
                  opacity: r.status === 'paused' ? 0.65 : 1,
                }}
              >
                {/* Top Row: Icon + Title/Subtitle on Left, Amount + Due Text on Right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: catColorBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CategoryIcon category={r.category} icon={cat?.icon} size={22} style={{ color: catColor }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                        {r.status === 'paused' && (
                          <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                            Paused
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.category} · {getFrequencyLabel(r)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {fmtMoney(r.amount, currency)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: dueTextColor, whiteSpace: 'nowrap' }}>
                      {dueText}
                    </div>
                  </div>
                </div>

                {/* Horizontal Divider */}
                <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />

                {/* Bottom Row: Badge on Left, Action Buttons on Right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '3px 9px',
                      borderRadius: 6,
                      background: isAutopay ? 'rgba(56, 189, 248, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      color: isAutopay ? 'var(--info)' : '#d97706',
                      border: isAutopay ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                    }}>
                      {isAutopay ? 'Subscription' : 'Log'}
                    </span>

                    {linkedFriend && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: 'var(--surface2)',
                          color: 'var(--accent)',
                          border: '1px solid var(--border)',
                          cursor: onNavigate ? 'pointer' : 'default',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          whiteSpace: 'nowrap'
                        }}
                        onClick={(e) => {
                          if (onNavigate) {
                            e.stopPropagation();
                            onNavigate('friend-detail', linkedFriend.id);
                          }
                        }}
                        title={`View ${linkedFriend.name} details`}
                      >
                        {linkedFriend.type === 'vendor' ? (
                          <Store size={12} style={{ flexShrink: 0 }} />
                        ) : linkedFriend.type === 'subscription' ? (
                          <Tv size={12} style={{ flexShrink: 0 }} />
                        ) : (
                          <User size={12} style={{ flexShrink: 0 }} />
                        )}
                        <span>{linkedFriend.name}</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isAutopay ? (
                      <button
                        className="btn btn-sm"
                        style={{
                          height: 36,
                          padding: '0 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 8,
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onClick={() => handlePayDeduct(r)}
                        disabled={r.status === 'paused'}
                      >
                        <CheckCircle2 size={15} /> Pay
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{
                          height: 36,
                          padding: '0 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 8,
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onClick={() => handleQuickLogToday(r)}
                        disabled={r.status === 'paused'}
                      >
                        <Zap size={15} style={{ color: '#f59e0b' }} /> Log
                      </button>
                    )}

                    <button
                      className="btn-icon"
                      style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      onClick={() => {
                        setEditingRule(r);
                        setShowModal(true);
                      }}
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>

                    <button
                      className="btn-icon"
                      style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: '#f87171' }}
                      onClick={() => handleDelete(r)}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <RecurringModal
          rule={editingRule}
          defaultKind={modalDefaultKind}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRule && (
        <ConfirmDialog
          title="Delete Recurring Rule"
          message={`Are you sure you want to delete "${deletingRule.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteRecurringRule(deletingRule.id);
            showToast(`Deleted "${deletingRule.title}"`);
            setDeletingRule(null);
          }}
          onClose={() => setDeletingRule(null)}
        />
      )}
    </div>
  );
}
