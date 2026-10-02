import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { AppDB, Expense, Friend, Wallet, Settlement, RecurringRule } from './types';

// 1. Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firestoreDb =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// 3. Initialize Firebase Authentication
export const firebaseAuth = getAuth(app);

// 4. Validate connection to Firestore on initialization
async function testConnection() {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection().catch(() => {});

// 5. Hardened Error Handlers
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 6. Authentication Helper Methods
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let isSocialLoginInitialized = false;

export async function ensureSocialLoginInit(): Promise<void> {
  if (isSocialLoginInitialized || !Capacitor.isNativePlatform()) return;
  try {
    await SocialLogin.initialize({
      google: {
        webClientId: firebaseConfig.oAuthClientId,
        mode: 'online',
      },
    });
    isSocialLoginInitialized = true;
  } catch (e) {
    console.warn('[SocialLogin] Initialize warning:', e);
  }
}

if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  ensureSocialLoginInit().catch(() => {});
}

async function recordUserProfile(user: User): Promise<void> {
  const userRef = doc(firestoreDb, 'users', user.uid);
  const userSnap = await getDoc(userRef).catch(() => null);
  const nowIso = new Date().toISOString();
  if (!userSnap || !userSnap.exists()) {
    await setDoc(userRef, {
      id: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    }).catch(err => {
      console.warn('Failed creating initial user profile document:', err);
    });
  } else {
    await setDoc(
      userRef,
      {
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});
  }
}

export async function signInWithGoogle(): Promise<User> {
  try {
    // 1. On Native Mobile (Android/iOS via Capacitor), use native system account dialog
    if (Capacitor.isNativePlatform()) {
      await ensureSocialLoginInit();
      const loginRes = await SocialLogin.login({
        provider: 'google',
        options: {},
      });

      const resObj = loginRes?.result as { idToken?: string | null } | undefined;
      const idToken = resObj?.idToken;
      if (!idToken) {
        throw new Error('Native Google sign-in was cancelled or returned no ID token.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(firebaseAuth, credential);
      if (cred.user) {
        await recordUserProfile(cred.user);
      }
      return cred.user;
    }

    // 2. On Web / Desktop (Browser or Tauri), use web popup
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    if (cred.user) {
      await recordUserProfile(cred.user);
    }
    return cred.user;
  } catch (error) {
    console.error('Sign-in with Google failed:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await SocialLogin.logout({ provider: 'google' }).catch(() => {});
    }
    await fbSignOut(firebaseAuth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}

// 7. Cloud Sync Operations between Okane and Firestore
export async function syncUserDataToFirestore(userId: string, data: AppDB): Promise<void> {
  if (!userId) throw new Error('Cannot sync without authenticated user ID');
  const path = `users/${userId}/data/ledger`;

  try {
    // 1. Save Full Ledger Snapshot for atomic and reliable 1-step restores
    const ledgerRef = doc(firestoreDb, 'users', userId, 'data', 'ledger');
    const cleanData: AppDB = JSON.parse(JSON.stringify(data));
    await setDoc(
      ledgerRef,
      {
        id: 'ledger',
        userId,
        version: cleanData.version || 3,
        expenses: cleanData.expenses || [],
        friends: cleanData.friends || [],
        wallets: cleanData.wallets || [],
        settlements: cleanData.settlements || [],
        recurringRules: cleanData.recurringRules || [],
        settings: cleanData.settings || {},
        activeTrip: cleanData.activeTrip || null,
        tripHistory: cleanData.tripHistory || [],
        presetGroups: cleanData.presetGroups || [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 2. Also populate subcollections for granular query access
    const batch = writeBatch(firestoreDb);
    let opCount = 0;

    // Sync Wallets
    for (const wallet of (data.wallets || []).slice(0, 50)) {
      if (!wallet.id) continue;
      const wRef = doc(firestoreDb, 'users', userId, 'wallets', wallet.id);
      batch.set(
        wRef,
        {
          id: wallet.id,
          userId,
          name: wallet.name || 'Wallet',
          openingBalance: wallet.openingBalance ?? 0,
          currentBalance: wallet.currentBalance ?? 0,
          color: wallet.color || '#6366f1',
          icon: wallet.icon || 'wallet',
          minBalanceAlert: wallet.minBalanceAlert ?? 0,
          monthlySpendLimit: wallet.monthlySpendLimit ?? 0,
          isDefault: Boolean(wallet.isDefault),
          isHidden: Boolean(wallet.isHidden),
          rulesNotes: wallet.rulesNotes || '',
        },
        { merge: true }
      );
      opCount++;
    }

    // Sync Friends / Contacts
    for (const friend of (data.friends || []).slice(0, 100)) {
      if (!friend.id) continue;
      const fRef = doc(firestoreDb, 'users', userId, 'friends', friend.id);
      batch.set(
        fRef,
        {
          id: friend.id,
          userId,
          name: friend.name || 'Friend',
          notes: friend.notes || '',
          color: friend.color || '#6366f1',
          createdAt: friend.createdAt || Date.now(),
          type: friend.type || 'friend',
          category: friend.category || '',
          billingCycle: friend.billingCycle || '',
          defaultAmount: friend.defaultAmount ?? 0,
          website: friend.website || '',
        },
        { merge: true }
      );
      opCount++;
    }

    // Sync Expenses (recent 200)
    for (const expense of (data.expenses || []).slice(0, 200)) {
      if (!expense.id) continue;
      const eRef = doc(firestoreDb, 'users', userId, 'expenses', expense.id);
      batch.set(
        eRef,
        {
          id: expense.id,
          userId,
          description: expense.description || 'Expense',
          amount: expense.amount ?? 0,
          category: expense.category || 'General',
          date: expense.date || new Date().toISOString().slice(0, 10),
          type: expense.type || 'personal',
          flow: expense.flow || 'out',
          friendId: expense.friendId || null,
          vendorId: expense.vendorId || null,
          walletId: expense.walletId || '',
          status: expense.status || 'paid',
          settled: Boolean(expense.settled),
          settlementId: expense.settlementId || null,
          notes: expense.notes || '',
          createdAt: expense.createdAt || Date.now(),
        },
        { merge: true }
      );
      opCount++;
    }

    // Sync Settlements (recent 50)
    for (const settlement of (data.settlements || []).slice(0, 50)) {
      if (!settlement.id) continue;
      const sRef = doc(firestoreDb, 'users', userId, 'settlements', settlement.id);
      batch.set(
        sRef,
        {
          id: settlement.id,
          userId,
          friendId: settlement.friendId,
          amount: settlement.amount ?? 0,
          date: settlement.date || new Date().toISOString().slice(0, 10),
          note: settlement.note || '',
          walletId: settlement.walletId || '',
          createdAt: settlement.createdAt || Date.now(),
        },
        { merge: true }
      );
      opCount++;
    }

    // Sync Recurring Rules (recent 50)
    for (const rule of (data.recurringRules || []).slice(0, 50)) {
      if (!rule.id) continue;
      const rRef = doc(firestoreDb, 'users', userId, 'recurringRules', rule.id);
      batch.set(
        rRef,
        {
          id: rule.id,
          userId,
          title: rule.title || 'Rule',
          amount: rule.amount ?? 0,
          category: rule.category || 'General',
          walletId: rule.walletId || '',
          type: rule.type || 'personal',
          flow: rule.flow || 'out',
          frequency: rule.frequency || 'monthly',
          startDate: rule.startDate || new Date().toISOString().slice(0, 10),
          nextDueDate: rule.nextDueDate || new Date().toISOString().slice(0, 10),
        },
        { merge: true }
      );
      opCount++;
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserDataFromFirestore(userId: string): Promise<AppDB | null> {
  if (!userId) throw new Error('Cannot fetch without authenticated user ID');

  try {
    // 1. First attempt direct snapshot document load
    const ledgerRef = doc(firestoreDb, 'users', userId, 'data', 'ledger');
    let ledgerSnap = null;
    try {
      ledgerSnap = await getDoc(ledgerRef);
    } catch (docErr) {
      console.warn('Direct ledger document fetch error, falling back:', docErr);
    }

    if (ledgerSnap && ledgerSnap.exists()) {
      const d = ledgerSnap.data() as Partial<AppDB>;
      return {
        version: d.version || 3,
        expenses: Array.isArray(d.expenses) ? d.expenses : [],
        friends: Array.isArray(d.friends) ? d.friends : [],
        wallets: Array.isArray(d.wallets) && d.wallets.length > 0 ? d.wallets : [],
        settlements: Array.isArray(d.settlements) ? d.settlements : [],
        recurringRules: Array.isArray(d.recurringRules) ? d.recurringRules : [],
        settings: (d.settings || {}) as AppDB['settings'],
        activeTrip: d.activeTrip || null,
        tripHistory: Array.isArray(d.tripHistory) ? d.tripHistory : [],
        presetGroups: Array.isArray(d.presetGroups) ? d.presetGroups : [],
      };
    }

    // 2. Fallback to subcollections
    const expensesCol = collection(firestoreDb, 'users', userId, 'expenses');
    const friendsCol = collection(firestoreDb, 'users', userId, 'friends');
    const walletsCol = collection(firestoreDb, 'users', userId, 'wallets');
    const settlementsCol = collection(firestoreDb, 'users', userId, 'settlements');
    const recurringCol = collection(firestoreDb, 'users', userId, 'recurringRules');

    const [expSnap, friendSnap, walletSnap, settleSnap, recSnap] = await Promise.all([
      getDocs(expensesCol).catch(() => null),
      getDocs(friendsCol).catch(() => null),
      getDocs(walletsCol).catch(() => null),
      getDocs(settlementsCol).catch(() => null),
      getDocs(recurringCol).catch(() => null),
    ]);

    const expenses: Expense[] = expSnap ? expSnap.docs.map(d => d.data() as Expense) : [];
    const friends: Friend[] = friendSnap ? friendSnap.docs.map(d => d.data() as Friend) : [];
    const wallets: Wallet[] = walletSnap ? walletSnap.docs.map(d => d.data() as Wallet) : [];
    const settlements: Settlement[] = settleSnap ? settleSnap.docs.map(d => d.data() as Settlement) : [];
    const recurringRules: RecurringRule[] = recSnap ? recSnap.docs.map(d => d.data() as RecurringRule) : [];

    if (
      expenses.length === 0 &&
      friends.length === 0 &&
      wallets.length === 0 &&
      settlements.length === 0 &&
      recurringRules.length === 0
    ) {
      return null;
    }

    return {
      version: 3,
      expenses,
      friends,
      wallets,
      settlements,
      recurringRules,
      settings: {} as AppDB['settings'],
      activeTrip: null,
      tripHistory: [],
      presetGroups: [],
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
  }
}

// Single item sync helpers
export async function saveExpenseToFirestore(userId: string, expense: Expense): Promise<void> {
  const path = `users/${userId}/expenses/${expense.id}`;
  try {
    const eRef = doc(firestoreDb, `users/${userId}/expenses`, expense.id);
    await setDoc(eRef, { ...expense, userId }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteExpenseFromFirestore(userId: string, expenseId: string): Promise<void> {
  const path = `users/${userId}/expenses/${expenseId}`;
  try {
    const eRef = doc(firestoreDb, `users/${userId}/expenses`, expenseId);
    await deleteDoc(eRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveWalletToFirestore(userId: string, wallet: Wallet): Promise<void> {
  const path = `users/${userId}/wallets/${wallet.id}`;
  try {
    const wRef = doc(firestoreDb, `users/${userId}/wallets`, wallet.id);
    await setDoc(wRef, { ...wallet, userId }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteWalletFromFirestore(userId: string, walletId: string): Promise<void> {
  const path = `users/${userId}/wallets/${walletId}`;
  try {
    const wRef = doc(firestoreDb, `users/${userId}/wallets`, walletId);
    await deleteDoc(wRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveFriendToFirestore(userId: string, friend: Friend): Promise<void> {
  const path = `users/${userId}/friends/${friend.id}`;
  try {
    const fRef = doc(firestoreDb, `users/${userId}/friends`, friend.id);
    await setDoc(fRef, { ...friend, userId }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteFriendFromFirestore(userId: string, friendId: string): Promise<void> {
  const path = `users/${userId}/friends/${friendId}`;
  try {
    const fRef = doc(firestoreDb, `users/${userId}/friends`, friendId);
    await deleteDoc(fRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveSettlementToFirestore(userId: string, settlement: Settlement): Promise<void> {
  const path = `users/${userId}/settlements/${settlement.id}`;
  try {
    const sRef = doc(firestoreDb, `users/${userId}/settlements`, settlement.id);
    await setDoc(sRef, { ...settlement, userId }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteSettlementFromFirestore(userId: string, settlementId: string): Promise<void> {
  const path = `users/${userId}/settlements/${settlementId}`;
  try {
    const sRef = doc(firestoreDb, `users/${userId}/settlements`, settlementId);
    await deleteDoc(sRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
