import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile } from '../types';
import { sheetsSyncService } from '../services/sheetsSyncService';
import { useToast } from './ToastContext';
import { playerService } from '../services/playerService';

const ADMIN_EMAILS = ['wayongohlaurence@gmail.com', 'enermindb@gmail.com'];

export interface AuthErrorNotice {
  type: 'network' | 'popup-blocked' | 'offline' | 'unauthorized-domain' | 'other';
  message: string;
  actionHint?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSigningIn: boolean;
  popupBlocked: boolean;
  authNetworkError: boolean;
  authErrorNotice: AuthErrorNotice | null;
  clearPopupBlocked: () => void;
  clearAuthErrorNotice: () => void;
  isAdmin: boolean;
  loginWithGoogle: (isRetry?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: {
    displayName?: string;
    photoURL?: string;
    efootballUsername?: string;
    efootballAccountImageUrl?: string;
  }) => Promise<UserProfile>;
  updateWhatsApp: (rawPhone: string) => Promise<{
    cleanDigits: string;
    formatted: string;
    countryCode: string;
    updatedAt: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authErrorNotice, setAuthErrorNotice] = useState<AuthErrorNotice | null>(null);
  const isSigningInRef = useRef(false);
  const toast = useToast();

  // Backward compatibility alias
  const popupBlocked = authErrorNotice?.type === 'popup-blocked';
  const authNetworkError = authErrorNotice?.type === 'network' || authErrorNotice?.type === 'offline';

  // Sync user profile from Firestore or generate unique permanent CHUKA Player ID
  const syncUserProfile = async (firebaseUser: User): Promise<UserProfile> => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const counterRef = doc(db, 'settings', 'playerCounter');
    const isDefaultAdmin = ADMIN_EMAILS.includes(firebaseUser.email?.toLowerCase() || '');
    const nowIso = new Date().toISOString();

    let profile: UserProfile;

    try {
      // Concurrency-safe atomic transaction:
      // Combines check-user-exists, monotonic counter-increment, and document-creation in ONE atomic commit.
      profile = await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);

        if (userSnap.exists()) {
          // EXISTING USER:
          // Keep existing permanent CHUKA ID, update lastLoginAt and allowed profile fields
          const existing = userSnap.data() as UserProfile;
          const stablePlayerId = existing.playerId || existing.userId || 'CHUKA-000001';

          const updates: Record<string, any> = {
            lastLoginAt: nowIso,
            updatedAt: nowIso,
          };

          // Update photoURL if changed in Google Auth
          if (firebaseUser.photoURL && firebaseUser.photoURL !== existing.photoURL) {
            updates.photoURL = firebaseUser.photoURL;
            updates.photoUrl = firebaseUser.photoURL;
          }

          // Backfill required schema fields if missing
          if (!existing.userId) updates.userId = stablePlayerId;
          if (!existing.playerId) updates.playerId = stablePlayerId;
          if (!existing.firebaseUid) updates.firebaseUid = firebaseUser.uid;
          if (!existing.status) updates.status = 'ACTIVE';
          if (!existing.role) updates.role = isDefaultAdmin ? 'ADMIN' : 'PLAYER';
          if (!existing.createdAt) updates.createdAt = existing.registeredAt || nowIso;

          // Admin role confirmation
          if (isDefaultAdmin && (!existing.isAdmin || existing.role !== 'ADMIN')) {
            updates.isAdmin = true;
            updates.role = 'ADMIN';
          }

          transaction.set(userRef, updates, { merge: true });

          return {
            ...existing,
            ...updates,
            id: firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            userId: stablePlayerId,
            playerId: stablePlayerId,
          } as UserProfile;
        }

        // NEW USER:
        // Atomically increment counter and assign permanent, sequential CHUKA-XXXXXX ID
        const counterSnap = await transaction.get(counterRef);
        let nextCount = 1;
        if (counterSnap.exists()) {
          const rawCount = Number(counterSnap.data()?.count);
          nextCount = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount + 1 : 1;
        }

        transaction.set(
          counterRef,
          { count: nextCount, updatedAt: serverTimestamp() },
          { merge: true }
        );

        const paddedId = `CHUKA-${String(nextCount).padStart(6, '0')}`;

        const newProfile: UserProfile = {
          id: firebaseUser.uid,
          firebaseUid: firebaseUser.uid,
          userId: paddedId,
          playerId: paddedId,
          displayName: firebaseUser.displayName || `Player ${paddedId}`,
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || '',
          photoUrl: firebaseUser.photoURL || '',
          role: isDefaultAdmin ? 'ADMIN' : 'PLAYER',
          status: 'ACTIVE',
          createdAt: nowIso,
          registeredAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: nowIso,
          wins: 0,
          losses: 0,
          championships: 0,
          isAdmin: isDefaultAdmin,
          whatsappRequired: false,
          sheetsSyncStatus: 'PENDING',
        };

        transaction.set(userRef, newProfile);
        return newProfile;
      });

      // If designated admin, ensure admin registry is updated
      if (isDefaultAdmin) {
        try {
          await setDoc(
            doc(db, 'admins', firebaseUser.uid),
            {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              createdAt: nowIso,
            },
            { merge: true }
          );
        } catch (adminErr) {
          console.warn('[AuthContext] Admin registry update notice:', adminErr);
        }
      }

      // Synchronize to Google Sheets (non-blocking, graceful failure handling)
      try {
        const contactSnap = await getDoc(doc(db, 'users', firebaseUser.uid, 'private', 'contact'));
        if (contactSnap.exists()) {
          const cData = contactSnap.data();
          profile.whatsappNumber = cData.whatsappNumber || cData.whatsappPhone || '';
          profile.whatsappCountryCode = cData.whatsappCountryCode || '+254';
          profile.whatsappUpdatedAt = cData.whatsappUpdatedAt || '';
          profile.whatsappStatus = profile.whatsappNumber ? 'SET' : 'NOT_SET';
        }
      } catch (contactErr) {
        console.warn('[AuthContext] Private contact check notice:', contactErr);
      }

      // Requirement 12: If Apps Script or Google Sheets is unavailable:
      // - Firebase user creation must continue.
      // - Do not show "registration failed" if Firebase succeeded.
      // - Report synchronization failure.
      // - Allow a later synchronization retry.
      // - Never claim Sheets synchronization succeeded when it failed.
      try {
        const syncSuccess = await sheetsSyncService.syncUser(profile);
        if (syncSuccess) {
          await setDoc(
            userRef,
            {
              sheetsSyncStatus: 'SYNCED',
              sheetsSyncedAt: new Date().toISOString(),
              sheetsSyncError: null,
            },
            { merge: true }
          );
          profile.sheetsSyncStatus = 'SYNCED';
        } else {
          await setDoc(
            userRef,
            {
              sheetsSyncStatus: 'FAILED',
              sheetsSyncError: 'Sheets returned non-success response',
            },
            { merge: true }
          );
          profile.sheetsSyncStatus = 'FAILED';
        }
      } catch (sheetsErr: any) {
        console.warn('[AuthContext] Google Sheets sync offline / non-blocking notice:', sheetsErr?.message);
        try {
          await setDoc(
            userRef,
            {
              sheetsSyncStatus: 'FAILED',
              sheetsSyncError: sheetsErr?.message || 'Network error syncing with Google Sheets',
            },
            { merge: true }
          );
        } catch {}
        profile.sheetsSyncStatus = 'FAILED';
      }

      return profile;
    } catch (err: any) {
      console.warn('[AuthContext] Firestore user profile sync notice (falling back to provisional profile):', err?.message || err);
      // Construct fallback provisional profile from Google User data so player can use app
      const isDefaultAdmin = ADMIN_EMAILS.includes(firebaseUser.email?.toLowerCase() || '');
      const provisionalProfile: UserProfile = {
        id: firebaseUser.uid,
        userId: 'CHUKA-PLAYER',
        playerId: 'CHUKA-PLAYER',
        firebaseUid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Chuka Player',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || undefined,
        photoUrl: firebaseUser.photoURL || undefined,
        registeredAt: nowIso,
        wins: 0,
        losses: 0,
        championships: 0,
        isAdmin: isDefaultAdmin,
        role: isDefaultAdmin ? 'ADMIN' : 'PLAYER',
        status: 'ACTIVE',
      };
      return provisionalProfile;
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      const profile = await syncUserProfile(currentUser);
      setUserProfile(profile);
    }
  };

  const updateProfile = async (updates: {
    displayName?: string;
    photoURL?: string;
    efootballUsername?: string;
    efootballAccountImageUrl?: string;
  }): Promise<UserProfile> => {
    if (!currentUser) throw new Error('Not authenticated');
    const updated = await playerService.updateProfile(currentUser.uid, updates);
    setUserProfile((prev) => ({
      ...(prev || ({} as UserProfile)),
      ...updated,
    }));
    return updated;
  };

  const updateWhatsApp = async (rawPhone: string) => {
    if (!currentUser) throw new Error('Not authenticated');
    const result = await playerService.updateWhatsApp(currentUser.uid, rawPhone);
    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            whatsappNumber: result.cleanDigits,
            whatsappCountryCode: result.countryCode,
            whatsappUpdatedAt: result.updatedAt,
            whatsappStatus: 'SET',
          }
        : prev
    );
    return result;
  };

  useEffect(() => {
    // Process redirect result if returning from redirect sign-in
    getRedirectResult(auth)
      .then(async (cred) => {
        if (cred?.user) {
          const profile = await syncUserProfile(cred.user);
          setUserProfile(profile);
          toast.success('Welcome back!', `Signed in as ${cred.user.displayName || 'Player'}`);
        }
      })
      .catch((err) => {
        if (err?.code !== 'auth/null-user') {
          console.warn('[AuthContext] Redirect result check notice:', err?.message);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await syncUserProfile(user);
          setUserProfile(profile);
        } catch (error) {
          console.error('Failed to sync user profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for online status restoration
  useEffect(() => {
    const handleOnline = () => {
      if (authErrorNotice?.type === 'offline') {
        setAuthErrorNotice(null);
        toast.success('Back Online', 'Internet connection restored.');
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [authErrorNotice]);

  const clearPopupBlocked = () => {
    setAuthErrorNotice(null);
  };

  const clearAuthErrorNotice = () => {
    setAuthErrorNotice(null);
  };

  const loginWithGoogle = async (isRetry = false): Promise<void> => {
    // Prevent concurrent executions that trigger "auth/cancelled-popup-request"
    // and "INTERNAL ASSERTION FAILED: Pending promise was never set"
    if (isSigningInRef.current) {
      console.warn('[AuthContext] Sign-in already in progress; ignoring duplicate trigger.');
      return;
    }

    // Check offline status first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineNotice: AuthErrorNotice = {
        type: 'offline',
        message: 'You appear to be offline. Please check your internet connection and try again.',
      };
      setAuthErrorNotice(offlineNotice);
      toast.error('Offline', 'Please check your internet connection before signing in.');
      return;
    }

    isSigningInRef.current = true;
    setIsSigningIn(true);
    setLoading(true);
    setAuthErrorNotice(null);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred?.user) {
        const profile = await syncUserProfile(cred.user);
        setUserProfile(profile);
        setAuthErrorNotice(null);
        toast.success('Signed In Successfully', `Welcome, ${cred.user.displayName || 'Player'}!`);
      }
    } catch (error: any) {
      const errorCode = error?.code || '';
      const errorMessage = error?.message || '';

      if (
        errorCode === 'auth/cancelled-popup-request' ||
        errorMessage.includes('Pending promise was never set')
      ) {
        // Suppress expected internal collision when a popup request is superseded or cancelled
        console.warn('[AuthContext] Google sign-in popup request superseded or cancelled.');
      } else if (errorCode === 'auth/popup-closed-by-user') {
        // User voluntarily closed the window, no error alert needed
        console.info('[AuthContext] Google sign-in popup closed by user.');
      } else if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
        // Automatic quick retry if not already retried and client reports online
        if (!isRetry && typeof navigator !== 'undefined' && navigator.onLine) {
          console.warn('[AuthContext] Transient network glitch during Google Auth; retrying in 600ms...');
          isSigningInRef.current = false;
          setIsSigningIn(false);
          await new Promise((resolve) => setTimeout(resolve, 600));
          return loginWithGoogle(true);
        }

        console.warn('[AuthContext] Google sign-in network connection failed or blocked by sandbox/shields.');

        const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
        if (!isInIframe) {
          // If in top-level window, attempt redirect sign-in
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirErr) {
            console.warn('[AuthContext] Redirect sign-in fallback notice:', redirErr);
          }
        }

        const notice: AuthErrorNotice = {
          type: 'network',
          message: 'Connection to Google Authentication was blocked. Preview sandbox iframes, ad-blockers (e.g. uBlock, Brave Shields), or third-party cookie restrictions can block Google Auth requests.',
          actionHint: 'Open the app in a new tab to authenticate directly, or disable shields for this page.',
        };
        setAuthErrorNotice(notice);

        toast.error(
          'Sign-In Connection Blocked',
          'Google Auth was blocked by browser shields or preview iframe. Open in a new tab to sign in directly.'
        );
      } else if (errorCode === 'auth/popup-blocked') {
        console.warn('[AuthContext] Google sign-in popup blocked by browser or iframe sandbox.');

        const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
        if (!isInIframe) {
          // If in top-level window, attempt redirect sign-in
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirErr) {
            console.warn('[AuthContext] Redirect sign-in fallback notice:', redirErr);
          }
        }

        const notice: AuthErrorNotice = {
          type: 'popup-blocked',
          message: 'Google Sign-In popup was blocked by your browser or preview sandbox.',
          actionHint: 'Please allow popups for this site or open the app in a new tab.',
        };
        setAuthErrorNotice(notice);

        toast.error(
          'Sign-In Popup Blocked',
          'Your browser or preview sandbox blocked the Google popup. Please allow popups or open the app in a new tab.'
        );
      } else if (errorCode === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        console.warn('[AuthContext] Unauthorized domain in Firebase Auth:', domain);
        const notice: AuthErrorNotice = {
          type: 'unauthorized-domain',
          message: `The domain "${domain}" is not authorized in Firebase Authentication.`,
          actionHint: 'Add it to Firebase Console -> Authentication -> Settings -> Authorized Domains.',
        };
        setAuthErrorNotice(notice);
        toast.error('Unauthorized Domain', notice.message);
      } else {
        console.warn('[AuthContext] Sign-in notice:', error);
        toast.error('Sign-In Failed', errorMessage || 'Could not sign in with Google. Please try again.');
      }
    } finally {
      isSigningInRef.current = false;
      setIsSigningIn(false);
      setLoading(false);
    }
  };

  const logout = async () => {
    await fbSignOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
    setAuthErrorNotice(null);
  };

  const isAdmin = Boolean(
    userProfile?.isAdmin ||
    (currentUser?.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase()))
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isSigningIn,
        popupBlocked,
        authNetworkError,
        authErrorNotice,
        clearPopupBlocked,
        clearAuthErrorNotice,
        isAdmin,
        loginWithGoogle,
        logout,
        refreshProfile,
        updateProfile,
        updateWhatsApp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
