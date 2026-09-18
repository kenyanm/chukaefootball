/**
 * Firebase → Google Sheets Synchronization Layer
 *
 * Responsibilities:
 * - Synchronizes reporting, audit, and operational copies of Firestore entities to Google Sheets.
 * - Guarantees idempotency and retry safety using primary key upserts.
 * - Tolerant to network or Apps Script timeouts: failures are logged without crashing live games.
 *
 * PRIVACY & SECURITY STRICT ENFORCEMENT:
 * - NEVER synchronizes eFootball 6-digit match room join codes.
 * - NEVER synchronizes player private WhatsApp numbers.
 * - NEVER synchronizes passwords, credentials, tokens, or raw screenshot files.
 * - Evidence metadata only is recorded; actual media remains in Firebase Storage.
 */

import {
  collection,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { googleSheetsService } from './googleSheetsService';
import { SHEET_NAMES } from '../config/googleSheets';
import {
  Tournament,
  TournamentEntry,
  PaymentRecord,
  MatchFixture,
  ChampionRecord,
  PrizeRecord,
  AuditLog,
  UserProfile,
} from '../types';

export const sheetsSyncService = {
  /**
   * Synchronizes a user profile (reporting copy) to Google Sheets.
   * Uses userId (permanent CHUKA ID: CHUKA-XXXXXX) as primary identifier.
   */
  async syncUser(user: Partial<UserProfile> | any): Promise<boolean> {
    const permanentUserId = user.userId || user.playerId;
    const firebaseUid = user.firebaseUid || user.id || user.uid;
    if (!permanentUserId) {
      console.warn('[sheetsSyncService] Cannot sync user without permanent CHUKA userId / playerId');
      return false;
    }

    const record = {
      userId: permanentUserId,
      firebaseUid: firebaseUid || '',
      displayName: user.displayName || user.name || `Player ${permanentUserId}`,
      efootballUsername: user.efootballUsername || '',
      efootballAccountImageUrl: user.efootballAccountImageUrl || '',
      email: user.email || '',
      photoUrl: user.photoURL || user.photoUrl || '',
      whatsappRequired: user.whatsappRequired ? 'YES' : 'NO',
      whatsappStatus: user.whatsappStatus || (user.whatsappNumber ? 'SET' : 'NOT_SET'),
      role: user.role || (user.isAdmin ? 'ADMIN' : 'PLAYER'),
      status: user.status || (user.isSuspended ? 'SUSPENDED' : 'ACTIVE'),
      createdAt: user.createdAt || user.registeredAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
      lastLoginAt: user.lastLoginAt || '',
    };

    const res = await googleSheetsService.upsertRecord(SHEET_NAMES.USERS, 'userId', permanentUserId, record);
    return res.success;
  },

  /**
   * Synchronizes a tournament record to Google Sheets.
   */
  async syncTournament(tournament: Partial<Tournament> | any): Promise<boolean> {
    const tournamentId = tournament.id || tournament.tournamentId;
    if (!tournamentId) return false;

    const record = {
      tournamentId,
      weekNumber: tournament.weekNumber || 1,
      name: tournament.name || 'CHUKA eFOOTBALL Championship',
      game: 'eFootball Mobile',
      platform: 'Mobile (Android/iOS)',
      entryFee: tournament.entryFee || 100,
      prizePool: tournament.prizePool || '',
      maxPlayers: tournament.maxPlayers || 32,
      registrationOpenAt: tournament.registrationOpenAt || '',
      registrationCloseAt: tournament.registrationCloseAt || '',
      verificationStartAt: tournament.verificationStartAt || '',
      verificationEndAt: tournament.verificationEndAt || '',
      competitionStartAt: tournament.competitionStartAt || tournament.startDate || '',
      competitionEndAt: tournament.competitionEndAt || '',
      status: tournament.status || 'UPCOMING',
      roomJoinWindowMinutes: tournament.roomJoinWindowMinutes || 5,
      createdAt: tournament.createdAt || new Date().toISOString(),
      updatedAt: tournament.updatedAt || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.TOURNAMENTS,
      'tournamentId',
      tournamentId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a tournament registration entry to Google Sheets.
   */
  async syncRegistration(entry: Partial<TournamentEntry> | any): Promise<boolean> {
    const registrationId = entry.id || entry.registrationId;
    if (!registrationId) return false;

    const record = {
      registrationId,
      tournamentId: entry.tournamentId || '',
      playerId: entry.playerId || '',
      displayName: entry.displayName || entry.playerName || '',
      status: entry.status || 'REGISTERED',
      registeredAt: entry.registeredAt || new Date().toISOString(),
      verifiedAt: entry.verifiedAt || (entry.status === 'VERIFIED' ? entry.registeredAt : ''),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.REGISTRATIONS,
      'registrationId',
      registrationId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a payment verification record to Google Sheets.
   */
  async syncPayment(payment: Partial<PaymentRecord> | any): Promise<boolean> {
    const paymentId = payment.id || payment.paymentId;
    if (!paymentId) return false;

    const record = {
      paymentId,
      tournamentId: payment.tournamentId || '',
      playerId: payment.playerId || '',
      playerName: payment.playerDisplayName || payment.playerName || '',
      mpesaCode: payment.mpesaCode || '',
      amount: payment.amount || 100,
      status: payment.status || 'PENDING',
      timestamp: payment.timestamp || new Date().toISOString(),
      reviewedBy: payment.reviewedBy || '',
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.PAYMENTS,
      'paymentId',
      paymentId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a match fixture to Google Sheets.
   * SECURITY: Room code (roomNumber) is strictly scrubbed.
   */
  async syncMatch(match: Partial<MatchFixture> | any): Promise<boolean> {
    const matchId = match.id || match.matchId;
    if (!matchId) return false;

    const record = {
      matchId,
      tournamentId: match.tournamentId || '',
      roundName: match.roundName || '',
      roundNumber: match.roundNumber || 1,
      homePlayerId: match.homePlayerId || '',
      homePlayerName: match.homePlayerName || '',
      awayPlayerId: match.awayPlayerId || '',
      awayPlayerName: match.awayPlayerName || '',
      homeScore: match.homeScore != null ? match.homeScore : '',
      awayScore: match.awayScore != null ? match.awayScore : '',
      status: match.status || 'SCHEDULED',
      winnerId: match.winnerId || '',
      deadline: match.deadline || '',
      updatedAt: match.updatedAt || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.MATCHES,
      'matchId',
      matchId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a confirmed match result to Google Sheets.
   */
  async syncMatchResult(result: any): Promise<boolean> {
    const resultId = result.resultId || result.id || `RES-${result.matchId || Date.now()}`;

    const record = {
      resultId,
      matchId: result.matchId || '',
      tournamentId: result.tournamentId || '',
      roundName: result.roundName || '',
      homePlayerName: result.homePlayerName || '',
      awayPlayerName: result.awayPlayerName || '',
      finalScore: result.finalScore || `${result.homeScore ?? 0} - ${result.awayScore ?? 0}`,
      winnerId: result.winnerId || '',
      winnerName: result.winnerName || '',
      confirmedAt: result.confirmedAt || result.updatedAt || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.MATCH_RESULTS,
      'resultId',
      resultId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a champion hall-of-fame record to Google Sheets.
   */
  async syncChampion(champion: Partial<ChampionRecord> | any): Promise<boolean> {
    const championId = champion.id || champion.championId;
    if (!championId) return false;

    const record = {
      championId,
      tournamentId: champion.tournamentId || '',
      tournamentName: champion.tournamentName || '',
      playerId: champion.playerId || '',
      playerName: champion.playerName || champion.displayName || '',
      crownedAt: champion.crownedAt || champion.createdAt || new Date().toISOString(),
      prizeAmount: champion.prizeAmount || '',
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.CHAMPIONS,
      'championId',
      championId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a prize record to Google Sheets.
   */
  async syncPrize(prize: Partial<PrizeRecord> | any): Promise<boolean> {
    const prizeId = prize.id || prize.prizeId;
    if (!prizeId) return false;

    const record = {
      prizeId,
      tournamentId: prize.tournamentId || '',
      playerId: prize.playerId || '',
      playerName: prize.playerName || '',
      placement: prize.placement || '1st Place',
      amount: prize.amount || 0,
      status: prize.status || 'PENDING',
      disbursedAt: prize.disbursedAt || '',
      mpesaReceipt: prize.mpesaReceipt || '',
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.PRIZES,
      'prizeId',
      prizeId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes bracket stage structure metadata to Google Sheets.
   */
  async syncBracket(bracket: any): Promise<boolean> {
    const bracketId = bracket.bracketId || bracket.id || bracket.tournamentId;
    if (!bracketId) return false;

    const record = {
      bracketId,
      tournamentId: bracket.tournamentId || '',
      roundName: bracket.roundName || '',
      totalMatches: bracket.totalMatches || 0,
      completedMatches: bracket.completedMatches || 0,
      updatedAt: new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.BRACKETS,
      'bracketId',
      bracketId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a match dispute record to Google Sheets.
   */
  async syncDispute(dispute: any): Promise<boolean> {
    const disputeId = dispute.id || dispute.disputeId;
    if (!disputeId) return false;

    const record = {
      disputeId,
      matchId: dispute.matchId || '',
      tournamentId: dispute.tournamentId || '',
      raisedByPlayerId: dispute.raisedByPlayerId || dispute.playerId || '',
      reason: dispute.reason || '',
      status: dispute.status || 'OPEN',
      resolvedBy: dispute.resolvedBy || '',
      createdAt: dispute.createdAt || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.DISPUTES,
      'disputeId',
      disputeId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes evidence metadata to Google Sheets.
   * SECURITY: Actual screenshot images remain in Firebase Storage; only metadata is written.
   */
  async syncEvidenceMetadata(evidence: any): Promise<boolean> {
    const evidenceId = evidence.id || evidence.evidenceId;
    if (!evidenceId) return false;

    const record = {
      evidenceId,
      matchId: evidence.matchId || '',
      playerId: evidence.playerId || '',
      fileType: evidence.fileType || 'image/jpeg',
      storageRef: evidence.storageRef || 'firebase-storage-evidence',
      status: evidence.status || 'SUBMITTED',
      uploadedAt: evidence.uploadedAt || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.EVIDENCE,
      'evidenceId',
      evidenceId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes high-level tournament statistics to Google Sheets.
   */
  async syncTournamentStats(stats: any): Promise<boolean> {
    const statId = stats.id || stats.statId || stats.tournamentId;
    if (!statId) return false;

    const record = {
      statId,
      tournamentId: stats.tournamentId || '',
      totalPlayers: stats.totalPlayers || 0,
      totalMatches: stats.totalMatches || 0,
      totalGoals: stats.totalGoals || 0,
      averageGoalsPerMatch: stats.averageGoalsPerMatch || 0,
      updatedAt: new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.TOURNAMENT_STATS,
      'statId',
      statId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a security audit log to Google Sheets.
   */
  async syncSecurityLog(log: any): Promise<boolean> {
    const securityLogId = log.id || log.securityLogId || `sec-${Date.now()}`;

    const record = {
      securityLogId,
      eventType: log.eventType || 'SECURITY_EVENT',
      actorId: log.actorId || '',
      severity: log.severity || 'INFO',
      description: log.description || '',
      timestamp: log.timestamp || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.SECURITY_LOGS,
      'securityLogId',
      securityLogId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes an admin audit log to Google Sheets.
   */
  async syncAdminLog(log: Partial<AuditLog> | any): Promise<boolean> {
    const logId = log.id || log.logId || `adm-${Date.now()}`;

    const record = {
      logId,
      adminEmail: log.adminEmail || log.userId || '',
      action: log.action || '',
      targetId: log.targetId || '',
      details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || ''),
      timestamp: log.timestamp || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.ADMIN_LOGS,
      'logId',
      logId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes an unlocked player achievement to Google Sheets.
   */
  async syncAchievement(achv: any): Promise<boolean> {
    const achievementId = achv.id || `ACHV_${achv.playerId}_${achv.type}`;
    const record = {
      achievementId,
      playerId: achv.playerId || '',
      type: achv.type || '',
      title: achv.title || '',
      description: achv.description || '',
      pointsAwarded: achv.pointsAwarded || 0,
      unlockedAt: achv.unlockedAt || new Date().toISOString(),
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.ACHIEVEMENTS,
      'achievementId',
      achievementId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes a daily check-in claim record to Google Sheets.
   */
  async syncDailyClaim(claim: any): Promise<boolean> {
    const claimId = claim.id || `${claim.userId}_${claim.date}`;
    const record = {
      claimId,
      userId: claim.userId || '',
      playerId: claim.playerId || '',
      displayName: claim.displayName || '',
      date: claim.date || '',
      claimedAt: claim.claimedAt || new Date().toISOString(),
      streakCount: claim.streakCount || 1,
      pointsEarned: claim.pointsEarned || 5,
      isFirstClaimToday: claim.isFirstClaimToday ? 'YES' : 'NO',
    };

    const res = await googleSheetsService.upsertRecord(
      SHEET_NAMES.DAILY_CLAIMS,
      'claimId',
      claimId,
      record
    );
    return res.success;
  },

  /**
   * Synchronizes all live operational data from Firebase Firestore to Google Sheets.
   * Executed when the verified admin clicks [ SYNC DATA ].
   */
  async syncAllData(triggeredBy: string = 'admin'): Promise<{
    success: boolean;
    syncedCount: number;
    errors: string[];
    timestamp: string;
  }> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      // 1. Fetch live collections from Firestore
      const [
        tournamentsSnap,
        entriesSnap,
        paymentsSnap,
        matchesSnap,
        championsSnap,
        prizesSnap,
        usersSnap,
        adminLogsSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'tournaments')),
        getDocs(collection(db, 'tournamentEntries')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'matches')),
        getDocs(collection(db, 'champions')),
        getDocs(collection(db, 'prizes')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'adminLogs')),
      ]);

      // 2. Synchronize Tournaments
      for (const d of tournamentsSnap.docs) {
        try {
          const ok = await this.syncTournament({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`Tournament ${d.id}: ${e.message}`);
        }
      }

      // 3. Synchronize Users (sanitized)
      for (const d of usersSnap.docs) {
        try {
          const ok = await this.syncUser({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`User ${d.id}: ${e.message}`);
        }
      }

      // 4. Synchronize Registrations
      for (const d of entriesSnap.docs) {
        try {
          const ok = await this.syncRegistration({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`Registration ${d.id}: ${e.message}`);
        }
      }

      // 5. Synchronize Payments
      for (const d of paymentsSnap.docs) {
        try {
          const ok = await this.syncPayment({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`Payment ${d.id}: ${e.message}`);
        }
      }

      // 6. Synchronize Matches (sanitized - NO room codes)
      for (const d of matchesSnap.docs) {
        try {
          const data = d.data() as MatchFixture;
          const ok = await this.syncMatch({ id: d.id, ...data });
          if (ok) syncedCount++;

          // If match is confirmed, also sync result
          if (data.status === 'CONFIRMED') {
            await this.syncMatchResult({
              matchId: d.id,
              tournamentId: data.tournamentId,
              roundName: data.roundName,
              homePlayerName: data.homePlayerName,
              awayPlayerName: data.awayPlayerName,
              homeScore: data.homeScore,
              awayScore: data.awayScore,
              winnerId: data.winnerId,
            });
          }
        } catch (e: any) {
          errors.push(`Match ${d.id}: ${e.message}`);
        }
      }

      // 7. Synchronize Champions
      for (const d of championsSnap.docs) {
        try {
          const ok = await this.syncChampion({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`Champion ${d.id}: ${e.message}`);
        }
      }

      // 8. Synchronize Prizes
      for (const d of prizesSnap.docs) {
        try {
          const ok = await this.syncPrize({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`Prize ${d.id}: ${e.message}`);
        }
      }

      // 9. Synchronize Admin Logs (recent)
      for (const d of adminLogsSnap.docs.slice(0, 50)) {
        try {
          const ok = await this.syncAdminLog({ id: d.id, ...d.data() });
          if (ok) syncedCount++;
        } catch (e: any) {
          errors.push(`AdminLog ${d.id}: ${e.message}`);
        }
      }

      const completedAt = new Date().toISOString();
      const isSuccess = errors.length === 0 || syncedCount > 0;

      // Update Firestore config
      await googleSheetsService.saveConfig({
        lastSuccessfulSync: isSuccess ? completedAt : undefined,
        lastError: errors.length > 0 ? errors.slice(0, 3).join('; ') : undefined,
        failedCount: errors.length,
        pendingCount: 0,
      });

      // Record sync log in Firestore
      try {
        await addDoc(collection(db, 'sheetsSyncLogs'), {
          syncId: `sync-${Date.now()}`,
          triggeredBy,
          startedAt,
          completedAt,
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          syncedCount,
          errorCount: errors.length,
          errors: errors.slice(0, 10),
          timestamp: completedAt,
        });
      } catch (logErr) {
        console.warn('Could not record sync audit log in Firestore:', logErr);
      }

      return {
        success: isSuccess,
        syncedCount,
        errors,
        timestamp: completedAt,
      };
    } catch (fatalErr: any) {
      const errMsg = fatalErr.message || 'Fatal error during data synchronization.';
      errors.push(errMsg);

      await googleSheetsService.saveConfig({
        lastError: errMsg,
        failedCount: (await googleSheetsService.getConfig()).failedCount + 1,
      });

      return {
        success: false,
        syncedCount,
        errors,
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Quick connection & health check for Google Sheets synchronization
   */
  async checkHealth(): Promise<{ connected: boolean; lastSync?: string; message?: string }> {
    try {
      const res = await googleSheetsService.testConnection();
      const config = await googleSheetsService.getConfig();
      return {
        connected: res.status === 'online',
        lastSync: config.lastSuccessfulSync,
        message: res.message,
      };
    } catch (e: any) {
      return {
        connected: false,
        message: e.message || 'Offline',
      };
    }
  },

  /**
   * Trigger full synchronization of all tournament reporting records
   */
  async syncFullTournamentData(tournamentId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.syncAllData(`command-center-sync-${tournamentId || 'all'}`);
      return {
        success: res.success,
        error: res.errors && res.errors.length > 0 ? res.errors.join('; ') : undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Sync error',
      };
    }
  },
};
