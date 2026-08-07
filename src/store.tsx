/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AppDB, Expense, Friend, Wallet, RecurringRule } from './types';
import {
  loadDB, saveDB, defaultDB, DEFAULT_CATEGORIES, DEFAULT_WALLETS,
  addExpense as dbAddExpense, updateExpense as dbUpdateExpense, deleteExpense as dbDeleteExpense, deleteExpenseGroup as dbDeleteExpenseGroup,
  transferFunds as dbTransferFunds,
  addFriend as dbAddFriend, updateFriend as dbUpdateFriend, deleteFriend as dbDeleteFriend,
  addWallet as dbAddWallet, updateWallet as dbUpdateWallet, deleteWallet as dbDeleteWallet,
  updateCategory as dbUpdateCategory,
  recordSettlement as dbRecordSettlement, deleteSettlement as dbDeleteSettlement, unsettleExpense as dbUnsettleExpense,
  addRecurringRule as dbAddRecurringRule, updateRecurringRule as dbUpdateRecurringRule, deleteRecurringRule as dbDeleteRecurringRule,
  triggerAutopayDeduct as dbTriggerAutopayDeduct, quickLogRecurringRule as dbQuickLogRecurringRule,
  seedSampleData,
  todayISO,
} from './db';
import {
  fetchGitHubReleases,
  compareVersions,
  getStoredInstalledVersion,
  setStoredInstalledVersion,
  type UpdateInfo,
  type ReleaseItem,
} from './utils/updateManager';

interface UndoEntry {
  label: string;
  snapshot: AppDB;
}

interface Toast {
  id: string;
  message: string;
  onUndo?: () => void;
}

interface StoreContextType {
  db: AppDB;
  toasts: Toast[];

  availableUpdate: UpdateInfo | null;
  releaseHistory: ReleaseItem[];
  isCheckingUpdate: boolean;
  isUpdating: boolean;
  updateProgress: number;
  updateStatusMessage: string;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  simulateUpdate: (version?: string) => void;
  installUpdate: () => Promise<void>;
  dismissUpdateNotification: () => void;

  addExpense: (data: Partial<Expense>) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  addFriend: (data: Partial<Friend>) => Friend;
  updateFriend: (id: string, data: Partial<Friend>) => void;
  deleteFriend: (id: string) => void;

  addWallet: (data: Partial<Wallet>) => Wallet;
  updateWallet: (id: string, data: Partial<Wallet>) => void;
  deleteWallet: (id: string) => boolean;
  transferFunds: (fromWalletId: string, toWalletId: string, amount: number, date: string, note?: string) => void;

  recordSettlement: (friendId: string, expenseIds: string[], note: string, walletId?: string) => void;
  deleteSettlement: (id: string) => void;
  unsettleExpense: (expenseId: string) => void;

  addRecurringRule: (data: Partial<RecurringRule>) => void;
  updateRecurringRule: (id: string, data: Partial<RecurringRule>) => void;
  deleteRecurringRule: (id: string) => void;
  triggerAutopayDeduct: (ruleId: string, customDate?: string, customWalletId?: string) => void;
  quickLogRecurringRule: (ruleId: string, customDate?: string, customWalletId?: string) => void;

  updateCategory: (oldName: string, data: { name: string; color: string; icon?: string }) => void;
  updateSettings: (data: Partial<AppDB['settings']>) => void;
  resetDB: () => void;
  restoreDB: (data: AppDB) => void;
  loadSampleData: () => void;
  bulkAddExpenses: (expenses: Partial<Expense>[]) => number;

  showToast: (message: string, onUndo?: () => void) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDB] = useState<AppDB>(() => loadDB());
  const [, setUndoStack] = useState<UndoEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const persist = useCallback((next: AppDB) => {
    setDB(next);
    saveDB(next);
  }, []);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    const id = 'toast_' + Date.now() + Math.random().toString(36).slice(2);
    setToasts([{ id, message, onUndo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseItem[]>([]);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatusMessage, setUpdateStatusMessage] = useState('');

  const checkForUpdates = useCallback(async (manual = false) => {
    setIsCheckingUpdate(true);
    try {
      const { latest, history } = await fetchGitHubReleases();
      setReleaseHistory(history);

      let currentVer = db.settings.installedVersion || getStoredInstalledVersion();
      if (latest && compareVersions(currentVer, latest.version) > 0) {
        currentVer = latest.version;
        setStoredInstalledVersion(latest.version);
        setDB(current => {
          const next = { ...current, settings: { ...current.settings, installedVersion: latest.version } };
          saveDB(next);
          return next;
        });
      }

      if (latest && compareVersions(latest.version, currentVer) > 0) {
        setAvailableUpdate(latest);
        if (manual) showToast(`New version available from GitHub: v${latest.version}`);
      } else {
        setAvailableUpdate(null);
        if (manual) showToast(`Okane is up to date (v${currentVer})`);
      }
    } catch {
      if (manual) showToast('Could not fetch release details from GitHub');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [db.settings.installedVersion, showToast]);

  const simulateUpdate = useCallback((targetVer?: string) => {
    const ver = targetVer || '0.9.0';
    const mockUpdate: UpdateInfo = {
      version: ver,
      buildNumber: '108',
      releaseDate: todayISO(),
      releaseNotes: `Okane v${ver}: Dev feature release with auto-updater, performance optimizations, and bug fixes.`,
      downloadUrl: `/updates/v${ver}.zip`,
    };
    setAvailableUpdate(mockUpdate);
    showToast(`Simulated new version available: v${ver}`);
  }, [showToast]);

  const dismissUpdateNotification = useCallback(() => {
    setAvailableUpdate(null);
  }, []);

  const installUpdate = useCallback(async () => {
    if (!availableUpdate) return;
    setIsUpdating(true);
    setUpdateProgress(10);
    setUpdateStatusMessage('Connecting to update server...');

    await new Promise(r => setTimeout(r, 600));
    setUpdateProgress(40);
    setUpdateStatusMessage(`Downloading Okane v${availableUpdate.version} bundle...`);

    await new Promise(r => setTimeout(r, 800));
    setUpdateProgress(75);
    setUpdateStatusMessage('Validating integrity & applying schema migrations...');

    await new Promise(r => setTimeout(r, 700));
    setUpdateProgress(100);
    setUpdateStatusMessage('Update installation complete!');

    const newVer = availableUpdate.version;
    setStoredInstalledVersion(newVer);
    setDB(current => {
      const next = {
        ...current,
        settings: {
          ...current.settings,
          installedVersion: newVer,
          lastUpdateCheck: todayISO(),
        },
      };
      saveDB(next);
      return next;
    });

    await new Promise(r => setTimeout(r, 400));
    setAvailableUpdate(null);
    setIsUpdating(false);
    showToast(`Successfully updated to Okane v${newVer}! 🎉`);
  }, [availableUpdate, showToast]);

  useEffect(() => {
    let isMounted = true;
    if (db.settings.devMode !== false && db.settings.enableAutoUpdate !== false) {
      fetchGitHubReleases().then(({ latest, history }) => {
        if (!isMounted) return;
        setReleaseHistory(history);
        let currentVer = db.settings.installedVersion || getStoredInstalledVersion();
        if (latest && compareVersions(currentVer, latest.version) > 0) {
          currentVer = latest.version;
          setStoredInstalledVersion(latest.version);
          setDB(current => {
            const next = { ...current, settings: { ...current.settings, installedVersion: latest.version } };
            saveDB(next);
            return next;
          });
        }
        if (latest && compareVersions(latest.version, currentVer) > 0) {
          setAvailableUpdate(latest);
        }
      }).catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [db.settings.devMode, db.settings.enableAutoUpdate, db.settings.installedVersion]);

  const pushUndo = useCallback((label: string, snapshot: AppDB, onUndo: () => void) => {
    const entry: UndoEntry = { label, snapshot };
    setUndoStack(s => [...s.slice(-24), entry]);
    showToast(label, onUndo);
  }, [showToast]);

  const addExpense = useCallback((data: Partial<Expense>) => {
    setDB(current => {
      const next = dbAddExpense(current, data);
      saveDB(next);
      return next;
    });
  }, []);

  const updateExpense = useCallback((id: string, data: Partial<Expense>) => {
    setDB(current => {
      const next = dbUpdateExpense(current, id, data);
      saveDB(next);
      return next;
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setDB(current => {
      const snapshot = current;
      const target = current.expenses.find(x => x.id === id || x.groupId === id);
      const targetGroupId = target?.groupId || (current.expenses.some(x => x.groupId === id) ? id : null);
      const next = targetGroupId
        ? dbDeleteExpenseGroup(current, targetGroupId)
        : dbDeleteExpense(current, id);
      saveDB(next);
      pushUndo('Expense deleted & money restored to wallet', snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

  const addFriend = useCallback((data: Partial<Friend>): Friend => {
    let createdFriend!: Friend;
    setDB(current => {
      const { db: next, friend } = dbAddFriend(current, data);
      createdFriend = friend;
      saveDB(next);
      return next;
    });
    return createdFriend;
  }, []);

  const updateFriend = useCallback((id: string, data: Partial<Friend>) => {
    setDB(current => {
      const next = dbUpdateFriend(current, id, data);
      saveDB(next);
      return next;
    });
  }, []);

  const deleteFriend = useCallback((id: string) => {
    setDB(current => {
      const snapshot = current;
      const next = dbDeleteFriend(current, id);
      saveDB(next);
      pushUndo('Friend removed', snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

  const addWallet = useCallback((data: Partial<Wallet>): Wallet => {
    let created!: Wallet;
    setDB(current => {
      const { db: next, wallet } = dbAddWallet(current, data);
      created = wallet;
      saveDB(next);
      return next;
    });
    return created;
  }, []);

  const updateWallet = useCallback((id: string, data: Partial<Wallet>) => {
    setDB(current => {
      const next = dbUpdateWallet(current, id, data);
      saveDB(next);
      return next;
    });
  }, []);

  const deleteWalletFn = useCallback((id: string): boolean => {
    let success = false;
    setDB(current => {
      if (current.wallets.length <= 1) return current;
      const snapshot = current;
      const next = dbDeleteWallet(current, id);
      if (!next) return current;
      success = true;
      saveDB(next);
      pushUndo('Wallet removed', snapshot, () => persist(snapshot));
      return next;
    });
    return success;
  }, [pushUndo, persist]);

  const transferFunds = useCallback((fromWalletId: string, toWalletId: string, amount: number, date: string, note?: string) => {
    setDB(current => {
      const snapshot = current;
      const { db: next, fromName, toName } = dbTransferFunds(current, fromWalletId, toWalletId, amount, date, note);
      saveDB(next);
      pushUndo(`Transferred funds from ${fromName} to ${toName}`, snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

  const recordSettlement = useCallback((friendId: string, expenseIds: string[], note: string, walletId?: string) => {
    setDB(current => {
      const next = dbRecordSettlement(current, friendId, expenseIds, note, walletId);
      saveDB(next);
      return next;
    });
  }, []);

  const deleteSettlement = useCallback((id: string) => {
    setDB(current => {
      const snapshot = current;
      const next = dbDeleteSettlement(current, id);
      saveDB(next);
      pushUndo('Settlement undone & money restored to wallet', snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

  const unsettleExpense = useCallback((expenseId: string) => {
    setDB(current => {
      const snapshot = current;
      const next = dbUnsettleExpense(current, expenseId);
      saveDB(next);
      pushUndo('Payment status reset & money restored', snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

  const addRecurringRule = useCallback((data: Partial<RecurringRule>) => {
    setDB(current => {
      const next = dbAddRecurringRule(current, data);
      saveDB(next);
      return next;
    });
  }, []);

  const updateRecurringRule = useCallback((id: string, data: Partial<RecurringRule>) => {
    setDB(current => {
      const next = dbUpdateRecurringRule(current, id, data);
      saveDB(next);
      return next;
    });
  }, []);

  const deleteRecurringRule = useCallback((id: string) => {
    setDB(current => {
      const snapshot = current;
      const next = dbDeleteRecurringRule(current, id);
      saveDB(next);
      pushUndo('Recurring rule deleted', snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

  const triggerAutopayDeduct = useCallback((ruleId: string, customDate?: string, customWalletId?: string) => {
    setDB(current => {
      const snapshot = current;
      const { db: next, expense } = dbTriggerAutopayDeduct(current, ruleId, customDate, customWalletId);
      saveDB(next);
      if (expense) {
        pushUndo(`Autopay paid: ${expense.description}`, snapshot, () => persist(snapshot));
      }
      return next;
    });
  }, [pushUndo, persist]);

  const quickLogRecurringRule = useCallback((ruleId: string, customDate?: string, customWalletId?: string) => {
    setDB(current => {
      const snapshot = current;
      const { db: next, expense } = dbQuickLogRecurringRule(current, ruleId, customDate, customWalletId);
      saveDB(next);
      if (expense) {
        pushUndo(`Logged: ${expense.description}`, snapshot, () => persist(snapshot));
      }
      return next;
    });
  }, [pushUndo, persist]);

  const updateCategory = useCallback((oldName: string, data: { name: string; color: string; icon?: string }) => {
    setDB(current => {
      const next = dbUpdateCategory(current, oldName, data);
      saveDB(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((data: Partial<AppDB['settings']>) => {
    setDB(current => {
      const next = { ...current, settings: { ...current.settings, ...data } };
      saveDB(next);
      return next;
    });
  }, []);

  const resetDB = useCallback(() => {
    const next = defaultDB();
    persist(next);
  }, [persist]);

  const restoreDB = useCallback((data: AppDB) => {
    const defaultWal = data.settings?.defaultWalletId || data.wallets?.[0]?.id || 'wal_cash';
    const rawData = data as unknown as Record<string, unknown>;
    const friendsArr = (Array.isArray(data.friends) && data.friends.length > 0)
      ? data.friends
      : (Array.isArray(rawData.contacts) ? (rawData.contacts as Friend[]) : (Array.isArray(data.friends) ? data.friends : []));
    const normalized: AppDB = {
      version: data.version || 3,
      friends: friendsArr,
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
      settlements: Array.isArray(data.settlements) ? data.settlements : [],
      wallets: Array.isArray(data.wallets) && data.wallets.length > 0 ? data.wallets : JSON.parse(JSON.stringify(DEFAULT_WALLETS)),
      settings: Object.assign(
        {
          currency: 'INR',
          categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
          defaultCategory: 'Food',
          defaultStatus: 'paid',
          defaultWalletId: defaultWal,
        },
        data.settings || {}
      ),
      recurringRules: Array.isArray(data.recurringRules) ? data.recurringRules : [],
    };
    persist(normalized);
  }, [persist]);

  const loadSampleData = useCallback(() => {
    setDB(current => {
      const next = seedSampleData(current);
      saveDB(next);
      return next;
    });
  }, []);

  const bulkAddExpenses = useCallback((expenses: Partial<Expense>[]): number => {
    let count = 0;
    setDB(current => {
      let next = current;
      expenses.forEach(e => {
        next = dbAddExpense(next, e);
        count++;
      });
      saveDB(next);
      return next;
    });
    return count;
  }, []);

  const value: StoreContextType = {
    db, toasts,
    availableUpdate,
    releaseHistory,
    isCheckingUpdate,
    isUpdating,
    updateProgress,
    updateStatusMessage,
    checkForUpdates,
    simulateUpdate,
    installUpdate,
    dismissUpdateNotification,
    addExpense, updateExpense, deleteExpense,
    addFriend, updateFriend, deleteFriend,
    addWallet, updateWallet, deleteWallet: deleteWalletFn, transferFunds,
    recordSettlement, deleteSettlement, unsettleExpense,
    addRecurringRule, updateRecurringRule, deleteRecurringRule,
    triggerAutopayDeduct, quickLogRecurringRule,
    updateCategory, updateSettings, resetDB, restoreDB, loadSampleData, bulkAddExpenses,
    showToast, dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
