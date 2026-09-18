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
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, removeUndefined } from '../firebase/config';
import { Tournament, TournamentEntry, MatchFixture, TournamentStatus, TournamentRoundConfig, TournamentStats, DisputeRecord } from '../types';
import { auditService } from './auditService';
import { bracketEngine } from './bracketEngine';
import { championService } from './championService';
import { sheetsSyncService } from './sheetsSyncService';

// Lifecycle validation: Only valid transitions are permitted (Requirement 2)
export const VALID_TOURNAMENT_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  UPCOMING: ['REGISTRATION_OPEN', 'CANCELLED'],
  REGISTRATION_OPEN: ['VERIFICATION', 'REGISTRATION_LOCKED', 'CANCELLED'],
  VERIFICATION: ['REGISTRATION_LOCKED', 'CANCELLED'],
  REGISTRATION_LOCKED: ['BRACKET_READY', 'LIVE', 'CANCELLED'],
  BRACKET_READY: ['LIVE', 'REGISTRATION_LOCKED', 'CANCELLED'],
  LIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

// Helper to format week numbers with leading zero (e.g. "CHUKA eFOOTBALL WEEK 04")
export const formatWeekTitle = (weekNumber: number): string => {
  const padded = String(weekNumber).padStart(2, '0');
  return `CHUKA eFOOTBALL WEEK ${padded}`;
};

// Helper for dynamic knockout round naming
export const getDynamicRoundName = (remainingPlayersInRound: number): string => {
  if (remainingPlayersInRound === 2) return 'Final';
  if (remainingPlayersInRound === 4) return 'Semifinal';
  if (remainingPlayersInRound === 8) return 'Quarterfinal';
  return `Round of ${remainingPlayersInRound}`;
};

export const tournamentService = {
  // Get all tournaments ordered by weekNumber desc
  async getAllTournaments(): Promise<Tournament[]> {
    try {
      const snap = await getDocs(collection(db, 'tournaments'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament));
      return list.sort((a, b) => b.weekNumber - a.weekNumber);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
    }
  },

  // Get single tournament by ID
  async getTournamentById(id: string): Promise<Tournament | null> {
    try {
      const snap = await getDoc(doc(db, 'tournaments', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Tournament;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `tournaments/${id}`);
    }
  },

  // Create new weekly tournament (Requirement 4)
  async createTournament(data: {
    weekNumber: number;
    name?: string;
    game?: string;
    platform?: string;
    entryFee?: number;
    prizePool?: number;
    maxPlayers?: number;
    status?: TournamentStatus;
    registrationOpenDate?: string;
    registrationCloseDate?: string;
    verificationStartDate?: string;
    verificationEndDate?: string;
    verificationDate?: string;
    startDate?: string;
    endDate?: string;
    roomJoinWindowMinutes?: number;
    adminUid?: string;
    adminEmail?: string;
  }): Promise<Tournament> {
    try {
      const paddedWeek = String(data.weekNumber).padStart(2, '0');
      const id = `week-${paddedWeek}`;
      const tournRef = doc(db, 'tournaments', id);

      const existing = await getDoc(tournRef);
      if (existing.exists()) {
        throw new Error(`Tournament for Week ${paddedWeek} already exists.`);
      }

      const now = new Date();
      const openDate = data.registrationOpenDate || now.toISOString();
      const closeDate = data.registrationCloseDate || new Date(now.getTime() + 86400000 * 4).toISOString();
      const verifStartDate = data.verificationStartDate || data.verificationDate || new Date(now.getTime() + 86400000 * 4).toISOString();
      const verifEndDate = data.verificationEndDate || new Date(now.getTime() + 86400000 * 5).toISOString();
      const startDate = data.startDate || new Date(now.getTime() + 86400000 * 6).toISOString();
      const endDate = data.endDate || new Date(now.getTime() + 86400000 * 12).toISOString();

      const tournament: Tournament = {
        id,
        weekNumber: Number(data.weekNumber),
        name: data.name?.trim() || formatWeekTitle(data.weekNumber),
        game: data.game?.trim() || 'eFootball Mobile',
        platform: data.platform?.trim() || 'Mobile / Android',
        entryFee: Number(data.entryFee ?? 20),
        prizePool: Number(data.prizePool ?? 1000),
        roomJoinWindowMinutes: Number(data.roomJoinWindowMinutes ?? 5),
        registrationOpenDate: openDate,
        registrationCloseDate: closeDate,
        verificationDate: verifStartDate,
        verificationStartDate: verifStartDate,
        verificationEndDate: verifEndDate,
        startDate,
        endDate,
        registeredCount: 0,
        verifiedCount: 0,
        status: data.status || 'REGISTRATION_OPEN',
        currentRound: 'Registration Open',
        totalRounds: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      if (data.maxPlayers && !isNaN(Number(data.maxPlayers)) && Number(data.maxPlayers) > 0) {
        tournament.maxPlayers = Number(data.maxPlayers);
      } else {
        tournament.maxPlayers = 1024;
      }

      await setDoc(tournRef, removeUndefined(tournament));

      await auditService.logAction(
        'TOURNAMENT_CREATED',
        data.adminUid || 'admin',
        data.adminEmail,
        id,
        undefined,
        {
          weekNumber: data.weekNumber,
          name: tournament.name,
          game: tournament.game,
          platform: tournament.platform,
          entryFee: tournament.entryFee,
          prizePool: tournament.prizePool,
        }
      );

      // Synchronize to Google Sheets
      try {
        await sheetsSyncService.syncTournament(tournament);
      } catch (sErr) {
        console.warn('Sheets sync notice for tournament creation:', sErr);
      }

      return tournament;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tournaments');
    }
  },

  // Update status with strict lifecycle state machine validation (Requirement 2)
  async updateTournamentStatus(
    id: string,
    newStatus: TournamentStatus,
    adminUid?: string,
    adminEmail?: string
  ): Promise<void> {
    try {
      const tournRef = doc(db, 'tournaments', id);
      const snap = await getDoc(tournRef);
      if (!snap.exists()) throw new Error('Tournament not found.');
      const currentTourn = snap.data() as Tournament;
      const currentStatus = currentTourn.status;

      if (currentStatus === newStatus) return; // No change needed

      const allowedNext = VALID_TOURNAMENT_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(newStatus)) {
        throw new Error(
          `Cannot transition tournament from "${currentStatus}" to "${newStatus}". Invalid lifecycle sequence. Allowed transitions: ${allowedNext.join(', ') || 'None (Terminal)'}`
        );
      }

      const now = new Date().toISOString();
      const updates: Partial<Tournament> = {
        status: newStatus,
        updatedAt: now,
      };

      if (newStatus === 'COMPLETED') {
        updates.completedDate = now;
      }

      await updateDoc(tournRef, updates);

      await auditService.logAction(
        'TOURNAMENT_EDITED',
        adminUid || 'admin',
        adminEmail,
        id,
        undefined,
        { previousStatus: currentStatus, newStatus }
      );

      // Synchronize updated tournament to Google Sheets
      try {
        await sheetsSyncService.syncTournament({ ...currentTourn, ...updates });
      } catch (sErr) {
        console.warn('Sheets sync notice for status update:', sErr);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  },

  // LOCK REGISTRATION (Requirement 4):
  // When verification is complete, lock registration so no new players can enter
  async lockRegistration(
    tournamentId: string,
    adminUid: string,
    adminEmail?: string
  ): Promise<void> {
    try {
      const tournRef = doc(db, 'tournaments', tournamentId);
      const snap = await getDoc(tournRef);
      if (!snap.exists()) throw new Error('Tournament not found.');

      const tourn = snap.data() as Tournament;
      if (tourn.lockedAt) {
        throw new Error(`Registration was already locked on ${new Date(tourn.lockedAt).toLocaleString()} by ${tourn.lockedBy || 'admin'}.`);
      }

      await updateDoc(tournRef, {
        status: 'VERIFICATION',
        lockedAt: new Date().toISOString(),
        lockedBy: adminUid,
        updatedAt: new Date().toISOString(),
      });

      await auditService.logAction(
        'REGISTRATION_LOCKED',
        adminUid,
        adminEmail,
        tournamentId,
        undefined,
        { lockedAt: new Date().toISOString(), verifiedPlayers: tourn.verifiedCount }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}`);
    }
  },

  // Get rounds configuration for a tournament
  async getTournamentRounds(tournamentId: string): Promise<TournamentRoundConfig[]> {
    try {
      const q = query(
        collection(db, 'rounds'),
        where('tournamentId', '==', tournamentId)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TournamentRoundConfig))
        .sort((a, b) => a.roundNumber - b.roundNumber);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'rounds');
    }
  },

  // Update schedule/deadline for a round (Requirement 7)
  async updateRoundSchedule(
    roundId: string,
    startDate: string,
    deadline: string,
    adminUid: string
  ): Promise<void> {
    try {
      const roundRef = doc(db, 'rounds', roundId);
      await updateDoc(roundRef, {
        startDate,
        deadline,
      });

      await auditService.logAction(
        'DEADLINE_RESOLVED' as any,
        adminUid,
        undefined,
        undefined,
        undefined,
        { roundId, newStartDate: startDate, newDeadline: deadline }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rounds/${roundId}`);
    }
  },

  // TRANSACTIONAL KNOCKOUT BRACKET GENERATOR (Requirements 6, 7, 16)
  async generateKnockoutBracket(
    tournamentId: string,
    adminUid?: string,
    adminEmail?: string
  ): Promise<{ matchCount: number; rounds: number; byesCount: number; version: string }> {
    try {
      const res = await bracketEngine.generateKnockoutBracket(tournamentId, adminUid, adminEmail);
      return {
        matchCount: res.matchCount,
        rounds: res.rounds,
        byesCount: res.byesCount,
        version: 'v1.0-official',
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}/bracket`);
      throw error;
    }
  },

  // ADMIN RESET / REBUILD BRACKET (Strictly restricted to wayongohlaurence@gmail.com)
  async resetKnockoutBracket(
    tournamentId: string,
    adminUid: string,
    adminEmail?: string,
    force = false
  ): Promise<{ deletedMatches: number; deletedRounds: number }> {
    try {
      return await bracketEngine.resetKnockoutBracket(tournamentId, adminUid, adminEmail, force);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}/reset_bracket`);
      throw error;
    }
  },

  // LOCK / PUBLISH BRACKET (Requirement 9)
  async lockBracket(
    tournamentId: string,
    adminUid: string,
    adminEmail?: string
  ): Promise<void> {
    try {
      const tournRef = doc(db, 'tournaments', tournamentId);
      const snap = await getDoc(tournRef);
      if (!snap.exists()) throw new Error('Tournament not found.');
      const tourn = snap.data() as Tournament;

      if (!tourn.bracketVersion && tourn.status !== 'BRACKET_READY' && tourn.status !== 'LIVE') {
        throw new Error('Cannot lock bracket: Bracket has not been generated yet.');
      }

      await updateDoc(tournRef, {
        bracketLocked: true,
        status: tourn.status === 'REGISTRATION_LOCKED' || tourn.status === 'VERIFICATION' ? 'BRACKET_READY' : tourn.status,
        updatedAt: new Date().toISOString(),
      });

      await auditService.logAction(
        'BRACKET_LOCKED',
        adminUid,
        adminEmail,
        tournamentId,
        undefined,
        { bracketVersion: tourn.bracketVersion, status: tourn.status }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/lock_bracket`);
      throw error;
    }
  },

  // DETECT ROUND PROGRESSION (Requirement 11)
  async checkRoundProgression(tournamentId: string): Promise<{
    currentRoundNumber: number;
    currentRoundName: string;
    totalMatchesInRound: number;
    resolvedMatchesCount: number;
    unresolvedMatchesCount: number;
    unresolvedMatches: MatchFixture[];
    isRoundFullyResolved: boolean;
    isTournamentFinal: boolean;
    canAdvance: boolean;
  }> {
    try {
      const rounds = (await this.getTournamentRounds(tournamentId)) || [];
      const matchesSnap = await getDocs(
        query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))
      );
      const allMatches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchFixture));

      const activeRound =
        rounds.find((r) => r.status === 'ACTIVE') ||
        rounds.find((r) => r.status !== 'COMPLETED') ||
        rounds[0];

      if (!activeRound) {
        return {
          currentRoundNumber: 0,
          currentRoundName: 'N/A',
          totalMatchesInRound: 0,
          resolvedMatchesCount: 0,
          unresolvedMatchesCount: 0,
          unresolvedMatches: [],
          isRoundFullyResolved: false,
          isTournamentFinal: false,
          canAdvance: false,
        };
      }

      const roundMatches = allMatches.filter(
        (m) => m.roundNumber === activeRound.roundNumber || m.roundId === activeRound.id
      );

      const playableMatches = roundMatches.filter((m) => !m.isBye);
      const unresolvedMatches = playableMatches.filter((m) => m.status !== 'CONFIRMED');

      const isRoundFullyResolved = playableMatches.length > 0 && unresolvedMatches.length === 0;
      const isTournamentFinal = activeRound.roundNumber >= rounds.length;
      const canAdvance = isRoundFullyResolved && !isTournamentFinal;

      return {
        currentRoundNumber: activeRound.roundNumber,
        currentRoundName: activeRound.roundName || `Round ${activeRound.roundNumber}`,
        totalMatchesInRound: playableMatches.length,
        resolvedMatchesCount: playableMatches.length - unresolvedMatches.length,
        unresolvedMatchesCount: unresolvedMatches.length,
        unresolvedMatches,
        isRoundFullyResolved,
        isTournamentFinal,
        canAdvance,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `tournaments/${tournamentId}/progression`);
      throw error;
    }
  },

  // ADVANCE TO NEXT ROUND (Requirement 11)
  async advanceRound(
    tournamentId: string,
    adminUid?: string,
    adminEmail?: string
  ): Promise<{ nextRoundNumber: number; nextRoundName: string }> {
    try {
      const progression = await this.checkRoundProgression(tournamentId);
      if (!progression.isRoundFullyResolved) {
        throw new Error(
          `Cannot advance round: ${progression.unresolvedMatchesCount} matches in ${progression.currentRoundName} are still unresolved.`
        );
      }
      if (progression.isTournamentFinal) {
        throw new Error('Tournament has reached the Final round. Complete tournament to crown champion.');
      }

      const rounds = (await this.getTournamentRounds(tournamentId)) || [];
      const currentR = rounds.find((r) => r.roundNumber === progression.currentRoundNumber);
      const nextR = rounds.find((r) => r.roundNumber === progression.currentRoundNumber + 1);

      if (!nextR) {
        throw new Error('Next round configuration not found.');
      }

      const batch = writeBatch(db);

      if (currentR) {
        batch.update(doc(db, 'rounds', currentR.id), {
          status: 'COMPLETED',
        });
      }

      batch.update(doc(db, 'rounds', nextR.id), {
        status: 'ACTIVE',
      });

      batch.update(doc(db, 'tournaments', tournamentId), {
        currentRound: nextR.roundName,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await auditService.logAction(
        'MATCH_RESOLVED',
        adminUid || 'admin',
        adminEmail,
        tournamentId,
        undefined,
        {
          event: 'ROUND_ADVANCED',
          previousRound: progression.currentRoundName,
          nextRound: nextR.roundName,
        }
      );

      await this.calculateAndSaveTournamentStats(tournamentId);

      return {
        nextRoundNumber: nextR.roundNumber,
        nextRoundName: nextR.roundName,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}/advance_round`);
      throw error;
    }
  },

  // CHECK CAN COMPLETE TOURNAMENT (Requirement 19)
  async canCompleteTournament(tournamentId: string): Promise<{
    canComplete: boolean;
    reason?: string;
    finalMatch?: MatchFixture;
    championPlayerId?: string;
    championName?: string;
    championScore?: string;
  }> {
    try {
      const tournSnap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournSnap.exists()) return { canComplete: false, reason: 'Tournament does not exist.' };
      const tourn = tournSnap.data() as Tournament;

      if (tourn.status === 'COMPLETED') {
        return { canComplete: false, reason: 'Tournament is already completed.' };
      }

      const matchesSnap = await getDocs(
        query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))
      );
      const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchFixture));

      if (matches.length === 0) {
        return { canComplete: false, reason: 'No bracket matches found for this tournament.' };
      }

      // Check open disputes
      const disputesSnap = await getDocs(
        query(collection(db, 'disputes'), where('tournamentId', '==', tournamentId))
      );
      const openDisputes = disputesSnap.docs
        .map((d) => d.data() as DisputeRecord)
        .filter((disp) => disp.status === 'OPEN');

      if (openDisputes.length > 0) {
        return {
          canComplete: false,
          reason: `There are ${openDisputes.length} open disputes that must be resolved first.`,
        };
      }

      // Check unresolved matches
      const unresolvedMatches = matches.filter((m) => !m.isBye && m.status !== 'CONFIRMED');
      if (unresolvedMatches.length > 0) {
        return {
          canComplete: false,
          reason: `${unresolvedMatches.length} matches remain unresolved. Every playable match must be CONFIRMED.`,
        };
      }

      // Find the final match (highest roundNumber)
      const maxRound = Math.max(...matches.map((m) => m.roundNumber || 1));
      const finalRoundMatches = matches.filter((m) => m.roundNumber === maxRound);
      const finalMatch = finalRoundMatches[0];

      if (!finalMatch || finalMatch.status !== 'CONFIRMED' || !finalMatch.winnerId) {
        return {
          canComplete: false,
          reason: 'The final match has not been officially resolved with a confirmed winner.',
        };
      }

      const championPlayerId =
        finalMatch.winnerId === finalMatch.homePlayerId || finalMatch.winnerId === finalMatch.homePlayerUid
          ? finalMatch.homePlayerId
          : finalMatch.awayPlayerId;
      const championName =
        finalMatch.winnerId === finalMatch.homePlayerId || finalMatch.winnerId === finalMatch.homePlayerUid
          ? finalMatch.homePlayerName
          : finalMatch.awayPlayerName;
      const championScore = `${finalMatch.homeScore ?? 0} — ${finalMatch.awayScore ?? 0}`;

      return {
        canComplete: true,
        finalMatch,
        championPlayerId,
        championName,
        championScore,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `tournaments/${tournamentId}/can_complete`);
      throw error;
    }
  },

  // COMPLETE TOURNAMENT & CROWN CHAMPION IDEMPOTENTLY (Requirement 19 & 20)
  async completeTournament(
    tournamentId: string,
    adminUid: string,
    adminEmail?: string
  ): Promise<{ championId: string; prizeId: string }> {
    try {
      const check = await this.canCompleteTournament(tournamentId);
      if (!check.canComplete || !check.finalMatch) {
        throw new Error(check.reason || 'Tournament cannot be completed at this time.');
      }

      const finalMatch = check.finalMatch;
      const tournSnap = await getDoc(doc(db, 'tournaments', tournamentId));
      const tourn = tournSnap.data() as Tournament;

      const isHomeWinner =
        finalMatch.winnerId === finalMatch.homePlayerId ||
        finalMatch.winnerId === finalMatch.homePlayerUid;
      const winnerPlayerId = isHomeWinner ? finalMatch.homePlayerId : finalMatch.awayPlayerId;
      const winnerUid = isHomeWinner ? (finalMatch.homePlayerUid || '') : (finalMatch.awayPlayerUid || '');
      const winnerDisplayName = isHomeWinner ? finalMatch.homePlayerName : finalMatch.awayPlayerName;
      const winnerPhoto = isHomeWinner ? finalMatch.homePlayerPhoto : finalMatch.awayPlayerPhoto;
      const winnerScore = check.championScore || `${finalMatch.homeScore ?? 0} — ${finalMatch.awayScore ?? 0}`;

      // 1. Create/update Champion & Prize records idempotently (Requirement 20 & 22)
      const res = await championService.createChampionAndPrizeRecord({
        tournament: tourn,
        winnerId: winnerPlayerId,
        winnerUid,
        winnerName: winnerDisplayName,
        winnerPhoto,
        finalMatchId: finalMatch.id,
        finalScore: winnerScore,
      });

      // 2. Mark tournament as COMPLETED
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        status: 'COMPLETED',
        championPlayerId: winnerPlayerId,
        championName: winnerDisplayName,
        championScore: winnerScore,
        completedDate: now,
        updatedAt: now,
      });

      // 3. Log actions
      await auditService.logAction(
        'TOURNAMENT_COMPLETED',
        adminUid,
        adminEmail,
        tournamentId,
        undefined,
        {
          championPlayerId: winnerPlayerId,
          championName: winnerDisplayName,
          finalScore: winnerScore,
          finalMatchId: finalMatch.id,
        }
      );

      // 4. Update and sync tournament stats
      await this.calculateAndSaveTournamentStats(tournamentId);

      return {
        championId: res.champion.id,
        prizeId: res.prize.id,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}/complete`);
      throw error;
    }
  },

  // CONTINUOUSLY CALCULATE & SAVE TOURNAMENT STATISTICS (Requirement 16)
  async calculateAndSaveTournamentStats(tournamentId: string): Promise<TournamentStats> {
    try {
      const [tournSnap, entriesSnap, matchesSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId)),
        getDocs(query(collection(db, 'registrations'), where('tournamentId', '==', tournamentId))),
        getDocs(query(collection(db, 'matches'), where('tournamentId', '==', tournamentId))),
      ]);

      const tourn = tournSnap.exists() ? (tournSnap.data() as Tournament) : null;
      const entries = entriesSnap.docs.map((d) => d.data() as TournamentEntry);
      const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchFixture));

      const verifiedPlayers = entries.filter((e) => e.status === 'VERIFIED').length;
      const matchesTotal = matches.length;
      const matchesCompleted = matches.filter((m) => m.status === 'CONFIRMED').length;
      const matchesPending = matches.filter(
        (m) =>
          m.status === 'SCHEDULED' ||
          m.status === 'PENDING_ROOM' ||
          m.status === 'ROOM_REQUIRED' ||
          m.status === 'ROOM_READY' ||
          m.status === 'AWAY_JOIN_WINDOW' ||
          m.status === 'READY_TO_PLAY' ||
          m.status === 'IN_PROGRESS' ||
          m.status === 'SUBMITTED' ||
          m.status === 'RESULT_SUBMITTED' ||
          m.status === 'AWAITING_CONFIRMATION'
      ).length;

      const now = Date.now();
      const matchesDisputed = matches.filter(
        (m) => m.status === 'DISPUTED' || m.status === 'ADMIN_RESOLUTION'
      ).length;
      const matchesOverdue = matches.filter(
        (m) =>
          m.status !== 'CONFIRMED' &&
          m.deadline &&
          new Date(m.deadline).getTime() < now
      ).length;

      let totalGoals = 0;
      let playedMatchesCount = 0;
      for (const m of matches) {
        if (m.status === 'CONFIRMED' && !m.isBye) {
          totalGoals += (m.homeScore || 0) + (m.awayScore || 0);
          playedMatchesCount++;
        }
      }
      const averageGoalsPerMatch =
        playedMatchesCount > 0 ? Number((totalGoals / playedMatchesCount).toFixed(2)) : 0;

      const playableCompleted = matches.filter((m) => m.status === 'CONFIRMED' && !m.isBye).length;
      const playersRemaining =
        tourn?.status === 'COMPLETED' ? 1 : Math.max(1, verifiedPlayers - playableCompleted);

      const stats: TournamentStats = {
        id: tournamentId,
        statId: tournamentId,
        tournamentId,
        verifiedPlayers,
        totalPlayers: entries.length,
        matchesTotal,
        totalMatches: matchesTotal,
        matchesCompleted,
        matchesPending,
        matchesDisputed,
        matchesOverdue,
        playersRemaining,
        currentRound: tourn?.currentRound || 'N/A',
        totalGoals,
        averageGoalsPerMatch,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'tournamentStats', tournamentId), removeUndefined(stats));

      try {
        await sheetsSyncService.syncTournamentStats(stats);
      } catch (sErr) {
        console.warn('Sheets sync notice for tournament stats:', sErr);
      }

      return stats;
    } catch (error) {
      console.error('Error calculating tournament stats:', error);
      return {
        id: tournamentId,
        tournamentId,
        verifiedPlayers: 0,
        matchesTotal: 0,
        matchesCompleted: 0,
        matchesPending: 0,
        matchesDisputed: 0,
        matchesOverdue: 0,
        playersRemaining: 0,
        currentRound: 'N/A',
        updatedAt: new Date().toISOString(),
      };
    }
  },

  // GET TOURNAMENT STATS (Requirement 16)
  async getTournamentStats(tournamentId: string): Promise<TournamentStats | null> {
    try {
      const snap = await getDoc(doc(db, 'tournamentStats', tournamentId));
      if (!snap.exists()) return null;
      return snap.data() as TournamentStats;
    } catch (error) {
      console.warn('Could not retrieve tournamentStats document:', error);
      return null;
    }
  },
};
/* DEPRECATED_LOCAL_GENERATOR_START
      const tournamentSnap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournamentSnap.exists()) throw new Error('Tournament not found');
      const tourn = tournamentSnap.data() as Tournament;

      if (tourn.bracketVersion) {
        throw new Error(
          `Bracket has already been generated for this tournament (Version: ${tourn.bracketVersion}). Duplicate generation is blocked.`
        );
      }

      // Check if existing matches are present
      const existingMatchesQuery = query(
        collection(db, 'matches'),
        where('tournamentId', '==', tournamentId)
      );
      const existingMatches = await getDocs(existingMatchesQuery);
      if (!existingMatches.empty) {
        throw new Error('Matches already exist for this tournament. Bracket generation aborted.');
      }

      // 2. Fetch all verified entries
      const entriesQuery = query(
        collection(db, 'tournamentEntries'),
        where('tournamentId', '==', tournamentId),
        where('status', '==', 'VERIFIED')
      );
      const entriesSnap = await getDocs(entriesQuery);
      const verifiedEntries = entriesSnap.docs.map((d) => d.data() as TournamentEntry);

      if (verifiedEntries.length < 2) {
        throw new Error(
          `At least 2 verified players are required to generate a bracket. Currently verified: ${verifiedEntries.length}.`
        );
      }

      // Shuffle players for fair randomized seeding
      const players = [...verifiedEntries].sort(() => Math.random() - 0.5);
      const N = players.length;

      // 3. Dynamic Power-of-Two Calculation
      const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(N)));
      const totalRounds = Math.log2(powerOfTwo);
      const byesCount = powerOfTwo - N;
      const round1MatchCount = powerOfTwo / 2;

      const weekPadded = String(tourn.weekNumber).padStart(2, '0');
      const bracketVersion = `v${Date.now()}_${powerOfTwo}bracket`;

      const batch = writeBatch(db);

      // 4. Create Round Schedules (Daily Round Management - Requirement 7)
      const nowTime = new Date().getTime();
      for (let r = 1; r <= totalRounds; r++) {
        const remainingInRound = powerOfTwo / Math.pow(2, r - 1);
        const roundName = getDynamicRoundName(remainingInRound);
        const roundId = `${tournamentId}_r${r}`;
        const roundStart = new Date(nowTime + 86400000 * (r - 1)).toISOString();
        const roundDeadline = new Date(nowTime + 86400000 * r).toISOString();

        const roundConfig: TournamentRoundConfig = {
          id: roundId,
          tournamentId,
          roundNumber: r,
          roundName,
          startDate: roundStart,
          deadline: roundDeadline,
          status: r === 1 ? 'ACTIVE' : 'PENDING',
          matchCount: remainingInRound / 2,
          completedMatchCount: 0,
        };

        batch.set(doc(db, 'rounds', roundId), removeUndefined(roundConfig));
      }

      // 5. Populate Round 1 Fixtures with Proper Bye Allocation (Requirement 16)
      // Top seeds/players who receive byes skip playing Round 1 and advance to Round 2 automatically.
      let playerIndex = 0;
      let totalMatchesCreated = 0;
      const initialRoundName = getDynamicRoundName(powerOfTwo);

      // Track players advancing to Round 2 due to Byes
      const round2Advancements: { bracketPos: number; player: TournamentEntry }[] = [];

      for (let pos = 1; pos <= round1MatchCount; pos++) {
        const matchNumberFormatted = String(pos).padStart(4, '0');
        const matchId = `CHK-W${weekPadded}-M${matchNumberFormatted}`;
        const matchRef = doc(db, 'matches', matchId);

        // Determine if this match position gets a Bye
        const getsBye = pos <= byesCount;

        if (getsBye) {
          // Exactly 1 player receives the Bye
          const byePlayer = players[playerIndex++];
          const byeFixture: MatchFixture = {
            id: matchId,
            matchId,
            tournamentId,
            roundId: `${tournamentId}_r1`,
            roundNumber: 1,
            roundName: initialRoundName,
            bracketPosition: pos,
            homePlayerId: byePlayer.playerId,
            homePlayerUid: byePlayer.userId,
            homePlayerName: byePlayer.displayName,
            homePlayerPhoto: byePlayer.photoURL || '',
            awayPlayerId: 'BYE',
            awayPlayerName: 'BYE (Automatic Advance)',
            status: 'CONFIRMED',
            winnerId: byePlayer.playerId,
            winnerUid: byePlayer.userId,
            isBye: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          batch.set(matchRef, removeUndefined(byeFixture));
          totalMatchesCreated++;

          // Record advancement to Round 2
          round2Advancements.push({ bracketPos: pos, player: byePlayer });
        } else {
          // Standard match with 2 verified competitors
          const home = players[playerIndex++];
          const away = players[playerIndex++];

          const fixture: MatchFixture = {
            id: matchId,
            matchId,
            tournamentId,
            roundId: `${tournamentId}_r1`,
            roundNumber: 1,
            roundName: initialRoundName,
            bracketPosition: pos,
            homePlayerId: home.playerId,
            homePlayerUid: home.userId,
            homePlayerName: home.displayName,
            homePlayerPhoto: home.photoURL || '',
            awayPlayerId: away.playerId,
            awayPlayerUid: away.userId,
            awayPlayerName: away.displayName,
            awayPlayerPhoto: away.photoURL || '',
            status: 'SCHEDULED',
            deadline: new Date(nowTime + 86400000).toISOString(),
            isBye: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          batch.set(matchRef, removeUndefined(fixture));
          totalMatchesCreated++;
        }
      }

      // If there are multiple rounds, seed the bye players into Round 2 slots directly
      if (totalRounds > 1 && round2Advancements.length > 0) {
        const round2Name = getDynamicRoundName(powerOfTwo / 2);
        for (const adv of round2Advancements) {
          const nextRoundPos = Math.ceil(adv.bracketPos / 2);
          const isHome = adv.bracketPos % 2 !== 0;
          const nextMatchId = `CHK-W${weekPadded}-R2-M${String(nextRoundPos).padStart(3, '0')}`;
          const nextRef = doc(db, 'matches', nextMatchId);

          const r2Fixture: Partial<MatchFixture> = {
            id: nextMatchId,
            matchId: nextMatchId,
            tournamentId,
            roundId: `${tournamentId}_r2`,
            roundNumber: 2,
            roundName: round2Name,
            bracketPosition: nextRoundPos,
            status: 'SCHEDULED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...(isHome
              ? {
                  homePlayerId: adv.player.playerId,
                  homePlayerUid: adv.player.userId,
                  homePlayerName: adv.player.displayName,
                  homePlayerPhoto: adv.player.photoURL || '',
                  awayPlayerId: 'TBD',
                  awayPlayerName: 'TBD (Winner of R1)',
                }
              : {
                  homePlayerId: 'TBD',
                  homePlayerName: 'TBD (Winner of R1)',
                  awayPlayerId: adv.player.playerId,
                  awayPlayerUid: adv.player.userId,
                  awayPlayerName: adv.player.displayName,
                  awayPlayerPhoto: adv.player.photoURL || '',
                }),
          };

          batch.set(nextRef, removeUndefined(r2Fixture), { merge: true });
        }
      }

      // 6. Update Tournament Document with Bracket Version & Status LIVE
      const tournRef = doc(db, 'tournaments', tournamentId);
      batch.update(tournRef, removeUndefined({
        status: 'LIVE',
        currentRound: initialRoundName,
        totalRounds,
        bracketVersion,
        updatedAt: new Date().toISOString(),
      }));

      await batch.commit();

      // 7. Audit Log
      await auditService.logAction(
        'BRACKET_GENERATED',
        adminUid || 'admin',
        adminEmail,
        tournamentId,
        undefined,
        {
          verifiedPlayers: N,
          bracketSize: powerOfTwo,
          totalRounds,
          byesCount,
          matchesCreated: totalMatchesCreated,
          bracketVersion,
        }
      );

      return {
        matchCount: totalMatchesCreated,
        rounds: totalRounds,
        byesCount,
        version: bracketVersion,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}/bracket`);
    }
  },
};
*/
