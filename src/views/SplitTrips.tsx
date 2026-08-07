/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Receipt,
  History as HistoryIcon,
  Archive,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  PieChart,
  BarChart2,
  Check,
  UserPlus,
  Handshake,
  Pencil,
  Users,
  Award
} from 'lucide-react';
import { useStore } from '../store';
import type { Trip, TripExpense, TripGroup, TripMember } from '../types';
import { fmtMoney } from '../utils';
import ConfirmDialog from '../components/ConfirmDialog';

// Helper storage keys
const STORAGE_KEY_ACTIVE_TRIP = 'okane_active_trip_v1';
const STORAGE_KEY_TRIP_HISTORY = 'okane_trip_history_v1';
const STORAGE_KEY_PRESET_GROUPS = 'okane_preset_groups_v1';

export interface DebtTransaction {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
}

export function simplifyDebts(members: TripMember[], expenses: TripExpense[]) {
  const balances: Record<string, { paid: number; share: number; net: number }> = {};
  members.forEach(m => {
    balances[m.id] = { paid: 0, share: 0, net: 0 };
  });

  let totalSpend = 0;

  expenses.forEach(exp => {
    const amt = Number(exp.amount) || 0;
    totalSpend += amt;

    // Paid amount
    if (balances[exp.paidByMemberId]) {
      balances[exp.paidByMemberId].paid += amt;
    }

    if (exp.splitMode === 'equal') {
      const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
        ? exp.splitMemberIds
        : members.map(m => m.id);
      const perShare = splitList.length > 0 ? amt / splitList.length : 0;
      splitList.forEach(mId => {
        if (balances[mId]) {
          balances[mId].share += perShare;
        }
      });
    } else if (exp.splitMode === 'custom' && exp.customSplits) {
      Object.entries(exp.customSplits).forEach(([mId, customAmt]) => {
        if (balances[mId]) {
          balances[mId].share += Number(customAmt) || 0;
        }
      });
    }
  });

  members.forEach(m => {
    const b = balances[m.id];
    if (b) {
      b.net = b.paid - b.share;
    }
  });

  const perPersonAvg = members.length > 0 ? totalSpend / members.length : 0;

  const debtors: { id: string; name: string; amount: number }[] = [];
  const creditors: { id: string; name: string; amount: number }[] = [];

  members.forEach(m => {
    const net = balances[m.id]?.net || 0;
    if (net < -0.01) {
      debtors.push({ id: m.id, name: m.name, amount: Math.abs(net) });
    } else if (net > 0.01) {
      creditors.push({ id: m.id, name: m.name, amount: net });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: DebtTransaction[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      transactions.push({
        fromMemberId: debtor.id,
        fromName: debtor.name,
        toMemberId: creditor.id,
        toName: creditor.name,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return { balances, transactions, totalSpend, perPersonAvg };
}

export default function SplitTrips() {
  const { db, showToast } = useStore();
  const currency = db.settings.currency || '₹';

  // Active Trip State
  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TRIP);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sub-navigation view modes: 'home' | 'expenses' | 'settle' | 'history' | 'archive-detail'
  const [subView, setSubView] = useState<'home' | 'expenses' | 'settle' | 'history' | 'archive-detail'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TRIP);
      return saved ? 'expenses' : 'home';
    } catch {
      return 'home';
    }
  });

  // Settle Tab Filter: 'who-pays' | 'net-balances' | 'breakdown'
  const [settleTab, setSettleTab] = useState<'who-pays' | 'net-balances' | 'breakdown'>('who-pays');

  // Archived Trips History
  const [tripHistory, setTripHistory] = useState<Trip[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRIP_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Preset Groups
  const [presetGroups, setPresetGroups] = useState<TripGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRESET_GROUPS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.filter((g: TripGroup) => !['grp_1', 'grp_2', 'grp_3'].includes(g.id));
      }
    } catch {
      // fallback default
    }
    return [];
  });

  // Selected Archived Trip for Archive Detail View
  const [selectedArchivedTrip, setSelectedArchivedTrip] = useState<Trip | null>(null);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Sync state to local storage
  useEffect(() => {
    try {
      if (activeTrip) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_TRIP, JSON.stringify(activeTrip));
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_TRIP);
      }
    } catch {
      // ignore
    }
  }, [activeTrip]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRIP_HISTORY, JSON.stringify(tripHistory));
    } catch {
      // ignore
    }
  }, [tripHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRESET_GROUPS, JSON.stringify(presetGroups));
    } catch {
      // ignore
    }
  }, [presetGroups]);

  // -------------------------------------------------------------
  // HOME SCREEN STATE (Group & Trip Setup)
  // -------------------------------------------------------------
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => presetGroups[0]?.id || '');
  const [tripName, setTripName] = useState<string>('');
  const [customGroupMembers, setCustomGroupMembers] = useState<string[]>(['You']);
  const [newMemberInput, setNewMemberInput] = useState<string>('');
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState<boolean>(() => presetGroups.length === 0);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const handleStartEditGroup = (grp: TripGroup, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setEditingGroupId(grp.id);
    setNewGroupName(grp.name);
    setCustomGroupMembers([...grp.memberNames]);
    setIsCreatingNewGroup(true);
  };

  const handleCancelGroupEdit = () => {
    setEditingGroupId(null);
    setNewGroupName('');
    if (presetGroups.length > 0) {
      setIsCreatingNewGroup(false);
    }
  };

  const handleSaveOrUpdateGroup = () => {
    const trimmedName = newGroupName.trim() || 'My Group';
    if (customGroupMembers.length < 1) {
      showToast('Group must have at least 1 member');
      return;
    }

    if (editingGroupId) {
      const updated = presetGroups.map(g => {
        if (g.id === editingGroupId) {
          return { ...g, name: trimmedName, memberNames: customGroupMembers };
        }
        return g;
      });
      setPresetGroups(updated);
      setSelectedGroupId(editingGroupId);
      showToast(`Group "${trimmedName}" updated`);
    } else {
      const newGrp: TripGroup = {
        id: 'grp_' + Date.now(),
        name: trimmedName,
        memberNames: customGroupMembers,
      };
      setPresetGroups([...presetGroups, newGrp]);
      setSelectedGroupId(newGrp.id);
      showToast(`Group "${trimmedName}" created`);
    }
    setEditingGroupId(null);
    setNewGroupName('');
    setIsCreatingNewGroup(false);
  };

  const handleDeleteGroup = (groupId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const g = presetGroups.find(p => p.id === groupId);
    if (!g) return;
    const updated = presetGroups.filter(p => p.id !== groupId);
    setPresetGroups(updated);
    if (selectedGroupId === groupId) {
      setSelectedGroupId(updated[0]?.id || '');
    }
    if (editingGroupId === groupId) {
      setEditingGroupId(null);
      setNewGroupName('');
    }
    if (updated.length === 0) {
      setIsCreatingNewGroup(true);
    }
    showToast(`Group "${g.name}" deleted`);
  };

  // Selected group members for starting a trip
  const currentMembersList = useMemo(() => {
    if (isCreatingNewGroup) return customGroupMembers;
    const g = presetGroups.find(p => p.id === selectedGroupId);
    return g ? g.memberNames : ['You', 'Member 1'];
  }, [selectedGroupId, presetGroups, isCreatingNewGroup, customGroupMembers]);

  const handleAddMemberToCustom = () => {
    const trimmed = newMemberInput.trim();
    if (!trimmed) return;
    if (customGroupMembers.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Member already added');
      return;
    }
    setCustomGroupMembers([...customGroupMembers, trimmed]);
    setNewMemberInput('');
  };

  const handleRemoveMemberFromCustom = (name: string) => {
    if (customGroupMembers.length <= 1) {
      showToast('At least 1 member is required');
      return;
    }
    setCustomGroupMembers(customGroupMembers.filter(m => m !== name));
  };

  const handleStartTrip = () => {
    const finalTripName = tripName.trim() || 'New Trip';
    let gName = 'Custom Group';

    if (isCreatingNewGroup) {
      gName = newGroupName.trim() || 'Custom Group';
      if (newGroupName.trim() && !editingGroupId) {
        const newGrp: TripGroup = {
          id: 'grp_' + Date.now(),
          name: gName,
          memberNames: customGroupMembers,
        };
        setPresetGroups([...presetGroups, newGrp]);
        setSelectedGroupId(newGrp.id);
      }
    } else {
      const g = presetGroups.find(p => p.id === selectedGroupId);
      if (g) gName = g.name;
    }

    const memberObjs: TripMember[] = currentMembersList.map((mName, idx) => ({
      id: `mem_${idx}_${mName.toLowerCase().replace(/\s+/g, '_')}`,
      name: mName,
    }));

    const newTrip: Trip = {
      id: 'trip_' + Date.now(),
      name: finalTripName,
      groupName: gName,
      members: memberObjs,
      expenses: [],
      status: 'active',
      createdAt: Date.now(),
    };

    setActiveTrip(newTrip);
    setTripName('');
    showToast(`Started trip "${finalTripName}"`);
    setSubView('expenses');
  };

  // -------------------------------------------------------------
  // EXPENSE FORM STATE (Active Trip)
  // -------------------------------------------------------------
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('');
  const [expSplitMode, setExpSplitMode] = useState<'equal' | 'custom'>('equal');
  const [expSplitMembers, setExpSplitMembers] = useState<string[]>([]);
  const [expCustomSplits, setExpCustomSplits] = useState<Record<string, string>>({});

  const effectivePaidBy = expPaidBy || (activeTrip?.members[0]?.id ?? '');
  const effectiveSplitMembers = expSplitMembers.length > 0 ? expSplitMembers : (activeTrip?.members.map(m => m.id) ?? []);

  const toggleSplitMember = (mId: string) => {
    const list = effectiveSplitMembers;
    if (list.includes(mId)) {
      if (list.length <= 1) {
        showToast('At least 1 member must split');
        return;
      }
      setExpSplitMembers(list.filter(id => id !== mId));
    } else {
      setExpSplitMembers([...list, mId]);
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;

    const desc = expDesc.trim() || 'General Expense';
    const numAmt = parseFloat(expAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      showToast('Please enter a valid expense amount');
      return;
    }

    const paidBy = effectivePaidBy;
    let finalCustomSplits: Record<string, number> | undefined = undefined;

    if (expSplitMode === 'custom') {
      const parsedSplits: Record<string, number> = {};
      let totalCustomSum = 0;
      activeTrip.members.forEach(m => {
        const val = parseFloat(expCustomSplits[m.id] || '0');
        parsedSplits[m.id] = isNaN(val) ? 0 : val;
        totalCustomSum += parsedSplits[m.id];
      });

      if (Math.abs(totalCustomSum - numAmt) > 0.5) {
        showToast(`Custom split sum (${currency}${totalCustomSum.toFixed(2)}) must equal total amount (${currency}${numAmt.toFixed(2)})`);
        return;
      }
      finalCustomSplits = parsedSplits;
    }

    const newExpense: TripExpense = {
      id: 'exp_' + Date.now(),
      description: desc,
      amount: numAmt,
      paidByMemberId: paidBy,
      splitMode: expSplitMode,
      splitMemberIds: effectiveSplitMembers,
      customSplits: finalCustomSplits,
      createdAt: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };

    const updatedTrip: Trip = {
      ...activeTrip,
      expenses: [newExpense, ...activeTrip.expenses],
    };

    setActiveTrip(updatedTrip);
    setExpDesc('');
    setExpAmount('');
    setExpCustomSplits({});
    showToast(`Added "${desc}" (${currency}${numAmt})`);
  };

  const handleDeleteExpense = (expId: string) => {
    if (!activeTrip) return;
    const updated: Trip = {
      ...activeTrip,
      expenses: activeTrip.expenses.filter(e => e.id !== expId),
    };
    setActiveTrip(updated);
    showToast('Expense removed');
  };

  // -------------------------------------------------------------
  // SETTLE & ARCHIVE ACTIONS
  // -------------------------------------------------------------
  const handleCancelActiveTrip = () => {
    if (!activeTrip) return;
    setConfirmDialog({
      open: true,
      title: 'Cancel Active Trip',
      message: `Are you sure you want to cancel and discard active trip "${activeTrip.name}"? All logged trip expenses will be removed.`,
      confirmLabel: 'Discard Trip',
      danger: true,
      onConfirm: () => {
        setActiveTrip(null);
        showToast(`Cancelled active trip "${activeTrip.name}"`);
        setSubView('home');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleArchiveAndStartNew = () => {
    if (!activeTrip) return;
    const archived: Trip = {
      ...activeTrip,
      status: 'archived',
      archivedAt: Date.now(),
    };
    setTripHistory([archived, ...tripHistory]);
    setActiveTrip(null);
    showToast(`Archived "${activeTrip.name}" to History`);
    setSubView('history');
  };

  const handleDeleteArchivedTrip = (tripId: string) => {
    const target = tripHistory.find(t => t.id === tripId);
    setConfirmDialog({
      open: true,
      title: 'Delete Trip Record',
      message: `Are you sure you want to delete "${target?.name || 'this trip'}" from history? This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setTripHistory(prev => prev.filter(t => t.id !== tripId));
        if (selectedArchivedTrip?.id === tripId) {
          setSelectedArchivedTrip(null);
          setSubView('history');
        }
        showToast('Trip deleted from history');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleClearAllHistory = () => {
    setConfirmDialog({
      open: true,
      title: 'Clear Trip History',
      message: 'Are you sure you want to clear all archived trip history permanently? This action cannot be undone.',
      confirmLabel: 'Clear All',
      danger: true,
      onConfirm: () => {
        setTripHistory([]);
        setSelectedArchivedTrip(null);
        showToast('Cleared trip history');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  // Expandable breakdown state
  const [expandedBreakdownMember, setExpandedBreakdownMember] = useState<string | null>(null);

  // Computed metrics for active trip
  const activeTripSummary = useMemo(() => {
    if (!activeTrip) return null;
    return simplifyDebts(activeTrip.members, activeTrip.expenses);
  }, [activeTrip]);

  // Computed metrics for selected archived trip
  const archiveTripSummary = useMemo(() => {
    if (!selectedArchivedTrip) return null;
    return simplifyDebts(selectedArchivedTrip.members, selectedArchivedTrip.expenses);
  }, [selectedArchivedTrip]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* UNIFIED PAGE HEADER */}
      <div className="page-header" style={{ marginBottom: 0, gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Split & Trips</h1>
        </div>

        {/* Topbar Navigation Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {activeTrip && (
            <button
              type="button"
              className={`btn ${subView === 'expenses' || subView === 'settle' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSubView('expenses')}
              style={{ fontSize: '12.5px', padding: '6px 11px', gap: 5, borderRadius: '8px' }}
            >
              <Receipt size={14} />
              <span>Active Trip ({activeTrip.name})</span>
            </button>
          )}

          <button
            type="button"
            className={`btn ${subView === 'home' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubView('home')}
            style={{ fontSize: '12.5px', padding: '6px 11px', gap: 5, borderRadius: '8px' }}
          >
            <Plus size={14} />
            <span>New Trip</span>
          </button>

          <button
            type="button"
            className={`btn ${subView === 'history' || subView === 'archive-detail' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubView('history')}
            style={{ fontSize: '12.5px', padding: '6px 11px', gap: 5, borderRadius: '8px' }}
          >
            <HistoryIcon size={14} />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTIVE TRIP CONTEXT STRIP (When on expenses or settle view) */}
      {/* ========================================================================= */}
      {(subView === 'expenses' || subView === 'settle') && activeTrip && activeTripSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Active Trip Header Bar */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{activeTrip.name}</span>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 99,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)'
                }}>
                  {activeTrip.groupName}
                </span>
              </div>
            </div>

            {/* View Mode Toggle & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setSubView('expenses')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    background: subView === 'expenses' ? 'var(--surface)' : 'transparent',
                    color: subView === 'expenses' ? 'var(--accent)' : 'var(--text-2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: subView === 'expenses' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <Receipt size={13} />
                  <span>Expenses</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubView('settle')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    background: subView === 'settle' ? 'var(--surface)' : 'transparent',
                    color: subView === 'settle' ? 'var(--accent)' : 'var(--text-2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: subView === 'settle' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <Handshake size={13} />
                  <span>Settle Up</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCancelActiveTrip}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '12px',
                  padding: '5px 10px',
                  color: '#ef4444',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Cancel Active Trip"
              >
                <Trash2 size={13} />
                <span>Cancel Trip</span>
              </button>
            </div>
          </div>

          {/* Sleek, Compact Stats Metric Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px'
          }}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', fontWeight: 700 }}>
                Total Spend
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                {fmtMoney(activeTripSummary.totalSpend, currency)}
              </span>
            </div>

            <div style={{
              background: 'var(--surface)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', fontWeight: 700 }}>
                Per Person Avg
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)' }}>
                ~{fmtMoney(activeTripSummary.perPersonAvg, currency)}
              </span>
            </div>

            <div style={{
              background: 'var(--surface)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', fontWeight: 700 }}>
                Logged Items
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                {activeTrip.expenses.length} Expenses
              </span>
            </div>

            <div style={{
              background: 'var(--surface)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', fontWeight: 700 }}>
                Group Size
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                {activeTrip.members.length} Members
              </span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 1: HOME (Pick or Create Group & Start Trip) */}
      {/* ========================================================================= */}
      {subView === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Active Trip Banner if present */}
          {activeTrip && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                    Active Trip: "{activeTrip.name}"
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    {activeTrip.groupName} • {activeTrip.members.length} Members • {activeTrip.expenses.length} Expenses
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCancelActiveTrip}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '12px', padding: '5px 10px', color: '#ef4444', gap: 4 }}
                  title="Cancel active trip"
                >
                  <Trash2 size={13} />
                  <span>Cancel Trip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubView('expenses')}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '12px', padding: '5px 12px', gap: 5 }}
                >
                  <span>Resume Trip</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          <div style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Start a New Split Trip
            </h2>

            {/* Trip Name */}
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                Trip Name
              </label>
              <input
                type="text"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                placeholder="e.g. Goa Trip, Weekend Getaway, Dinner Party"
                className="form-control"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            {/* Select or Create Group */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
                  Group Members
                </label>
                {presetGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewGroup(!isCreatingNewGroup);
                      setEditingGroupId(null);
                      setNewGroupName('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {isCreatingNewGroup ? (
                      <>
                        <Users size={12} />
                        <span>Use Saved Group</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Create New Group</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {!isCreatingNewGroup && presetGroups.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {presetGroups.map(grp => {
                    const isSelected = selectedGroupId === grp.id;
                    return (
                      <div
                        key={grp.id}
                        onClick={() => setSelectedGroupId(grp.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 4
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isSelected && <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />}
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>{grp.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button
                              type="button"
                              onClick={(e) => handleStartEditGroup(grp, e)}
                              title="Edit Group"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '3px',
                                borderRadius: '4px',
                                color: 'var(--text-3)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteGroup(grp.id, e)}
                              title="Delete Group"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '3px',
                                borderRadius: '4px',
                                color: 'var(--text-3)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {grp.memberNames.join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface2)', padding: '12px', borderRadius: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 3 }}>
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="e.g. Goa Squad, Flatmates"
                      className="form-control"
                      style={{ width: '100%', fontSize: '12.5px', padding: '5px 8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                      Group Members ({customGroupMembers.length})
                    </label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input
                        type="text"
                        value={newMemberInput}
                        onChange={e => setNewMemberInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMemberToCustom(); } }}
                        placeholder="Type member name (e.g. Alex)"
                        className="form-control"
                        style={{ flex: 1, fontSize: '12.5px', padding: '5px 8px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddMemberToCustom}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '12px', padding: '5px 10px', gap: 4 }}
                      >
                        <UserPlus size={13} />
                        <span>Add</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {customGroupMembers.map(mName => (
                        <span
                          key={mName}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>{mName}</span>
                          {customGroupMembers.length > 1 && (
                            <X
                              size={11}
                              style={{ cursor: 'pointer', color: 'var(--text-3)' }}
                              onClick={() => handleRemoveMemberFromCustom(mName)}
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Save / Update Group controls */}
                  <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
                    <button
                      type="button"
                      onClick={handleSaveOrUpdateGroup}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px', padding: '4px 10px', fontWeight: 600 }}
                    >
                      {editingGroupId ? 'Update Group' : 'Save Group'}
                    </button>
                    {(editingGroupId || presetGroups.length > 0) && (
                      <button
                        type="button"
                        onClick={handleCancelGroupEdit}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Import from Okane Contacts Option */}
                  {db.friends.length > 0 && (
                    <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                        Import from Contacts:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {db.friends.map(f => {
                          const exists = customGroupMembers.some(m => m.toLowerCase() === f.name.toLowerCase());
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                if (!exists) setCustomGroupMembers([...customGroupMembers, f.name]);
                              }}
                              disabled={exists}
                              style={{
                                fontSize: '10.5px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: exists ? 'var(--surface3)' : 'var(--surface)',
                                color: exists ? 'var(--text-3)' : 'var(--text)',
                                cursor: exists ? 'default' : 'pointer'
                              }}
                            >
                              + {f.name} {exists ? '✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleStartTrip}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>Start Trip →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: EXPENSES (Active Trip Expense Logging) */}
      {/* ========================================================================= */}
      {subView === 'expenses' && activeTrip && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          
          {/* ADD EXPENSE FORM */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            height: 'fit-content'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Receipt size={16} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Add Expense
              </h3>
            </div>

            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Description */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 3 }}>
                  Description
                </label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  placeholder="e.g. Hotel, Dinner, Fuel"
                  className="form-control"
                  style={{ width: '100%', fontSize: '12.5px' }}
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 3 }}>
                  Amount ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  placeholder="0.00"
                  className="form-control"
                  style={{ width: '100%', fontSize: '14px', fontWeight: 700 }}
                  required
                />
              </div>

              {/* Who Paid */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 3 }}>
                  Who Paid?
                </label>
                <select
                  value={effectivePaidBy}
                  onChange={e => setExpPaidBy(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', fontSize: '12.5px' }}
                >
                  {activeTrip.members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Split Mode Toggle */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                  Split Mode
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setExpSplitMode('equal')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: expSplitMode === 'equal' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: expSplitMode === 'equal' ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer'
                    }}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpSplitMode('custom')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: expSplitMode === 'custom' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: expSplitMode === 'custom' ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer'
                    }}
                  >
                    Custom Amounts
                  </button>
                </div>
              </div>

              {/* Participating Members for Equal Split */}
              {expSplitMode === 'equal' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                    Who's Splitting?
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {activeTrip.members.map(m => {
                      const isSelected = effectiveSplitMembers.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleSplitMember(m.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-3)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          {isSelected && <Check size={11} />}
                          <span>{m.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Amounts Input per Person */}
              {expSplitMode === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--surface2)', padding: '8px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-3)' }}>
                    Specify exact amount per person:
                  </span>
                  {activeTrip.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={expCustomSplits[m.id] || ''}
                        onChange={e => setExpCustomSplits({ ...expCustomSplits, [m.id]: e.target.value })}
                        className="form-control"
                        style={{ width: '85px', fontSize: '11.5px', padding: '3px 6px', textAlign: 'right' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  marginTop: '4px',
                  padding: '8px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5
                }}
              >
                <Plus size={15} />
                <span>Add Expense</span>
              </button>
            </form>
          </div>

          {/* EXPENSES LIST */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Expenses List ({activeTrip.expenses.length})
              </h3>
              {activeTrip.expenses.length > 0 && (
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)' }}>
                  Total: {fmtMoney(activeTripSummary?.totalSpend || 0, currency)}
                </span>
              )}
            </div>

            {activeTrip.expenses.length === 0 ? (
              <div style={{
                padding: '30px 16px',
                textAlign: 'center',
                color: 'var(--text-3)',
                fontSize: '12px',
                fontStyle: 'italic',
                background: 'var(--surface2)',
                borderRadius: '10px'
              }}>
                No expenses added yet. Add an expense using the form to start splitting.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeTrip.expenses.map(exp => {
                  const paidByMember = activeTrip.members.find(m => m.id === exp.paidByMemberId);
                  return (
                    <div
                      key={exp.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {exp.description}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span>Paid by <strong style={{ color: 'var(--text)' }}>{paidByMember?.name || 'Member'}</strong></span>
                          <span>•</span>
                          <span style={{
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'var(--surface)',
                            fontSize: '10px',
                            fontWeight: 600
                          }}>
                            {exp.splitMode === 'equal' ? 'Equal' : 'Custom'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                          {fmtMoney(exp.amount, currency)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          title="Delete Expense"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: SETTLE VIEW (Compact & Meaningful) */}
      {/* ========================================================================= */}
      {subView === 'settle' && activeTripSummary && activeTrip && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Sub-Tabs for Settle View: Who Pays Whom | Net Balances | Breakdown */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSettleTab('who-pays')}
              className={`btn btn-sm ${settleTab === 'who-pays' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '12px', padding: '5px 12px', gap: 5 }}
            >
              <Handshake size={13} />
              <span>Who Pays Whom ({activeTripSummary.transactions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSettleTab('net-balances')}
              className={`btn btn-sm ${settleTab === 'net-balances' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '12px', padding: '5px 12px', gap: 5 }}
            >
              <PieChart size={13} />
              <span>Net Balances</span>
            </button>

            <button
              type="button"
              onClick={() => setSettleTab('breakdown')}
              className={`btn btn-sm ${settleTab === 'breakdown' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '12px', padding: '5px 12px', gap: 5 }}
            >
              <BarChart2 size={13} />
              <span>Breakdown & Stats</span>
            </button>
          </div>

          {/* TAB 1: WHO PAYS WHOM */}
          {settleTab === 'who-pays' && (
            <div style={{
              background: 'var(--surface)',
              borderRadius: '14px',
              border: '1px solid var(--border)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Handshake size={16} style={{ color: 'var(--accent)' }} />
                  <span>Settlement Transactions</span>
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Minimized transactions</span>
              </div>

              {activeTripSummary.transactions.length === 0 ? (
                <div style={{ padding: '20px', background: 'var(--surface2)', borderRadius: '10px', fontSize: '12.5px', color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center' }}>
                  🎉 Everyone is completely settled up! No transactions needed.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                  {activeTripSummary.transactions.map((tx, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {tx.fromName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>pays</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                          {tx.toName}
                        </span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                        {fmtMoney(tx.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Archive Action */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleArchiveAndStartNew}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', padding: '6px 14px', gap: 6 }}
                >
                  <Archive size={14} style={{ color: 'var(--accent)' }} />
                  <span>Archive & Finish Trip</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: NET BALANCES */}
          {settleTab === 'net-balances' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Compact Header Summary Strip */}
              <div style={{
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <PieChart size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>
                      Net Balances Overview
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {activeTrip.members.length} Members • Total Spend: {fmtMoney(activeTripSummary.totalSpend, currency)} • Target Share: ~{fmtMoney(activeTripSummary.perPersonAvg, currency)}/person
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: activeTripSummary.transactions.length === 0 ? 'rgba(34, 197, 94, 0.12)' : 'var(--surface2)',
                    color: activeTripSummary.transactions.length === 0 ? '#22c55e' : 'var(--text-2)',
                    border: '1px solid var(--border)'
                  }}>
                    {activeTripSummary.transactions.length === 0 ? '✓ Fully Settled' : `${activeTripSummary.transactions.length} Transfers Pending`}
                  </span>
                </div>
              </div>

              {/* Member Net Balance List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeTrip.members.map(m => {
                  const b = activeTripSummary.balances[m.id] || { paid: 0, share: 0, net: 0 };
                  const isPositive = b.net > 0.01;
                  const isNegative = b.net < -0.01;

                  const maxVal = Math.max(...activeTrip.members.map(mem => (activeTripSummary.balances[mem.id]?.paid || 0)), activeTripSummary.perPersonAvg, 1);
                  const paidPct = Math.min(100, Math.max(0, (b.paid / maxVal) * 100));
                  const sharePct = Math.min(100, Math.max(0, (b.share / maxVal) * 100));
                  const initial = m.name ? m.name.charAt(0).toUpperCase() : '?';

                  return (
                    <div
                      key={m.id}
                      style={{
                        background: 'var(--surface)',
                        borderRadius: '12px',
                        border: isPositive
                          ? '1px solid rgba(34, 197, 94, 0.25)'
                          : isNegative
                          ? '1px solid rgba(239, 68, 68, 0.25)'
                          : '1px solid var(--border)',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top row: Avatar, Name, Status, Net Amount */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isPositive
                              ? 'rgba(34, 197, 94, 0.15)'
                              : isNegative
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'var(--surface2)',
                            color: isPositive ? '#22c55e' : isNegative ? '#ef4444' : 'var(--text-2)',
                            fontWeight: 700,
                            fontSize: '13px',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0
                          }}>
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{m.name}</span>
                              {m.name.toLowerCase() === 'you' && (
                                <span style={{ fontSize: '10px', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>You</span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                              Paid {fmtMoney(b.paid, currency)} • Share {fmtMoney(b.share, currency)}
                            </div>
                          </div>
                        </div>

                        {/* Net Badge */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: isPositive ? '#22c55e' : isNegative ? '#ef4444' : 'var(--text-2)'
                          }}>
                            {isPositive ? `+${fmtMoney(b.net, currency)}` : fmtMoney(b.net, currency)}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            color: isPositive ? '#22c55e' : isNegative ? '#ef4444' : 'var(--text-3)'
                          }}>
                            {isPositive ? 'Gets Back' : isNegative ? 'Owes Group' : 'Settled'}
                          </div>
                        </div>
                      </div>

                      {/* Visual comparison bar: Paid vs Share */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)' }}>
                          <span>Paid ({fmtMoney(b.paid, currency)})</span>
                          <span>Fair Share ({fmtMoney(b.share, currency)})</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '99px', background: 'var(--surface2)', overflow: 'hidden', position: 'relative', width: '100%' }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${paidPct}%`,
                            background: isPositive ? '#22c55e' : isNegative ? '#ef4444' : 'var(--accent)',
                            borderRadius: '99px'
                          }} />
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: `${Math.min(paidPct, sharePct)}%`,
                            height: '100%',
                            width: `${Math.abs(paidPct - sharePct)}%`,
                            background: isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BREAKDOWN & STATS */}
          {settleTab === 'breakdown' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* KPI Stats Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '8px'
              }}>
                <div style={{
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Receipt size={12} style={{ color: 'var(--accent)' }} />
                    <span>Total Spend</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                    {fmtMoney(activeTripSummary.totalSpend, currency)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                    {activeTrip.expenses.length} logged expense{activeTrip.expenses.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div style={{
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Award size={12} style={{ color: '#eab308' }} />
                    <span>Top Payer</span>
                  </div>
                  {(() => {
                    let topMember = activeTrip.members[0];
                    let maxPaid = -1;
                    activeTrip.members.forEach(m => {
                      const paid = activeTripSummary.balances[m.id]?.paid || 0;
                      if (paid > maxPaid) {
                        maxPaid = paid;
                        topMember = m;
                      }
                    });
                    return (
                      <>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {topMember ? topMember.name : 'None'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                          Paid {fmtMoney(maxPaid > 0 ? maxPaid : 0, currency)}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div style={{
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <BarChart2 size={12} style={{ color: '#3b82f6' }} />
                    <span>Average Share</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)' }}>
                    {fmtMoney(activeTripSummary.perPersonAvg, currency)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                    across {activeTrip.members.length} members
                  </div>
                </div>
              </div>

              {/* Member Contribution Percentages */}
              <div style={{
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart2 size={15} style={{ color: 'var(--accent)' }} />
                  <span>Spending Contribution Breakdown</span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeTrip.members.map(m => {
                    const b = activeTripSummary.balances[m.id] || { paid: 0, share: 0, net: 0 };
                    const pct = activeTripSummary.totalSpend > 0 ? (b.paid / activeTripSummary.totalSpend) * 100 : 0;

                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                            {fmtMoney(b.paid, currency)} <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '99px', background: 'var(--surface2)', overflow: 'hidden', width: '100%' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                            background: 'var(--accent-gradient)',
                            borderRadius: '99px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Itemized Member Transactions Accordion */}
              <div style={{
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    Itemized Member Transactions
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    Click member to expand
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeTrip.members.map(m => {
                    const isExpanded = expandedBreakdownMember === m.id;
                    const b = activeTripSummary.balances[m.id] || { paid: 0, share: 0, net: 0 };

                    return (
                      <div
                        key={m.id}
                        style={{
                          borderRadius: '10px',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          onClick={() => setExpandedBreakdownMember(isExpanded ? null : m.id)}
                          style={{
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                              {m.name}
                            </span>
                            <span style={{
                              fontSize: '10.5px',
                              padding: '2px 8px',
                              borderRadius: 99,
                              background: b.net >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: b.net >= 0 ? '#22c55e' : '#ef4444',
                              fontWeight: 700
                            }}>
                              Net: {b.net >= 0 ? `+${fmtMoney(b.net, currency)}` : fmtMoney(b.net, currency)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)' }}>
                            <span style={{ fontSize: '11px' }}>
                              {activeTrip.expenses.filter(e => e.paidByMemberId === m.id || (e.splitMemberIds && e.splitMemberIds.includes(m.id))).length} items
                            </span>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ padding: '0 12px 12px 12px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                            {activeTrip.expenses.length === 0 ? (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic', padding: '6px 0' }}>
                                No expenses logged yet.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {activeTrip.expenses.map(exp => {
                                  const isPayer = exp.paidByMemberId === m.id;
                                  let memberShare = 0;

                                  if (exp.splitMode === 'equal') {
                                    const splitList = exp.splitMemberIds && exp.splitMemberIds.length > 0
                                      ? exp.splitMemberIds
                                      : activeTrip.members.map(mem => mem.id);
                                    if (splitList.includes(m.id)) {
                                      memberShare = exp.amount / splitList.length;
                                    }
                                  } else if (exp.splitMode === 'custom' && exp.customSplits) {
                                    memberShare = exp.customSplits[m.id] || 0;
                                  }

                                  if (!isPayer && memberShare === 0) return null;

                                  const netItemImpact = (isPayer ? exp.amount : 0) - memberShare;

                                  return (
                                    <div
                                      key={exp.id}
                                      style={{
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        fontSize: '11.5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '6px'
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                          {exp.description}
                                        </div>
                                        <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                                          {isPayer ? `Paid ${fmtMoney(exp.amount, currency)}` : `Paid by group`} • Share: {fmtMoney(memberShare, currency)}
                                        </div>
                                      </div>
                                      <span style={{
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        color: netItemImpact >= 0 ? '#22c55e' : '#ef4444'
                                      }}>
                                        {netItemImpact >= 0
                                          ? `+${fmtMoney(netItemImpact, currency)}`
                                          : fmtMoney(netItemImpact, currency)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: HISTORY (ARCHIVED TRIPS LIST) */}
      {/* ========================================================================= */}
      {subView === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  Trip History
                </h2>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                  Archived completed trip splits
                </p>
              </div>

              {tripHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Clear History
                </button>
              )}
            </div>

            {tripHistory.length === 0 ? (
              <div style={{
                padding: '30px 16px',
                textAlign: 'center',
                color: 'var(--text-3)',
                fontSize: '12px',
                fontStyle: 'italic',
                background: 'var(--surface2)',
                borderRadius: '10px'
              }}>
                No archived trips. Finished trips will appear here.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {tripHistory.map(trip => {
                  const summary = simplifyDebts(trip.members, trip.expenses);
                  const dateStr = trip.archivedAt ? new Date(trip.archivedAt).toLocaleDateString() : 'Past Trip';

                  return (
                    <div
                      key={trip.id}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => {
                        setSelectedArchivedTrip(trip);
                        setSubView('archive-detail');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                            {trip.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
                            {trip.groupName} • {dateStr}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteArchivedTrip(trip.id);
                          }}
                          title="Delete trip from history"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border)'
                      }}>
                        <div>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Total Spend</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                            {fmtMoney(summary.totalSpend, currency)}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Per Person</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent)' }}>
                            {fmtMoney(summary.perPersonAvg, currency)}
                          </div>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
                          View →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 5: ARCHIVE DETAIL PANEL */}
      {/* ========================================================================= */}
      {subView === 'archive-detail' && selectedArchivedTrip && archiveTripSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Topbar Navigation */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={() => setSubView('history')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', padding: '5px 10px', gap: 5 }}
            >
              <ArrowLeft size={14} />
              <span>Back to History</span>
            </button>

            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
              {selectedArchivedTrip.name} (Archived)
            </div>

            <button
              type="button"
              onClick={() => handleDeleteArchivedTrip(selectedArchivedTrip.id)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>

          {/* Compact Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px'
          }}>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '10px 12px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Total Spend</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                {fmtMoney(archiveTripSummary.totalSpend, currency)}
              </div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '10px 12px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Per Person</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                ~{fmtMoney(archiveTripSummary.perPersonAvg, currency)}
              </div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '10px 12px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Members</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                {selectedArchivedTrip.members.length} People
              </div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '10px 12px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Expenses</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                {selectedArchivedTrip.expenses.length} Items
              </div>
            </div>
          </div>

          {/* Final Settlements */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Final Settlements (Who Pays Whom)
            </h3>
            {archiveTripSummary.transactions.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                No debt transactions were required for this trip.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {archiveTripSummary.transactions.map((tx, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>
                      {tx.fromName} → {tx.toName}
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--accent)' }}>
                      {fmtMoney(tx.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full Itemized Expense List */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Expense Log ({selectedArchivedTrip.expenses.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedArchivedTrip.expenses.map(exp => {
                const payer = selectedArchivedTrip.members.find(m => m.id === exp.paidByMemberId);
                return (
                  <div key={exp.id} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>{exp.description}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Paid by {payer?.name || 'Member'} • {exp.splitMode}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>{fmtMoney(exp.amount, currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Confirm Dialog Modal */}
      {confirmDialog.open && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        />
      )}

    </div>
  );
}
