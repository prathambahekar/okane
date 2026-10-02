/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  firebaseAuth,
  subscribeToAuthChanges,
  signInWithGoogle as fbSignInWithGoogle,
  signOutUser as fbSignOutUser,
  syncUserDataToFirestore,
  fetchUserDataFromFirestore,
} from '../firebase';
import type { AppDB } from '../types';
import { useStore } from '../store';

function isDatabaseEmpty(currentDb: AppDB): boolean {
  if (!currentDb) return true;
  const expenseCount = currentDb.expenses?.length || 0;
  const friendCount = currentDb.friends?.length || 0;
  const settlementCount = currentDb.settlements?.length || 0;
  const recurringCount = currentDb.recurringRules?.length || 0;
  const tripCount = currentDb.tripHistory?.length || 0;
  const hasActiveTrip = Boolean(currentDb.activeTrip);
  return expenseCount === 0 && friendCount === 0 && settlementCount === 0 && recurringCount === 0 && tripCount === 0 && !hasActiveTrip;
}

function getDbFingerprint(d: AppDB): string {
  if (!d) return '';
  return JSON.stringify({
    expenses: d.expenses,
    friends: d.friends,
    wallets: d.wallets,
    settlements: d.settlements,
    recurringRules: d.recurringRules,
    tripHistory: d.tripHistory,
    activeTrip: d.activeTrip,
  });
}

export interface FirebaseContextType {
  user: User | null;
  authLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  isAutoSyncActive: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  syncToCloud: (db?: AppDB) => Promise<boolean>;
  pullFromCloud: () => Promise<Partial<AppDB> | null>;
  restoreFromCloud: () => Promise<boolean>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const { db, restoreDB, showToast } = useStore();
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem('okane_last_firebase_sync');
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  const latestDbRef = useRef(db);
  useEffect(() => {
    latestDbRef.current = db;
  }, [db]);

  const checkedRestoreUserRef = useRef<string | null>(null);
  const isRestoringFromCloudRef = useRef(false);
  const lastSyncedFingerprintRef = useRef<string>('');
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        checkedRestoreUserRef.current = null;
        lastSyncedFingerprintRef.current = '';
        if (uploadTimerRef.current) {
          clearTimeout(uploadTimerRef.current);
          uploadTimerRef.current = null;
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Flush any pending auto-save if page unloads or closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (uploadTimerRef.current && user && latestDbRef.current) {
        clearTimeout(uploadTimerRef.current);
        uploadTimerRef.current = null;
        syncUserDataToFirestore(user.uid, latestDbRef.current).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Helper to merge items by ID (cloud items take precedence, local offline items preserved)
  const performRestore = useCallback(async (targetUid: string) => {
    try {
      setIsSyncing(true);
      const cloudData = await fetchUserDataFromFirestore(targetUid);
      const currentDb = latestDbRef.current;

      const hasCloudData = Boolean(
        cloudData && (
          (cloudData.expenses && cloudData.expenses.length > 0) ||
          (cloudData.friends && cloudData.friends.length > 0) ||
          (cloudData.settlements && cloudData.settlements.length > 0) ||
          (cloudData.recurringRules && cloudData.recurringRules.length > 0) ||
          (cloudData.wallets && cloudData.wallets.length > 0)
        )
      );

      if (hasCloudData && cloudData) {
        const mergeById = <T extends { id?: string }>(primary: T[], secondary: T[]): T[] => {
          const map = new Map<string, T>();
          for (const item of primary) {
            if (item && item.id) map.set(item.id, item);
          }
          for (const item of secondary) {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          }
          return Array.from(map.values());
        };

        const mergedExpenses = mergeById(cloudData.expenses || [], currentDb.expenses || []);
        const mergedFriends = mergeById(cloudData.friends || [], currentDb.friends || []);
        const mergedWallets = (cloudData.wallets && cloudData.wallets.length > 0) ? cloudData.wallets : currentDb.wallets;
        const mergedSettlements = mergeById(cloudData.settlements || [], currentDb.settlements || []);
        const mergedRules = mergeById(cloudData.recurringRules || [], currentDb.recurringRules || []);

        const restoredDB: AppDB = {
          version: cloudData.version || currentDb.version || 3,
          expenses: mergedExpenses,
          friends: mergedFriends,
          wallets: mergedWallets,
          settlements: mergedSettlements,
          recurringRules: mergedRules,
          settings: {
            ...currentDb.settings,
            ...(cloudData.settings || {}),
          },
          activeTrip: cloudData.activeTrip ?? currentDb.activeTrip,
          tripHistory: (cloudData.tripHistory && cloudData.tripHistory.length > 0) ? cloudData.tripHistory : currentDb.tripHistory,
          presetGroups: (cloudData.presetGroups && cloudData.presetGroups.length > 0) ? cloudData.presetGroups : currentDb.presetGroups,
        };

        isRestoringFromCloudRef.current = true;
        lastSyncedFingerprintRef.current = getDbFingerprint(restoredDB);
        restoreDB(restoredDB);

        const now = new Date();
        setLastSyncTime(now);
        try {
          localStorage.setItem('okane_last_firebase_sync', now.toISOString());
        } catch {
          // ignore
        }

        const count = restoredDB.expenses.length;
        showToast(`Cloud backup restored: ${count} expenses synced!`);
      } else if (!isDatabaseEmpty(currentDb)) {
        // Cloud is empty but local has data: auto-backup local data to cloud for this account
        await syncUserDataToFirestore(targetUid, currentDb);
        const now = new Date();
        setLastSyncTime(now);
        lastSyncedFingerprintRef.current = getDbFingerprint(currentDb);
        try {
          localStorage.setItem('okane_last_firebase_sync', now.toISOString());
        } catch {
          // ignore
        }
      } else {
        lastSyncedFingerprintRef.current = getDbFingerprint(currentDb);
      }
    } catch (err) {
      console.warn('[CloudSync] Restore on login failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [restoreDB, showToast]);

  // 1. Auto-Restore when signed in or re-authenticating
  useEffect(() => {
    if (!user || authLoading) return;
    if (checkedRestoreUserRef.current === user.uid) return;

    checkedRestoreUserRef.current = user.uid;
    performRestore(user.uid);
  }, [user, authLoading, performRestore]);

  // 2. Background Auto-Upload when data increments / changes
  useEffect(() => {
    if (!user || authLoading) return;
    if (checkedRestoreUserRef.current !== user.uid) return;

    if (isRestoringFromCloudRef.current) {
      isRestoringFromCloudRef.current = false;
      return;
    }

    // Do not auto-upload an empty database
    if (isDatabaseEmpty(db)) return;

    const currentFingerprint = getDbFingerprint(db);

    if (!lastSyncedFingerprintRef.current) {
      lastSyncedFingerprintRef.current = currentFingerprint;
      return;
    }

    if (currentFingerprint === lastSyncedFingerprintRef.current) {
      return;
    }

    // New/modified data detected! Debounce auto-upload in background
    if (uploadTimerRef.current) {
      clearTimeout(uploadTimerRef.current);
    }

    uploadTimerRef.current = setTimeout(async () => {
      try {
        setIsSyncing(true);
        const freshDb = latestDbRef.current;
        await syncUserDataToFirestore(user.uid, freshDb);
        const now = new Date();
        setLastSyncTime(now);
        lastSyncedFingerprintRef.current = getDbFingerprint(freshDb);
        try {
          localStorage.setItem('okane_last_firebase_sync', now.toISOString());
        } catch {
          // ignore
        }
        console.log('[CloudSync] Background auto-upload completed successfully.');
      } catch (err) {
        console.warn('[CloudSync] Background auto-upload to cloud failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 1500);

    return () => {
      if (uploadTimerRef.current) {
        clearTimeout(uploadTimerRef.current);
      }
    };
  }, [db, user, authLoading]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    try {
      setIsSyncing(true);
      const loggedUser = await fbSignInWithGoogle();
      setUser(loggedUser);
      if (loggedUser) {
        checkedRestoreUserRef.current = loggedUser.uid;
        await performRestore(loggedUser.uid);
      }
      return loggedUser;
    } catch (err) {
      console.error('Firebase Google sign-in failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [performRestore]);

  const signOut = useCallback(async () => {
    try {
      if (uploadTimerRef.current) {
        clearTimeout(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
      checkedRestoreUserRef.current = null;
      lastSyncedFingerprintRef.current = '';
      await fbSignOutUser();
      setUser(null);
    } catch (err) {
      console.error('Firebase sign-out failed:', err);
      throw err;
    }
  }, []);

  const syncToCloud = useCallback(async (appDb?: AppDB): Promise<boolean> => {
    if (!user) return false;
    const targetDb = appDb || latestDbRef.current;
    setIsSyncing(true);
    try {
      await syncUserDataToFirestore(user.uid, targetDb);
      const now = new Date();
      setLastSyncTime(now);
      lastSyncedFingerprintRef.current = getDbFingerprint(targetDb);
      try {
        localStorage.setItem('okane_last_firebase_sync', now.toISOString());
      } catch {
        // ignore
      }
      return true;
    } catch (err) {
      console.error('Sync to Firestore failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const pullFromCloud = useCallback(async (): Promise<Partial<AppDB> | null> => {
    if (!user) return null;
    setIsSyncing(true);
    try {
      const data = await fetchUserDataFromFirestore(user.uid);
      const now = new Date();
      setLastSyncTime(now);
      try {
        localStorage.setItem('okane_last_firebase_sync', now.toISOString());
      } catch {
        // ignore
      }
      return data;
    } catch (err) {
      console.error('Fetch from Firestore failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const restoreFromCloud = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    await performRestore(user.uid);
    return true;
  }, [user, performRestore]);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authLoading,
        isSyncing,
        lastSyncTime,
        isAutoSyncActive: Boolean(user),
        signInWithGoogle,
        signOut,
        syncToCloud,
        pullFromCloud,
        restoreFromCloud,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return ctx;
}
