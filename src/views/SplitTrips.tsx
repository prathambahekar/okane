import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Receipt,
  History as HistoryIcon,
  FileText,
  X,
  PieChart,
  Check,
  UserPlus,
  Handshake,
  Pencil,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';
import { useStore } from '../store';
import type { Trip, TripExpense, TripGroup, TripMember } from '../types';
import { fmtMoney } from '../utils';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

// Storage keys
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

function simplifyDebts(members: TripMember[], expenses: TripExpense[]) {
  const balances: Record<string, { paid: number; share: number; net: number }> = {};
  members.forEach(m => {
    balances[m.id] = { paid: 0, share: 0, net: 0 };
  });

  let totalSpend = 0;

  expenses.forEach(exp => {
    const amt = Number(exp.amount) || 0;
    totalSpend += amt;

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

// -------------------------------------------------------------
// REUSABLE BOTTOM DRAWER MODAL
// -------------------------------------------------------------
interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

function BottomDrawer({ isOpen, onClose, title, subtitle, children, icon }: BottomDrawerProps) {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="drawer-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <style>{`
        @keyframes drawerSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes modalPopIn {
          from { transform: scale(0.94); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes drawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .drawer-overlay {
          justify-content: flex-end;
          padding: 0;
        }

        .drawer-card {
          position: relative;
          width: 100%;
          max-width: 540px;
          margin: 0 auto;
          background: var(--surface);
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border: 1px solid var(--border);
          border-bottom: none;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: drawerSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .drawer-handle {
          padding: 12px 0 6px 0;
          display: flex;
          justify-content: center;
          cursor: pointer;
        }

        @media (min-width: 640px) {
          .drawer-overlay {
            justify-content: center !important;
            padding: 24px !important;
          }
          .drawer-card {
            border-radius: 20px !important;
            border: 1px solid var(--border) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25) !important;
            max-height: 88vh !important;
            animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .drawer-handle {
            display: none !important;
          }
        }
      `}</style>

      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          animation: 'drawerFadeIn 0.2s ease',
          zIndex: 1,
        }}
      />

      {/* Drawer Card */}
      <div className="drawer-card">
        {/* Top Handle bar (Mobile only) */}
        <div className="drawer-handle" onClick={onClose}>
          <div style={{ width: '42px', height: '4px', borderRadius: '99px', background: 'var(--border2)' }} />
        </div>

        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px 8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 8,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Default initial groups if none saved
const DEFAULT_PRESET_GROUPS: TripGroup[] = [];

export default function SplitTrips({ initialArg }: { initialArg?: string; onClearViewArg?: () => void }) {
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

  // Sub-navigation view modes: 'home' | 'expenses' | 'settle' | 'archive-detail'
  const [subView, setSubView] = useState<'home' | 'expenses' | 'settle' | 'archive-detail'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TRIP);
      return saved ? 'expenses' : 'home';
    } catch {
      return 'home';
    }
  });

  useBackButtonModal(subView !== 'home', () => setSubView('home'), { priority: BackPriority.SUBVIEW });

  const handledArgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }
    if (handledArgRef.current === initialArg) return;
    handledArgRef.current = initialArg;

    const timer = setTimeout(() => {
      const allTrips: Trip[] = [
        ...(db.tripHistory || []),
        ...(db.activeTrip ? [db.activeTrip] : []),
      ];
      const foundTrip = allTrips.find(t => t.id === initialArg || t.name.toLowerCase().includes(initialArg.toLowerCase()));
      if (foundTrip) {
        setActiveTrip(foundTrip);
        setSubView('expenses');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, db.tripHistory, db.activeTrip]);

  // Settle Tab Filter: 'who-pays' | 'breakdown'
  const [settleTab, setSettleTab] = useState<'who-pays' | 'breakdown'>('who-pays');
  // Archive Detail Tab: 'who-pays' | 'breakdown' | 'expenses'
  const [archiveTab, setArchiveTab] = useState<'who-pays' | 'breakdown' | 'expenses'>('who-pays');
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  // Expenses log collapsed state
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);

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
        if (Array.isArray(parsed)) {
          // Filter out legacy mock default groups if present in localStorage
          return parsed.filter(g => g.id !== 'grp_default_1' && g.id !== 'grp_default_2');
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_PRESET_GROUPS;
  });

  // Selected Group for starting a trip
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => presetGroups[0]?.id || '');
  const [tripName, setTripName] = useState<string>('');

  // Selected Archived Trip for Detail View
  const [selectedArchivedTrip, setSelectedArchivedTrip] = useState<Trip | null>(null);

  // Bottom Drawers State
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [groupsDrawerOpen, setGroupsDrawerOpen] = useState(false);
  const [addGroupDrawerOpen, setAddGroupDrawerOpen] = useState(false);
  const [addTripDrawerOpen, setAddTripDrawerOpen] = useState(false);
  const [addExpenseDrawerOpen, setAddExpenseDrawerOpen] = useState(false);

  // Add/Edit Group Drawer Form State
  const [editingGroup, setEditingGroup] = useState<TripGroup | null>(null);
  const [drawerGroupName, setDrawerGroupName] = useState('');
  const [drawerMembers, setDrawerMembers] = useState<string[]>(['You']);
  const [newMemberInput, setNewMemberInput] = useState('');

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

  // Listen for external storage restore events
  useEffect(() => {
    const handleTripsUpdated = () => {
      try {
        const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE_TRIP);
        setActiveTrip(savedActive ? JSON.parse(savedActive) : null);
        if (savedActive) setSubView('expenses');
        else setSubView('home');
      } catch {
        setActiveTrip(null);
        setSubView('home');
      }

      try {
        const savedHistory = localStorage.getItem(STORAGE_KEY_TRIP_HISTORY);
        setTripHistory(savedHistory ? JSON.parse(savedHistory) : []);
      } catch {
        setTripHistory([]);
      }

      try {
        const savedGroups = localStorage.getItem(STORAGE_KEY_PRESET_GROUPS);
        if (savedGroups) {
          const parsed = JSON.parse(savedGroups);
          if (Array.isArray(parsed)) {
            setPresetGroups(parsed.filter(g => g.id !== 'grp_default_1' && g.id !== 'grp_default_2'));
          } else {
            setPresetGroups(DEFAULT_PRESET_GROUPS);
          }
        } else {
          setPresetGroups(DEFAULT_PRESET_GROUPS);
        }
      } catch {
        setPresetGroups(DEFAULT_PRESET_GROUPS);
      }
    };

    window.addEventListener('okane_trips_updated', handleTripsUpdated);
    return () => window.removeEventListener('okane_trips_updated', handleTripsUpdated);
  }, []);

  // Handle open drawer to add new group
  const handleOpenAddGroupDrawer = () => {
    setEditingGroup(null);
    setDrawerGroupName('');
    setDrawerMembers(['You']);
    setNewMemberInput('');
    setGroupsDrawerOpen(false);
    setAddGroupDrawerOpen(true);
  };

  // Handle open drawer to edit an existing group
  const handleOpenEditGroupDrawer = (group: TripGroup) => {
    setEditingGroup(group);
    setDrawerGroupName(group.name);
    setDrawerMembers([...group.memberNames]);
    setNewMemberInput('');
    setGroupsDrawerOpen(false);
    setAddGroupDrawerOpen(true);
  };

  // Add member to custom drawer group list
  const handleAddMemberToDrawer = () => {
    const trimmed = newMemberInput.trim();
    if (!trimmed) return;
    if (drawerMembers.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Member already added');
      return;
    }
    setDrawerMembers([...drawerMembers, trimmed]);
    setNewMemberInput('');
  };

  // Remove member from custom drawer group list
  const handleRemoveMemberFromDrawer = (name: string) => {
    if (drawerMembers.length <= 1) {
      showToast('Group must have at least 1 member');
      return;
    }
    setDrawerMembers(drawerMembers.filter(m => m !== name));
  };

  // Save or update group from drawer
  const handleSaveGroupFromDrawer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalGroupName = drawerGroupName.trim() || 'My Group';
    if (drawerMembers.length < 1) {
      showToast('Group must have at least 1 member');
      return;
    }

    if (editingGroup) {
      // Update existing
      const updated = presetGroups.map(g => {
        if (g.id === editingGroup.id) {
          return { ...g, name: finalGroupName, memberNames: drawerMembers };
        }
        return g;
      });
      setPresetGroups(updated);
      setSelectedGroupId(editingGroup.id);
      showToast(`Group "${finalGroupName}" updated`);
    } else {
      // Create new
      const newGrp: TripGroup = {
        id: 'grp_' + Date.now(),
        name: finalGroupName,
        memberNames: drawerMembers,
      };
      setPresetGroups([...presetGroups, newGrp]);
      setSelectedGroupId(newGrp.id);
      showToast(`Group "${finalGroupName}" created`);
    }

    setAddGroupDrawerOpen(false);
    setEditingGroup(null);
  };

  // Delete group
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
    showToast(`Group "${g.name}" deleted`);
  };

  // Currently selected group object
  const selectedGroupObj = useMemo(() => {
    return presetGroups.find(g => g.id === selectedGroupId) || presetGroups[0];
  }, [presetGroups, selectedGroupId]);

  // Start new trip
  const handleStartTrip = () => {
    if (!selectedGroupObj) {
      handleOpenAddGroupDrawer();
      return;
    }

    const finalTripName = tripName.trim() || `${selectedGroupObj.name} Trip`;
    const memberObjs: TripMember[] = selectedGroupObj.memberNames.map((mName, idx) => ({
      id: `mem_${idx}_${mName.toLowerCase().replace(/\s+/g, '_')}`,
      name: mName,
    }));

    const newTrip: Trip = {
      id: 'trip_' + Date.now(),
      name: finalTripName,
      groupName: selectedGroupObj.name,
      members: memberObjs,
      expenses: [],
      status: 'active',
      createdAt: Date.now(),
    };

    setActiveTrip(newTrip);
    setTripName('');
    setAddTripDrawerOpen(false);
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
        showToast(`Custom splits (${currency}${totalCustomSum.toFixed(2)}) must equal total amount (${currency}${numAmt.toFixed(2)})`);
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
    setAddExpenseDrawerOpen(false);
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
    showToast(`Saved "${activeTrip.name}" to History`);
    setSubView('home');
    setHistoryDrawerOpen(true);
  };

  const handleExportPDF = (targetTrip?: Trip | null | React.MouseEvent) => {
    const trip = (targetTrip && typeof targetTrip === 'object' && 'id' in targetTrip)
      ? (targetTrip as Trip)
      : (activeTrip || selectedArchivedTrip);
    if (!trip) {
      showToast('No trip available to export');
      return;
    }

    try {
      showToast(`Generating PDF for "${trip.name}"...`);
      const doc = new jsPDF();
      const summary = simplifyDebts(trip.members, trip.expenses);
      const dateStr = trip.archivedAt
        ? new Date(trip.archivedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : new Date(trip.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

      // Primary Brand Bar Accent
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 210, 8, 'F');

      // Title & Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text('Trip Settlement Report', 14, 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(51, 65, 85); // Slate-700
      doc.text(`${trip.name}`, 14, 29);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Group: ${trip.groupName}  |  Date: ${dateStr}  |  Members: ${trip.members.map(m => m.name).join(', ')}`, 14, 35);

      // Table 1: Summary KPI Cards Table
      autoTable(doc, {
        startY: 40,
        head: [['Total Trip Spend', 'Per Person Share', 'Total Expenses', 'Group Members']],
        body: [[
          fmtMoney(summary.totalSpend, currency),
          `~${fmtMoney(summary.perPersonAvg, currency)}`,
          `${trip.expenses.length} logged`,
          `${trip.members.length} members`
        ]],
        theme: 'plain',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        bodyStyles: {
          fillColor: [248, 250, 252],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 12,
          halign: 'center',
        },
        styles: { cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.5 },
      });

      // Table 2: Final Settlement Transfers (Who Pays Whom)
      let lastY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 55) + 10;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('1. Settlement Transfers (Who Pays Whom)', 14, lastY);

      if (summary.transactions.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text('All members are fully settled. No debt transfers required.', 14, lastY + 6);
        lastY += 12;
      } else {
        autoTable(doc, {
          startY: lastY + 3,
          head: [['Payer (Debtor)', 'Receiver (Creditor)', 'Amount to Pay']],
          body: summary.transactions.map(tx => [
            tx.fromName,
            tx.toName,
            fmtMoney(tx.amount, currency)
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9.5, textColor: [15, 23, 42] },
          columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          styles: { cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
        });
        lastY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || lastY) + 10;
      }

      // Table 3: Member Contribution Breakdown
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('2. Member Contribution Breakdown', 14, lastY);

      autoTable(doc, {
        startY: lastY + 3,
        head: [['Member', 'Total Paid', 'Fair Share', 'Net Status']],
        body: trip.members.map(m => {
          const b = summary.balances[m.id] || { paid: 0, share: 0, net: 0 };
          const statusStr = b.net > 0.01
            ? `+${fmtMoney(b.net, currency)} (Gets back)`
            : b.net < -0.01
            ? `${fmtMoney(b.net, currency)} (Owes)`
            : 'Settled';
          return [m.name, fmtMoney(b.paid, currency), fmtMoney(b.share, currency), statusStr];
        }),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9.5, textColor: [15, 23, 42] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
      });
      lastY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || lastY) + 10;

      // Table 4: Itemized Expenses Log
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('3. Itemized Expenses Log', 14, lastY);

      if (trip.expenses.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text('No expenses logged for this trip.', 14, lastY + 6);
      } else {
        autoTable(doc, {
          startY: lastY + 3,
          head: [['Date', 'Description', 'Paid By', 'Split Mode', 'Total Amount']],
          body: trip.expenses.map(exp => {
            const payer = trip.members.find(m => m.id === exp.paidByMemberId)?.name || 'Member';
            return [
              exp.date || '—',
              exp.description,
              payer,
              exp.splitMode === 'equal' ? 'Equal' : 'Custom',
              fmtMoney(exp.amount, currency)
            ];
          }),
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9.5, textColor: [15, 23, 42] },
          columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          styles: { cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
        });
      }

      const cleanFileName = trip.name.replace(/[^a-z0-9_-]/gi, '_');
      doc.save(`${cleanFileName}_Trip_Report.pdf`);
      showToast(`PDF exported successfully!`);
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to generate PDF');
    }
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
          setSubView('home');
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
      message: 'Are you sure you want to clear all archived trip history permanently?',
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
    <div style={{ maxWidth: '920px', margin: '0 auto', padding: '16px 16px 32px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ========================================================================= */}
      {/* TOP NAVIGATION BUTTONS (GROUPS & HISTORY POP DRAWERS - HOME ONLY) */}
      {/* ========================================================================= */}
      {subView === 'home' && (
        <div className="split-trips-top-nav">
          {/* Action Buttons: Groups & History in centered/full-width segmented capsule */}
          <div className="split-trips-capsule">
            <button
              type="button"
              className="split-trips-tab-btn"
              onClick={() => setGroupsDrawerOpen(true)}
              title="Saved Groups"
            >
              <Users size={15} style={{ color: 'var(--accent)' }} />
              <span>Groups</span>
              <span className="split-trips-tab-badge">
                {presetGroups.length}
              </span>
            </button>

            <button
              type="button"
              className="split-trips-tab-btn"
              onClick={() => setHistoryDrawerOpen(true)}
              title="Trip History"
            >
              <HistoryIcon size={15} style={{ color: 'var(--accent)' }} />
              <span>History</span>
              {tripHistory.length > 0 && (
                <span className="split-trips-tab-badge">
                  {tripHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 1: MINIMAL & BEAUTIFUL HOME SETUP */}
      {/* ========================================================================= */}
      {subView === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Active Trip Banner if an active trip exists */}
          {activeTrip && activeTripSummary && (
            <div
              style={{
                background: 'var(--accent-surface-gradient)',
                border: '1px solid var(--accent-border-soft)',
                borderRadius: '16px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)', fontWeight: 800 }}>
                  Current Active Trip
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                  {activeTrip.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                  Total Spend: <strong style={{ color: 'var(--text)' }}>{fmtMoney(activeTripSummary.totalSpend, currency)}</strong> • {activeTrip.expenses.length} Expenses • {activeTrip.members.length} Members
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSubView('expenses')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'var(--accent-gradient)',
                    color: 'var(--accent-contrast, #ffffff)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px var(--accent-soft)',
                  }}
                >
                  <Receipt size={14} />
                  <span>Resume Trip</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddTripDrawerOpen(true)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} style={{ color: 'var(--accent)' }} />
                  <span>Start a Trip</span>
                </button>
              </div>
            </div>
          )}

          {/* Start New Trip Hero Card (Redesigned from scratch, clean & beautiful) */}
          <div className="split-hero-card">
            <div className="split-hero-main">
              <div className="split-hero-info">
                <div className="split-hero-icon">
                  <Compass size={22} />
                </div>
                <div className="split-hero-text">
                  <p className="split-hero-subtitle">
                    Split bills and track shared expenses with friends.
                  </p>
                </div>
              </div>

              <div className="split-hero-actions">
                <button
                  type="button"
                  className="split-start-btn"
                  onClick={() => {
                    setSelectedGroupId(presetGroups.length > 0 ? presetGroups[0].id : '');
                    setAddTripDrawerOpen(true);
                  }}
                >
                  <Plus size={16} />
                  <span>Start a Trip</span>
                </button>
              </div>
            </div>

            {/* Saved Groups Subsection */}
            <div className="split-groups-strip">
              <div className="split-groups-strip-header">
                <div className="split-groups-strip-title">
                  <Users size={14} style={{ color: 'var(--accent)' }} />
                  <span>Saved Groups</span>
                  {presetGroups.length > 0 && (
                    <span className="split-groups-count-badge">
                      {presetGroups.length}
                    </span>
                  )}
                </div>
                {presetGroups.length > 0 && (
                  <button
                    type="button"
                    className="split-groups-manage-btn"
                    onClick={() => setGroupsDrawerOpen(true)}
                  >
                    Manage
                  </button>
                )}
              </div>

              <div className="split-groups-grid">
                {presetGroups.map(grp => (
                  <div
                    key={grp.id}
                    className="split-group-pill"
                    onClick={() => {
                      setSelectedGroupId(grp.id);
                      setAddTripDrawerOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedGroupId(grp.id);
                        setAddTripDrawerOpen(true);
                      }
                    }}
                    title={`Start trip with ${grp.name}`}
                  >
                    <div className="split-group-avatar">
                      {grp.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="split-group-name">{grp.name}</span>
                    <span className="split-group-badge">
                      {grp.memberNames.length} {grp.memberNames.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                ))}

                <button
                  type="button"
                  className="split-group-add-pill"
                  onClick={handleOpenAddGroupDrawer}
                  title="Create a new saved group"
                >
                  <Plus size={14} style={{ color: 'var(--accent)' }} />
                  <span>{presetGroups.length === 0 ? 'Create a group' : 'New Group'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2 & 3: ACTIVE TRIP EXPENSES & SETTLE VIEW */}
      {/* ========================================================================= */}
      {(subView === 'expenses' || subView === 'settle') && activeTrip && activeTripSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ========================================== */}
          {/* PART 1: EXPENSES VIEW (subView === 'expenses') */}
          {/* ========================================== */}
          {subView === 'expenses' && (
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: '20px',
                border: '1px solid var(--border)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: 'var(--shadow)',
              }}
            >
              {/* Trip Title Header (With Merged Back Button) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  paddingBottom: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSubView('home')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    title="Back to Home"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{activeTrip.name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {activeTrip.groupName}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                      Members: {activeTrip.members.map(m => m.name).join(', ')}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelActiveTrip}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--debit-bg)',
                    color: 'var(--debit)',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    transition: 'opacity 0.15s ease',
                  }}
                  title="Cancel Trip"
                >
                  <Trash2 size={12} />
                  <span>Cancel</span>
                </button>
              </div>

              {/* Add Expense Primary Button */}
              <button
                type="button"
                onClick={() => setAddExpenseDrawerOpen(true)}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px var(--accent-soft)',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
              >
                <Plus size={18} />
                <span>Add Expense</span>
              </button>

              {/* Expandable / Collapsible Expenses Log (No split lines) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setExpensesCollapsed(!expensesCollapsed)}
                  style={{
                    width: '100%',
                    padding: '4px 0',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: 'var(--accent-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)'
                    }}>
                      <Receipt size={14} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                      Expenses Log ({activeTrip.expenses.length})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-2)', fontSize: '12px', fontWeight: 600 }}>
                    <span>{expensesCollapsed ? 'Expand' : 'Collapse'}</span>
                    {expensesCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                  </div>
                </button>

                {!expensesCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeTrip.expenses.length === 0 ? (
                      <div style={{
                        padding: '28px 16px',
                        textAlign: 'center',
                        color: 'var(--text-3)',
                        fontSize: '13px',
                        borderRadius: '12px',
                        background: 'var(--surface2)',
                      }}>
                        No expenses logged yet. Tap <strong>+ Add Expense</strong> above to log your first bill!
                      </div>
                    ) : (
                      activeTrip.expenses.map((exp) => {
                        const paidByMember = activeTrip.members.find(m => m.id === exp.paidByMemberId);
                        return (
                          <div
                            key={exp.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              background: 'var(--surface2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {exp.description}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span>Paid by <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{paidByMember?.name || 'Member'}</strong></span>
                                <span>•</span>
                                <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'var(--surface3)', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-2)' }}>
                                  {exp.splitMode === 'equal' ? 'Equal' : 'Custom'}
                                </span>
                                {exp.date && (
                                  <>
                                    <span>•</span>
                                    <span>{exp.date}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                                {fmtMoney(exp.amount, currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(exp.id)}
                                title="Delete Expense"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '8px',
                                  background: 'var(--surface3)',
                                  color: 'var(--debit)',
                                  border: 'none',
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Settle Up Button */}
              <button
                type="button"
                onClick={() => setSubView('settle')}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Handshake size={17} style={{ color: 'var(--accent)' }} />
                <span>Settle Up & View Stats</span>
                <ArrowRight size={15} style={{ color: 'var(--text-3)' }} />
              </button>
            </div>
          )}

          {/* ========================================== */}
          {/* PART 2: SETTLE & STATS VIEW (subView === 'settle') */}
          {/* ========================================== */}
          {subView === 'settle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header Bar with Merged Back Button */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSubView('expenses')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title="Back to Trip"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                    Settlement & Stats
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                    {activeTrip.name} ({activeTrip.groupName})
                  </div>
                </div>
              </div>

              {/* Stats Overview Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Total Spend</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                    {fmtMoney(activeTripSummary.totalSpend, currency)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Per Person Share</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                    ~{fmtMoney(activeTripSummary.perPersonAvg, currency)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Logged Items</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                    {activeTrip.expenses.length} Expenses
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Members</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                    {activeTrip.members.length} People
                  </div>
                </div>
              </div>

              {/* Settlement Workspace */}
              <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Modern 2-Tab Segmented Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    background: 'var(--surface2)',
                    borderRadius: '12px',
                    padding: '4px',
                    border: '1px solid var(--border)',
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSettleTab('who-pays')}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      border: 'none',
                      background: settleTab === 'who-pays' ? 'var(--accent-gradient)' : 'transparent',
                      color: settleTab === 'who-pays' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Handshake size={15} />
                    <span>Who Pays</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettleTab('breakdown')}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      border: 'none',
                      background: settleTab === 'breakdown' ? 'var(--accent-gradient)' : 'transparent',
                      color: settleTab === 'breakdown' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <PieChart size={15} />
                    <span>Breakdown</span>
                  </button>
                </div>

                {/* TAB 1: WHO PAYS WHOM */}
                {settleTab === 'who-pays' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Handshake size={16} style={{ color: 'var(--accent)' }} />
                        <span>Settlement Transfers</span>
                      </h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Minimized debt paths</span>
                    </div>

                    {activeTripSummary.transactions.length === 0 ? (
                      <div style={{ padding: '24px 16px', background: 'transparent', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center' }}>
                        🎉 Everyone is completely settled up! No transfers needed.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {activeTripSummary.transactions.map((tx, idx) => {
                          const isLast = idx === activeTripSummary.transactions.length - 1;
                          return (
                            <div
                              key={idx}
                              style={{
                                padding: '12px 0',
                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>
                                  {tx.fromName}
                                </span>
                                <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>pays</span>
                                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--accent)' }}>
                                  {tx.toName}
                                </span>
                              </div>
                              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                                {fmtMoney(tx.amount, currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Save Trip & Export PDF Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)', marginTop: '4px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleArchiveAndStartNew}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '10px',
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
                        <span>Save Trip</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportPDF}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '10px',
                          background: 'var(--accent-gradient)',
                          color: 'var(--accent-contrast, #ffffff)',
                          border: 'none',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                          boxShadow: 'var(--shadow)',
                        }}
                      >
                        <FileText size={15} />
                        <span>Export to PDF</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: BREAKDOWN */}
                {settleTab === 'breakdown' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeTrip.members.map((m) => {
                      const b = activeTripSummary.balances[m.id] || { paid: 0, share: 0, net: 0 };
                      const isPositive = b.net > 0.01;
                      const isNegative = b.net < -0.01;
                      const isExpanded = !!expandedMembers[m.id];

                      // Relevant expenses for this member
                      const memberExpenses = activeTrip.expenses.filter(exp => {
                        if (exp.paidByMemberId === m.id) return true;
                        if (exp.splitMode === 'equal') {
                          const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
                            ? exp.splitMemberIds
                            : activeTrip.members.map(mem => mem.id);
                          return splitList.includes(m.id);
                        } else if (exp.splitMode === 'custom' && exp.customSplits) {
                          return (Number(exp.customSplits[m.id]) || 0) > 0;
                        }
                        return false;
                      });

                      return (
                        <div
                          key={m.id}
                          style={{
                            background: 'var(--surface)',
                            borderRadius: '14px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Collapsed Header Button */}
                          <button
                            type="button"
                            onClick={() => setExpandedMembers(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              background: isExpanded ? 'var(--surface2)' : 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* Left Side: Avatar + Member Name ONLY */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: isPositive
                                    ? 'var(--credit-bg)'
                                    : isNegative
                                    ? 'var(--debit-bg)'
                                    : 'var(--surface2)',
                                  color: isPositive
                                    ? 'var(--credit)'
                                    : isNegative
                                    ? 'var(--debit)'
                                    : 'var(--text-3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '13px',
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                                {m.name}
                              </span>
                            </div>

                            {/* Right Side: Net Balance & Status Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: 800,
                                    color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-2)',
                                    letterSpacing: '-0.2px',
                                  }}
                                >
                                  {isPositive ? `+${fmtMoney(b.net, currency)}` : fmtMoney(b.net, currency)}
                                </div>
                                <div
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-3)',
                                    marginTop: '1px',
                                  }}
                                >
                                  {isPositive ? 'Gets Back' : isNegative ? 'Owes' : 'Settled'}
                                </div>
                              </div>
                              <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </div>
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div
                              style={{
                                padding: '14px 16px',
                                background: 'var(--surface)',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                              }}
                            >
                              {/* 1. Summary Financial Bar */}
                              <div
                                style={{
                                  background: 'var(--surface2)',
                                  padding: '10px 12px',
                                  borderRadius: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  fontSize: '12px',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                <div style={{ color: 'var(--text-2)' }}>
                                  Paid: <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(b.paid, currency)}</strong>
                                </div>
                                <div style={{ color: 'var(--border)' }}>•</div>
                                <div style={{ color: 'var(--text-2)' }}>
                                  Share: <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(b.share, currency)}</strong>
                                </div>
                              </div>

                              {/* 2. Itemized Expenses List */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Itemized Expenses ({memberExpenses.length})
                                </div>

                                {memberExpenses.length === 0 ? (
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic', padding: '4px 0' }}>
                                    No expenses associated with {m.name}.
                                  </div>
                                ) : (
                                  memberExpenses.map((exp) => {
                                    const paidByMember = activeTrip.members.find(mem => mem.id === exp.paidByMemberId);
                                    const totalAmt = Number(exp.amount) || 0;
                                    const paidByThis = exp.paidByMemberId === m.id;
                                    const paidAmt = paidByThis ? totalAmt : 0;

                                    let shareAmt = 0;
                                    let isIncluded = false;
                                    if (exp.splitMode === 'equal') {
                                      const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
                                        ? exp.splitMemberIds
                                        : activeTrip.members.map(mem => mem.id);
                                      isIncluded = splitList.includes(m.id);
                                      shareAmt = isIncluded ? (totalAmt / splitList.length) : 0;
                                    } else if (exp.splitMode === 'custom' && exp.customSplits) {
                                      shareAmt = Number(exp.customSplits[m.id]) || 0;
                                      isIncluded = shareAmt > 0;
                                    }

                                    const itemNet = paidAmt - shareAmt;

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
                                          gap: '10px',
                                        }}
                                      >
                                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {exp.description} <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-3)' }}>({fmtMoney(totalAmt, currency)})</span>
                                          </div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                                            Paid by <strong style={{ color: 'var(--text)' }}>{paidByThis ? 'You' : (paidByMember?.name || 'Member')}</strong>
                                            {isIncluded ? ` • Share: ${fmtMoney(shareAmt, currency)}` : ' • Not included'}
                                          </div>
                                        </div>

                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                          <div
                                            style={{
                                              fontSize: '13px',
                                              fontWeight: 800,
                                              color: itemNet > 0.01 ? 'var(--credit)' : itemNet < -0.01 ? 'var(--debit)' : 'var(--text-3)',
                                            }}
                                          >
                                            {itemNet > 0.01 ? `+${fmtMoney(itemNet, currency)}` : itemNet < -0.01 ? fmtMoney(itemNet, currency) : fmtMoney(0, currency)}
                                          </div>
                                          <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginTop: '1px' }}>
                                            {itemNet > 0.01 ? 'Overpaid' : itemNet < -0.01 ? 'Owes Share' : 'Balanced'}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: ARCHIVE DETAIL VIEW */}
      {/* ========================================================================= */}
      {subView === 'archive-detail' && selectedArchivedTrip && archiveTripSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Bar */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                paddingBottom: '2px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedArchivedTrip(null);
                    setSubView('home');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title="Back to Home"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{selectedArchivedTrip.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      {selectedArchivedTrip.groupName}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      Archived {selectedArchivedTrip.archivedAt ? new Date(selectedArchivedTrip.archivedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                    Members: {selectedArchivedTrip.members.map(m => m.name).join(', ')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => handleExportPDF(selectedArchivedTrip)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    background: 'var(--accent-gradient)',
                    color: 'var(--accent-contrast, #ffffff)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px var(--accent-soft)',
                  }}
                >
                  <FileText size={14} />
                  <span>Export PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteArchivedTrip(selectedArchivedTrip.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'var(--debit-bg)',
                    color: 'var(--debit)',
                    border: '1px solid var(--debit-border)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Delete Trip from History"
                >
                  <Trash2 size={14} />
                  <span>Delete Trip</span>
                </button>
              </div>
            </div>

            {/* Stats Overview Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Total Spend</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                  {fmtMoney(archiveTripSummary.totalSpend, currency)}
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Per Person Share</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                  ~{fmtMoney(archiveTripSummary.perPersonAvg, currency)}
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Logged Items</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                  {selectedArchivedTrip.expenses.length} Expenses
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Members</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                  {selectedArchivedTrip.members.length} People
                </div>
              </div>
            </div>

            {/* Segmented 3-Tab Workspace */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                background: 'var(--surface2)',
                borderRadius: '12px',
                padding: '4px',
                border: '1px solid var(--border)',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setArchiveTab('who-pays')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  background: archiveTab === 'who-pays' ? 'var(--accent-gradient)' : 'transparent',
                  color: archiveTab === 'who-pays' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Handshake size={15} />
                <span>Who Pays</span>
              </button>

              <button
                type="button"
                onClick={() => setArchiveTab('breakdown')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  background: archiveTab === 'breakdown' ? 'var(--accent-gradient)' : 'transparent',
                  color: archiveTab === 'breakdown' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <PieChart size={15} />
                <span>Breakdown</span>
              </button>

              <button
                type="button"
                onClick={() => setArchiveTab('expenses')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  background: archiveTab === 'expenses' ? 'var(--accent-gradient)' : 'transparent',
                  color: archiveTab === 'expenses' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Receipt size={15} />
                <span>Expenses ({selectedArchivedTrip.expenses.length})</span>
              </button>
            </div>

            {/* TAB 1: WHO PAYS WHOM */}
            {archiveTab === 'who-pays' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Handshake size={16} style={{ color: 'var(--accent)' }} />
                    <span>Final Settlement Transfers</span>
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Minimized debt paths</span>
                </div>

                {archiveTripSummary.transactions.length === 0 ? (
                  <div style={{ padding: '24px 16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center' }}>
                    🎉 Everyone was completely settled up! No transfers required.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {archiveTripSummary.transactions.map((tx, idx) => {
                      const isLast = idx === archiveTripSummary.transactions.length - 1;
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 0',
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>
                              {tx.fromName}
                            </span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>pays</span>
                            <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--accent)' }}>
                              {tx.toName}
                            </span>
                          </div>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                            {fmtMoney(tx.amount, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MEMBER BREAKDOWN */}
            {archiveTab === 'breakdown' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedArchivedTrip.members.map((m) => {
                  const b = archiveTripSummary.balances[m.id] || { paid: 0, share: 0, net: 0 };
                  const isPositive = b.net > 0.01;
                  const isNegative = b.net < -0.01;
                  const isExpanded = !!expandedMembers[m.id];

                  const memberExpenses = selectedArchivedTrip.expenses.filter(exp => {
                    if (exp.paidByMemberId === m.id) return true;
                    if (exp.splitMode === 'equal') {
                      const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
                        ? exp.splitMemberIds
                        : selectedArchivedTrip.members.map(mem => mem.id);
                      return splitList.includes(m.id);
                    } else if (exp.splitMode === 'custom' && exp.customSplits) {
                      return (Number(exp.customSplits[m.id]) || 0) > 0;
                    }
                    return false;
                  });

                  return (
                    <div
                      key={m.id}
                      style={{
                        background: 'var(--surface)',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Collapsed Header Button */}
                      <button
                        type="button"
                        onClick={() => setExpandedMembers(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: isExpanded ? 'var(--surface2)' : 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Left Side: Avatar + Member Name ONLY */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isPositive
                                ? 'var(--credit-bg)'
                                : isNegative
                                ? 'var(--debit-bg)'
                                : 'var(--surface2)',
                              color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                            {m.name}
                          </span>
                        </div>

                        {/* Right Side: Net Balance & Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 800,
                                color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-2)',
                                letterSpacing: '-0.2px',
                              }}
                            >
                              {isPositive ? `+${fmtMoney(b.net, currency)}` : fmtMoney(b.net, currency)}
                            </div>
                            <div
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-3)',
                                marginTop: '1px',
                              }}
                            >
                              {isPositive ? 'Gets Back' : isNegative ? 'Owes' : 'Settled'}
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '14px 16px',
                            background: 'var(--surface)',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* 1. Summary Financial Bar */}
                          <div
                            style={{
                              background: 'var(--surface2)',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              fontSize: '12px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ color: 'var(--text-2)' }}>
                              Paid: <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(b.paid, currency)}</strong>
                            </div>
                            <div style={{ color: 'var(--border)' }}>•</div>
                            <div style={{ color: 'var(--text-2)' }}>
                              Share: <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(b.share, currency)}</strong>
                            </div>
                          </div>

                          {/* 2. Itemized Expenses List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Itemized Expenses ({memberExpenses.length})
                            </div>

                            {memberExpenses.length === 0 ? (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic', padding: '4px 0' }}>
                                No expenses associated with {m.name}.
                              </div>
                            ) : (
                              memberExpenses.map((exp) => {
                                const paidByMember = selectedArchivedTrip.members.find(mem => mem.id === exp.paidByMemberId);
                                const totalAmt = Number(exp.amount) || 0;
                                const paidByThis = exp.paidByMemberId === m.id;
                                const paidAmt = paidByThis ? totalAmt : 0;

                                let shareAmt = 0;
                                let isIncluded = false;
                                if (exp.splitMode === 'equal') {
                                  const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
                                    ? exp.splitMemberIds
                                    : selectedArchivedTrip.members.map(mem => mem.id);
                                  isIncluded = splitList.includes(m.id);
                                  shareAmt = isIncluded ? (totalAmt / splitList.length) : 0;
                                } else if (exp.splitMode === 'custom' && exp.customSplits) {
                                  shareAmt = Number(exp.customSplits[m.id]) || 0;
                                  isIncluded = shareAmt > 0;
                                }

                                const itemNet = paidAmt - shareAmt;

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
                                      gap: '10px',
                                    }}
                                  >
                                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {exp.description} <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-3)' }}>({fmtMoney(totalAmt, currency)})</span>
                                      </div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                                        Paid by <strong style={{ color: 'var(--text)' }}>{paidByThis ? 'You' : (paidByMember?.name || 'Member')}</strong>
                                        {isIncluded ? ` • Share: ${fmtMoney(shareAmt, currency)}` : ' • Not included'}
                                      </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: 800,
                                          color: itemNet > 0.01 ? 'var(--credit)' : itemNet < -0.01 ? 'var(--debit)' : 'var(--text-3)',
                                        }}
                                      >
                                        {itemNet > 0.01 ? `+${fmtMoney(itemNet, currency)}` : itemNet < -0.01 ? fmtMoney(itemNet, currency) : fmtMoney(0, currency)}
                                      </div>
                                      <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginTop: '1px' }}>
                                        {itemNet > 0.01 ? 'Overpaid' : itemNet < -0.01 ? 'Owes Share' : 'Balanced'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: EXPENSES LOG */}
            {archiveTab === 'expenses' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedArchivedTrip.expenses.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                    No expenses were logged for this trip.
                  </div>
                ) : (
                  selectedArchivedTrip.expenses.map((exp, idx) => {
                    const paidByMember = selectedArchivedTrip.members.find(m => m.id === exp.paidByMemberId);
                    const isLast = idx === selectedArchivedTrip.expenses.length - 1;
                    return (
                      <div
                        key={exp.id}
                        style={{
                          padding: '12px 0',
                          borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {exp.description}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>Paid by <strong style={{ color: 'var(--text)' }}>{paidByMember?.name || 'Member'}</strong></span>
                            <span>•</span>
                            <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'var(--accent-soft)', fontSize: '10.5px', fontWeight: 700, color: 'var(--accent)' }}>
                              {exp.splitMode === 'equal' ? 'Equal' : 'Custom'}
                            </span>
                            {exp.date && (
                              <>
                                <span>•</span>
                                <span>{exp.date}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>
                          {fmtMoney(exp.amount, currency)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 1: HISTORY DRAWER */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        title="Trip History"
        subtitle="Archived completed trip splits"
        icon={<HistoryIcon size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tripHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClearAllHistory}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--debit)',
                  background: 'var(--debit-bg)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Clear History
              </button>
            </div>
          )}

          {tripHistory.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12.5px', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: '12px' }}>
              No archived trips found. Archived trips will appear here when you save a trip.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tripHistory.map(trip => {
                const summary = simplifyDebts(trip.members, trip.expenses);
                const dateStr = trip.archivedAt ? new Date(trip.archivedAt).toLocaleDateString() : 'Past Trip';

                return (
                  <div
                    key={trip.id}
                    onClick={() => {
                      setSelectedArchivedTrip(trip);
                      setSubView('archive-detail');
                      setHistoryDrawerOpen(false);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                        {trip.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                        {trip.groupName} • {dateStr} • {fmtMoney(summary.totalSpend, currency)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                        View
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--accent)' }} />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteArchivedTrip(trip.id);
                        }}
                        title="Delete Trip"
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          background: 'var(--debit-bg)',
                          border: 'none',
                          color: 'var(--debit)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: '4px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 2: SAVED GROUPS DRAWER */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={groupsDrawerOpen}
        onClose={() => setGroupsDrawerOpen(false)}
        title="Saved Groups"
        subtitle="Manage your expense splitting groups"
        icon={<Users size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {presetGroups.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: '14px' }}>
              No saved groups yet. Create one below to split trip costs faster.
            </div>
          ) : (
            <div className="drawer-groups-list">
              {presetGroups.map(grp => {
                const isSelected = selectedGroupId === grp.id;
                return (
                  <div
                    key={grp.id}
                    className={`drawer-group-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedGroupId(grp.id);
                      setGroupsDrawerOpen(false);
                      showToast(`Selected group "${grp.name}"`);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedGroupId(grp.id);
                        setGroupsDrawerOpen(false);
                        showToast(`Selected group "${grp.name}"`);
                      }
                    }}
                  >
                    <div className="drawer-group-card-left">
                      <div className="drawer-group-icon">
                        {grp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="drawer-group-info">
                        <div className="drawer-group-title-row">
                          <span className="drawer-group-name">{grp.name}</span>
                          {isSelected && (
                            <CheckCircle2 size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          )}
                        </div>
                        <div className="drawer-group-members">
                          {grp.memberNames.join(', ')} • {grp.memberNames.length} {grp.memberNames.length === 1 ? 'member' : 'members'}
                        </div>
                      </div>
                    </div>

                    <div className="drawer-group-actions" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditGroupDrawer(grp)}
                        title="Edit Group"
                        className="drawer-action-btn"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteGroup(grp.id, e)}
                        title="Delete Group"
                        className="drawer-action-btn btn-delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create New Group CTA Button */}
          <button
            type="button"
            onClick={handleOpenAddGroupDrawer}
            className="drawer-create-group-btn"
          >
            <Plus size={15} style={{ color: 'var(--accent)' }} />
            <span>Create New Group</span>
          </button>
        </div>
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 3: ADD / EDIT GROUP DRAWER */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={addGroupDrawerOpen}
        onClose={() => setAddGroupDrawerOpen(false)}
        title={editingGroup ? 'Edit Group' : 'Create New Group'}
        subtitle="Set group title and add members"
        icon={<Users size={20} />}
      >
        <form onSubmit={handleSaveGroupFromDrawer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Group Name */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              Group Name
            </label>
            <input
              type="text"
              value={drawerGroupName}
              onChange={e => setDrawerGroupName(e.target.value)}
              placeholder="e.g. Goa Squad, Flatmates, Weekend Trip"
              className="form-control"
              style={{
                width: '100%',
                fontSize: '13.5px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {/* Group Members Input */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Group Members ({drawerMembers.length})
              </label>
            </div>
            
            <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
              <input
                type="text"
                value={newMemberInput}
                onChange={e => setNewMemberInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMemberToDrawer();
                  }
                }}
                placeholder="Type member name (e.g. Alex, Sam)"
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 80px 10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleAddMemberToDrawer}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '4px',
                  bottom: '4px',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '0 12px',
                  borderRadius: '7px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background-color 0.15s ease, opacity 0.15s ease'
                }}
              >
                <UserPlus size={13} />
                <span>Add</span>
              </button>
            </div>

            {/* Member Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '14px' }}>
              {drawerMembers.map(mName => (
                <span
                  key={mName}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '99px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{mName}</span>
                  {drawerMembers.length > 1 && (
                    <X
                      size={13}
                      style={{ cursor: 'pointer', color: 'var(--text-3)', opacity: 0.8 }}
                      onClick={() => handleRemoveMemberFromDrawer(mName)}
                    />
                  )}
                </span>
              ))}
            </div>

            {/* Import from Okane Contacts */}
            {db.friends && db.friends.length > 0 && (
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border-subtle)',
                marginTop: '4px'
              }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '8px' }}>
                  Quick add from Contacts:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {db.friends.map(f => {
                    const exists = drawerMembers.some(m => m.toLowerCase() === f.name.toLowerCase());
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          if (!exists) setDrawerMembers([...drawerMembers, f.name]);
                        }}
                        disabled={exists}
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: exists ? '1px solid var(--border)' : '1px solid var(--border-subtle)',
                          background: exists ? 'var(--surface3)' : 'var(--surface)',
                          color: exists ? 'var(--text-3)' : 'var(--text)',
                          cursor: exists ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{exists ? '✓' : '+'}</span>
                        <span>{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Save Button (Full Width, No Bottom Cancel) */}
          <div style={{ width: '100%', paddingTop: '8px' }}>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'var(--accent-gradient)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--accent-soft)',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
            >
              <Check size={16} />
              <span>{editingGroup ? 'Update Group' : 'Save Group'}</span>
            </button>
          </div>
        </form>
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 4: START NEW TRIP DRAWER */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={addTripDrawerOpen}
        onClose={() => setAddTripDrawerOpen(false)}
        title="Split Trip"
        icon={<Compass size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Trip Name Input */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              Trip Name
            </label>
            <input
              type="text"
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              placeholder="e.g. Goa Vacation, Friday Dinner, Beach House"
              className="form-control"
              style={{
                width: '100%',
                fontSize: '13.5px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            />
          </div>

          {/* Select Group */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Select Group
              </label>
              <button
                type="button"
                onClick={() => {
                  setAddTripDrawerOpen(false);
                  handleOpenAddGroupDrawer();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={14} />
                <span>Add Group</span>
              </button>
            </div>

            {/* Group Cards */}
            {presetGroups.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12.5px', background: 'var(--surface2)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                No saved groups available.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAddTripDrawerOpen(false);
                    handleOpenAddGroupDrawer();
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Create a group
                </button>{' '}
                first to start a trip.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {presetGroups.map(grp => {
                  const isSelected = selectedGroupId === grp.id;
                  return (
                    <div
                      key={grp.id}
                      onClick={() => setSelectedGroupId(grp.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: isSelected ? 'var(--accent-gradient)' : 'var(--surface)',
                            color: isSelected ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Users size={16} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {grp.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {grp.memberNames.join(', ')}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ width: '100%', paddingTop: '12px' }}>
            <button
              type="button"
              onClick={handleStartTrip}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'var(--accent-gradient)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--accent-soft)',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
            >
              <span>Start Trip</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 5: ADD TRIP EXPENSE DRAWER */}
      {/* ========================================================================= */}
      {activeTrip && (
        <BottomDrawer
          isOpen={addExpenseDrawerOpen}
          onClose={() => setAddExpenseDrawerOpen(false)}
          title="Add Trip Expense"
          subtitle={`Log a new expense for ${activeTrip.name}`}
          icon={<Receipt size={20} />}
        >
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Description */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Description
              </label>
              <input
                type="text"
                value={expDesc}
                onChange={e => setExpDesc(e.target.value)}
                placeholder="e.g. Hotel Booking, Dinner, Fuel, Grocery"
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: '13.5px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Amount ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                placeholder="0.00"
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: '15px',
                  fontWeight: 700,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            {/* Who Paid */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Who Paid?
              </label>
              <select
                value={effectivePaidBy}
                onChange={e => setExpPaidBy(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: '13.5px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
              >
                {activeTrip.members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Split Mode Toggle */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
                Split Mode
              </label>
              <div style={{
                display: 'flex',
                gap: '6px',
                padding: '4px',
                borderRadius: '12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border-subtle)'
              }}>
                <button
                  type="button"
                  onClick={() => setExpSplitMode('equal')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    border: 'none',
                    background: expSplitMode === 'equal' ? 'var(--accent-gradient)' : 'transparent',
                    color: expSplitMode === 'equal' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                    cursor: 'pointer',
                    boxShadow: expSplitMode === 'equal' ? '0 2px 8px var(--accent-soft)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Equal Split
                </button>
                <button
                  type="button"
                  onClick={() => setExpSplitMode('custom')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    border: 'none',
                    background: expSplitMode === 'custom' ? 'var(--accent-gradient)' : 'transparent',
                    color: expSplitMode === 'custom' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                    cursor: 'pointer',
                    boxShadow: expSplitMode === 'custom' ? '0 2px 8px var(--accent-soft)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Custom Amounts
                </button>
              </div>
            </div>

            {/* Equal Split Members */}
            {expSplitMode === 'equal' && (
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border-subtle)',
              }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '8px' }}>
                  Who's Splitting?
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeTrip.members.map(m => {
                    const isSelected = effectiveSplitMembers.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleSplitMember(m.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: isSelected ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                          color: isSelected ? 'var(--accent)' : 'var(--text)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isSelected ? <Check size={12} /> : <span style={{ opacity: 0.5 }}>+</span>}
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Amounts */}
            {expSplitMode === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)' }}>
                  Specify amount per person:
                </span>
                {activeTrip.members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expCustomSplits[m.id] || ''}
                      onChange={e => setExpCustomSplits({ ...expCustomSplits, [m.id]: e.target.value })}
                      className="form-control"
                      style={{
                        width: '110px',
                        fontSize: '13px',
                        padding: '6px 10px',
                        textAlign: 'right',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Modal Footer Actions (Full Width) */}
            <div style={{ width: '100%', paddingTop: '8px' }}>
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px var(--accent-soft)',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
              >
                <Plus size={16} />
                <span>Add Expense</span>
              </button>
            </div>
          </form>
        </BottomDrawer>
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
