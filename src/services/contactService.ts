import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface PlayerPrivateContact {
  whatsappPhone?: string;
  whatsappPhoneFormatted?: string;
  updatedAt?: string;
}

export interface KenyanPhoneValidationResult {
  valid: boolean;
  formatted: string;
  cleanDigits: string;
  error?: string;
}

/**
 * Validates and formats a Kenyan mobile phone number for WhatsApp.
 * Supports:
 * - 0712345678 -> 254712345678
 * - 0112345678 -> 254112345678
 * - +254712345678 -> 254712345678
 * - 254712345678 -> 254712345678
 */
export function validateKenyanPhone(rawPhone: string): KenyanPhoneValidationResult {
  if (!rawPhone || !rawPhone.trim()) {
    return {
      valid: false,
      formatted: '',
      cleanDigits: '',
      error: 'WhatsApp phone number is required.',
    };
  }

  // Remove spaces, dashes, parentheses, plus signs
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\+]/g, '');

  // Convert leading 0 to 254 if 10 digits
  if (/^0[17]\d{8}$/.test(cleaned)) {
    cleaned = '254' + cleaned.substring(1);
  } else if (/^[17]\d{8}$/.test(cleaned)) {
    cleaned = '254' + cleaned;
  }

  // Check valid Kenyan mobile prefix: 2547xx or 2541xx (12 digits total)
  if (!/^254[17]\d{8}$/.test(cleaned)) {
    return {
      valid: false,
      formatted: rawPhone,
      cleanDigits: cleaned,
      error: 'Please enter a valid Kenyan mobile number starting with 07 or 01 (e.g. 0712345678).',
    };
  }

  const formatted = `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;

  return {
    valid: true,
    formatted,
    cleanDigits: cleaned,
  };
}

/**
 * Generates an official WhatsApp click-to-chat URL:
 * https://wa.me/254XXXXXXXXX?text=...
 */
export function getWhatsAppClickToChatUrl(cleanDigits: string, text: string): string {
  const encoded = encodeURIComponent(text.trim());
  return `https://wa.me/${cleanDigits}?text=${encoded}`;
}

export const contactService = {
  /**
   * Retrieves player's private contact information.
   * Path: users/{userId}/private/contact
   * Strictly isolated by Firestore security rules (only owner or admin can read).
   */
  async getPrivateContact(userId: string): Promise<PlayerPrivateContact | null> {
    try {
      const contactRef = doc(db, 'users', userId, 'private', 'contact');
      const snap = await getDoc(contactRef);
      if (snap.exists()) {
        return snap.data() as PlayerPrivateContact;
      }
      return null;
    } catch (e) {
      console.warn('Could not read private contact info (or not set yet):', e);
      return null;
    }
  },

  /**
   * Saves or updates player's private contact information.
   * Path: users/{userId}/private/contact
   */
  async savePrivateContact(userId: string, rawPhone: string): Promise<KenyanPhoneValidationResult> {
    const validation = validateKenyanPhone(rawPhone);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid phone number');
    }

    const contactRef = doc(db, 'users', userId, 'private', 'contact');
    await setDoc(
      contactRef,
      {
        whatsappPhone: validation.cleanDigits,
        whatsappPhoneFormatted: validation.formatted,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return validation;
  },

  /**
   * Syncs player's verified WhatsApp contact into the private Match Room document
   * so ONLY the assigned opponent and tournament administrators can access it.
   */
  async syncMatchRoomWhatsApp(
    matchId: string,
    isHome: boolean,
    cleanDigits: string
  ): Promise<void> {
    const roomRef = doc(db, 'matchRooms', matchId);
    const snap = await getDoc(roomRef);

    const updatePayload = isHome
      ? { homeWhatsApp: cleanDigits, updatedAt: new Date().toISOString() }
      : { awayWhatsApp: cleanDigits, updatedAt: new Date().toISOString() };

    if (snap.exists()) {
      await updateDoc(roomRef, updatePayload);
    } else {
      // If room not yet initialized, write with merge
      await setDoc(roomRef, updatePayload, { merge: true });
    }
  },
};
