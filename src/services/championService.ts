import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, removeUndefined } from '../firebase/config';
import { ChampionRecord, PrizeRecord, PrizeStatus, Tournament } from '../types';
import { auditService } from './auditService';
import { TOURNAMENT_DEFAULTS } from '../config/tournamentConfig';

export const championService = {
  /**
   * Get all historical champions
   */
  async getAllChampions(): Promise<ChampionRecord[]> {
    try {
      const q = query(collection(db, 'champions'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChampionRecord));
      return list.sort((a, b) => b.weekNumber - a.weekNumber);
    } catch (error) {
      console.warn('Could not fetch champions collection:', error);
      return [];
    }
  },

  /**
   * Get champion by tournament ID
   */
  async getChampionByTournament(tournamentId: string): Promise<ChampionRecord | null> {
    try {
      const snap = await getDoc(doc(db, 'champions', `CHAMP_${tournamentId}`));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ChampionRecord;
    } catch (error) {
      console.warn('Error fetching champion for tournament:', tournamentId, error);
      return null;
    }
  },

  /**
   * Automatically create official Champion and Prize records when Final match is confirmed
   * (PART S & PART T)
   */
  async createChampionAndPrizeRecord(params: {
    tournament: Tournament;
    winnerId: string;
    winnerUid: string;
    winnerName: string;
    winnerPhoto?: string;
    finalMatchId: string;
    finalScore: string;
  }): Promise<{ champion: ChampionRecord; prize: PrizeRecord }> {
    const {
      tournament,
      winnerId,
      winnerUid,
      winnerName,
      winnerPhoto,
      finalMatchId,
      finalScore,
    } = params;

    const champId = `CHAMP_${tournament.id}`;
    const prizeId = `PRIZE_${tournament.id}`;
    const now = new Date().toISOString();

    const championRecord: ChampionRecord = {
      id: champId,
      tournamentId: tournament.id,
      weekNumber: tournament.weekNumber,
      tournamentName: tournament.name,
      playerId: winnerId,
      playerUid: winnerUid,
      displayName: winnerName,
      photoURL: winnerPhoto || '',
      finalMatchId,
      finalScore,
      tournamentDate: tournament.startDate || now,
      prizeAmount: TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
      prizeStatus: 'PENDING_PAYOUT',
      createdAt: now,
    };

    const prizeRecord: PrizeRecord = {
      id: prizeId,
      tournamentId: tournament.id,
      weekNumber: tournament.weekNumber,
      tournamentName: tournament.name,
      championPlayerId: winnerId,
      championPlayerUid: winnerUid,
      championDisplayName: winnerName,
      amount: TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
      status: 'PENDING_PAYOUT',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'champions', champId), removeUndefined(championRecord), { merge: true });
      await setDoc(doc(db, 'prizes', prizeId), removeUndefined(prizeRecord), { merge: true });

      await auditService.logAction(
        'CHAMPION_CROWNED',
        'system',
        undefined,
        tournament.id,
        finalMatchId,
        {
          championPlayerId: winnerId,
          championName: winnerName,
          finalScore,
          prizeAmount: TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
        }
      );

      await auditService.logAction(
        'PRIZE_RECORD_CREATED',
        'system',
        undefined,
        tournament.id,
        undefined,
        {
          prizeId,
          amount: TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
          status: 'PENDING_PAYOUT',
        }
      );

      return { champion: championRecord, prize: prizeRecord };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `champions/${champId}`);
    }
  },

  /**
   * Get all prize records for administration
   */
  async getAllPrizes(): Promise<PrizeRecord[]> {
    try {
      const snap = await getDocs(collection(db, 'prizes'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrizeRecord));
      return list.sort((a, b) => b.weekNumber - a.weekNumber);
    } catch (error) {
      console.warn('Error fetching prizes:', error);
      return [];
    }
  },

  /**
   * Record manual M-Pesa payout by authorized administrator (PART T & AI)
   */
  async recordManualPayout(params: {
    prizeId: string;
    mpesaCode: string;
    mpesaPhone: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    const { prizeId, mpesaCode, mpesaPhone, adminUid, adminEmail } = params;
    const now = new Date().toISOString();

    const prizeRef = doc(db, 'prizes', prizeId);
    const prizeSnap = await getDoc(prizeRef);
    if (!prizeSnap.exists()) throw new Error('Prize record not found');
    const prize = prizeSnap.data() as PrizeRecord;

    try {
      await updateDoc(prizeRef, {
        status: 'PAID',
        payoutMpesaCode: mpesaCode.trim().toUpperCase(),
        payoutPhone: mpesaPhone.trim(),
        payoutPaidAt: now,
        payoutRecordedBy: adminUid,
        updatedAt: now,
      });

      // Also update champion record
      const champRef = doc(db, 'champions', `CHAMP_${prize.tournamentId}`);
      const champSnap = await getDoc(champRef);
      if (champSnap.exists()) {
        await updateDoc(champRef, {
          prizeStatus: 'PAID',
          payoutMpesaCode: mpesaCode.trim().toUpperCase(),
          payoutPhone: mpesaPhone.trim(),
          payoutPaidAt: now,
          payoutRecordedBy: adminUid,
        });
      }

      await auditService.logAction(
        'PRIZE_PAYOUT_RECORDED',
        adminUid,
        adminEmail,
        prize.tournamentId,
        undefined,
        {
          prizeId,
          amount: prize.amount,
          championPlayerId: prize.championPlayerId,
          mpesaCode: mpesaCode.trim().toUpperCase(),
          mpesaPhone: mpesaPhone.trim(),
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `prizes/${prizeId}`);
    }
  },

  /**
   * Get prize record by tournament ID
   */
  async getPrizeByTournament(tournamentId: string): Promise<PrizeRecord | null> {
    try {
      const snap = await getDoc(doc(db, 'prizes', `PRIZE_${tournamentId}`));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as PrizeRecord;
    } catch (error) {
      return null;
    }
  },

  /**
   * Update prize disbursement status with full details
   */
  async updatePrizeStatus(
    prizeId: string,
    status: PrizeStatus,
    options?: {
      mpesaReference?: string;
      recipientPhone?: string;
      notes?: string;
      adminEmail?: string;
    }
  ): Promise<void> {
    try {
      const prizeRef = doc(db, 'prizes', prizeId);
      const snap = await getDoc(prizeRef);
      if (!snap.exists()) throw new Error('Prize record not found');
      const prize = snap.data() as PrizeRecord;

      const now = new Date().toISOString();
      const updates: any = {
        status,
        updatedAt: now,
      };

      if (options?.mpesaReference) {
        updates.mpesaReference = options.mpesaReference;
        updates.payoutMpesaCode = options.mpesaReference;
      }
      if (options?.recipientPhone) {
        updates.recipientPhone = options.recipientPhone;
        updates.payoutPhone = options.recipientPhone;
      }
      if (options?.notes) {
        updates.disbursementNotes = options.notes;
      }
      if (status === 'PAID') {
        updates.paidAt = now;
        updates.payoutPaidAt = now;
      }

      await updateDoc(prizeRef, updates);

      if (prize.tournamentId) {
        const champRef = doc(db, 'champions', `CHAMP_${prize.tournamentId}`);
        const champSnap = await getDoc(champRef);
        if (champSnap.exists()) {
          await updateDoc(champRef, {
            prizeStatus: status,
            payoutMpesaCode: options?.mpesaReference || '',
            payoutPhone: options?.recipientPhone || '',
            updatedAt: now,
          });
        }
      }

      await auditService.logAction(
        'PRIZE_PAYOUT_RECORDED',
        options?.adminEmail || 'admin',
        options?.adminEmail,
        prize.tournamentId,
        undefined,
        {
          prizeId,
          status,
          mpesaReference: options?.mpesaReference,
          recipientPhone: options?.recipientPhone,
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `prizes/${prizeId}`);
    }
  },
};
