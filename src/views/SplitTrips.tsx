import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
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
  Handshake,
  Pencil,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { useStore } from '../store';
import type { Trip, TripExpense, TripGroup, TripMember } from '../types';
import { fmtMoney, currencySymbol, friendInitial, getAvatarStyle } from '../utils';
import { FRIEND_PALETTE } from '../db';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

// Helper to deterministically get contact-palette color for trip members
function getTripMemberAvatarColor(name: string, index: number, contactColor?: string): string {
  if (contactColor) return contactColor;
  if (name.trim().toLowerCase() === 'you') return 'var(--accent)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const paletteIndex = Math.abs(hash + index) % FRIEND_PALETTE.length;
  return FRIEND_PALETTE[paletteIndex];
}

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

function formatDisplayDate(dateStr?: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${months[monthIdx]} ${day}, ${year}`;
    }
  }
  return dateStr;
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

const GROUP_AVATAR_THEMES = [
  { bg: 'var(--accent-soft)', text: 'var(--accent)', border: 'var(--accent-border-soft)' },
  { bg: 'var(--credit-bg)', text: 'var(--credit)', border: 'var(--credit-border)' },
  { bg: 'var(--amber-bg)', text: 'var(--amber)', border: 'var(--amber-border)' },
  { bg: 'var(--surface3)', text: 'var(--text-2)', border: 'var(--border2)' },
];

function getGroupAvatarStyle(name: string) {
  let charSum = 0;
  for (let i = 0; i < name.length; i++) charSum += name.charCodeAt(i);
  return GROUP_AVATAR_THEMES[charSum % GROUP_AVATAR_THEMES.length];
}

// -------------------------------------------------------------
// REUSABLE BOTTOM DRAWER MODAL (Consistent with App Design System)
// -------------------------------------------------------------
interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: number;
}

function BottomDrawer({ isOpen, onClose, title, subtitle, children, icon, maxWidth = 480 }: BottomDrawerProps) {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      className="modal-backdrop-motion"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: isMobileScreen ? 'flex-end' : 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Sheet panel / Desktop center dialog */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal modal-dialog-panel"
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth,
          width: '100%',
          maxHeight: 'min(88vh, 88dvh)',
          borderRadius: isMobileScreen ? '22px 22px 0 0' : 22,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--drawer-bg, var(--surface))',
          border: '1px solid var(--border)',
          borderBottom: isMobileScreen ? 'none' : '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          color: 'var(--text)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Drag Handle Pill */}
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 'var(--radius-full)',
            background: 'var(--border2, rgba(255,255,255,0.25))',
            margin: '12px auto 6px',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={onClose}
        />

        {/* Drawer Header */}
        <div
          className="modal-header"
          style={{
            padding: '8px 20px 12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {icon && (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </div>
              {subtitle && (
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn-icon drawer-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div style={{ padding: '18px 20px 24px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {children}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// Default initial groups if none saved
const DEFAULT_PRESET_GROUPS: TripGroup[] = [];

export default function SplitTrips({ initialArg }: { initialArg?: string; onClearViewArg?: () => void }) {
  const { db, showToast, updateTripsData } = useStore();
  const currency = db.settings.currency || '₹';
  const currSym = currencySymbol(currency);

  // Active Trip State
  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => {
    if (db.activeTrip !== undefined) return db.activeTrip;
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

  // Expenses log collapsed state
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);

  // Archived Trips History
  const [tripHistory, setTripHistory] = useState<Trip[]>(() => {
    if (db.tripHistory && Array.isArray(db.tripHistory) && db.tripHistory.length > 0) {
      return db.tripHistory;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRIP_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Preset Groups
  const [presetGroups, setPresetGroups] = useState<TripGroup[]>(() => {
    if (db.presetGroups && Array.isArray(db.presetGroups) && db.presetGroups.length > 0) {
      return db.presetGroups.filter(g => g.id !== 'grp_default_1' && g.id !== 'grp_default_2');
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRESET_GROUPS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
  const [splitDrawerOpen, setSplitDrawerOpen] = useState(false);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [breakdownDrawerOpen, setBreakdownDrawerOpen] = useState(false);
  const [selectedMemberIdForDetail, setSelectedMemberIdForDetail] = useState<string | null>(null);

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

  // Sync state to local storage and global store
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
    updateTripsData({ activeTrip });
  }, [activeTrip, updateTripsData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRIP_HISTORY, JSON.stringify(tripHistory));
    } catch {
      // ignore
    }
    updateTripsData({ tripHistory });
  }, [tripHistory, updateTripsData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRESET_GROUPS, JSON.stringify(presetGroups));
    } catch {
      // ignore
    }
    updateTripsData({ presetGroups });
  }, [presetGroups, updateTripsData]);

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
        showToast(`Custom splits (${currSym}${totalCustomSum.toFixed(2)}) must equal total amount (${currSym}${numAmt.toFixed(2)})`);
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
    showToast(`Added "${desc}" (${currSym}${numAmt})`);
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
              formatDisplayDate(exp.date) || '—',
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
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Splits & Groups</h1>
        </div>
        <DesktopSearchBar placeholder="Search splits, groups, members..." defaultTab="trips" />
        <div className="desktop-only" style={{ width: 100 }} />
      </div>
      
      {/* ========================================================================= */}
      {/* TOP NAVIGATION BUTTONS (GROUPS & HISTORY POP DRAWERS - HOME ONLY) */}
      {/* ========================================================================= */}
      {subView === 'home' && (
        <div className="split-trips-top-nav">
          <button
            type="button"
            className="split-trips-separate-btn"
            onClick={() => setGroupsDrawerOpen(true)}
            title="Saved Groups"
          >
            <Users size={16} />
            <span>Groups</span>
            <span className="split-trips-tab-badge">
              {presetGroups.length}
            </span>
          </button>

          <button
            type="button"
            className="split-trips-separate-btn"
            onClick={() => setHistoryDrawerOpen(true)}
            title="Trip History"
          >
            <HistoryIcon size={16} />
            <span>History</span>
            {tripHistory.length > 0 && (
              <span className="split-trips-tab-badge">
                {tripHistory.length}
              </span>
            )}
          </button>
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
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', fontWeight: 600 }}>
                    Active Group Split
                  </div>
                  <div style={{ fontSize: 'var(--fs-hero-sm)', fontWeight: 800, color: 'var(--text)', marginTop: '4px', letterSpacing: '-0.3px' }}>
                    {activeTrip.name}
                  </div>
                  
                  {/* Metadata Chips: Total Spend & Expenses (Always side-by-side on 1 row) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'nowrap' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      fontSize: 'var(--fs-xs)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Spend</span>
                      <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(activeTripSummary.totalSpend, currency)}</strong>
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      fontSize: 'var(--fs-xs)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      <Receipt size={13} style={{ color: 'var(--text-2)' }} />
                      <strong style={{ color: 'var(--text)', fontWeight: 750 }}>{activeTrip.expenses.length}</strong>
                      <span className="split-expense-text" style={{ color: 'var(--text-2)', fontWeight: 550 }}>Expenses</span>
                    </div>
                  </div>
                </div>

                {/* Top Right Header Controls: Members Button + Delete Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowMembersDrawer(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={`View Members (${activeTrip.members.length})`}
                  >
                    <Users size={15} style={{ color: 'var(--text-2)' }} />
                    <span>{activeTrip.members.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelActiveTrip}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--debit-bg)',
                      color: 'var(--debit)',
                      border: '1px solid var(--debit-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    title="Delete / Cancel Active Split"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Action Buttons: New Split (Left) & Resume Split (Right) strictly side-by-side on 1 row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => setAddTripDrawerOpen(true)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Plus size={16} />
                  <span>New Split</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubView('expenses')}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--accent-gradient)',
                    color: 'var(--accent-contrast, #ffffff)',
                    border: 'none',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    boxShadow: '0 4px 14px var(--accent-soft)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Receipt size={16} />
                  <span>Resume Split</span>
                </button>
              </div>
            </div>
          )}

          {/* Start New Split Hero Card */}
          <div className="split-hero-card">
            <div className="split-hero-main">
              <div className="split-hero-info">
                <div className="split-hero-icon">
                  <Compass size={22} strokeWidth={2} />
                </div>
                <div className="split-hero-text">
                  <div className="split-hero-eyebrow">
                    Group Expenses
                  </div>
                  <h3 className="split-hero-title">
                    Split bills & shared costs with friends.
                  </h3>
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
                  <span>Start New Split</span>
                </button>
              </div>
            </div>

            {/* Saved Groups Subsection */}
            <div className="split-groups-strip">
              <div className="split-groups-strip-header">
                <div className="split-groups-strip-title">
                  <Users size={14} style={{ color: 'var(--text-2)' }} />
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
                    className="split-groups-manage-icon-btn"
                    onClick={() => setGroupsDrawerOpen(true)}
                    title="Manage Groups"
                  >
                    <Users size={14} />
                  </button>
                )}
              </div>

              <div className="split-groups-grid">
                {presetGroups.map(grp => {
                  const avatarStyle = getGroupAvatarStyle(grp.name);
                  return (
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
                      <div
                        className="split-group-avatar"
                        style={{
                          background: avatarStyle.bg,
                          color: avatarStyle.text,
                          border: `1px solid ${avatarStyle.border}`
                        }}
                      >
                        {grp.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="split-group-name">{grp.name}</span>
                      <span className="split-group-member-badge">
                        <span>{grp.memberNames.length}</span>
                        <span className="split-group-member-unit"> {grp.memberNames.length === 1 ? 'member' : 'members'}</span>
                      </span>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="split-group-add-pill"
                  onClick={handleOpenAddGroupDrawer}
                  title="Create a new saved group"
                >
                  <Plus size={14} style={{ color: 'var(--text-2)' }} />
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
                borderRadius: 'var(--radius-lg)',
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
                    className="split-card-back-btn"
                    title="Back to Home"
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{activeTrip.name}</span>
                      <span className="split-trip-group-badge">
                        {activeTrip.groupName}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowMembersDrawer(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={`View Members (${activeTrip.members.length})`}
                  >
                    <Users size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelActiveTrip}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--debit-bg)',
                      color: 'var(--debit)',
                      border: '1px solid var(--debit-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Cancel / Delete Trip"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Add Expense Primary Button */}
              <button
                type="button"
                onClick={() => setAddExpenseDrawerOpen(true)}
                className="split-trip-add-expense-btn"
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px var(--accent-soft)',
                }}
              >
                <Plus size={18} />
                <span>Add Expense</span>
              </button>

              {/* Expandable / Collapsible Expenses Log */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setExpensesCollapsed(!expensesCollapsed)}
                  style={{
                    width: '100%',
                    padding: '6px 2px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border-subtle)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-2)',
                    }}>
                      <Receipt size={16} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>
                      Expenses Log ({activeTrip.expenses.length})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
                    <span>{expensesCollapsed ? 'Expand' : 'Collapse'}</span>
                    {expensesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </div>
                </button>

                {!expensesCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeTrip.expenses.length === 0 ? (
                      <div style={{
                        padding: '28px 16px',
                        textAlign: 'center',
                        color: 'var(--text-3)',
                        fontSize: 'var(--fs-sm)',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        No expenses logged yet. Tap <strong>+ Add Expense</strong> above to log your first bill!
                      </div>
                    ) : (
                      activeTrip.expenses.map((exp) => {
                        const paidByMember = activeTrip.members.find(m => m.id === exp.paidByMemberId);
                        const payerInitial = (paidByMember?.name || 'M').charAt(0).toUpperCase();
                        const formattedDate = formatDisplayDate(exp.date);
                        return (
                          <div
                            key={exp.id}
                            style={{
                              padding: '11px 13px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--surface2)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {/* Top Row: Icon + Description + Amount + Delete */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: 'var(--radius-xs)',
                                    background: 'var(--accent-soft)',
                                    color: 'var(--accent)',
                                    border: '1px solid var(--accent-border-soft)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: 'var(--fs-xs)',
                                    fontWeight: 800,
                                    flexShrink: 0,
                                  }}
                                  title={`Paid by ${paidByMember?.name || 'Member'}`}
                                >
                                  {payerInitial}
                                </div>
                                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {exp.description}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtMoney(exp.amount, currency)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  title="Delete Expense"
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: 'var(--radius-xs)',
                                    background: 'var(--surface)',
                                    color: 'var(--debit, #ef4444)',
                                    border: '1px solid var(--border-subtle)',
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

                            {/* Bottom Row: Payer + Split Mode + Date */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: 'var(--fs-caption)', color: 'var(--text-3)', paddingTop: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Paid by <strong style={{ color: 'var(--text-2)', fontWeight: 600 }}>{paidByMember?.name || 'Member'}</strong>
                                </span>
                                <span style={{ padding: '1px 5px', borderRadius: 'var(--radius-xs)', background: 'var(--surface)', border: '1px solid var(--border-subtle)', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>
                                  {exp.splitMode === 'equal' ? 'Equal' : 'Custom'}
                                </span>
                              </div>
                              {formattedDate && (
                                <span style={{ flexShrink: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>{formattedDate}</span>
                              )}
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
                className="split-settle-up-btn"
              >
                <Handshake size={17} className="split-settle-up-icon" />
                <span>Settle Up & View Stats</span>
                <ArrowRight size={15} className="split-settle-up-arrow" />
              </button>
            </div>
          )}

          {/* ========================================== */}
          {/* PART 2: SETTLE & STATS VIEW (subView === 'settle') */}
          {/* ========================================== */}
          {subView === 'settle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* TOP ACTION BUTTONS BAR (EXPORT AT LEFT, SAVE AT RIGHT) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--text)',
                    color: 'var(--surface)',
                    border: 'none',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    transition: 'all 0.15s ease',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  <FileText size={16} />
                  <span>Export PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleArchiveAndStartNew}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    transition: 'all 0.15s ease',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
                  <span>Save Trip</span>
                </button>
              </div>

              {/* SINGLE COMBINED HEADER & FINANCIAL STATS CARD WITH ACCENT BG GRADIENT */}
              <div
                style={{
                  background: 'var(--accent-surface-gradient)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--accent-border-soft)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'var(--shadow-lg), 0 4px 20px -4px var(--accent-soft)',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setSubView('expenses')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '34px',
                        height: '34px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        border: '1px solid var(--accent-border-soft)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                        boxShadow: 'var(--shadow)',
                      }}
                      title="Back to Trip"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                        Settlement & Stats
                      </div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: '1px' }}>
                        {activeTrip.name} • {activeTrip.groupName}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBreakdownDrawerOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '34px',
                      height: '34px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--accent-border-soft)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow)',
                    }}
                    title="View Member Breakdown"
                  >
                    <PieChart size={17} style={{ color: 'var(--accent)' }} />
                  </button>
                </div>

                {/* Financial Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  {/* Total Spend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-2)', fontWeight: 800 }}>
                      Total Spend
                    </span>
                    <div style={{ fontSize: 'var(--fs-hero-sm)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
                      {fmtMoney(activeTripSummary.totalSpend, currency)}
                    </div>
                  </div>

                  {/* Per Person Share */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right' }}>
                    <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-2)', fontWeight: 800 }}>
                      Per Person Share
                    </span>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
                      ~{fmtMoney(activeTripSummary.perPersonAvg, currency)}
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    width: '100%',
                    marginTop: '2px',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)' }}>
                    <Receipt size={14} style={{ color: 'var(--accent)' }} />
                    {activeTrip.expenses.length} Expenses
                  </span>

                  <button
                    type="button"
                    onClick={() => setBreakdownDrawerOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 650,
                      color: 'var(--accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Users size={14} />
                    {activeTrip.members.length} People
                  </button>
                </div>
              </div>

              {/* CARD 2: SETTLEMENT TRANSFERS & ACTIONS CARD */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-border-soft)',
                      color: 'var(--accent)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Handshake size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Settlement Transfers
                    </h3>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', display: 'block', marginTop: '1px' }}>
                      Minimized debt paths • Tap for member details
                    </span>
                  </div>
                </div>

                {activeTripSummary.transactions.length === 0 ? (
                  <div style={{ padding: '20px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: 'var(--fs-sm)', color: 'var(--text-2)', fontWeight: 600, textAlign: 'center' }}>
                    🎉 Everyone is completely settled up! No transfers needed.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeTripSummary.transactions.map((tx, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedMemberIdForDetail(tx.fromMemberId);
                          setBreakdownDrawerOpen(true);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          boxShadow: 'var(--shadow)',
                          cursor: 'pointer',
                          transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent-border-soft)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Payer -> Recipient Flow */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                          {/* Payer Avatar & Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--debit-bg)',
                                border: '1px solid var(--debit-border)',
                                color: 'var(--debit)',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 'var(--fs-xs)',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {tx.fromName.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tx.fromName}
                            </span>
                          </div>

                          {/* Directional Arrow */}
                          <ArrowRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0, margin: '0 2px' }} />

                          {/* Recipient Avatar & Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--credit-bg)',
                                border: '1px solid var(--credit-border)',
                                color: 'var(--credit)',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 'var(--fs-xs)',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {tx.toName.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tx.toName}
                            </span>
                          </div>
                        </div>

                        {/* Amount & Chevron */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '4px' }}>
                          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>
                            {fmtMoney(tx.amount, currency)}
                          </span>
                          <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
                        </div>
                      </div>
                    ))}
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
          {/* CARD 1: Financial Overview & Header */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
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
                  className="split-card-back-btn"
                  title="Back to Home"
                >
                  <ArrowLeft size={17} />
                </button>
                <div>
                  <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{selectedArchivedTrip.name}</span>
                    <span className="split-trip-group-badge">
                      {selectedArchivedTrip.groupName}
                    </span>
                    <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--surface2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      Archived {selectedArchivedTrip.archivedAt ? new Date(selectedArchivedTrip.archivedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setShowMembersDrawer(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`View Members (${selectedArchivedTrip.members.length})`}
                >
                  <Users size={18} />
                </button>
              </div>
            </div>

            {/* Stats Overview Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Total Spend</span>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                  {fmtMoney(archiveTripSummary.totalSpend, currency)}
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                <span style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', fontWeight: 700 }}>Per Person Share</span>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                  ~{fmtMoney(archiveTripSummary.perPersonAvg, currency)}
                </div>
              </div>
            </div>

            {/* Breakdown Drawer Trigger Card */}
            <div
              onClick={() => setBreakdownDrawerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PieChart size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>
                    View Member Balances & Breakdown
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                    {selectedArchivedTrip.members.length} Members • {selectedArchivedTrip.expenses.length} Logged Expenses
                  </div>
                </div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
            </div>
          </div>

          {/* CARD 2: Settlement Transfers & Actions */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--card-radius)',
              border: '1px solid var(--border)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Handshake size={18} style={{ color: 'var(--accent)' }} />
                <span>Final Settlement Transfers</span>
              </h3>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 600 }}>
                Minimized debt paths
              </span>
            </div>

            {archiveTripSummary.transactions.length === 0 ? (
              <div style={{ padding: '24px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: 'var(--fs-sm)', color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', background: 'var(--surface2)' }}>
                🎉 Everyone was completely settled up! No transfers required.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {archiveTripSummary.transactions.map((tx, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text)' }}>
                        {tx.fromName}
                      </span>
                      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>pays</span>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent)' }}>
                        {tx.toName}
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)' }}>
                      {fmtMoney(tx.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={() => handleExportPDF(selectedArchivedTrip)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px var(--accent-soft)',
                }}
              >
                <FileText size={16} />
                <span>Export PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteArchivedTrip(selectedArchivedTrip.id)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--debit-bg)',
                  color: 'var(--debit)',
                  border: '1px solid var(--debit-border)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={16} />
                <span>Delete Trip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 1: HISTORY DRAWER */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        title="Split History"
        subtitle="Archived completed group splits"
        icon={<HistoryIcon size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tripHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClearAllHistory}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 700,
                  color: 'var(--debit)',
                  background: 'var(--debit-bg)',
                  border: '1px solid var(--debit-border, transparent)',
                  cursor: 'pointer',
                }}
              >
                Clear History
              </button>
            </div>
          )}

          {tripHistory.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: 'var(--radius-md)' }}>
              No archived splits found. Archived splits will appear here when you save a split.
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
                      borderRadius: 'var(--radius-md)',
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
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text)' }}>
                        {trip.name}
                      </div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: '2px' }}>
                        {trip.groupName} • {dateStr} • {fmtMoney(summary.totalSpend, currency)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)' }}>
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
                          borderRadius: 'var(--radius-xs)',
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
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--fs-sm)', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: 'var(--radius-md)' }}>
              No saved groups yet. Create one below to split trip costs faster.
            </div>
          ) : (
            <div className="drawer-groups-list">
              {presetGroups.map((grp) => {
                const isSelected = selectedGroupId === grp.id;
                const avatarStyle = getGroupAvatarStyle(grp.name);
                return (
                  <div
                    key={grp.id}
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
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-lg)',
                      border: isSelected ? '1px solid var(--border2)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--surface3)' : 'var(--surface2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 10px rgba(0, 0, 0, 0.08)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-md)',
                          background: avatarStyle.bg,
                          color: avatarStyle.text,
                          border: `1px solid ${avatarStyle.border}`,
                          fontWeight: 800,
                          fontSize: 'var(--fs-md)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        {grp.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {grp.name}
                          </span>
                          <span className="split-group-member-badge">
                            <span>{grp.memberNames.length}</span>
                            <span className="split-group-member-unit"> {grp.memberNames.length === 1 ? 'member' : 'members'}</span>
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={16} style={{ color: 'var(--text)', flexShrink: 0 }} />
                          )}
                        </div>
                        <div style={{ color: 'var(--text-2)', fontSize: 'var(--fs-xs)', fontWeight: 450, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {grp.memberNames.join(', ')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditGroupDrawer(grp)}
                        title="Edit Group"
                        className="split-group-edit-btn"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(99, 102, 241, 0.14)',
                          border: '1px solid rgba(99, 102, 241, 0.28)',
                          color: '#818cf8',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          transition: 'all 0.15s ease',
                          flexShrink: 0
                        }}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteGroup(grp.id, e)}
                        title="Delete Group"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--debit-bg)',
                          border: '1px solid var(--debit-border)',
                          color: 'var(--debit)',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          transition: 'all 0.15s ease',
                          flexShrink: 0
                        }}
                      >
                        <Trash2 size={14} style={{ color: 'var(--debit)' }} />
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
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-gradient)',
              color: 'var(--accent-contrast, #ffffff)',
              border: 'none',
              fontSize: 'var(--fs-base)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px var(--accent-soft)',
              marginTop: '6px',
              transition: 'transform 0.15s ease, opacity 0.15s ease'
            }}
          >
            <Plus size={16} strokeWidth={2.5} style={{ color: 'var(--accent-contrast, #ffffff)' }} />
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
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)', display: 'block', marginBottom: '6px' }}>
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
                fontSize: 'var(--fs-sm)',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {/* Group Members Input */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)', margin: 0 }}>
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
                  fontSize: 'var(--fs-sm)',
                  padding: '11px 48px 11px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleAddMemberToDrawer}
                title="Add member"
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 2px 6px var(--accent-soft)',
                  transition: 'transform 0.15s ease, opacity 0.15s ease'
                }}
              >
                <Plus size={16} strokeWidth={2.6} />
              </button>
            </div>

            {/* Member Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {drawerMembers.map(mName => (
                <span
                  key={mName}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--accent-gradient)',
                    color: 'var(--accent-contrast, #ffffff)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px var(--accent-soft)',
                  }}
                >
                  <span>{mName}</span>
                  {drawerMembers.length > 1 && (
                    <X
                      size={13}
                      style={{ cursor: 'pointer', opacity: 0.85 }}
                      onClick={() => handleRemoveMemberFromDrawer(mName)}
                    />
                  )}
                </span>
              ))}
            </div>

            {/* Import from Okane Contacts (excluding Vendors) */}
            {db.friends && db.friends.filter(f => f.type !== 'vendor').length > 0 && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                marginTop: '4px'
              }}>
                <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 650, color: 'var(--text-2)', display: 'block', marginBottom: '8px' }}>
                  Quick add from Contacts:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {db.friends
                    .filter(f => f.type !== 'vendor')
                    .slice(0, 8)
                    .map(f => {
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
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 700,
                            padding: '6px 13px',
                            borderRadius: 'var(--radius-full)',
                            border: exists ? '1px solid var(--border)' : 'none',
                            background: exists ? 'var(--surface3)' : 'var(--accent-gradient)',
                            color: exists ? 'var(--text-3)' : 'var(--accent-contrast, #ffffff)',
                            cursor: exists ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: exists ? 'none' : '0 2px 6px var(--accent-soft)',
                            transition: 'transform 0.15s ease, opacity 0.15s ease'
                          }}
                        >
                          <span style={{ fontWeight: 800 }}>{exists ? '✓' : '+'}</span>
                          <span>{f.name}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div style={{ width: '100%', paddingTop: '8px' }}>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-gradient)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                fontSize: 'var(--fs-base)',
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
      {/* BOTTOM DRAWER 4: START NEW SPLIT DRAWER */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={addTripDrawerOpen}
        onClose={() => setAddTripDrawerOpen(false)}
        title="New Group Split"
        subtitle="Set split name and select a group"
        icon={<Users size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Split Name Input */}
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              Split Name
            </label>
            <input
              type="text"
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              placeholder="e.g. Goa Vacation, Flat #402 Rent, Birthday Party"
              className="form-control"
              style={{
                width: '100%',
                fontSize: 'var(--fs-sm)',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* Select Group */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)', margin: 0 }}>
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
                  color: 'var(--text-2)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 650,
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
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', background: 'var(--surface2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                No saved groups available.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAddTripDrawerOpen(false);
                    handleOpenAddGroupDrawer();
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Create a group
                </button>{' '}
                first to start a trip.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {presetGroups.map((grp) => {
                  const isSelected = selectedGroupId === grp.id;
                  const avatarStyle = getGroupAvatarStyle(grp.name);
                  return (
                    <div
                      key={grp.id}
                      onClick={() => setSelectedGroupId(grp.id)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-lg)',
                        border: isSelected ? '1px solid var(--border2)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--surface3)' : 'var(--surface2)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: isSelected ? '0 2px 10px rgba(0, 0, 0, 0.08)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: 'var(--radius-md)',
                            background: avatarStyle.bg,
                            color: avatarStyle.text,
                            border: `1px solid ${avatarStyle.border}`,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            fontSize: 'var(--fs-md)',
                            fontWeight: 800,
                          }}
                        >
                          {grp.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {grp.name}
                            </span>
                            <span className="split-group-member-badge">
                              <span>{grp.memberNames.length}</span>
                              <span className="split-group-member-unit"> {grp.memberNames.length === 1 ? 'member' : 'members'}</span>
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 450, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {grp.memberNames.join(', ')}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 size={18} style={{ color: 'var(--text)', flexShrink: 0 }} />
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
                padding: '13px 20px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-gradient)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                fontSize: 'var(--fs-base)',
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
            {/* Hero Amount Field */}
            <div className="hero-amount-card">
              <span className="hero-amount-label">Amount</span>
              <div className="hero-amount-input-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span className="hero-currency-symbol" style={{ fontSize: '24px', fontWeight: 700 }}>{currSym}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  placeholder="0.00"
                  className="hero-amount-input"
                  style={{
                    width: expAmount ? `${Math.max(4, expAmount.length + 1)}ch` : '4.5ch',
                    minWidth: '80px',
                    maxWidth: '200px',
                    textAlign: 'left'
                  }}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)', display: 'block', marginBottom: '6px' }}>
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
                  fontSize: 'var(--fs-sm)',
                  padding: '11px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            {/* Who Paid */}
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)', display: 'block', marginBottom: '6px' }}>
                Who Paid?
              </label>
              <select
                value={effectivePaidBy}
                onChange={e => setExpPaidBy(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: 'var(--fs-sm)',
                  padding: '11px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  boxSizing: 'border-box'
                }}
              >
                {activeTrip.members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Tap to Select Friends & Split Card */}
            <div
              onClick={() => setSplitDrawerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--accent-gradient, var(--card-bg, #1e1e24))',
                    color: 'var(--accent-contrast, #ffffff)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px var(--accent-soft, rgba(0,0,0,0.1))',
                  }}
                >
                  <Users size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {effectiveSplitMembers.length > 0
                      ? `Splitting with ${effectiveSplitMembers.length} Member${effectiveSplitMembers.length > 1 ? 's' : ''}`
                      : 'Tap to Select Friends & Split'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {expSplitMode === 'custom'
                      ? 'Custom amounts split rules'
                      : effectiveSplitMembers.length === activeTrip.members.length
                      ? 'Equal split with everyone'
                      : `Equal split • ${effectiveSplitMembers.length} selected`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSplitDrawerOpen(true);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px var(--accent-soft)',
                }}
              >
                + Add
              </button>
            </div>

            {/* Modal Footer Actions (Full Width) */}
            <div style={{ width: '100%', paddingTop: '8px' }}>
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: 'var(--fs-base)',
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

      {/* View Members Drawer */}
      <BottomDrawer
        isOpen={showMembersDrawer}
        onClose={() => setShowMembersDrawer(false)}
        title={`Trip Members · ${activeTrip?.members.length || selectedArchivedTrip?.members.length || 0}`}
        subtitle={
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 9px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border-soft)',
                color: 'var(--text-2)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 550,
                lineHeight: 1.3,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Users size={11} style={{ color: 'var(--text-3)', opacity: 0.9 }} />
              <span>{activeTrip ? activeTrip.groupName : selectedArchivedTrip ? selectedArchivedTrip.groupName : 'Trip Group'}</span>
            </span>
          </div>
        }
        icon={<Users size={20} style={{ color: 'var(--accent)' }} />}
      >
        {(() => {
          const tripData = activeTrip || selectedArchivedTrip;
          const membersList = tripData?.members || [];
          const summary = activeTrip ? activeTripSummary : archiveTripSummary;
          const hasExpenses = (tripData?.expenses.length || 0) > 0;

          return (
            <div style={{ padding: '6px 14px 20px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Member Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                {membersList.map((m, idx) => {
                  const isYou = m.name.trim().toLowerCase() === 'you';
                  const matchingContact = db.friends.find(
                    f => f.id === m.id || f.name.trim().toLowerCase() === m.name.trim().toLowerCase()
                  );

                  const color = getTripMemberAvatarColor(m.name, idx, matchingContact?.color);
                  const avatarStyle: React.CSSProperties = isYou
                    ? {
                        background: 'var(--accent-gradient)',
                        color: 'var(--accent-contrast, #ffffff)',
                        border: 'none',
                        boxShadow: '0 2px 8px var(--accent-soft)',
                      }
                    : getAvatarStyle(color);

                  const memBal = summary?.balances?.[m.id];
                  const hasSubRow = (hasExpenses && memBal) || (matchingContact && !isYou);

                  return (
                    <div
                      key={m.id || idx}
                      className="trip-member-card"
                      onClick={() => {
                        setSelectedMemberIdForDetail(m.id);
                        setBreakdownDrawerOpen(true);
                        setShowMembersDrawer(false);
                      }}
                      title={`View ${m.name}'s balance & expenses`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        minWidth: 0,
                        width: '100%',
                        boxSizing: 'border-box',
                        position: 'relative',
                        userSelect: 'none',
                      }}
                    >
                      {/* Avatar Badge with Squircle Radius matching Contact Page (12px) */}
                      <div
                        style={{
                          ...avatarStyle,
                          width: 38,
                          height: 38,
                          borderRadius: 'var(--radius-md)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 750,
                          fontSize: 'var(--fs-base)',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        {friendInitial(m.name, matchingContact?.avatarNumber)}
                      </div>

                      {/* Info & Badges */}
                      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 'var(--fs-sm)',
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {m.name}
                          </span>
                          {isYou && (
                            <span className="trip-member-pill you">
                              You
                            </span>
                          )}
                        </div>

                        {/* Status / Badge Row */}
                        {hasSubRow && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                            {hasExpenses && memBal ? (
                              memBal.net > 0.01 ? (
                                <span className="trip-member-pill credit">
                                  +{fmtMoney(memBal.net, currency)}
                                </span>
                              ) : memBal.net < -0.01 ? (
                                <span className="trip-member-pill debit">
                                  {fmtMoney(memBal.net, currency)}
                                </span>
                              ) : (
                                <span className="trip-member-pill settled">
                                  Settled ✓
                                </span>
                              )
                            ) : matchingContact && !isYou ? (
                              <span className="trip-member-pill contact">
                                <span
                                  style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: '50%',
                                    backgroundColor: matchingContact.color || 'var(--text-3)',
                                    opacity: 0.85,
                                  }}
                                />
                                <span>Contact</span>
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Chevron Navigation Indicator */}
                      <ChevronRight
                        size={14}
                        style={{
                          color: 'var(--text-3)',
                          opacity: 0.5,
                          flexShrink: 0,
                          marginLeft: 'auto',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* BOTTOM DRAWER 7: SELECT FRIENDS & SPLIT DRAWER */}
      {/* ========================================================================= */}
      {activeTrip && (
        <BottomDrawer
          isOpen={splitDrawerOpen}
          onClose={() => setSplitDrawerOpen(false)}
          title="Select Friends & Split"
          subtitle="Set who shared this expense and split rules"
          icon={<Users size={20} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Split Mode Segment Control */}
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: '8px' }}>
                Split Mode
              </label>
              <div style={{
                display: 'flex',
                gap: '6px',
                padding: '4px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border-subtle)'
              }}>
                <button
                  type="button"
                  onClick={() => setExpSplitMode('equal')}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: expSplitMode === 'equal' ? 650 : 500,
                    border: expSplitMode === 'equal' ? '1px solid var(--border2)' : '1px solid transparent',
                    background: expSplitMode === 'equal' ? 'var(--surface)' : 'transparent',
                    color: expSplitMode === 'equal' ? 'var(--text)' : 'var(--text-2)',
                    cursor: 'pointer',
                    boxShadow: expSplitMode === 'equal' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
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
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: expSplitMode === 'custom' ? 650 : 500,
                    border: expSplitMode === 'custom' ? '1px solid var(--border2)' : '1px solid transparent',
                    background: expSplitMode === 'custom' ? 'var(--surface)' : 'transparent',
                    color: expSplitMode === 'custom' ? 'var(--text)' : 'var(--text-2)',
                    cursor: 'pointer',
                    boxShadow: expSplitMode === 'custom' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Equal Split Section */}
            {expSplitMode === 'equal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)' }}>
                    Who's Splitting?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (effectiveSplitMembers.length === activeTrip.members.length) {
                        setExpSplitMembers([activeTrip.members[0]?.id || '']);
                      } else {
                        setExpSplitMembers(activeTrip.members.map(m => m.id));
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      cursor: 'pointer',
                    }}
                  >
                    {effectiveSplitMembers.length === activeTrip.members.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Member Chips - Compact wrap layout */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {activeTrip.members.map((m, mIdx) => {
                    const isSelected = effectiveSplitMembers.includes(m.id);
                    const isYou = m.name.trim().toLowerCase() === 'you';
                    const matchingContact = db.friends.find(
                      f => f.id === m.id || f.name.trim().toLowerCase() === m.name.trim().toLowerCase()
                    );
                    const color = getTripMemberAvatarColor(m.name, mIdx, matchingContact?.color);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleSplitMember(m.id)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: isSelected ? 700 : 550,
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--surface)' : 'var(--surface2)',
                          color: 'var(--text)',
                          boxShadow: isSelected ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Mini Avatar Badge */}
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 'var(--radius-xs)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 750,
                            ...(isYou
                              ? { background: 'var(--accent-gradient)', color: '#fff' }
                              : { background: `${color}25`, color: color, border: `1px solid ${color}40` }),
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          {friendInitial(m.name, matchingContact?.avatarNumber)}
                        </span>

                        <span>{m.name}</span>

                        {isSelected ? (
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              display: 'grid',
                              placeItems: 'center',
                              marginLeft: '2px',
                              flexShrink: 0,
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                        ) : (
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 'var(--radius-full)',
                              background: 'transparent',
                              color: 'var(--text-3)',
                              display: 'grid',
                              placeItems: 'center',
                              marginLeft: '2px',
                              fontSize: 'var(--fs-sm)',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            +
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Amounts Section */}
            {expSplitMode === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)' }}>
                  Specify amount per person:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {activeTrip.members.map((m, mIdx) => {
                    const isYou = m.name.trim().toLowerCase() === 'you';
                    const matchingContact = db.friends.find(
                      f => f.id === m.id || f.name.trim().toLowerCase() === m.name.trim().toLowerCase()
                    );
                    const color = getTripMemberAvatarColor(m.name, mIdx, matchingContact?.color);

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 'var(--radius-xs)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 'var(--fs-caption)',
                              fontWeight: 750,
                              ...(isYou
                                ? { background: 'var(--accent-gradient)', color: '#fff' }
                                : { background: `${color}25`, color: color }),
                              flexShrink: 0,
                              lineHeight: 1,
                            }}
                          >
                            {friendInitial(m.name, matchingContact?.avatarNumber)}
                          </span>
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                        </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          width: '84px',
                          flexShrink: 0
                        }}
                      >
                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', marginRight: '2px' }}>{currSym}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={expCustomSplits[m.id] || ''}
                          onChange={e => setExpCustomSplits({ ...expCustomSplits, [m.id]: e.target.value })}
                          style={{
                            width: '100%',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 700,
                            textAlign: 'right',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text)',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            )}

            {/* Done Button */}
            <div style={{ paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setSplitDrawerOpen(false)}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-gradient)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--accent-soft)',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </BottomDrawer>
      )}

      {/* Breakdown Drawer */}
      <BottomDrawer
        isOpen={breakdownDrawerOpen}
        onClose={() => {
          setBreakdownDrawerOpen(false);
          setSelectedMemberIdForDetail(null);
        }}
        title={selectedMemberIdForDetail ? 'Member Details' : 'Member Balances & Breakdown'}
        subtitle={(subView === 'archive-detail' && selectedArchivedTrip) ? selectedArchivedTrip.name : activeTrip?.name || ''}
        icon={<PieChart size={20} style={{ color: 'var(--accent)' }} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {(() => {
            const currentMembersList = (subView === 'archive-detail' && selectedArchivedTrip && archiveTripSummary)
              ? selectedArchivedTrip.members.map(m => ({ member: m, balance: archiveTripSummary.balances[m.id], expenses: selectedArchivedTrip.expenses, members: selectedArchivedTrip.members }))
              : (activeTrip && activeTripSummary)
              ? activeTrip.members.map(m => ({ member: m, balance: activeTripSummary.balances[m.id], expenses: activeTrip.expenses, members: activeTrip.members }))
              : [];

            const selectedData = currentMembersList.find(item => item.member.id === selectedMemberIdForDetail);

            // Detailed View for Selected Member
            if (selectedMemberIdForDetail && selectedData) {
              const { member: m, balance, expenses, members } = selectedData;
              const b = balance || { paid: 0, share: 0, net: 0 };
              const isPositive = b.net > 0.01;
              const isNegative = b.net < -0.01;

              const memberExpenses = expenses.filter(exp => {
                if (exp.paidByMemberId === m.id) return true;
                if (exp.splitMode === 'equal') {
                  const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
                    ? exp.splitMemberIds
                    : members.map(mem => mem.id);
                  return splitList.includes(m.id);
                } else if (exp.splitMode === 'custom' && exp.customSplits) {
                  return (Number(exp.customSplits[m.id]) || 0) > 0;
                }
                return false;
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Back to Member List Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedMemberIdForDetail(null)}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-border-soft)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ArrowLeft size={14} /> Back to Member Balances
                  </button>

                  {/* Member Hero Header Card */}
                  <div
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: 'var(--shadow)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {(() => {
                          const isYou = m.name.trim().toLowerCase() === 'you';
                          const matchingContact = db.friends.find(
                            f => f.id === m.id || f.name.trim().toLowerCase() === m.name.trim().toLowerCase()
                          );
                          const color = getTripMemberAvatarColor(m.name, 0, matchingContact?.color);
                          const avatarStyle: React.CSSProperties = isYou
                            ? {
                                background: 'var(--accent-gradient)',
                                color: 'var(--accent-contrast, #ffffff)',
                                border: 'none',
                                boxShadow: '0 2px 8px var(--accent-soft)',
                              }
                            : getAvatarStyle(color);

                          return (
                            <div
                              style={{
                                ...avatarStyle,
                                width: '44px',
                                height: '44px',
                                borderRadius: 'var(--radius-md)',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 'var(--fs-lg)',
                                fontWeight: 800,
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              {friendInitial(m.name, matchingContact?.avatarNumber)}
                            </div>
                          );
                        })()}
                        <div>
                          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)' }}>
                            {m.name}
                          </div>
                          {m.name.toLowerCase() === 'you' && (
                            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700 }}>Primary User</span>
                          )}
                        </div>
                      </div>

                      {/* Status Pill Badge */}
                      <span
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: isPositive
                            ? 'var(--credit-bg)'
                            : isNegative
                            ? 'var(--debit-bg)'
                            : 'var(--surface2)',
                          color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-3)',
                          border: isPositive
                            ? '1px solid var(--credit-border)'
                            : isNegative
                            ? '1px solid var(--debit-border)'
                            : '1px solid var(--border-subtle)',
                        }}
                      >
                        {isPositive ? 'Gets Back' : isNegative ? 'Owes' : 'Settled'}
                      </span>
                    </div>

                    {/* Financial 3-Metric Summary Bar */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--surface2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 800 }}>Paid</div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>{fmtMoney(b.paid, currency)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 800 }}>Share</div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>{fmtMoney(b.share, currency)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--fs-caption)', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 800 }}>Net</div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-2)', marginTop: '2px' }}>
                          {isPositive ? `+${fmtMoney(b.net, currency)}` : fmtMoney(b.net, currency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Expenses Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 2px' }}>
                      Itemized Expenses ({memberExpenses.length})
                    </div>

                    {memberExpenses.length === 0 ? (
                      <div
                        style={{
                          padding: '18px',
                          textAlign: 'center',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-3)',
                          fontSize: 'var(--fs-sm)',
                          fontStyle: 'italic',
                        }}
                      >
                        No expenses linked to {m.name}.
                      </div>
                    ) : (
                      memberExpenses.map(exp => {
                        const paidByMember = members.find(mem => mem.id === exp.paidByMemberId);
                        const totalAmt = Number(exp.amount) || 0;
                        const paidByThis = exp.paidByMemberId === m.id;
                        const paidAmt = paidByThis ? totalAmt : 0;

                        let shareAmt = 0;
                        let isIncluded = false;
                        if (exp.splitMode === 'equal') {
                          const splitList = (exp.splitMemberIds && exp.splitMemberIds.length > 0)
                            ? exp.splitMemberIds
                            : members.map(mem => mem.id);
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
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              boxShadow: 'var(--shadow)',
                            }}
                          >
                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {exp.description} <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-3)' }}>({fmtMoney(totalAmt, currency)})</span>
                              </div>
                              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: '2px' }}>
                                Paid by <strong style={{ color: 'var(--text)' }}>{paidByThis ? 'You' : (paidByMember?.name || 'Member')}</strong>
                                {isIncluded ? ` • Share: ${fmtMoney(shareAmt, currency)}` : ' • Not included'}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div
                                style={{
                                  fontSize: 'var(--fs-sm)',
                                  fontWeight: 800,
                                  color: itemNet > 0.01 ? 'var(--credit)' : itemNet < -0.01 ? 'var(--debit)' : 'var(--text-3)',
                                  letterSpacing: '-0.2px',
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
              );
            }

            // Default Clean Minimal List View for All Members
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Member Balances
                  </span>
                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                    Tap member to view details
                  </span>
                </div>

                {currentMembersList.map(({ member: m, balance }) => {
                  const b = balance || { paid: 0, share: 0, net: 0 };
                  const isPositive = b.net > 0.01;
                  const isNegative = b.net < -0.01;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMemberIdForDetail(m.id)}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: 'var(--shadow)',
                        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-border-soft)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Avatar & Member Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {(() => {
                          const isYou = m.name.trim().toLowerCase() === 'you';
                          const matchingContact = db.friends.find(
                            f => f.id === m.id || f.name.trim().toLowerCase() === m.name.trim().toLowerCase()
                          );
                          const color = getTripMemberAvatarColor(m.name, 0, matchingContact?.color);
                          const avatarStyle: React.CSSProperties = isYou
                            ? {
                                background: 'var(--accent-gradient)',
                                color: 'var(--accent-contrast, #ffffff)',
                                border: 'none',
                                boxShadow: '0 2px 8px var(--accent-soft)',
                              }
                            : getAvatarStyle(color);

                          return (
                            <div
                              style={{
                                ...avatarStyle,
                                width: '40px',
                                height: '40px',
                                borderRadius: 'var(--radius-md)',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 'var(--fs-md)',
                                fontWeight: 750,
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              {friendInitial(m.name, matchingContact?.avatarNumber)}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {m.name}
                          </span>
                          {m.name.toLowerCase() === 'you' && (
                            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700 }}>Primary User</span>
                          )}
                        </div>
                      </div>

                      {/* Right Amount & Navigation Chevron */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontSize: 'var(--fs-md)',
                              fontWeight: 800,
                              color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-2)',
                              letterSpacing: '-0.3px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {isPositive ? `+${fmtMoney(b.net, currency)}` : fmtMoney(b.net, currency)}
                          </div>
                          <div style={{ marginTop: '2px' }}>
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px',
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-xs)',
                                display: 'inline-block',
                                background: isPositive
                                  ? 'var(--credit-bg)'
                                  : isNegative
                                  ? 'var(--debit-bg)'
                                  : 'var(--surface2)',
                                color: isPositive ? 'var(--credit)' : isNegative ? 'var(--debit)' : 'var(--text-3)',
                                border: isPositive
                                  ? '1px solid var(--credit-border)'
                                  : isNegative
                                  ? '1px solid var(--debit-border)'
                                  : '1px solid var(--border-subtle)',
                              }}
                            >
                              {isPositive ? 'Gets Back' : isNegative ? 'Owes' : 'Settled'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} style={{ color: 'var(--text-3)', marginLeft: '2px' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </BottomDrawer>

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
