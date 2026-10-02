/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

export interface FirebaseContextType {
  user: User | null;
  authLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  syncToCloud: (db: AppDB) => Promise<boolean>;
  pullFromCloud: () => Promise<Partial<AppDB> | null>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
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

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    try {
      setIsSyncing(true);
      const loggedUser = await fbSignInWithGoogle();
      setUser(loggedUser);
      return loggedUser;
    } catch (err) {
      console.error('Firebase Google sign-in failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOutUser();
      setUser(null);
    } catch (err) {
      console.error('Firebase sign-out failed:', err);
      throw err;
    }
  }, []);

  const syncToCloud = useCallback(async (appDb: AppDB): Promise<boolean> => {
    if (!user) return false;
    setIsSyncing(true);
    try {
      await syncUserDataToFirestore(user.uid, appDb);
      const now = new Date();
      setLastSyncTime(now);
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

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authLoading,
        isSyncing,
        lastSyncTime,
        signInWithGoogle,
        signOut,
        syncToCloud,
        pullFromCloud,
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
