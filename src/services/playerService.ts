import { collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile } from '../types';
import { sheetsSyncService } from './sheetsSyncService';
import { validateKenyanPhone, contactService } from './contactService';
import { normalizeEfootballUsername } from '../utils/usernameUtils';
import { gamificationService } from './gamificationService';

/**
 * Sanitizes eFootball username:
 * - Trims leading/trailing whitespace
 * - Strips HTML tags and script elements
 * - Retains alphanumeric characters, spaces, dots, dashes, underscores, and hashes
 * - Collapses consecutive spaces
 * - Caps length at 30 characters
 */
export function sanitizeEfootballUsername(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim().replace(/<[^>]*>?/gm, '');
  cleaned = cleaned.replace(/[^\w\s\.\-_#]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.slice(0, 30);
}

export const playerService = {
  // Public player directory
  async getAllPlayers(): Promise<UserProfile[]> {
    try {
      const q = query(collection(db, 'users'), orderBy('wins', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as UserProfile;
        return {
          id: d.id,
          playerId: data.playerId || data.userId || '',
          displayName: data.displayName,
          email: '', // Stored private, do not expose in public lists
          photoURL: data.photoURL,
          efootballUsername: data.efootballUsername || '',
          efootballAccountImageUrl: data.efootballAccountImageUrl || '',
          registeredAt: data.registeredAt,
          wins: data.wins || 0,
          losses: data.losses || 0,
          championships: data.championships || 0,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  },

  // Lookup player by CHUKA Player ID
  async getPlayerByPlayerId(playerId: string): Promise<UserProfile | null> {
    try {
      const q = query(collection(db, 'users'), where('playerId', '==', playerId.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      const data = d.data() as UserProfile;
      return {
        id: d.id,
        playerId: data.playerId || data.userId || '',
        displayName: data.displayName,
        email: '', // Never expose email
        photoURL: data.photoURL,
        efootballUsername: data.efootballUsername || '',
        efootballAccountImageUrl: data.efootballAccountImageUrl || '',
        registeredAt: data.registeredAt,
        wins: data.wins || 0,
        losses: data.losses || 0,
        championships: data.championships || 0,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  },

  // Hall of Fame / Recent Champions
  async getChampions(): Promise<UserProfile[]> {
    try {
      const q = query(
        collection(db, 'users'),
        where('championships', '>', 0),
        orderBy('championships', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as UserProfile;
        return {
          id: d.id,
          playerId: data.playerId || data.userId || '',
          displayName: data.displayName,
          email: '',
          photoURL: data.photoURL,
          efootballUsername: data.efootballUsername || '',
          efootballAccountImageUrl: data.efootballAccountImageUrl || '',
          registeredAt: data.registeredAt,
          wins: data.wins || 0,
          losses: data.losses || 0,
          championships: data.championships || 0,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  },

  // Allowed profile updates:
  // Users may update displayName, photoURL, efootballUsername, efootballAccountImageUrl.
  // Must NEVER be able to modify: userId, playerId, firebaseUid, role, admin status, status, createdAt.
  // Cannot edit another player's profile unless authorized admin.
  async updateProfile(
    uid: string,
    updates: {
      displayName?: string;
      photoURL?: string;
      efootballUsername?: string;
      efootballAccountImageUrl?: string;
    }
  ): Promise<UserProfile> {
    const currentUid = auth.currentUser?.uid;
    const currentUserEmail = auth.currentUser?.email?.toLowerCase();
    const isAdmin = currentUserEmail === 'wayongohlaurence@gmail.com' || currentUserEmail === 'enermindb@gmail.com';

    if (!currentUid) {
      throw new Error('UNAUTHORIZED: You must be signed in to update a profile.');
    }
    if (currentUid !== uid && !isAdmin) {
      throw new Error("PERMISSION_DENIED: You cannot edit another player's profile.");
    }

    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      throw new Error('User record not found in Firebase.');
    }

    const current = snap.data() as UserProfile;
    const cleanUpdates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
      cleanUpdates.displayName = updates.displayName.trim();
    }
    if (typeof updates.photoURL === 'string' && updates.photoURL.trim()) {
      cleanUpdates.photoURL = updates.photoURL.trim();
      cleanUpdates.photoUrl = updates.photoURL.trim();
    }
    if (typeof updates.efootballUsername === 'string') {
      const sanitized = sanitizeEfootballUsername(updates.efootballUsername);
      cleanUpdates.efootballUsername = sanitized;
      const normalized = normalizeEfootballUsername(sanitized);
      cleanUpdates.efootballUsernameNormalized = normalized;

      if (normalized && !isAdmin) {
        const isTaken = await gamificationService.isUsernameTaken(normalized, uid);
        if (isTaken) {
          throw new Error(
            `DUPLICATE_USERNAME: The eFootball username "${sanitized}" is already claimed by another player. Please choose a distinct username or contact an administrator.`
          );
        }
      }
    }
    if (typeof updates.efootballAccountImageUrl === 'string') {
      cleanUpdates.efootballAccountImageUrl = updates.efootballAccountImageUrl.trim();
    }

    // Step 1: Update Firestore first (Authoritative database)
    await setDoc(userRef, cleanUpdates, { merge: true });

    const updatedProfile: UserProfile = {
      ...current,
      ...cleanUpdates,
      id: uid,
      firebaseUid: uid,
      userId: current.userId || current.playerId,
      playerId: current.playerId || current.userId || '',
    };

    // Step 2: Attempt Google Sheets synchronization (non-sensitive fields)
    try {
      const syncSuccess = await sheetsSyncService.syncUser(updatedProfile);
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
        updatedProfile.sheetsSyncStatus = 'SYNCED';
      } else {
        await setDoc(
          userRef,
          {
            sheetsSyncStatus: 'FAILED',
            sheetsSyncError: 'Sheets returned unsuccessful status on profile update',
          },
          { merge: true }
        );
        updatedProfile.sheetsSyncStatus = 'FAILED';
      }
    } catch (err: any) {
      console.warn('[playerService] Sheets sync failed on profile update (offline/non-blocking):', err.message);
      try {
        await setDoc(
          userRef,
          {
            sheetsSyncStatus: 'FAILED',
            sheetsSyncError: err.message || 'Sheets offline during profile update',
          },
          { merge: true }
        );
      } catch {}
      updatedProfile.sheetsSyncStatus = 'FAILED';
    }

    return updatedProfile;
  },

  /**
   * Save and normalize player WhatsApp contact:
   * - Validates Kenyan mobile format (07/01/254/+254)
   * - Normalizes to 254XXXXXXXXX
   * - Strictly stores raw phone in users/{userId}/private/contact (PII isolation)
   * - Updates user profile with country code (+254), whatsappUpdatedAt, and whatsappStatus ('SET')
   * - Never exposes raw phone in public rosters or Google Sheets
   */
  async updateWhatsApp(
    uid: string,
    rawPhone: string
  ): Promise<{ cleanDigits: string; formatted: string; countryCode: string; updatedAt: string }> {
    const currentUid = auth.currentUser?.uid;
    const currentUserEmail = auth.currentUser?.email?.toLowerCase();
    const isAdmin = currentUserEmail === 'wayongohlaurence@gmail.com' || currentUserEmail === 'enermindb@gmail.com';

    if (!currentUid) {
      throw new Error('UNAUTHORIZED: You must be signed in to save your WhatsApp number.');
    }
    if (currentUid !== uid && !isAdmin) {
      throw new Error("PERMISSION_DENIED: You cannot edit another player's WhatsApp contact.");
    }

    const validation = validateKenyanPhone(rawPhone);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please provide a valid Kenyan phone number.');
    }

    const nowIso = new Date().toISOString();

    // 1. Save to isolated private subdocument
    const privateRef = doc(db, 'users', uid, 'private', 'contact');
    await setDoc(
      privateRef,
      {
        userId: uid,
        whatsappNumber: validation.cleanDigits,
        whatsappPhone: validation.cleanDigits,
        whatsappPhoneFormatted: validation.formatted,
        whatsappCountryCode: '+254',
        whatsappUpdatedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 2. Update user profile with non-sensitive status & timestamp
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        whatsappCountryCode: '+254',
        whatsappUpdatedAt: nowIso,
        whatsappStatus: 'SET',
        whatsappRequired: false,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 3. Attempt to sync non-sensitive profile state to Google Sheets
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const fullProf = snap.data() as UserProfile;
        await sheetsSyncService.syncUser(fullProf);
      }
    } catch (e) {
      console.warn('[playerService] Sheets sync skipped on WhatsApp update notice:', e);
    }

    return {
      cleanDigits: validation.cleanDigits,
      formatted: validation.formatted,
      countryCode: '+254',
      updatedAt: nowIso,
    };
  },

  /**
   * Retrieves private contact for authorized owner or admin
   */
  async getPrivateContact(uid: string) {
    return contactService.getPrivateContact(uid);
  },

  // Admin User Directory with synchronization state
  async getAllUsersAdmin(): Promise<UserProfile[]> {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => {
        const data = d.data() as UserProfile;
        const stableId = data.userId || data.playerId || 'CHUKA-UNKNOWN';
        return {
          id: d.id,
          firebaseUid: data.firebaseUid || d.id,
          userId: stableId,
          playerId: stableId,
          displayName: data.displayName || `Player ${stableId}`,
          email: data.email || '',
          photoURL: data.photoURL || '',
          photoUrl: data.photoUrl || data.photoURL || '',
          role: data.role || (data.isAdmin ? 'ADMIN' : 'PLAYER'),
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || data.registeredAt || '',
          registeredAt: data.registeredAt || data.createdAt || '',
          updatedAt: data.updatedAt || '',
          lastLoginAt: data.lastLoginAt || '',
          wins: data.wins || 0,
          losses: data.losses || 0,
          championships: data.championships || 0,
          isAdmin: Boolean(data.isAdmin),
          sheetsSyncStatus: data.sheetsSyncStatus || 'PENDING',
          sheetsSyncedAt: data.sheetsSyncedAt,
          sheetsSyncError: data.sheetsSyncError,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
  },

  // Manual re-synchronization of a user to Google Sheets
  async reSyncUserToSheets(uid: string): Promise<{ success: boolean; error?: string }> {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return { success: false, error: 'User does not exist in Firebase.' };
    }
    const data = snap.data() as UserProfile;
    const permanentUserId = data.userId || data.playerId;
    if (!permanentUserId) {
      return { success: false, error: 'User does not have an assigned permanent CHUKA ID.' };
    }

    try {
      const ok = await sheetsSyncService.syncUser(data);
      if (ok) {
        await setDoc(
          userRef,
          {
            sheetsSyncStatus: 'SYNCED',
            sheetsSyncedAt: new Date().toISOString(),
            sheetsSyncError: null,
          },
          { merge: true }
        );
        return { success: true };
      } else {
        await setDoc(
          userRef,
          {
            sheetsSyncStatus: 'FAILED',
            sheetsSyncError: 'Apps Script returned failure',
          },
          { merge: true }
        );
        return { success: false, error: 'Apps Script returned failure' };
      }
    } catch (err: any) {
      const msg = err.message || 'Network error syncing user to Google Sheets';
      await setDoc(
        userRef,
        {
          sheetsSyncStatus: 'FAILED',
          sheetsSyncError: msg,
        },
        { merge: true }
      );
      return { success: false, error: msg };
    }
  },
};
