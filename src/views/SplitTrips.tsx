import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  Receipt,
  History as HistoryIcon,
  X,
  Check,
  Pencil,
  Users,
  Compass,
  ArrowRight,
  Scale,
  Copy,
  CheckCircle2,
  Download,
  RotateCcw,
  Search,
  Share2,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { useStore } from '../store';
import type { Trip, TripExpense, TripGroup, TripMember } from '../types';
import { fmtMoney, currencySymbol, friendInitial } from '../utils';
import { FRIEND_PALETTE } from '../db';
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

// Deterministically retrieve contact-palette color for trip members
function getTripMemberAvatarColor(name: string, index: number): string {
  if (name.trim().toLowerCase() === 'you') return 'var(--accent)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const paletteIndex = Math.abs(hash + index) % FRIEND_PALETTE.length;
  return FRIEND_PALETTE[paletteIndex];
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

// -------------------------------------------------------------
// DEBT SIMPLIFICATION ALGORITHM
// -------------------------------------------------------------
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
      const splitList = exp.splitMemberIds && exp.splitMemberIds.length > 0
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
// REUSABLE BOTTOM DRAWER / MODAL
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

function BottomDrawer({ isOpen, onClose, title, subtitle, children, icon, maxWidth = 500 }: BottomDrawerProps) {
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: isMobileScreen ? 'flex-end' : 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={onClose}
      />

      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: isMobileScreen ? 0.26 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth,
          width: '100%',
          maxHeight: 'min(90vh, 90dvh)',
          borderRadius: isMobileScreen ? '24px 24px 0 0' : 20,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: isMobileScreen ? 'none' : '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-floating)',
          color: 'var(--text)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 'var(--radius-full)',
            background: 'var(--border2)',
            margin: '12px auto 4px',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={onClose}
        />

        <div
          style={{
            padding: '12px 20px 14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {icon && (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-lg)',
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
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </div>
              {subtitle && (
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn-icon"
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
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px 24px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {children}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// -------------------------------------------------------------
// MAIN SPLITS & GROUPS COMPONENT
// -------------------------------------------------------------
interface Props {
  initialArg?: string;
  onClearViewArg?: () => void;
}

export default function SplitTrips({ initialArg }: Props) {
  const { db, showToast, updateTripsData } = useStore();
  const currency = db.settings.currency || 'INR';
  const currSym = currencySymbol(currency);

  // Active Tab: 'active-trip' | 'groups' | 'history'
  const [activeTab, setActiveTab] = useState<'active-trip' | 'groups' | 'history'>('active-trip');

  // Persistence State
  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TRIP);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return db.activeTrip || null;
  });

  const [tripHistory, setTripHistory] = useState<Trip[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRIP_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return db.tripHistory || [];
  });

  const [presetGroups, setPresetGroups] = useState<TripGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRESET_GROUPS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    if (db.presetGroups && db.presetGroups.length > 0) return db.presetGroups;
    return [
      {
        id: 'group_roommates',
        name: 'Apartment Flatmates',
        memberNames: ['You', 'Alex', 'Sam', 'Rohan'],
      },
      {
        id: 'group_weekend_trip',
        name: 'Weekend Getaway',
        memberNames: ['You', 'Priya', 'Vikram', 'Elena'],
      },
    ];
  });

  // Modal / Drawer visibility
  const [showStartTripModal, setShowStartTripModal] = useState(false);
  const [showAddExpenseDrawer, setShowAddExpenseDrawer] = useState(false);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<TripMember | null>(null);
  const [selectedArchivedTrip, setSelectedArchivedTrip] = useState<Trip | null>(null);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [editingGroup, setEditingGroup] = useState<TripGroup | null>(null);
  const [copiedPlan, setCopiedPlan] = useState(false);

  // Search & Filter within Active Trip Expenses
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseSort, setExpenseSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');

  // Form State: Start Trip
  const [newTripName, setNewTripName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [customTripMembers, setCustomTripMembers] = useState<string[]>(['You']);
  const [newTripMemberInput, setNewTripMemberInput] = useState('');

  // Form State: Create/Edit Group
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupMembersList, setGroupMembersList] = useState<string[]>(['You']);
  const [groupMemberInput, setGroupMemberInput] = useState('');

  // Form State: Add/Edit Expense
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('');
  const [expSplitMode, setExpSplitMode] = useState<'equal' | 'custom'>('equal');
  const [expSplitMembers, setExpSplitMembers] = useState<string[]>([]);
  const [expCustomSplits, setExpCustomSplits] = useState<Record<string, string>>({});
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  // Handle deep link / search query arg safely
  const handledArgRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }
    if (handledArgRef.current === initialArg) return;
    handledArgRef.current = initialArg;

    const allTrips: Trip[] = [
      ...(tripHistory || []),
      ...(activeTrip ? [activeTrip] : []),
    ];
    const foundTrip = allTrips.find(t => t.id === initialArg || t.name.toLowerCase().includes(initialArg.toLowerCase()));
    if (foundTrip) {
      queueMicrotask(() => {
        if (foundTrip.status === 'active') {
          setActiveTrip(foundTrip);
          setActiveTab('active-trip');
        } else {
          setSelectedArchivedTrip(foundTrip);
        }
      });
    }
  }, [initialArg, tripHistory, activeTrip]);

  // Sync to localStorage and store
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

  // Computed Summaries
  const activeTripSummary = useMemo(() => {
    if (!activeTrip) return null;
    return simplifyDebts(activeTrip.members, activeTrip.expenses);
  }, [activeTrip]);

  // Find "You" member in active trip
  const youMemberId = useMemo(() => {
    if (!activeTrip) return null;
    const found = activeTrip.members.find(m => m.name.toLowerCase() === 'you');
    return found ? found.id : activeTrip.members[0]?.id || null;
  }, [activeTrip]);

  const youBalance = useMemo(() => {
    if (!activeTripSummary || !youMemberId) return null;
    return activeTripSummary.balances[youMemberId] || { paid: 0, share: 0, net: 0 };
  }, [activeTripSummary, youMemberId]);

  // Filtered & Sorted Active Trip Expenses
  const filteredActiveExpenses = useMemo(() => {
    if (!activeTrip) return [];
    const list = activeTrip.expenses.filter(e => {
      if (!expenseSearch.trim()) return true;
      const q = expenseSearch.toLowerCase();
      const payerName = activeTrip.members.find(m => m.id === e.paidByMemberId)?.name || '';
      return e.description.toLowerCase().includes(q) || payerName.toLowerCase().includes(q);
    });

    return list.sort((a, b) => {
      if (expenseSort === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (expenseSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (expenseSort === 'amount_desc') return b.amount - a.amount;
      if (expenseSort === 'amount_asc') return a.amount - b.amount;
      return 0;
    });
  }, [activeTrip, expenseSearch, expenseSort]);

  // -------------------------------------------------------------
  // ACTIONS: TRIP MANAGEMENT
  // -------------------------------------------------------------
  const handleOpenStartTripModal = (preselectedGroup?: TripGroup) => {
    if (preselectedGroup) {
      setSelectedGroupId(preselectedGroup.id);
      setNewTripName(`${preselectedGroup.name} Split`);
      setCustomTripMembers([...preselectedGroup.memberNames]);
    } else if (presetGroups.length > 0) {
      setSelectedGroupId(presetGroups[0].id);
      setNewTripName(`${presetGroups[0].name} Split`);
      setCustomTripMembers([...presetGroups[0].memberNames]);
    } else {
      setSelectedGroupId('');
      setNewTripName('');
      setCustomTripMembers(['You']);
    }
    setNewTripMemberInput('');
    setShowStartTripModal(true);
  };

  const handleStartTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTripName = newTripName.trim() || 'New Group Split';
    let groupName = 'Custom Group';
    let memberNames = [...customTripMembers];

    const pendingMember = newTripMemberInput.trim();
    if (pendingMember && !memberNames.some(m => m.toLowerCase() === pendingMember.toLowerCase())) {
      memberNames.push(pendingMember);
    }

    if (selectedGroupId) {
      const grp = presetGroups.find(g => g.id === selectedGroupId);
      if (grp) {
        groupName = grp.name;
        memberNames = grp.memberNames;
      }
    }

    if (memberNames.length < 2) {
      showToast('Please add at least 2 members to split expenses');
      return;
    }

    const memberObjs: TripMember[] = memberNames.map((mName, idx) => ({
      id: `mem_${idx}_${mName.toLowerCase().replace(/\s+/g, '_')}`,
      name: mName,
    }));

    const newTrip: Trip = {
      id: 'trip_' + Date.now(),
      name: finalTripName,
      groupName,
      members: memberObjs,
      expenses: [],
      status: 'active',
      createdAt: Date.now(),
    };

    setActiveTrip(newTrip);
    setShowStartTripModal(false);
    setActiveTab('active-trip');
    showToast(`Started split "${finalTripName}"`);
  };

  const handleCancelActiveTrip = () => {
    if (!activeTrip) return;
    setConfirmDialog({
      open: true,
      title: 'Discard Active Split',
      message: `Are you sure you want to discard "${activeTrip.name}"? All logged expenses for this trip will be removed.`,
      confirmLabel: 'Discard Split',
      danger: true,
      onConfirm: () => {
        setActiveTrip(null);
        showToast('Active split discarded');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleSettleAndArchive = () => {
    if (!activeTrip) return;
    setConfirmDialog({
      open: true,
      title: 'Settle & Archive Split',
      message: `Finish "${activeTrip.name}" and save the final settlement report to Trip History?`,
      confirmLabel: 'Settle & Archive',
      danger: false,
      onConfirm: () => {
        const archived: Trip = {
          ...activeTrip,
          status: 'archived',
          archivedAt: Date.now(),
        };
        setTripHistory([archived, ...tripHistory]);
        setActiveTrip(null);
        setActiveTab('history');
        showToast(`Saved "${activeTrip.name}" to History`);
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleReopenTrip = (trip: Trip) => {
    setConfirmDialog({
      open: true,
      title: 'Reopen Trip',
      message: activeTrip
        ? `Reopening "${trip.name}" will replace your current active split. Proceed?`
        : `Reopen "${trip.name}" as your current active split?`,
      confirmLabel: 'Reopen Split',
      danger: false,
      onConfirm: () => {
        const reopened: Trip = {
          ...trip,
          status: 'active',
        };
        setActiveTrip(reopened);
        setSelectedArchivedTrip(null);
        setActiveTab('active-trip');
        showToast(`"${trip.name}" is now active`);
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleDeleteArchivedTrip = (tripId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete History Record',
      message: 'Permanently remove this trip record from history?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setTripHistory(prev => prev.filter(t => t.id !== tripId));
        if (selectedArchivedTrip?.id === tripId) setSelectedArchivedTrip(null);
        showToast('Trip record removed');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  // -------------------------------------------------------------
  // ACTIONS: EXPENSE CRUD
  // -------------------------------------------------------------
  const handleOpenAddExpense = (expenseToEdit?: TripExpense) => {
    if (!activeTrip) return;
    if (expenseToEdit) {
      setEditingExpense(expenseToEdit);
      setExpDesc(expenseToEdit.description);
      setExpAmount(expenseToEdit.amount.toString());
      setExpPaidBy(expenseToEdit.paidByMemberId);
      setExpSplitMode(expenseToEdit.splitMode);
      setExpSplitMembers(expenseToEdit.splitMemberIds || activeTrip.members.map(m => m.id));
      const strSplits: Record<string, string> = {};
      if (expenseToEdit.customSplits) {
        Object.entries(expenseToEdit.customSplits).forEach(([k, v]) => {
          strSplits[k] = v.toString();
        });
      }
      setExpCustomSplits(strSplits);
      setExpDate(expenseToEdit.date || new Date().toISOString().split('T')[0]);
    } else {
      setEditingExpense(null);
      setExpDesc('');
      setExpAmount('');
      setExpPaidBy(activeTrip.members[0]?.id || '');
      setExpSplitMode('equal');
      setExpSplitMembers(activeTrip.members.map(m => m.id));
      setExpCustomSplits({});
      setExpDate(new Date().toISOString().split('T')[0]);
    }
    setShowAddExpenseDrawer(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;

    const desc = expDesc.trim() || 'General Expense';
    const numAmt = parseFloat(expAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      showToast('Please enter a valid expense amount');
      return;
    }

    const paidBy = expPaidBy || activeTrip.members[0]?.id;
    let finalCustomSplits: Record<string, number> | undefined = undefined;

    if (expSplitMode === 'custom') {
      const parsedSplits: Record<string, number> = {};
      let totalCustomSum = 0;
      activeTrip.members.forEach(m => {
        const val = parseFloat(expCustomSplits[m.id] || '0');
        parsedSplits[m.id] = isNaN(val) ? 0 : val;
        totalCustomSum += parsedSplits[m.id];
      });

      if (Math.abs(totalCustomSum - numAmt) > 0.05) {
        showToast(`Custom splits (${currSym}${totalCustomSum.toFixed(2)}) must equal total amount (${currSym}${numAmt.toFixed(2)})`);
        return;
      }
      finalCustomSplits = parsedSplits;
    }

    if (editingExpense) {
      const updatedExpenses = activeTrip.expenses.map(item => {
        if (item.id === editingExpense.id) {
          return {
            ...item,
            description: desc,
            amount: numAmt,
            paidByMemberId: paidBy,
            splitMode: expSplitMode,
            splitMemberIds: expSplitMembers.length > 0 ? expSplitMembers : activeTrip.members.map(m => m.id),
            customSplits: finalCustomSplits,
            date: expDate,
          };
        }
        return item;
      });

      setActiveTrip({
        ...activeTrip,
        expenses: updatedExpenses,
      });
      showToast('Expense updated');
    } else {
      const newExp: TripExpense = {
        id: 'exp_' + Date.now(),
        description: desc,
        amount: numAmt,
        paidByMemberId: paidBy,
        splitMode: expSplitMode,
        splitMemberIds: expSplitMembers.length > 0 ? expSplitMembers : activeTrip.members.map(m => m.id),
        customSplits: finalCustomSplits,
        date: expDate,
        createdAt: Date.now(),
      };

      setActiveTrip({
        ...activeTrip,
        expenses: [newExp, ...activeTrip.expenses],
      });
      showToast(`Added "${desc}" (${fmtMoney(numAmt, currency)})`);
    }

    setShowAddExpenseDrawer(false);
  };

  const handleDeleteExpense = (expId: string) => {
    if (!activeTrip) return;
    const exp = activeTrip.expenses.find(e => e.id === expId);
    setConfirmDialog({
      open: true,
      title: 'Delete Expense',
      message: `Are you sure you want to remove "${exp?.description || 'this expense'}"?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setActiveTrip({
          ...activeTrip,
          expenses: activeTrip.expenses.filter(e => e.id !== expId),
        });
        showToast('Expense deleted');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  // -------------------------------------------------------------
  // ACTIONS: PRESET GROUP CRUD
  // -------------------------------------------------------------
  const handleOpenGroupDrawer = (groupToEdit?: TripGroup) => {
    if (groupToEdit) {
      setEditingGroup(groupToEdit);
      setGroupNameInput(groupToEdit.name);
      setGroupMembersList([...groupToEdit.memberNames]);
    } else {
      setEditingGroup(null);
      setGroupNameInput('');
      setGroupMembersList(['You']);
    }
    setGroupMemberInput('');
    setShowGroupDrawer(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const gName = groupNameInput.trim();
    if (!gName) {
      showToast('Please enter a group name');
      return;
    }

    const finalMembers = [...groupMembersList];
    const pendingMem = groupMemberInput.trim();
    if (pendingMem && !finalMembers.some(m => m.toLowerCase() === pendingMem.toLowerCase())) {
      finalMembers.push(pendingMem);
    }

    if (finalMembers.length < 2) {
      showToast('Please add at least 2 members to the group');
      return;
    }

    if (editingGroup) {
      setPresetGroups(prev =>
        prev.map(g => (g.id === editingGroup.id ? { ...g, name: gName, memberNames: finalMembers } : g))
      );
      showToast(`Group "${gName}" updated`);
    } else {
      const newGrp: TripGroup = {
        id: 'grp_' + Date.now(),
        name: gName,
        memberNames: finalMembers,
      };
      setPresetGroups(prev => [...prev, newGrp]);
      showToast(`Group "${gName}" created`);
    }
    setShowGroupDrawer(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    const grp = presetGroups.find(g => g.id === groupId);
    setConfirmDialog({
      open: true,
      title: 'Delete Saved Group',
      message: `Remove "${grp?.name || 'this group'}" from your saved presets?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setPresetGroups(prev => prev.filter(g => g.id !== groupId));
        showToast('Group removed');
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  // -------------------------------------------------------------
  // ACTIONS: SHARE & EXPORT PDF
  // -------------------------------------------------------------
  const handleCopySettlementPlan = () => {
    if (!activeTrip || !activeTripSummary) return;
    const lines = [
      `💰 Settlement Summary for "${activeTrip.name}" (${activeTrip.groupName})`,
      `Total Spend: ${fmtMoney(activeTripSummary.totalSpend, currency)}`,
      `Average / Person: ${fmtMoney(activeTripSummary.perPersonAvg, currency)}`,
      '',
      'Settlement Transfers:',
    ];

    if (activeTripSummary.transactions.length === 0) {
      lines.push('All members are fully settled! No transfers needed.');
    } else {
      activeTripSummary.transactions.forEach((tx, idx) => {
        lines.push(`${idx + 1}. ${tx.fromName} pays ${tx.toName} -> ${fmtMoney(tx.amount, currency)}`);
      });
    }

    lines.push('');
    lines.push('Member Balances:');
    activeTrip.members.forEach(m => {
      const b = activeTripSummary.balances[m.id];
      if (b) {
        const netStr = b.net > 0 ? `+${fmtMoney(b.net, currency)} (gets back)` : b.net < 0 ? `-${fmtMoney(Math.abs(b.net), currency)} (owes)` : 'Settled';
        lines.push(`• ${m.name}: Paid ${fmtMoney(b.paid, currency)} | Share ${fmtMoney(b.share, currency)} | Net: ${netStr}`);
      }
    });

    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedPlan(true);
      showToast('Settlement summary copied to clipboard');
      setTimeout(() => setCopiedPlan(false), 2000);
    }).catch(() => {
      showToast('Could not copy to clipboard');
    });
  };

  const handleExportPDF = (tripToExport?: Trip | null) => {
    const targetTrip = tripToExport || activeTrip;
    if (!targetTrip) return;

    try {
      const doc = new jsPDF();
      const summary = simplifyDebts(targetTrip.members, targetTrip.expenses);

      doc.setFontSize(20);
      doc.text(targetTrip.name, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Group: ${targetTrip.groupName}  |  Generated: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Total Spend: ${fmtMoney(summary.totalSpend, currency)}  |  Members: ${targetTrip.members.length}`, 14, 34);

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Settlement Transfers', 14, 46);

      if (summary.transactions.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(80);
        doc.text('All members are fully settled. No payments required.', 14, 54);
      } else {
        const txRows = summary.transactions.map((tx, idx) => [
          (idx + 1).toString(),
          tx.fromName,
          tx.toName,
          fmtMoney(tx.amount, currency),
        ]);

        autoTable(doc, {
          startY: 50,
          head: [['#', 'Payer (From)', 'Recipient (To)', 'Amount']],
          body: txRows,
          theme: 'striped',
          headStyles: { fillColor: [40, 40, 40] },
        });
      }

      interface DocWithAutoTable {
        lastAutoTable?: { finalY: number };
      }
      const lastY = (doc as unknown as DocWithAutoTable).lastAutoTable ? (doc as unknown as DocWithAutoTable).lastAutoTable!.finalY + 12 : 65;

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Member Balances', 14, lastY);

      const memberRows = targetTrip.members.map(m => {
        const b = summary.balances[m.id] || { paid: 0, share: 0, net: 0 };
        return [
          m.name,
          fmtMoney(b.paid, currency),
          fmtMoney(b.share, currency),
          b.net > 0 ? `+${fmtMoney(b.net, currency)}` : b.net < 0 ? `-${fmtMoney(Math.abs(b.net), currency)}` : '0.00',
        ];
      });

      autoTable(doc, {
        startY: lastY + 4,
        head: [['Member', 'Total Paid', 'Fair Share', 'Net Balance']],
        body: memberRows,
        theme: 'striped',
        headStyles: { fillColor: [70, 70, 70] },
      });

      const expStartY = (doc as unknown as DocWithAutoTable).lastAutoTable ? (doc as unknown as DocWithAutoTable).lastAutoTable!.finalY + 12 : lastY + 50;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Itemized Expenses Log', 14, expStartY);

      const expRows = targetTrip.expenses.map(e => {
        const payer = targetTrip.members.find(m => m.id === e.paidByMemberId)?.name || 'Unknown';
        return [
          formatDisplayDate(e.date),
          e.description,
          payer,
          e.splitMode === 'equal' ? 'Equal' : 'Custom',
          fmtMoney(e.amount, currency),
        ];
      });

      autoTable(doc, {
        startY: expStartY + 4,
        head: [['Date', 'Description', 'Paid By', 'Split Mode', 'Amount']],
        body: expRows,
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100] },
      });

      doc.save(`${targetTrip.name.replace(/\s+/g, '_')}_Settlement.pdf`);
      showToast('PDF Settlement Report downloaded');
    } catch {
      showToast('Error generating PDF report');
    }
  };

  return (
    <div className="view-container">
      {/* ========================================================================= */}
      {/* PAGE HEADER */}
      {/* ========================================================================= */}
      <div className="splits-page-header">
        <div>
          <h1 className="page-title">Splits &amp; Groups</h1>
        </div>

        <div className="desktop-search-filter-wrap desktop-only">
          <DesktopSearchBar placeholder="Search group splits, expenses..." defaultTab="trips" />
        </div>

        <div className="splits-header-actions desktop-only">
          {activeTab === 'groups' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenGroupDrawer()}
            >
              <Plus size={16} /> Add Group
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenStartTripModal()}
            >
              <Plus size={16} /> Start New Split
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEGMENTED TAB SWITCHER */}
      {/* ========================================================================= */}
      <div className="splits-segmented-tabs">
        <button
          type="button"
          className={`splits-tab-btn ${activeTab === 'active-trip' ? 'active' : ''}`}
          onClick={() => setActiveTab('active-trip')}
        >
          <Compass size={16} />
          <span>Active Split</span>
          {activeTrip && <span className="splits-tab-badge active-pulse">1</span>}
        </button>

        <button
          type="button"
          className={`splits-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <Users size={16} />
          <span>Saved Groups</span>
          <span className="splits-tab-badge">{presetGroups.length}</span>
        </button>

        <button
          type="button"
          className={`splits-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <HistoryIcon size={16} />
          <span>History</span>
          <span className="splits-tab-badge">{tripHistory.length}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT WITH SMOOTH ANIMATION */}
      {/* ========================================================================= */}
      <AnimatePresence mode="wait">
        {/* TAB 1: ACTIVE TRIP VIEW */}
        {activeTab === 'active-trip' && (
          <motion.div
            key="tab-active-trip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="splits-page-container"
          >
            {activeTrip && activeTripSummary ? (
              <>
                {/* 1. HERO SUMMARY & KPI STRIP */}
                <div className="split-hero-header-card">
                  <div className="split-hero-header-top">
                    <div className="split-hero-title-group">
                      <div className="split-hero-badge-row">
                        <span className="split-hero-group-tag">
                          <Users size={12} />
                          <span>{activeTrip.groupName}</span>
                        </span>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                          Started {formatDisplayDate(new Date(activeTrip.createdAt).toISOString().split('T')[0])}
                        </span>
                      </div>
                      <h2 className="split-hero-title">{activeTrip.name}</h2>
                    </div>

                    <div className="split-hero-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleOpenAddExpense()}
                      >
                        <Plus size={15} /> Add Expense
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCopySettlementPlan}
                        title="Copy settlement summary"
                      >
                        {copiedPlan ? <Check size={15} style={{ color: 'var(--credit)' }} /> : <Share2 size={15} />}
                        <span>{copiedPlan ? 'Copied' : 'Share'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleExportPDF(activeTrip)}
                        title="Export PDF Report"
                      >
                        <Download size={15} />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSettleAndArchive}
                        title="Finish and archive trip"
                      >
                        <CheckCircle2 size={15} style={{ color: 'var(--credit)' }} />
                        <span>Finish &amp; Settle</span>
                      </button>

                      <button
                        type="button"
                        className="btn-icon"
                        onClick={handleCancelActiveTrip}
                        title="Discard active trip"
                        style={{ color: 'var(--debit)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 4 KPI Metric Cards */}
                  <div className="split-kpi-grid">
                    <div className="split-kpi-card">
                      <div className="split-kpi-label">
                        <Receipt size={14} /> Total Spend
                      </div>
                      <div className="split-kpi-value">
                        {fmtMoney(activeTripSummary.totalSpend, currency)}
                      </div>
                      <div className="split-kpi-sub">
                        {activeTrip.expenses.length} item{activeTrip.expenses.length === 1 ? '' : 's'} logged
                      </div>
                    </div>

                    <div className="split-kpi-card">
                      <div className="split-kpi-label">
                        <CreditCard size={14} /> Paid by You
                      </div>
                      <div className="split-kpi-value">
                        {youBalance ? fmtMoney(youBalance.paid, currency) : `${currSym}0.00`}
                      </div>
                      <div className="split-kpi-sub">Out of pocket total</div>
                    </div>

                    <div className="split-kpi-card">
                      <div className="split-kpi-label">
                        <Scale size={14} /> Your Fair Share
                      </div>
                      <div className="split-kpi-value">
                        {youBalance ? fmtMoney(youBalance.share, currency) : `${currSym}0.00`}
                      </div>
                      <div className="split-kpi-sub">Your portion</div>
                    </div>

                    <div
                      className={`split-kpi-card ${
                        youBalance
                          ? youBalance.net > 0.01
                            ? 'highlight-credit'
                            : youBalance.net < -0.01
                            ? 'highlight-debit'
                            : ''
                          : ''
                      }`}
                    >
                      <div className="split-kpi-label">
                        <UserCheck size={14} /> Your Net Balance
                      </div>
                      <div className="split-kpi-value">
                        {youBalance
                          ? youBalance.net > 0.01
                            ? `+${fmtMoney(youBalance.net, currency)}`
                            : youBalance.net < -0.01
                            ? `-${fmtMoney(Math.abs(youBalance.net), currency)}`
                            : 'Settled'
                          : 'Settled'}
                      </div>
                      <div className="split-kpi-sub">
                        {youBalance
                          ? youBalance.net > 0.01
                            ? 'You will receive back'
                            : youBalance.net < -0.01
                            ? 'You need to pay back'
                            : 'All balanced'
                          : 'All balanced'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BENTO 2-COLUMN LAYOUT: EXPENSES (LEFT) vs DEBTS & BALANCES (RIGHT) */}
                <div className="split-bento-layout">
                  {/* Left Column: Expenses Feed */}
                  <div className="split-panel">
                    <div className="split-panel-header">
                      <h3 className="split-panel-title">
                        <Receipt size={17} />
                        <span>Logged Expenses ({activeTrip.expenses.length})</span>
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={expenseSort}
                          onChange={e => setExpenseSort(e.target.value as 'newest' | 'oldest' | 'amount_desc' | 'amount_asc')}
                          className="split-select"
                          style={{ height: 30, padding: '2px 8px', fontSize: 'var(--fs-xs)' }}
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                          <option value="amount_desc">Highest Amount</option>
                          <option value="amount_asc">Lowest Amount</option>
                        </select>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleOpenAddExpense()}
                          style={{ height: 30, padding: '0 10px', fontSize: 'var(--fs-xs)' }}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>

                    <div className="split-panel-body">
                      {/* Search Filter if multiple expenses */}
                      {activeTrip.expenses.length > 3 && (
                        <div style={{ position: 'relative', marginBottom: 4 }}>
                          <Search
                            size={14}
                            style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-3)' }}
                          />
                          <input
                            type="text"
                            placeholder="Filter expenses or payers..."
                            value={expenseSearch}
                            onChange={e => setExpenseSearch(e.target.value)}
                            style={{
                              width: '100%',
                              height: 36,
                              paddingLeft: 34,
                              paddingRight: 12,
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--surface2)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                              fontSize: 'var(--fs-xs)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}

                      {filteredActiveExpenses.length === 0 ? (
                        <div
                          style={{
                            padding: '36px 16px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--surface2)',
                              border: '1px solid var(--border)',
                              display: 'grid',
                              placeItems: 'center',
                              color: 'var(--text-3)',
                            }}
                          >
                            <Receipt size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
                              No expenses logged yet
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                              Record bills, meals, tickets or travel costs to calculate fair shares.
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleOpenAddExpense()}
                            style={{ height: 34, padding: '0 14px', fontSize: 'var(--fs-xs)' }}
                          >
                            <Plus size={14} /> Add First Expense
                          </button>
                        </div>
                      ) : (
                        <div className="split-expense-list">
                          {filteredActiveExpenses.map(exp => {
                            const payer = activeTrip.members.find(m => m.id === exp.paidByMemberId);
                            const payerName = payer ? payer.name : 'Unknown';
                            const isPayerYou = payerName.toLowerCase() === 'you';
                            const payerAvatarColor = getTripMemberAvatarColor(payerName, 0);

                            return (
                              <div key={exp.id} className="split-expense-item">
                                <div className="split-expense-left">
                                  <div
                                    className="split-expense-avatar"
                                    style={{ background: payerAvatarColor }}
                                  >
                                    {friendInitial(payerName)}
                                  </div>

                                  <div className="split-expense-info">
                                    <div className="split-expense-desc">{exp.description}</div>
                                    <div className="split-expense-meta">
                                      <span>
                                        Paid by{' '}
                                        <strong className={isPayerYou ? 'payer-you' : ''}>
                                          {payerName}
                                        </strong>
                                      </span>
                                      <span>•</span>
                                      <span>{formatDisplayDate(exp.date)}</span>
                                      {exp.splitMode === 'custom' && (
                                        <span className="split-expense-tag">
                                          Custom Split
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="split-expense-right">
                                  <div className="split-expense-amount-wrap">
                                    <div className="split-expense-amt">{fmtMoney(exp.amount, currency)}</div>
                                    <div className="split-expense-share-pill">
                                      {exp.splitMode === 'equal'
                                        ? `~${fmtMoney(
                                            exp.amount / (exp.splitMemberIds?.length || activeTrip.members.length),
                                            currency
                                          )}/ea`
                                        : 'custom'}
                                    </div>
                                  </div>

                                  <div className="split-expense-actions">
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      onClick={() => handleOpenAddExpense(exp)}
                                      title="Edit expense"
                                      style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)' }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      onClick={() => handleDeleteExpense(exp.id)}
                                      title="Delete expense"
                                      style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', color: 'var(--debit)' }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Settlement Transfers & Member Balances */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 1. Settlement Plan Card */}
                    <div className="split-panel">
                      <div className="split-panel-header">
                        <h3 className="split-panel-title">
                          <Scale size={17} />
                          <span>Smart Debt Settlements</span>
                        </h3>

                        {activeTripSummary.transactions.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCopySettlementPlan}
                            style={{ height: 28, padding: '0 10px', fontSize: 'var(--fs-xs)', gap: 4 }}
                          >
                            {copiedPlan ? <Check size={13} style={{ color: 'var(--credit)' }} /> : <Copy size={13} />}
                            {copiedPlan ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>

                      <div className="split-panel-body">
                        {activeTripSummary.transactions.length === 0 ? (
                          <div
                            style={{
                              padding: '24px 16px',
                              textAlign: 'center',
                              background: 'var(--surface2)',
                              borderRadius: 'var(--radius-lg)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <CheckCircle2 size={24} style={{ color: 'var(--credit)' }} />
                            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
                              All Debts Balanced
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                              No transfers required between group members right now.
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {activeTripSummary.transactions.map((tx, idx) => (
                              <div key={idx} className="split-settlement-card">
                                <div className="split-settlement-flow">
                                  <span
                                    className={`split-settlement-member ${
                                      tx.fromName.toLowerCase() === 'you' ? 'debtor' : ''
                                    }`}
                                  >
                                    {tx.fromName}
                                  </span>
                                  <div className="split-settlement-arrow">
                                    <span>pays</span>
                                    <ArrowRight size={12} />
                                  </div>
                                  <span
                                    className={`split-settlement-member ${
                                      tx.toName.toLowerCase() === 'you' ? 'creditor' : ''
                                    }`}
                                  >
                                    {tx.toName}
                                  </span>
                                </div>

                                <div className="split-settlement-amount">
                                  {fmtMoney(tx.amount, currency)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Member Balances Breakdown */}
                    <div className="split-panel">
                      <div className="split-panel-header">
                        <h3 className="split-panel-title">
                          <Users size={17} />
                          <span>Member Balances ({activeTrip.members.length})</span>
                        </h3>
                      </div>

                      <div className="split-panel-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activeTrip.members.map((member, idx) => {
                            const b = activeTripSummary.balances[member.id] || { paid: 0, share: 0, net: 0 };
                            const isNetCredit = b.net > 0.01;
                            const isNetDebit = b.net < -0.01;
                            const avatarBg = getTripMemberAvatarColor(member.name, idx);

                            return (
                              <div
                                key={member.id}
                                className="split-member-card"
                                onClick={() => setSelectedMemberForDetail(member)}
                              >
                                <div className="split-member-left">
                                  <div className="split-member-avatar" style={{ background: avatarBg }}>
                                    {friendInitial(member.name)}
                                  </div>

                                  <div className="split-member-info">
                                    <div className="split-member-name-row">
                                      <span className="split-member-name">{member.name}</span>
                                      {member.name.toLowerCase() === 'you' && (
                                        <span className="split-member-you-badge">You</span>
                                      )}
                                    </div>
                                    <div className="split-member-sub">
                                      Paid: {fmtMoney(b.paid, currency)} • Share: {fmtMoney(b.share, currency)}
                                    </div>
                                  </div>
                                </div>

                                <div className="split-member-right">
                                  <div
                                    className={`split-member-net ${
                                      isNetCredit ? 'credit' : isNetDebit ? 'debit' : 'settled'
                                    }`}
                                  >
                                    {isNetCredit
                                      ? `+${fmtMoney(b.net, currency)}`
                                      : isNetDebit
                                      ? `-${fmtMoney(Math.abs(b.net), currency)}`
                                      : `${currSym}0.00`}
                                  </div>
                                  <div
                                    className={`split-member-status-label ${
                                      isNetCredit ? 'credit' : isNetDebit ? 'debit' : 'settled'
                                    }`}
                                  >
                                    {isNetCredit ? 'gets back' : isNetDebit ? 'owes' : 'settled'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Minimal Empty Active Trip State */
              <div className="split-empty-state-card">
                <div className="split-empty-icon-box">
                  <Compass size={30} />
                </div>

                <div style={{ textAlign: 'center', maxWidth: 440 }}>
                  <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    No Active Split in Progress
                  </h2>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Going on a trip, dining out, or splitting apartment groceries? Start a new group split to record shared expenses and calculate settlements.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleOpenStartTripModal()}
                    style={{ height: 40, padding: '0 18px', fontSize: 'var(--fs-sm)' }}
                  >
                    <Plus size={16} /> Start New Split
                  </button>

                  {presetGroups.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setActiveTab('groups')}
                      style={{ height: 40, padding: '0 16px', fontSize: 'var(--fs-sm)' }}
                    >
                      <Users size={16} /> Choose from Saved Groups
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: SAVED GROUPS VIEW */}
        {activeTab === 'groups' && (
          <motion.div
            key="tab-groups"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="splits-page-container"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>
                  Preset &amp; Saved Groups ({presetGroups.length})
                </h2>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                  Save your recurring friend circles or roommates to launch quick splits anytime.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenGroupDrawer()}
                style={{ height: 34, padding: '0 14px', fontSize: 'var(--fs-xs)' }}
              >
                <Plus size={14} /> Add Group
              </button>
            </div>

            {presetGroups.length === 0 ? (
              <div className="split-empty-state-card">
                <div className="split-empty-icon-box">
                  <Users size={28} />
                </div>
                <div style={{ textAlign: 'center', maxWidth: 400 }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    No Saved Groups Yet
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                    Create friend groups like &ldquo;Goa Trip&rdquo;, &ldquo;Flatmates&rdquo;, or &ldquo;Office Lunch&rdquo; for 1-click splitting.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenGroupDrawer()}
                  style={{ height: 36, padding: '0 16px', fontSize: 'var(--fs-xs)' }}
                >
                  <Plus size={14} /> Create First Group
                </button>
              </div>
            ) : (
              <div className="split-groups-grid">
                {presetGroups.map(grp => (
                  <div key={grp.id} className="split-group-card">
                    <div className="split-group-card-header">
                      <div>
                        <h3 className="split-group-card-title">{grp.name}</h3>
                        <div className="split-group-card-sub">{grp.memberNames.length} members</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleOpenGroupDrawer(grp)}
                          title="Edit group"
                          style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleDeleteGroup(grp.id)}
                          title="Delete group"
                          style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', color: 'var(--debit)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Member Avatars & Pills */}
                    <div className="split-group-members-list">
                      {grp.memberNames.map((name, idx) => (
                        <div key={idx} className="split-group-member-tag">
                          <div
                            className="split-group-member-mini-avatar"
                            style={{ background: getTripMemberAvatarColor(name, idx) }}
                          >
                            {friendInitial(name)}
                          </div>
                          <span>{name}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleOpenStartTripModal(grp)}
                      style={{ width: '100%', height: 36, fontSize: 'var(--fs-xs)', fontWeight: 600, gap: 6, marginTop: 'auto' }}
                    >
                      <Compass size={14} /> Start Split with this Group
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: HISTORY VIEW */}
        {activeTab === 'history' && (
          <motion.div
            key="tab-history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="splits-page-container"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>
                  Settled Splits &amp; Trip Archive ({tripHistory.length})
                </h2>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                  Browse previous trip summaries, export PDF settlements, or reopen splits.
                </div>
              </div>
            </div>

            {tripHistory.length === 0 ? (
              <div className="split-empty-state-card">
                <div className="split-empty-icon-box">
                  <HistoryIcon size={28} />
                </div>
                <div style={{ textAlign: 'center', maxWidth: 400 }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    No Settled Trips Yet
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                    When you finish an active split, click &ldquo;Finish &amp; Settle&rdquo; to archive it here with all historical records.
                  </div>
                </div>
              </div>
            ) : (
              <div className="split-history-list">
                {tripHistory.map(trip => {
                  const summary = simplifyDebts(trip.members, trip.expenses);
                  const dateStr = trip.archivedAt
                    ? formatDisplayDate(new Date(trip.archivedAt).toISOString().split('T')[0])
                    : formatDisplayDate(new Date(trip.createdAt).toISOString().split('T')[0]);

                  return (
                    <div
                      key={trip.id}
                      className="split-history-card"
                      onClick={() => setSelectedArchivedTrip(trip)}
                    >
                      <div className="split-history-top">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-full)',
                                background: 'var(--surface2)',
                                color: 'var(--text-2)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {trip.groupName}
                            </span>
                            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                              Settled {dateStr}
                            </span>
                          </div>
                          <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                            {trip.name}
                          </h3>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 750, color: 'var(--text)' }}>
                            {fmtMoney(summary.totalSpend, currency)}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                            {trip.expenses.length} expenses • {trip.members.length} members
                          </div>
                        </div>
                      </div>

                      <div className="split-history-bottom">
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {trip.members.map(m => m.name).join(', ')}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleExportPDF(trip)}
                            style={{ height: 28, padding: '0 10px', fontSize: '11px', gap: 4 }}
                          >
                            <Download size={13} /> PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleReopenTrip(trip)}
                            style={{ height: 28, padding: '0 10px', fontSize: '11px', gap: 4 }}
                          >
                            <RotateCcw size={13} /> Reopen
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleDeleteArchivedTrip(trip.id)}
                            style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', color: 'var(--debit)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 1: START / CREATE TRIP */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={showStartTripModal}
        onClose={() => setShowStartTripModal(false)}
        title="Start New Split"
        subtitle="Set up a trip or group event to track shared expenses"
        icon={<Compass size={18} />}
      >
        <form onSubmit={handleStartTripSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
              Trip / Event Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Manali Road Trip, Flat 402 Rent, Goa Dinner"
              value={newTripName}
              onChange={e => setNewTripName(e.target.value)}
              className="input-field"
              style={{ width: '100%', height: 40, fontSize: 'var(--fs-sm)' }}
            />
          </div>

          {/* Group Preset Selection */}
          {presetGroups.length > 0 && (
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Group Template
              </label>
              <select
                value={selectedGroupId}
                onChange={e => {
                  const gId = e.target.value;
                  setSelectedGroupId(gId);
                  if (gId) {
                    const found = presetGroups.find(g => g.id === gId);
                    if (found) {
                      setCustomTripMembers([...found.memberNames]);
                      if (!newTripName || newTripName.includes('Split')) {
                        setNewTripName(`${found.name} Split`);
                      }
                    }
                  }
                }}
                className="split-select"
                style={{ width: '100%', height: 40, fontSize: 'var(--fs-sm)' }}
              >
                <option value="">Custom Members</option>
                {presetGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberNames.length} members)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Members Input */}
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
              Members ({customTripMembers.length})
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {customTripMembers.map((name, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  {name.toLowerCase() !== 'you' && (
                    <button
                      type="button"
                      onClick={() => setCustomTripMembers(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Enter member name..."
                value={newTripMemberInput}
                onChange={e => setNewTripMemberInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newTripMemberInput.trim();
                    if (trimmed && !customTripMembers.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
                      setCustomTripMembers([...customTripMembers, trimmed]);
                      setNewTripMemberInput('');
                    }
                  }
                }}
                className="input-field"
                style={{ flex: 1, height: 38, fontSize: 'var(--fs-xs)' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const trimmed = newTripMemberInput.trim();
                  if (trimmed && !customTripMembers.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
                    setCustomTripMembers([...customTripMembers, trimmed]);
                    setNewTripMemberInput('');
                  }
                }}
                style={{ height: 38, padding: '0 14px', fontSize: 'var(--fs-xs)' }}
              >
                Add
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowStartTripModal(false)}
              style={{ flex: 1, height: 40 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, height: 40 }}
            >
              Start Split
            </button>
          </div>
        </form>
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* DRAWER 2: ADD / EDIT EXPENSE */}
      {/* ========================================================================= */}
      {activeTrip && (
        <BottomDrawer
          isOpen={showAddExpenseDrawer}
          onClose={() => setShowAddExpenseDrawer(false)}
          title={editingExpense ? 'Edit Trip Expense' : 'Add Trip Expense'}
          subtitle={`Adding to ${activeTrip.name}`}
          icon={<Receipt size={18} />}
        >
          <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Description
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Resort Booking, Dinner at Cafe, Fuel, Groceries"
                value={expDesc}
                onChange={e => setExpDesc(e.target.value)}
                className="input-field"
                style={{ width: '100%', height: 40, fontSize: 'var(--fs-sm)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                  Amount ({currSym})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', height: 40, fontSize: 'var(--fs-md)', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', height: 40, fontSize: 'var(--fs-xs)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Paid By
              </label>
              <select
                value={expPaidBy}
                onChange={e => setExpPaidBy(e.target.value)}
                className="split-select"
                style={{ width: '100%', height: 40, fontSize: 'var(--fs-sm)' }}
              >
                {activeTrip.members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.name.toLowerCase() === 'you' ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Split Mode Selector */}
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
                Split Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${expSplitMode === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setExpSplitMode('equal')}
                  style={{ height: 36, fontSize: 'var(--fs-xs)' }}
                >
                  Split Equally
                </button>
                <button
                  type="button"
                  className={`btn ${expSplitMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setExpSplitMode('custom')}
                  style={{ height: 36, fontSize: 'var(--fs-xs)' }}
                >
                  Custom Unequal Split
                </button>
              </div>
            </div>

            {/* Equal Split: Member participation */}
            {expSplitMode === 'equal' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
                    Split Among ({expSplitMembers.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (expSplitMembers.length === activeTrip.members.length) {
                        setExpSplitMembers([activeTrip.members[0].id]);
                      } else {
                        setExpSplitMembers(activeTrip.members.map(m => m.id));
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {expSplitMembers.length === activeTrip.members.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeTrip.members.map(member => {
                    const isSelected = expSplitMembers.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (expSplitMembers.length > 1) {
                              setExpSplitMembers(prev => prev.filter(id => id !== member.id));
                            }
                          } else {
                            setExpSplitMembers(prev => [...prev, member.id]);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full)',
                          background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          color: isSelected ? 'var(--accent)' : 'var(--text-3)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected && <Check size={13} />}
                        <span>{member.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Split: Amount input per member */}
            {expSplitMode === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
                  Enter Each Member&apos;s Exact Share ({currSym})
                </label>

                {activeTrip.members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={expCustomSplits[m.id] || ''}
                      onChange={e => setExpCustomSplits({ ...expCustomSplits, [m.id]: e.target.value })}
                      className="input-field"
                      style={{ flex: 1, height: 36, fontSize: 'var(--fs-xs)' }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddExpenseDrawer(false)}
                style={{ flex: 1, height: 40 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, height: 40 }}
              >
                Save Expense
              </button>
            </div>
          </form>
        </BottomDrawer>
      )}

      {/* ========================================================================= */}
      {/* DRAWER 3: CREATE / EDIT GROUP */}
      {/* ========================================================================= */}
      <BottomDrawer
        isOpen={showGroupDrawer}
        onClose={() => setShowGroupDrawer(false)}
        title={editingGroup ? 'Edit Saved Group' : 'Create Saved Group'}
        subtitle="Group templates for quick expense splitting"
        icon={<Users size={18} />}
      >
        <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
              Group Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Flat 301 Roommates, Goa Trip Gang, Friday Drinks"
              value={groupNameInput}
              onChange={e => setGroupNameInput(e.target.value)}
              className="input-field"
              style={{ width: '100%', height: 40, fontSize: 'var(--fs-sm)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'block' }}>
              Members ({groupMembersList.length})
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {groupMembersList.map((name, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  {name.toLowerCase() !== 'you' && (
                    <button
                      type="button"
                      onClick={() => setGroupMembersList(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Add member name..."
                value={groupMemberInput}
                onChange={e => setGroupMemberInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = groupMemberInput.trim();
                    if (trimmed && !groupMembersList.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
                      setGroupMembersList([...groupMembersList, trimmed]);
                      setGroupMemberInput('');
                    }
                  }
                }}
                className="input-field"
                style={{ flex: 1, height: 38, fontSize: 'var(--fs-xs)' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const trimmed = groupMemberInput.trim();
                  if (trimmed && !groupMembersList.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
                    setGroupMembersList([...groupMembersList, trimmed]);
                    setGroupMemberInput('');
                  }
                }}
                style={{ height: 38, padding: '0 14px', fontSize: 'var(--fs-xs)' }}
              >
                Add
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowGroupDrawer(false)}
              style={{ flex: 1, height: 40 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, height: 40 }}
            >
              Save Group
            </button>
          </div>
        </form>
      </BottomDrawer>

      {/* ========================================================================= */}
      {/* DRAWER 4: MEMBER DETAIL BREAKDOWN */}
      {/* ========================================================================= */}
      {selectedMemberForDetail && activeTrip && activeTripSummary && (
        <BottomDrawer
          isOpen={Boolean(selectedMemberForDetail)}
          onClose={() => setSelectedMemberForDetail(null)}
          title={`${selectedMemberForDetail.name}'s Contribution`}
          subtitle={`Breakdown in ${activeTrip.name}`}
          icon={<Users size={18} />}
        >
          {(() => {
            const b = activeTripSummary.balances[selectedMemberForDetail.id] || { paid: 0, share: 0, net: 0 };
            const isNetCredit = b.net > 0.01;
            const isNetDebit = b.net < -0.01;
            const paidExpenses = activeTrip.expenses.filter(e => e.paidByMemberId === selectedMemberForDetail.id);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 600 }}>Total Paid</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(b.paid, currency)}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 600 }}>Fair Share</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(b.share, currency)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    background: isNetCredit ? 'var(--credit-bg)' : isNetDebit ? 'var(--debit-bg)' : 'var(--surface2)',
                    border: `1px solid ${isNetCredit ? 'var(--credit-border)' : isNetDebit ? 'var(--debit-border)' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)' }}>
                    Net Settlement Status
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 750,
                      fontVariantNumeric: 'tabular-nums',
                      color: isNetCredit ? 'var(--credit)' : isNetDebit ? 'var(--debit)' : 'var(--text-2)',
                    }}
                  >
                    {isNetCredit ? `Gets Back +${fmtMoney(b.net, currency)}` : isNetDebit ? `Owes -${fmtMoney(Math.abs(b.net), currency)}` : 'Fully Settled'}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Expenses Paid by {selectedMemberForDetail.name} ({paidExpenses.length})
                  </div>

                  {paidExpenses.length === 0 ? (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', fontStyle: 'italic', padding: '8px 0' }}>
                      No expenses paid out of pocket yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {paidExpenses.map(exp => (
                        <div
                          key={exp.id}
                          className="split-expense-item"
                          style={{ padding: 'var(--space-2) var(--space-3)' }}
                        >
                          <div>
                            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)' }}>{exp.description}</div>
                            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>{formatDisplayDate(exp.date)}</div>
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtMoney(exp.amount, currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </BottomDrawer>
      )}

      {/* ========================================================================= */}
      {/* DRAWER 5: ARCHIVED TRIP DETAIL */}
      {/* ========================================================================= */}
      {selectedArchivedTrip && (
        <BottomDrawer
          isOpen={Boolean(selectedArchivedTrip)}
          onClose={() => setSelectedArchivedTrip(null)}
          title={selectedArchivedTrip.name}
          subtitle={`Archived Split • ${selectedArchivedTrip.groupName}`}
          icon={<HistoryIcon size={18} />}
        >
          {(() => {
            const summary = simplifyDebts(selectedArchivedTrip.members, selectedArchivedTrip.expenses);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 600 }}>Total Spent</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(summary.totalSpend, currency)}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 600 }}>Avg / Person</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      ~{fmtMoney(summary.perPersonAvg, currency)}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Settlement Summary
                  </div>

                  {summary.transactions.length === 0 ? (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', fontStyle: 'italic' }}>
                      All members were fully settled.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {summary.transactions.map((tx, idx) => (
                        <div
                          key={idx}
                          className="split-settlement-card"
                          style={{ padding: 'var(--space-2) var(--space-3)' }}
                        >
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text)' }}>
                            <strong>{tx.fromName}</strong> paid <strong>{tx.toName}</strong>
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--credit)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtMoney(tx.amount, currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExportPDF(selectedArchivedTrip)}
                    style={{ flex: 1, height: 40 }}
                  >
                    <Download size={14} /> Export PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleReopenTrip(selectedArchivedTrip)}
                    style={{ flex: 1, height: 40 }}
                  >
                    <RotateCcw size={14} /> Reopen Split
                  </button>
                </div>
              </div>
            );
          })()}
        </BottomDrawer>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM DIALOG */}
      {/* ========================================================================= */}
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
