import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AppDB, Expense, Friend, Wallet } from './types';
import {
  loadDB, saveDB, defaultDB,
  addExpense as dbAddExpense, updateExpense as dbUpdateExpense, deleteExpense as dbDeleteExpense,
  addFriend as dbAddFriend, updateFriend as dbUpdateFriend, deleteFriend as dbDeleteFriend,
  addWallet as dbAddWallet, updateWallet as dbUpdateWallet, deleteWallet as dbDeleteWallet,
  recordSettlement as dbRecordSettlement, deleteSettlement as dbDeleteSettlement,
  seedSampleData,
} from './db';

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

  addExpense: (data: Partial<Expense>) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  addFriend: (data: Partial<Friend>) => Friend;
  updateFriend: (id: string, data: Partial<Friend>) => void;
  deleteFriend: (id: string) => void;

  addWallet: (data: Partial<Wallet>) => Wallet;
  updateWallet: (id: string, data: Partial<Wallet>) => void;
  deleteWallet: (id: string) => boolean;

  recordSettlement: (friendId: string, expenseIds: string[], note: string, walletId?: string) => void;
  deleteSettlement: (id: string) => void;

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
  const [_undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const persist = useCallback((next: AppDB) => {
    setDB(next);
    saveDB(next);
  }, []);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    const id = 'toast_' + Date.now() + Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, onUndo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

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
      const next = dbDeleteExpense(current, id);
      saveDB(next);
      pushUndo('Expense deleted', snapshot, () => persist(snapshot));
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
      pushUndo('Settlement undone', snapshot, () => persist(snapshot));
      return next;
    });
  }, [pushUndo, persist]);

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
    persist(data);
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
    addExpense, updateExpense, deleteExpense,
    addFriend, updateFriend, deleteFriend,
    addWallet, updateWallet, deleteWallet: deleteWalletFn,
    recordSettlement, deleteSettlement,
    updateSettings, resetDB, restoreDB, loadSampleData, bulkAddExpenses,
    showToast, dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
