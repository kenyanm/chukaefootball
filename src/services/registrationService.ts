import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  increment,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, removeUndefined } from '../firebase/config';
import { PaymentRecord, TournamentEntry, UserProfile } from '../types';
import { auditService } from './auditService';
import { sheetsSyncService } from './sheetsSyncService';
import { TOURNAMENT_DEFAULTS } from '../config/tournamentConfig';

export interface VerificationMetrics {
  totalRegistrations: number;
  paymentsPending: number;
  paymentsVerified: number;
  paymentsRejected: number;
  duplicatesCount: number;
  duplicateCodes: string[];
  totalVerifiedPlayers: number;
}

export interface FinancialMetrics {
  totalRegistrations: number;
  totalVerifiedPlayers: number;
  entryFee: number;
  expectedRevenue: number;
  totalVerifiedRevenue: number;
  prizePoolAllocation: number;
  universityBalance: number;
}

export const registrationService = {
  // Register user for tournament and create PENDING payment (Requirements 2 & 3)
  async registerForTournament(
    tournamentId: string,
    tournamentName: string,
    amount: number,
    mpesaCode: string,
    mpesaPhone: string,
    userProfile: UserProfile
  ): Promise<{ entry: TournamentEntry; payment: PaymentRecord }> {
    try {
      const stablePlayerId = userProfile.userId || userProfile.playerId || 'CHUKA_PLAYER';
      const entryId = `${tournamentId}_${userProfile.id}`;
      const paymentId = `PAY_${Date.now()}_${stablePlayerId.replace('-', '_')}`;

      // Check if user is suspended
      const userRef = doc(db, 'users', userProfile.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().isSuspended) {
        throw new Error('Your account has been suspended by administration. Contact Chuka eFootball admins.');
      }

      // Check tournament status and locking
      const tournRef = doc(db, 'tournaments', tournamentId);
      const tournSnap = await getDoc(tournRef);
      if (!tournSnap.exists()) throw new Error('Tournament not found');
      const tournData = tournSnap.data();

      if (tournData.status !== 'REGISTRATION_OPEN') {
        throw new Error('Registration is only permitted when tournament status is REGISTRATION_OPEN.');
      }
      if (tournData.lockedAt) {
        throw new Error('Registration for this tournament is closed/locked.');
      }

      // Capacity check (tournament.maxPlayers)
      const maxCap = tournData.maxPlayers || TOURNAMENT_DEFAULTS.MAX_PLAYERS || 1024;
      if (tournData.registeredCount >= maxCap) {
        throw new Error(`This tournament has reached its maximum capacity of ${maxCap} players.`);
      }

      // Check if already registered (Prevent duplicate registration for the same tournament)
      const entryRef = doc(db, 'tournamentEntries', entryId);
      const existingEntry = await getDoc(entryRef);

      let isReSubmission = false;
      let existingPaymentId: string | undefined;

      if (existingEntry.exists()) {
        const existingData = existingEntry.data() as TournamentEntry;
        const status = existingData.status;
        const regStatus = existingData.registrationStatus;

        if (status === 'VERIFIED' || regStatus === 'VERIFIED') {
          throw new Error('You are already verified for this tournament.');
        }
        if (
          status === 'PENDING' ||
          status === 'PAYMENT_PENDING' ||
          regStatus === 'PAYMENT_PENDING' ||
          regStatus === 'PENDING'
        ) {
          throw new Error(
            'You have already submitted registration for this tournament. Awaiting admin verification on Verification Day.'
          );
        }
        if (
          status === 'PAYMENT_REJECTED' ||
          status === 'REJECTED' ||
          regStatus === 'PAYMENT_REJECTED' ||
          regStatus === 'REJECTED' ||
          status === 'PAYMENT_REQUIRED'
        ) {
          isReSubmission = true;
          existingPaymentId = existingData.paymentId;
        } else {
          throw new Error('You already have an existing entry for this tournament.');
        }
      }

      const formattedMpesa = mpesaCode.trim().toUpperCase();
      const formattedPhone = mpesaPhone.trim();

      if (!/^[A-Z0-9]{8,15}$/.test(formattedMpesa)) {
        throw new Error('Invalid M-Pesa code format. Enter a valid transaction reference code (e.g. QDH58291KL).');
      }

      const cleanPhone = formattedPhone.replace(/[\s\-\+]/g, '');
      if (!/^(?:254|0)?[17]\d{8}$/.test(cleanPhone)) {
        throw new Error('Invalid M-Pesa phone number format. Please enter a valid Kenyan phone number.');
      }

      // DUPLICATE PAYMENT DETECTION (Check both mpesaCode and mpesaTransactionCode)
      let isDuplicate = false;
      let duplicateOfId = '';
      try {
        const dupQuery1 = query(
          collection(db, 'payments'),
          where('mpesaTransactionCode', '==', formattedMpesa)
        );
        const dupSnap1 = await getDocs(dupQuery1);
        if (!dupSnap1.empty) {
          const nonSelf = dupSnap1.docs.find((d) => d.id !== existingPaymentId);
          if (nonSelf) {
            isDuplicate = true;
            duplicateOfId = nonSelf.id;
          }
        }
        if (!isDuplicate) {
          const dupQuery2 = query(
            collection(db, 'payments'),
            where('mpesaCode', '==', formattedMpesa)
          );
          const dupSnap2 = await getDocs(dupQuery2);
          if (!dupSnap2.empty) {
            const nonSelf = dupSnap2.docs.find((d) => d.id !== existingPaymentId);
            if (nonSelf) {
              isDuplicate = true;
              duplicateOfId = nonSelf.id;
            }
          }
        }
      } catch (dupErr) {
        console.warn('Duplicate payment check warning:', dupErr);
      }

      const finalPaymentId = existingPaymentId || paymentId;
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();

      const entry: TournamentEntry = {
        id: entryId,
        registrationId: entryId,
        tournamentId,
        userId: userProfile.id,
        playerId: userProfile.playerId,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || '',
        registeredAt: existingEntry.exists() ? existingEntry.data()?.registeredAt || nowIso : nowIso,
        status: 'PAYMENT_PENDING',
        registrationStatus: 'PAYMENT_PENDING',
        paymentStatus: 'PAYMENT_PENDING',
        paymentId: finalPaymentId,
        mpesaCode: formattedMpesa,
        mpesaTransactionCode: formattedMpesa,
        mpesaPhone: formattedPhone,
        duplicateFlag: isDuplicate,
        submittedAt: nowIso,
        createdAt: existingEntry.exists() ? existingEntry.data()?.createdAt || nowIso : nowIso,
        updatedAt: nowIso,
      };

      const payment: PaymentRecord = {
        id: finalPaymentId,
        paymentId: finalPaymentId,
        registrationId: entryId,
        tournamentId,
        tournamentName,
        userId: userProfile.id,
        playerId: userProfile.playerId,
        playerDisplayName: userProfile.displayName,
        amount: 20,
        currency: 'KES',
        paymentMethod: 'MPESA',
        mpesaCode: formattedMpesa,
        mpesaTransactionCode: formattedMpesa,
        mpesaPhone: formattedPhone,
        timestamp: nowIso,
        submittedAt: nowIso,
        status: 'PENDING',
        isSuspectedDuplicate: isDuplicate,
        duplicateFlag: isDuplicate,
        duplicateOfPaymentId: duplicateOfId || undefined,
        createdAt: isReSubmission && existingEntry.exists() ? existingEntry.data()?.createdAt || nowIso : nowIso,
        updatedAt: nowIso,
      };

      batch.set(entryRef, removeUndefined(entry), { merge: true });
      batch.set(doc(db, 'payments', finalPaymentId), removeUndefined(payment), { merge: true });

      // Increment registeredCount on tournament only if new registration
      if (!existingEntry.exists()) {
        batch.update(tournRef, {
          registeredCount: increment(1),
          updatedAt: nowIso,
        });
      }

      await batch.commit();

      // Audit logs
      await auditService.logAction(
        'PLAYER_REGISTERED',
        userProfile.id,
        userProfile.email,
        tournamentId,
        undefined,
        { playerId: userProfile.playerId, displayName: userProfile.displayName, isReSubmission }
      );

      await auditService.logAction(
        'PAYMENT_SUBMITTED',
        userProfile.id,
        userProfile.email,
        tournamentId,
        undefined,
        { paymentId: finalPaymentId, amount: 20, mpesaCode: formattedMpesa, isSuspectedDuplicate: isDuplicate, duplicateFlag: isDuplicate }
      );

      if (isDuplicate) {
        await auditService.logAction(
          'DUPLICATE_PAYMENT_DETECTED',
          userProfile.id,
          userProfile.email,
          tournamentId,
          undefined,
          { paymentId: finalPaymentId, mpesaCode: formattedMpesa, duplicateOfPaymentId: duplicateOfId }
        );
      }

      // Safe asynchronous sync to Google Sheets (failures are non-blocking)
      sheetsSyncService.syncRegistration(entry).catch((e) => console.warn('Sheets sync registration notice:', e));
      sheetsSyncService.syncPayment(payment).catch((e) => console.warn('Sheets sync payment notice:', e));

      return { entry, payment };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tournamentEntries');
    }
  },

  // Step 1 of Requirement 2: Start registration with status PAYMENT_REQUIRED / PENDING_PAYMENT
  async createDraftRegistration(
    tournamentId: string,
    userProfile: UserProfile
  ): Promise<TournamentEntry> {
    try {
      const entryId = `${tournamentId}_${userProfile.id}`;

      // Check if user is suspended
      const userRef = doc(db, 'users', userProfile.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().isSuspended) {
        throw new Error('Your account has been suspended by administration. Contact Chuka eFootball admins.');
      }

      // Check tournament status
      const tournRef = doc(db, 'tournaments', tournamentId);
      const tournSnap = await getDoc(tournRef);
      if (!tournSnap.exists()) throw new Error('Tournament not found');
      const tournData = tournSnap.data();

      if (tournData.lockedAt || tournData.status === 'LIVE' || tournData.status === 'COMPLETED' || tournData.status === 'CANCELLED') {
        throw new Error('Registration for this tournament is closed/locked.');
      }

      // Capacity check
      const maxCap = tournData.maxPlayers || TOURNAMENT_DEFAULTS.MAX_PLAYERS;
      if (maxCap && tournData.registeredCount >= maxCap) {
        throw new Error(`This tournament has reached its maximum capacity of ${maxCap} players.`);
      }

      const entryRef = doc(db, 'tournamentEntries', entryId);
      const existingEntry = await getDoc(entryRef);
      if (existingEntry.exists()) {
        return { id: existingEntry.id, ...existingEntry.data() } as TournamentEntry;
      }

      const batch = writeBatch(db);

      const entry: TournamentEntry = {
        id: entryId,
        tournamentId,
        userId: userProfile.id,
        playerId: userProfile.playerId,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || '',
        registeredAt: new Date().toISOString(),
        status: 'PAYMENT_REQUIRED',
        registrationStatus: 'PENDING_PAYMENT',
        paymentStatus: 'UNPAID',
      };

      batch.set(entryRef, entry);
      batch.update(tournRef, {
        registeredCount: increment(1),
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      return entry;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tournamentEntries');
    }
  },

  // Check if user is registered for a tournament
  async getUserEntry(tournamentId: string, userId: string): Promise<TournamentEntry | null> {
    try {
      const entryId = `${tournamentId}_${userId}`;
      const snap = await getDoc(doc(db, 'tournamentEntries', entryId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TournamentEntry;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `tournamentEntries/${tournamentId}_${userId}`);
    }
  },

  // Get all tournament entries for a user
  async getUserTournamentEntries(userId: string): Promise<TournamentEntry[]> {
    try {
      const q = query(
        collection(db, 'tournamentEntries'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TournamentEntry))
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'tournamentEntries');
    }
  },

  // PUBLIC: Verified Players List (Requirement 5 & Privacy Rule)
  // NEVER exposes payment info, emails, phone numbers, or Firebase UIDs.
  async getVerifiedPlayersPublic(tournamentId: string): Promise<TournamentEntry[]> {
    try {
      const q = query(
        collection(db, 'tournamentEntries'),
        where('tournamentId', '==', tournamentId),
        where('status', '==', 'VERIFIED')
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => {
          const data = d.data() as TournamentEntry;
          return {
            id: d.id,
            registrationId: d.id,
            tournamentId: data.tournamentId,
            playerId: data.playerId,
            displayName: data.displayName,
            photoURL: data.photoURL || '',
            registeredAt: data.registeredAt,
            status: 'VERIFIED' as const,
            registrationStatus: 'VERIFIED' as const,
            paymentStatus: 'VERIFIED' as const,
          };
        })
        .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `tournamentEntries/${tournamentId}`);
    }
  },

  // Public Registered Players for a specific tournament (safe data only)
  async getTournamentRegisteredPlayers(tournamentId: string): Promise<TournamentEntry[]> {
    try {
      const q = query(
        collection(db, 'tournamentEntries'),
        where('tournamentId', '==', tournamentId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as TournamentEntry;
        return {
          id: d.id,
          registrationId: d.id,
          tournamentId: data.tournamentId,
          playerId: data.playerId,
          displayName: data.displayName,
          photoURL: data.photoURL || '',
          registeredAt: data.registeredAt,
          status: data.status,
          registrationStatus: data.registrationStatus,
          paymentStatus: data.paymentStatus,
        };
      });
    } catch (error) {
      // If access to unverified entries is restricted (e.g. non-admin visitor), fall back to public verified roster
      try {
        const verified = await this.getVerifiedPlayersPublic(tournamentId);
        return verified || [];
      } catch {
        handleFirestoreError(error, OperationType.LIST, 'tournamentEntries');
      }
    }
  },

  // Admin: Get all payments for a tournament
  async getAllPayments(tournamentId?: string): Promise<PaymentRecord[]> {
    try {
      const snap = await getDocs(collection(db, 'payments'));
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
      if (tournamentId) {
        list = list.filter((p) => p.tournamentId === tournamentId);
      }
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    }
  },

  // Admin: Get Verification Day metrics (Requirement 4)
  async getVerificationMetrics(tournamentId: string): Promise<VerificationMetrics> {
    try {
      const [entriesSnap, paymentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'tournamentEntries'), where('tournamentId', '==', tournamentId))),
        getDocs(query(collection(db, 'payments'), where('tournamentId', '==', tournamentId))),
      ]);

      const entries = entriesSnap.docs.map((d) => d.data() as TournamentEntry);
      const payments = paymentsSnap.docs.map((d) => d.data() as PaymentRecord);

      let paymentsPending = 0;
      let paymentsVerified = 0;
      let paymentsRejected = 0;
      const seenCodes = new Map<string, number>();

      payments.forEach((p) => {
        if (p.status === 'PENDING') paymentsPending++;
        else if (p.status === 'VERIFIED') paymentsVerified++;
        else if (p.status === 'REJECTED') paymentsRejected++;

        const code = (p.mpesaTransactionCode || p.mpesaCode)?.trim().toUpperCase();
        if (code) {
          seenCodes.set(code, (seenCodes.get(code) || 0) + 1);
        }
      });

      const duplicateCodes: string[] = [];
      seenCodes.forEach((count, code) => {
        if (count > 1) duplicateCodes.push(code);
      });

      const totalVerifiedPlayers = entries.filter((e) => e.status === 'VERIFIED').length;

      return {
        totalRegistrations: entries.length,
        paymentsPending,
        paymentsVerified,
        paymentsRejected,
        duplicatesCount: duplicateCodes.length,
        duplicateCodes,
        totalVerifiedPlayers,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `verificationMetrics/${tournamentId}`);
    }
  },

  // Admin: Verify payment and approve tournament entry (Requirement 4)
  async verifyPayment(paymentId: string, adminUid: string, adminEmail?: string): Promise<void> {
    try {
      // Sole authorized admin check
      if (adminEmail && !['wayongohlaurence@gmail.com', 'enermindb@gmail.com'].includes(adminEmail.toLowerCase())) {
        throw new Error('Unauthorized: Only authorized administrators can verify payments.');
      }

      const paymentRef = doc(db, 'payments', paymentId);
      const paymentSnap = await getDoc(paymentRef);
      if (!paymentSnap.exists()) throw new Error('Payment record not found');
      const payment = paymentSnap.data() as PaymentRecord;

      const tournRef = doc(db, 'tournaments', payment.tournamentId);
      const tournSnap = await getDoc(tournRef);
      if (tournSnap.exists()) {
        const tournData = tournSnap.data();
        const maxCap = tournData.maxPlayers || TOURNAMENT_DEFAULTS.MAX_PLAYERS || 1024;
        if ((tournData.verifiedCount || 0) >= maxCap) {
          throw new Error(`Capacity reached: Tournament already has maximum verified players (${maxCap}).`);
        }
      }

      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const verifiedBy = adminEmail || adminUid;

      // Update payment
      batch.update(paymentRef, {
        status: 'VERIFIED',
        verifiedAt: nowIso,
        verifiedBy,
        reviewedBy: verifiedBy,
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });

      // Update tournament entry to VERIFIED
      const entryId = payment.registrationId || `${payment.tournamentId}_${payment.userId}`;
      const entryRef = doc(db, 'tournamentEntries', entryId);
      batch.update(entryRef, {
        status: 'VERIFIED',
        registrationStatus: 'VERIFIED',
        paymentStatus: 'VERIFIED',
        verifiedAt: nowIso,
        verifiedBy,
        updatedAt: nowIso,
      });

      // Increment verifiedCount on tournament
      batch.update(tournRef, {
        verifiedCount: increment(1),
        updatedAt: nowIso,
      });

      await batch.commit();

      // Audit Log
      await auditService.logAction(
        'PAYMENT_VERIFIED',
        adminUid,
        adminEmail,
        payment.tournamentId,
        undefined,
        { paymentId, playerId: payment.playerId, mpesaCode: payment.mpesaTransactionCode || payment.mpesaCode }
      );

      // Asynchronous safe sync to Google Sheets
      sheetsSyncService.syncRegistration({
        id: entryId,
        registrationId: entryId,
        tournamentId: payment.tournamentId,
        playerId: payment.playerId,
        displayName: payment.playerDisplayName,
        status: 'VERIFIED',
        verifiedAt: nowIso,
      }).catch((e) => console.warn('Sheets sync reg error:', e));

      sheetsSyncService.syncPayment({
        id: paymentId,
        paymentId: paymentId,
        tournamentId: payment.tournamentId,
        playerId: payment.playerId,
        playerName: payment.playerDisplayName,
        mpesaCode: payment.mpesaTransactionCode || payment.mpesaCode,
        amount: payment.amount || 20,
        status: 'VERIFIED',
        reviewedBy: verifiedBy,
      }).catch((e) => console.warn('Sheets sync payment error:', e));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `payments/${paymentId}`);
    }
  },

  // Admin: Reject payment (Requirement 4)
  async rejectPayment(
    paymentId: string,
    adminUid: string,
    adminEmail?: string,
    reason = 'Invalid transaction code'
  ): Promise<void> {
    try {
      if (adminEmail && !['wayongohlaurence@gmail.com', 'enermindb@gmail.com'].includes(adminEmail.toLowerCase())) {
        throw new Error('Unauthorized: Only authorized administrators can reject payments.');
      }

      const paymentRef = doc(db, 'payments', paymentId);
      const paymentSnap = await getDoc(paymentRef);
      if (!paymentSnap.exists()) throw new Error('Payment record not found');
      const payment = paymentSnap.data() as PaymentRecord;

      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const rejectedBy = adminEmail || adminUid;

      batch.update(paymentRef, {
        status: 'REJECTED',
        reviewedBy: rejectedBy,
        reviewedAt: nowIso,
        rejectedAt: nowIso,
        rejectedBy,
        rejectionReason: reason,
        updatedAt: nowIso,
      });

      const entryId = payment.registrationId || `${payment.tournamentId}_${payment.userId}`;
      const entryRef = doc(db, 'tournamentEntries', entryId);
      batch.update(entryRef, {
        status: 'PAYMENT_REJECTED',
        registrationStatus: 'PAYMENT_REJECTED',
        paymentStatus: 'REJECTED',
        rejectedAt: nowIso,
        rejectedBy,
        rejectionReason: reason,
        updatedAt: nowIso,
      });

      await batch.commit();

      await auditService.logAction(
        'PAYMENT_REJECTED',
        adminUid,
        adminEmail,
        payment.tournamentId,
        undefined,
        { paymentId, playerId: payment.playerId, reason }
      );

      // Safe sync to Google Sheets
      sheetsSyncService.syncRegistration({
        id: entryId,
        registrationId: entryId,
        tournamentId: payment.tournamentId,
        playerId: payment.playerId,
        displayName: payment.playerDisplayName,
        status: 'PAYMENT_REJECTED',
      }).catch((e) => console.warn('Sheets sync reg error:', e));

      sheetsSyncService.syncPayment({
        id: paymentId,
        paymentId: paymentId,
        tournamentId: payment.tournamentId,
        playerId: payment.playerId,
        playerName: payment.playerDisplayName,
        status: 'REJECTED',
        reviewedBy: rejectedBy,
      }).catch((e) => console.warn('Sheets sync payment error:', e));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `payments/${paymentId}`);
    }
  },

  // Admin: Suspend player (Requirement 4)
  async suspendPlayer(
    userId: string,
    adminUid: string,
    adminEmail?: string,
    reason = 'Rule violation or fraudulent transaction'
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isSuspended: true,
      });

      await auditService.logAction(
        'PLAYER_SUSPENDED',
        adminUid,
        adminEmail,
        undefined,
        undefined,
        { suspendedUserId: userId, reason }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  },

  // Admin: Remove invalid registration (Requirement 4)
  async removeInvalidRegistration(
    entryId: string,
    adminUid: string,
    adminEmail?: string,
    reason?: string
  ): Promise<void> {
    try {
      const entryRef = doc(db, 'tournamentEntries', entryId);
      const snap = await getDoc(entryRef);
      if (!snap.exists()) return;
      const entry = snap.data() as TournamentEntry;

      const batch = writeBatch(db);
      batch.delete(entryRef);

      const tournRef = doc(db, 'tournaments', entry.tournamentId);
      batch.update(tournRef, {
        registeredCount: increment(-1),
        ...(entry.status === 'VERIFIED' ? { verifiedCount: increment(-1) } : {}),
      });

      if (entry.paymentId) {
        batch.delete(doc(db, 'payments', entry.paymentId));
      }

      await batch.commit();

      await auditService.logAction(
        'REGISTRATION_REMOVED',
        adminUid,
        adminEmail,
        entry.tournamentId,
        undefined,
        { entryId, playerId: entry.playerId, reason }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tournamentEntries/${entryId}`);
    }
  },

  // Admin: Lock Registration & Remove All Unpaid / Unverified Registrations (Requirement 4)
  async lockRegistrationAndPruneUnverified(
    tournamentId: string,
    adminUid: string,
    adminEmail?: string
  ): Promise<{ verifiedCount: number; prunedCount: number }> {
    try {
      const tournRef = doc(db, 'tournaments', tournamentId);
      const tournSnap = await getDoc(tournRef);
      if (!tournSnap.exists()) throw new Error('Tournament not found.');

      const entriesQuery = query(
        collection(db, 'tournamentEntries'),
        where('tournamentId', '==', tournamentId)
      );
      const entriesSnap = await getDocs(entriesQuery);

      const batch = writeBatch(db);
      let verifiedCount = 0;
      let prunedCount = 0;

      entriesSnap.docs.forEach((d) => {
        const entry = d.data() as TournamentEntry;
        if (entry.status === 'VERIFIED') {
          verifiedCount++;
        } else {
          // Remove unverified/unpaid registration
          batch.delete(d.ref);
          if (entry.paymentId) {
            batch.delete(doc(db, 'payments', entry.paymentId));
          }
          prunedCount++;
        }
      });

      // Update tournament to locked state with confirmed counts
      batch.update(tournRef, {
        status: 'VERIFICATION',
        lockedAt: new Date().toISOString(),
        lockedBy: adminUid,
        registeredCount: verifiedCount,
        verifiedCount: verifiedCount,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await auditService.logAction(
        'REGISTRATION_LOCKED',
        adminUid,
        adminEmail,
        tournamentId,
        undefined,
        {
          verifiedPlayerPool: verifiedCount,
          unverifiedEntriesRemoved: prunedCount,
          lockedAt: new Date().toISOString(),
        }
      );

      return { verifiedCount, prunedCount };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}`);
    }
  },

  // Admin: Manually flag a payment as suspected duplicate
  async flagDuplicatePayment(
    paymentId: string,
    adminUid: string,
    adminEmail?: string
  ): Promise<void> {
    try {
      const paymentRef = doc(db, 'payments', paymentId);
      await updateDoc(paymentRef, {
        isSuspectedDuplicate: true,
        flaggedByAdmin: true,
        reviewedBy: adminUid,
        reviewedAt: new Date().toISOString(),
      });

      await auditService.logAction(
        'DUPLICATE_PAYMENT_DETECTED',
        adminUid,
        adminEmail,
        undefined,
        undefined,
        { paymentId, manualFlag: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
    }
  },

  // Admin: Calculate real financial metrics for a tournament (PART AB & Y)
  async getFinancialMetrics(tournamentId: string): Promise<FinancialMetrics> {
    try {
      const [tournSnap, entriesSnap, paymentsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId)),
        getDocs(query(collection(db, 'tournamentEntries'), where('tournamentId', '==', tournamentId))),
        getDocs(query(collection(db, 'payments'), where('tournamentId', '==', tournamentId))),
      ]);

      const tourn = tournSnap.exists() ? tournSnap.data() : null;
      const entryFee = tourn?.entryFee ?? TOURNAMENT_DEFAULTS.ENTRY_FEE;
      const entries = entriesSnap.docs.map((d) => d.data() as TournamentEntry);
      const payments = paymentsSnap.docs.map((d) => d.data() as PaymentRecord);

      const verifiedEntries = entries.filter((e) => e.status === 'VERIFIED');
      const verifiedPayments = payments.filter((p) => p.status === 'VERIFIED');

      const totalRegistrations = entries.length;
      const totalVerifiedPlayers = verifiedEntries.length;
      const expectedRevenue = totalVerifiedPlayers * entryFee;

      const totalVerifiedRevenue = verifiedPayments.reduce(
        (sum, p) => sum + (p.amount || entryFee),
        0
      );

      const prizePoolAllocation = TOURNAMENT_DEFAULTS.CHAMPION_PRIZE; // KSh 1,000
      const universityBalance = totalVerifiedRevenue - prizePoolAllocation;

      return {
        totalRegistrations,
        totalVerifiedPlayers,
        entryFee,
        expectedRevenue,
        totalVerifiedRevenue,
        prizePoolAllocation,
        universityBalance,
      };
    } catch (error) {
      console.warn('Error fetching financial metrics:', error);
      return {
        totalRegistrations: 0,
        totalVerifiedPlayers: 0,
        entryFee: TOURNAMENT_DEFAULTS.ENTRY_FEE,
        expectedRevenue: 0,
        totalVerifiedRevenue: 0,
        prizePoolAllocation: TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
        universityBalance: -TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
      };
    }
  },

  // Helper aliases for Tournament Command Center
  async getTournamentEntries(tournamentId: string): Promise<TournamentEntry[]> {
    const list = await this.getTournamentRegisteredPlayers(tournamentId);
    return list || [];
  },

  async getTournamentPayments(tournamentId: string): Promise<PaymentRecord[]> {
    const list = await this.getAllPayments(tournamentId);
    return list || [];
  },
};
