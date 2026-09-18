import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  increment,
  writeBatch,
  runTransaction,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, removeUndefined } from '../firebase/config';
import {
  MatchFixture,
  MatchEvidenceRecord,
  DisputeRecord,
  EvidenceStatus,
  MatchStatus,
  Tournament,
  MatchRoomPrivate,
} from '../types';
import { auditService } from './auditService';
import { getDynamicRoundName } from './tournamentService';
import { storageService } from './storageService';
import { championService } from './championService';
import { sheetsSyncService } from './sheetsSyncService';

export const matchService = {
  // Get all matches for a tournament
  async getTournamentMatches(tournamentId: string): Promise<MatchFixture[]> {
    try {
      const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchFixture));
      return list.sort((a, b) => {
        if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
        return (a.bracketPosition || 0) - (b.bracketPosition || 0);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    }
  },

  // Get matches where user is a participant
  async getUserMatches(userUid: string): Promise<MatchFixture[]> {
    try {
      const [homeSnap, awaySnap] = await Promise.all([
        getDocs(query(collection(db, 'matches'), where('homePlayerUid', '==', userUid))),
        getDocs(query(collection(db, 'matches'), where('awayPlayerUid', '==', userUid))),
      ]);

      const map = new Map<string, MatchFixture>();
      homeSnap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as MatchFixture));
      awaySnap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as MatchFixture));

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    }
  },

  // Get single match by ID
  async getMatchById(matchId: string): Promise<MatchFixture | null> {
    try {
      const snap = await getDoc(doc(db, 'matches', matchId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as MatchFixture;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `matches/${matchId}`);
    }
  },

  // Real-time listener for private match room
  listenToMatchRoom(
    matchId: string,
    callback: (room: MatchRoomPrivate | null) => void,
    onError?: (err: any) => void
  ): () => void {
    const roomRef = doc(db, 'matchRooms', matchId);
    return onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          callback(null);
        } else {
          callback({ id: snap.id, ...snap.data() } as MatchRoomPrivate);
        }
      },
      (error) => {
        console.warn(`Error listening to matchRoom ${matchId}:`, error);
        if (onError) onError(error);
      }
    );
  },

  // Get private match room doc
  async getMatchRoom(matchId: string): Promise<MatchRoomPrivate | null> {
    try {
      const snap = await getDoc(doc(db, 'matchRooms', matchId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as MatchRoomPrivate;
    } catch (error) {
      console.warn(`Could not read match room for ${matchId}`, error);
      return null;
    }
  },

  // HOME PLAYER = ROOM CREATOR
  // Save or update 6-digit room number created in eFootball Mobile
  async saveRoomNumber(
    matchId: string,
    roomNumber: string,
    userUid: string,
    isAdmin = false,
    joinWindowMinutes = 5
  ): Promise<void> {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) throw new Error('Match fixture not found');
      const match = snap.data() as MatchFixture;

      // Ensure caller is HOME player or Admin
      if (!isAdmin && match.homePlayerUid !== userUid) {
        throw new Error('Only the designated HOME player can create and register the eFootball Mobile room number.');
      }

      // Check immutable state
      if (['SUBMITTED', 'RESULT_SUBMITTED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'DISPUTED'].includes(match.status)) {
        throw new Error('Room number cannot be modified after match results have been submitted or confirmed.');
      }

      const cleanCode = roomNumber.trim().replace(/\D/g, '');
      if (!/^\d{6}$/.test(cleanCode)) {
        throw new Error('Invalid room number. eFootball Mobile match room numbers must be exactly 6 digits.');
      }

      const now = new Date().toISOString();
      const roomRef = doc(db, 'matchRooms', matchId);
      const roomSnap = await getDoc(roomRef);
      const isUpdate = roomSnap.exists();
      const previousData = isUpdate ? (roomSnap.data() as MatchRoomPrivate) : null;

      const history = previousData?.history || [];
      if (isUpdate && previousData?.roomNumber && previousData.roomNumber !== cleanCode) {
        history.push({
          roomNumber: previousData.roomNumber,
          changedAt: now,
          changedBy: userUid,
        });
      }

      const roomData: MatchRoomPrivate = {
        id: matchId,
        matchId,
        tournamentId: match.tournamentId,
        homePlayerUid: match.homePlayerUid || '',
        homePlayerId: match.homePlayerId,
        awayPlayerUid: match.awayPlayerUid || '',
        awayPlayerId: match.awayPlayerId,
        roomNumber: cleanCode,
        roomCreatedAt: now,
        roomJoinWindowMinutes: joinWindowMinutes,
        awayReady: previousData?.awayReady || false,
        updatedAt: now,
        updatedBy: userUid,
        history,
      };

      if (previousData?.awayReadyAt) {
        roomData.awayReadyAt = previousData.awayReadyAt;
      }

      const batch = writeBatch(db);
      batch.set(roomRef, removeUndefined(roomData), { merge: true });

      // Determine next status: AWAY_JOIN_WINDOW or ROOM_READY
      let nextStatus: MatchStatus = match.status;
      if (['SCHEDULED', 'PENDING_ROOM', 'ROOM_REQUIRED'].includes(match.status)) {
        nextStatus = 'AWAY_JOIN_WINDOW';
      }

      // Update public fixture metadata (DO NOT write private roomNumber to public match doc)
      batch.update(matchRef, {
        roomCreatedAt: now,
        roomJoinWindowMinutes: joinWindowMinutes,
        roomStatus: 'READY',
        status: nextStatus,
        updatedAt: now,
      });

      await batch.commit();

      await auditService.logAction(
        isUpdate ? 'ROOM_UPDATED' : 'ROOM_CREATED',
        userUid,
        undefined,
        match.tournamentId,
        matchId,
        {
          roomNumber: cleanCode,
          previousRoomNumber: previousData?.roomNumber,
          joinWindowMinutes,
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/room`);
    }
  },

  // AWAY PLAYER READINESS DECLARATION
  async setAwayReady(matchId: string, userUid: string, isAdmin = false): Promise<void> {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) throw new Error('Match fixture not found');
      const match = snap.data() as MatchFixture;

      // Verify caller is AWAY player or Admin
      if (!isAdmin && match.awayPlayerUid !== userUid) {
        throw new Error('Only the designated AWAY player can confirm readiness for this match.');
      }

      const now = new Date().toISOString();
      const roomRef = doc(db, 'matchRooms', matchId);

      const batch = writeBatch(db);
      batch.set(
        roomRef,
        {
          awayReady: true,
          awayReadyAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      // Transition to READY_TO_PLAY or IN_PROGRESS
      let nextStatus: MatchStatus = match.status;
      if (['ROOM_READY', 'AWAY_JOIN_WINDOW', 'SCHEDULED', 'PENDING_ROOM'].includes(match.status)) {
        nextStatus = 'READY_TO_PLAY';
      }

      batch.update(matchRef, {
        awayReady: true,
        awayReadyAt: now,
        status: nextStatus,
        updatedAt: now,
      });

      await batch.commit();

      await auditService.logAction(
        'AWAY_PLAYER_READY',
        userUid,
        undefined,
        match.tournamentId,
        matchId,
        { declaredAt: now }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/awayReady`);
    }
  },

  // PARTICIPANT GAME STARTED DECLARATION (Requirement 9)
  async setGameStarted(matchId: string, userUid: string, isAdmin = false): Promise<void> {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) throw new Error('Match fixture not found');
      const match = snap.data() as MatchFixture;

      // Verify caller is a registered participant in this match or Admin
      const isHome = match.homePlayerUid === userUid;
      const isAway = match.awayPlayerUid === userUid;
      if (!isAdmin && !isHome && !isAway) {
        throw new Error('Only an assigned participant in this match can declare the game has started.');
      }

      const now = new Date().toISOString();
      await updateDoc(matchRef, {
        status: 'IN_PROGRESS',
        gameStartedAt: now,
        gameStartedBy: userUid,
        updatedAt: now,
      });

      await auditService.logAction(
        'GAME_STARTED',
        userUid,
        undefined,
        match.tournamentId,
        matchId,
        { startedAt: now, declaredBy: isHome ? 'HOME' : isAway ? 'AWAY' : 'ADMIN' }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/gameStarted`);
    }
  },

  // Mark match as OVERDUE if deadline exceeded without score (Admin / Cron / Trigger)
  async markMatchOverdue(matchId: string, actorUid: string): Promise<void> {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) return;
      const match = snap.data() as MatchFixture;

      if (['CONFIRMED', 'SUBMITTED', 'RESULT_SUBMITTED', 'AWAITING_CONFIRMATION', 'CANCELLED'].includes(match.status)) {
        return;
      }

      await updateDoc(matchRef, {
        status: 'OVERDUE',
        updatedAt: new Date().toISOString(),
      });

      await auditService.logAction(
        'DEADLINE_RESOLVED',
        actorUid,
        undefined,
        match.tournamentId,
        matchId,
        { reason: 'MATCH_DEADLINE_EXCEEDED', previousStatus: match.status }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/overdue`);
    }
  },

  // RESULT SUBMISSION (Requirements 11, 12, 13)
  // Submit score and temporary screenshot evidence
  async submitMatchResult(params: {
    matchId: string;
    userUid: string;
    homeScore: number;
    awayScore: number;
    screenshotBase64?: string;
  }): Promise<{ status: MatchStatus; isDisputed: boolean; isConfirmed: boolean }> {
    try {
      const { matchId, userUid, homeScore, awayScore, screenshotBase64 } = params;
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) throw new Error('Match fixture not found');
      const match = snap.data() as MatchFixture;

      if (match.status === 'CONFIRMED') {
        throw new Error('This match result is already confirmed and immutable.');
      }

      // Verify participant ownership
      const isHome = match.homePlayerUid === userUid;
      const isAway = match.awayPlayerUid === userUid;
      if (!isHome && !isAway) {
        throw new Error('You are not a registered participant in this match.');
      }

      const submitterRole = isHome ? 'HOME' : 'AWAY';
      const submitterPlayerId = isHome ? match.homePlayerId : match.awayPlayerId;
      const opponentUid = isHome ? match.awayPlayerUid : match.homePlayerUid;

      const batch = writeBatch(db);

      // Create evidence record if screenshot provided
      let evidenceId = '';
      if (screenshotBase64) {
        evidenceId = `EVD_${matchId}_${submitterRole}_${Date.now()}`;
        let downloadUrl = screenshotBase64;
        let storagePath = '';
        try {
          const uploadRes = await storageService.uploadMatchScreenshot(
            matchId,
            submitterRole,
            screenshotBase64
          );
          downloadUrl = uploadRes.downloadUrl;
          storagePath = uploadRes.storagePath;
        } catch (storageErr) {
          console.warn('Storage upload error, retaining direct data url', storageErr);
        }

        const evidenceRef = doc(db, 'matchEvidence', evidenceId);
        const evidence: MatchEvidenceRecord = {
          id: evidenceId,
          matchId,
          tournamentId: match.tournamentId,
          uploadedBy: userUid,
          uploaderPlayerId: submitterPlayerId,
          screenshotUrl: downloadUrl,
          storagePath,
          status: 'PENDING',
          uploadedAt: new Date().toISOString(),
        };
        batch.set(evidenceRef, evidence);
      }

      // Check existing submissions
      const submissions = match.submissions || {};
      const subRecord: any = {
        homeScore,
        awayScore,
        submittedAt: new Date().toISOString(),
        submittedByUid: userUid,
        submittedByPlayerId: submitterPlayerId,
      };
      if (evidenceId) {
        subRecord.screenshotId = evidenceId;
      }
      submissions[userUid] = subRecord;

      // Check if opponent already submitted
      let nextStatus: MatchStatus = 'AWAITING_CONFIRMATION';
      let isDisputed = false;
      let isConfirmed = false;

      if (opponentUid && submissions[opponentUid]) {
        const oppSub = submissions[opponentUid];
        // Compare submissions
        if (oppSub.homeScore === homeScore && oppSub.awayScore === awayScore) {
          if (homeScore === awayScore) {
            // Draw in knockout format (Requirement 13: Move to ADMIN_RESOLUTION, do NOT advance)
            nextStatus = 'ADMIN_RESOLUTION';
            isDisputed = true;
          } else {
            // Both players submitted identical decisive scores! Automatic Confirmation (Requirement 12)
            nextStatus = 'CONFIRMED';
            isConfirmed = true;
          }
        } else {
          // CONFLICTING RESULTS! (Requirement 13: 3-1 vs 2-2)
          nextStatus = 'DISPUTED';
          isDisputed = true;

          // Create Dispute Record
          const disputeId = `DISP_${matchId}_${Date.now()}`;
          const disputeRef = doc(db, 'disputes', disputeId);
          const dispute: DisputeRecord = {
            id: disputeId,
            matchId,
            tournamentId: match.tournamentId,
            reportedBy: userUid,
            reportedByName: isHome ? match.homePlayerName : match.awayPlayerName,
            reportedPlayerId: submitterPlayerId,
            reason: 'WRONG_SCORE',
            notes: `Conflicting scores submitted: Home submitted ${submissions[match.homePlayerUid || '']?.homeScore ?? '?'}-${submissions[match.homePlayerUid || '']?.awayScore ?? '?'}, Away submitted ${submissions[match.awayPlayerUid || '']?.homeScore ?? '?'}-${submissions[match.awayPlayerUid || '']?.awayScore ?? '?'}.`,
            status: 'OPEN',
            originalSubmissions: submissions,
            createdAt: new Date().toISOString(),
          };
          batch.set(disputeRef, dispute);

          await auditService.logAction(
            'RESULT_DISPUTED',
            userUid,
            undefined,
            match.tournamentId,
            matchId,
            { disputeId, submissions }
          );
        }
      } else {
        // First submission
        nextStatus = 'AWAITING_CONFIRMATION';
      }

      batch.update(matchRef, {
        homeScore,
        awayScore,
        submittedBy: submitterRole,
        submittedByUid: userUid,
        submittedAt: new Date().toISOString(),
        status: nextStatus,
        submissions,
        evidenceStatus: 'PENDING',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await auditService.logAction(
        'RESULT_SUBMITTED',
        userUid,
        undefined,
        match.tournamentId,
        matchId,
        { submitterRole, homeScore, awayScore, nextStatus }
      );

      // If automatically confirmed, process advancement and cleanup
      if (isConfirmed) {
        await this.finalizeMatchConfirmation(matchId, homeScore, awayScore, 'auto_agreement');
      }

      return { status: nextStatus, isDisputed, isConfirmed };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${params.matchId}/result`);
    }
  },

  // OPPONENT CONFIRMATION (Requirement 12)
  // Opponent clicks "Confirm Score"
  async confirmMatchResult(matchId: string, userUid: string): Promise<void> {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) throw new Error('Match fixture not found');
      const match = snap.data() as MatchFixture;

      if (match.status === 'CONFIRMED') {
        throw new Error('Match result is already confirmed.');
      }

      // Check caller is one of the participants
      const isHome = match.homePlayerUid === userUid;
      const isAway = match.awayPlayerUid === userUid;
      if (!isHome && !isAway) {
        throw new Error('Only a registered participant in this match can confirm the result.');
      }

      if (match.submittedByUid && match.submittedByUid === userUid) {
        throw new Error('You cannot confirm your own result submission. Your opponent must confirm or dispute.');
      }

      if (match.homeScore === null || match.homeScore === undefined || match.awayScore === null || match.awayScore === undefined) {
        throw new Error('No score has been submitted yet to confirm.');
      }

      // Draw handling (Requirement 13)
      if (match.homeScore === match.awayScore) {
        await updateDoc(matchRef, {
          status: 'ADMIN_RESOLUTION',
          disputeReason: 'TIED_MATCH_DRAW',
          updatedAt: new Date().toISOString(),
        });

        await auditService.logAction(
          'DRAW_FLAGGED_ADMIN_RESOLUTION',
          userUid,
          undefined,
          match.tournamentId,
          matchId,
          { homeScore: match.homeScore, awayScore: match.awayScore }
        );
        return;
      }

      await this.finalizeMatchConfirmation(matchId, match.homeScore, match.awayScore, userUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/confirm`);
    }
  },

  // FINALIZE CONFIRMATION: Advance winner, update stats, purge screenshot (Requirements 12, 13, 14, 15, 16, 19, 23)
  async finalizeMatchConfirmation(
    matchId: string,
    homeScore: number,
    awayScore: number,
    actorUid: string
  ): Promise<void> {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) return;
      const match = snap.data() as MatchFixture;

      // Draw Check (Requirement 13)
      if (homeScore === awayScore) {
        await updateDoc(matchRef, {
          status: 'ADMIN_RESOLUTION',
          disputeReason: 'TIED_MATCH_DRAW',
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      // Determine winner & loser strictly from scores (Requirement 12: Do NOT allow player to choose winner)
      let winnerId = '';
      let winnerUid = '';
      let loserId = '';
      let loserUid = '';

      if (homeScore > awayScore) {
        winnerId = match.homePlayerId;
        winnerUid = match.homePlayerUid || '';
        loserId = match.awayPlayerId;
        loserUid = match.awayPlayerUid || '';
      } else {
        winnerId = match.awayPlayerId;
        winnerUid = match.awayPlayerUid || '';
        loserId = match.homePlayerId;
        loserUid = match.homePlayerUid || '';
      }

      // Concurrency & Idempotency: Use runTransaction to prevent double confirmation
      let alreadyConfirmed = false;
      await runTransaction(db, async (transaction) => {
        const mDoc = await transaction.get(matchRef);
        if (!mDoc.exists()) return;
        const currentMatch = mDoc.data() as MatchFixture;
        if (currentMatch.status === 'CONFIRMED') {
          alreadyConfirmed = true;
          return;
        }

        const now = new Date().toISOString();
        transaction.update(matchRef, {
          status: 'CONFIRMED',
          homeScore,
          awayScore,
          winnerId,
          winnerPlayerId: winnerId,
          winnerUid,
          loserId,
          loserPlayerId: loserId,
          loserUid,
          confirmedAt: now,
          updatedAt: now,
        });

        // Atomic stats increment
        if (winnerUid) {
          const winnerRef = doc(db, 'users', winnerUid);
          transaction.update(winnerRef, { wins: increment(1) });
        }
        if (loserUid) {
          const loserRef = doc(db, 'users', loserUid);
          transaction.update(loserRef, { losses: increment(1) });
        }
      });

      if (alreadyConfirmed) {
        return; // Safe idempotent return
      }

      // SCREENSHOT EVIDENCE CLEANUP (Requirement 19 & Physical Storage deletion)
      const evidenceQuery = query(collection(db, 'matchEvidence'), where('matchId', '==', matchId));
      const evidenceSnap = await getDocs(evidenceQuery);
      for (const evDoc of evidenceSnap.docs) {
        const evData = { id: evDoc.id, ...evDoc.data() } as MatchEvidenceRecord;
        try {
          await storageService.purgeEvidence(evData, actorUid);
        } catch (cleanErr) {
          console.error('Evidence purge error:', cleanErr);
        }
      }

      // Audit Logs
      await auditService.logAction(
        'RESULT_CONFIRMED',
        actorUid,
        undefined,
        match.tournamentId,
        matchId,
        { homeScore, awayScore, winnerId, loserId }
      );

      await auditService.logAction(
        'PLAYER_ADVANCED',
        'system',
        undefined,
        match.tournamentId,
        matchId,
        { winnerId, advancedToNextRound: match.roundNumber + 1 }
      );

      await auditService.logAction(
        'PLAYER_ELIMINATED',
        'system',
        undefined,
        match.tournamentId,
        matchId,
        { eliminatedPlayerId: loserId }
      );

      // AUTOMATIC IDEMPOTENT ADVANCEMENT (Requirement 16)
      await this.advanceWinnerToNextRound(match, winnerId, winnerUid);

      // Google Sheets operational sync (scrubbed of private room/phone)
      try {
        await sheetsSyncService.syncMatch({
          ...match,
          status: 'CONFIRMED',
          homeScore,
          awayScore,
          winnerId,
        });
        await sheetsSyncService.syncMatchResult({
          matchId,
          tournamentId: match.tournamentId,
          roundName: match.roundName,
          homePlayerName: match.homePlayerName,
          awayPlayerName: match.awayPlayerName,
          finalScore: `${homeScore} - ${awayScore}`,
          winnerId,
          winnerName: winnerId === match.homePlayerId ? match.homePlayerName : match.awayPlayerName,
          confirmedAt: new Date().toISOString(),
        });
      } catch (sheetsErr) {
        console.warn('Google Sheets sync notice (non-fatal):', sheetsErr);
      }
    } catch (error) {
      console.error('Error in finalizeMatchConfirmation:', error);
      throw error;
    }
  },

  // Advance winner to the corresponding next round match slot
  async advanceWinnerToNextRound(match: MatchFixture, winnerId: string, winnerUid: string): Promise<void> {
    try {
      const tournRef = doc(db, 'tournaments', match.tournamentId);
      const tournSnap = await getDoc(tournRef);
      if (!tournSnap.exists()) return;
      const tourn = tournSnap.data() as Tournament;

      const totalRounds = tourn.totalRounds || 1;
      const currentRoundNum = match.roundNumber;

      // Check if this was the FINAL MATCH (Requirement 20: Crown Champion)
      if (currentRoundNum >= totalRounds) {
        // Automatically mark winner as Champion!
        const winnerDoc = await getDoc(doc(db, 'users', winnerUid));
        const winnerProfile = winnerDoc.exists() ? winnerDoc.data() : null;
        const championName = winnerProfile?.displayName || (winnerId === match.homePlayerId ? match.homePlayerName : match.awayPlayerName);
        const championPhoto = winnerProfile?.photoURL || (winnerId === match.homePlayerId ? match.homePlayerPhoto : match.awayPlayerPhoto);
        const championScore = `${match.homeScore} - ${match.awayScore}`;

        const batch = writeBatch(db);

        // Update tournament record
        batch.update(tournRef, {
          status: 'COMPLETED',
          currentRound: 'Champion Crowned',
          championPlayerId: winnerId,
          championName,
          championPhoto: championPhoto || '',
          championScore,
          completedDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Increment champion's championship count
        if (winnerUid) {
          batch.update(doc(db, 'users', winnerUid), {
            championships: increment(1),
          });
        }

        await batch.commit();

        // Create official ChampionRecord and PrizeRecord (PART S & PART T)
        await championService.createChampionAndPrizeRecord({
          tournament: { ...tourn, id: match.tournamentId },
          winnerId,
          winnerUid,
          winnerName: championName,
          winnerPhoto: championPhoto || '',
          finalMatchId: match.id || match.matchId,
          finalScore: championScore,
        });

        await auditService.logAction(
          'CHAMPION_CROWNED',
          'system',
          undefined,
          match.tournamentId,
          match.matchId,
          { championPlayerId: winnerId, championName, championScore }
        );

        await auditService.logAction(
          'TOURNAMENT_COMPLETED',
          'system',
          undefined,
          match.tournamentId,
          undefined,
          { championPlayerId: winnerId, totalVerified: tourn.verifiedCount }
        );

        return;
      }

      // Next round target position
      const nextRoundNum = currentRoundNum + 1;
      const currentBracketPos = match.bracketPosition || 1;
      const nextBracketPos = Math.ceil(currentBracketPos / 2);
      const isHome = currentBracketPos % 2 !== 0;

      const weekPadded = String(tourn.weekNumber).padStart(2, '0');
      const nextMatchId = `CHK-W${weekPadded}-R${nextRoundNum}-M${String(nextBracketPos).padStart(3, '0')}`;
      const nextMatchRef = doc(db, 'matches', nextMatchId);

      // Fetch winner player name & photo
      const winnerName = winnerId === match.homePlayerId ? match.homePlayerName : match.awayPlayerName;
      const winnerPhoto = winnerId === match.homePlayerId ? match.homePlayerPhoto : match.awayPlayerPhoto;

      const nextSnap = await getDoc(nextMatchRef);
      if (nextSnap.exists()) {
        const nextData = nextSnap.data() as MatchFixture;
        // Idempotency: avoid redundant write if winner is already recorded in destination slot
        if ((isHome && nextData.homePlayerId === winnerId) || (!isHome && nextData.awayPlayerId === winnerId)) {
          return;
        }
        await updateDoc(nextMatchRef, {
          ...(isHome
            ? {
                homePlayerId: winnerId,
                homePlayerUid: winnerUid,
                homePlayerName: winnerName,
                homePlayerPhoto: winnerPhoto || '',
              }
            : {
                awayPlayerId: winnerId,
                awayPlayerUid: winnerUid,
                awayPlayerName: winnerName,
                awayPlayerPhoto: winnerPhoto || '',
              }),
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create next fixture
        const nextRoundName = getDynamicRoundName(Math.pow(2, totalRounds - nextRoundNum + 1));
        const newFixture: MatchFixture = {
          id: nextMatchId,
          matchId: nextMatchId,
          tournamentId: match.tournamentId,
          roundId: `${match.tournamentId}_r${nextRoundNum}`,
          roundNumber: nextRoundNum,
          roundName: nextRoundName,
          bracketPosition: nextBracketPos,
          status: 'SCHEDULED',
          homePlayerId: isHome ? winnerId : 'TBD',
          homePlayerUid: isHome ? (winnerUid || '') : '',
          homePlayerName: isHome ? winnerName : 'TBD',
          homePlayerPhoto: isHome ? winnerPhoto || '' : '',
          awayPlayerId: !isHome ? winnerId : 'TBD',
          awayPlayerUid: !isHome ? (winnerUid || '') : '',
          awayPlayerName: !isHome ? winnerName : 'TBD',
          awayPlayerPhoto: !isHome ? winnerPhoto || '' : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(nextMatchRef, removeUndefined(newFixture));
      }
    } catch (e) {
      console.error('Error advancing winner to next round:', e);
    }
  },

  // OVERDUE CHECK (Requirement 17)
  // Find matches whose deadline passed and are still not confirmed
  async checkAndMarkOverdueMatches(tournamentId: string): Promise<MatchFixture[]> {
    try {
      const matches = await this.getTournamentMatches(tournamentId);
      const now = new Date().getTime();
      const overdueList: MatchFixture[] = [];

      for (const m of matches) {
        if (m.status !== 'CONFIRMED' && m.status !== 'DISPUTED' && m.status !== 'CANCELLED' && m.deadline) {
          const deadlineTime = new Date(m.deadline).getTime();
          if (deadlineTime < now && m.status !== 'OVERDUE') {
            await updateDoc(doc(db, 'matches', m.id), {
              status: 'OVERDUE',
              updatedAt: new Date().toISOString(),
            });
            m.status = 'OVERDUE';
            overdueList.push(m);
          } else if (m.status === 'OVERDUE') {
            overdueList.push(m);
          }
        }
      }

      return overdueList;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'matches/overdue');
    }
  },

  // ADMIN RESOLUTION: Overdue / No-Show / Disputes (Requirements 13 & 17)
  async resolveMatchAdmin(params: {
    matchId: string;
    decision: 'ADVANCE_HOME' | 'ADVANCE_AWAY' | 'REPLAY' | 'DISQUALIFY_BOTH';
    reason: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    try {
      const { matchId, decision, reason, adminUid, adminEmail } = params;
      const matchRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) throw new Error('Match not found');
      const match = snap.data() as MatchFixture;

      if (decision === 'ADVANCE_HOME') {
        await this.finalizeMatchConfirmation(matchId, 3, 0, adminUid);
      } else if (decision === 'ADVANCE_AWAY') {
        await this.finalizeMatchConfirmation(matchId, 0, 3, adminUid);
      } else if (decision === 'REPLAY') {
        await updateDoc(matchRef, {
          status: 'SCHEDULED',
          roomStatus: null,
          roomCreatedAt: null,
          homeScore: null,
          awayScore: null,
          submissions: {},
          deadline: new Date(Date.now() + 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        });
        try {
          await deleteDoc(doc(db, 'matchRooms', matchId));
        } catch {
          // ignore if room didn't exist
        }
      } else if (decision === 'DISQUALIFY_BOTH') {
        await updateDoc(matchRef, {
          status: 'CANCELLED',
          updatedAt: new Date().toISOString(),
        });
      }

      // If dispute exists, mark resolved
      const disputeQuery = query(collection(db, 'disputes'), where('matchId', '==', matchId));
      const disputeSnap = await getDocs(disputeQuery);
      disputeSnap.docs.forEach(async (dDoc) => {
        await updateDoc(dDoc.ref, {
          status: 'RESOLVED',
          resolvedAt: new Date().toISOString(),
          resolvedBy: adminUid,
          resolutionNotes: reason,
          resolutionDecision: decision,
        });
      });

      await auditService.logAction(
        'DISPUTE_RESOLVED',
        adminUid,
        adminEmail,
        match.tournamentId,
        matchId,
        { decision, reason }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${params.matchId}/admin_resolve`);
    }
  },

  // Get all disputes (Requirement 13)
  async getAllDisputes(tournamentId?: string): Promise<DisputeRecord[]> {
    try {
      const q = query(collection(db, 'disputes'));
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DisputeRecord));
      if (tournamentId) {
        list = list.filter((d) => d.tournamentId === tournamentId);
      }
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'disputes');
    }
  },

  // Report dispute by participant (Requirement 13)
  async reportDispute(
    matchIdOrParams:
      | string
      | {
          matchId: string;
          tournamentId?: string;
          reportedBy: string;
          reportedByName: string;
          reportedPlayerId: string;
          reason: any;
          notes: string;
        },
    reportedBy?: string,
    reportedByName?: string,
    reportedPlayerId?: string,
    reason?: any,
    notes?: string,
    tournamentId?: string
  ): Promise<DisputeRecord> {
    const params =
      typeof matchIdOrParams === 'object'
        ? matchIdOrParams
        : {
            matchId: matchIdOrParams,
            tournamentId: tournamentId || '',
            reportedBy: reportedBy!,
            reportedByName: reportedByName!,
            reportedPlayerId: reportedPlayerId!,
            reason: reason || 'OTHER',
            notes: notes || '',
          };

    try {
      const disputeId = `DISP_${params.matchId}_${Date.now()}`;
      const disputeRef = doc(db, 'disputes', disputeId);
      const dispute: DisputeRecord = {
        id: disputeId,
        matchId: params.matchId,
        tournamentId: params.tournamentId || '',
        reportedBy: params.reportedBy,
        reportedByName: params.reportedByName,
        reportedPlayerId: params.reportedPlayerId,
        reason: params.reason,
        notes: params.notes,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };

      const matchRef = doc(db, 'matches', params.matchId);
      const batch = writeBatch(db);
      batch.set(disputeRef, dispute);
      batch.update(matchRef, {
        status: 'DISPUTED',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await auditService.logAction(
        'RESULT_DISPUTED',
        params.reportedBy,
        undefined,
        params.tournamentId || undefined,
        params.matchId,
        { disputeId, reason: params.reason, notes: params.notes }
      );

      return dispute;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `disputes/${params.matchId}`);
    }
  },

  // Admin Resolve Dispute with official home/away scores (Requirement 13)
  async resolveDispute(
    disputeId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
    adminUid: string,
    notes?: string
  ): Promise<void> {
    try {
      // Finalize match confirmation with official scores
      await this.finalizeMatchConfirmation(matchId, homeScore, awayScore, adminUid);

      const disputeRef = doc(db, 'disputes', disputeId);
      await updateDoc(disputeRef, {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolvedBy: adminUid,
        resolutionNotes: notes || 'Admin verified evidence and determined official score',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `disputes/${disputeId}/resolve`);
    }
  },

  // Aliases for MatchRoomModal compatibility
  async setRoomNumber(matchId: string, roomNumber: string, userUid: string, isAdmin = false) {
    return this.saveRoomNumber(matchId, roomNumber, userUid, isAdmin);
  },

  async submitResult(
    matchIdOrParams:
      | string
      | {
          matchId: string;
          userUid: string;
          homeScore: number;
          awayScore: number;
          screenshotBase64?: string;
        },
    homeScore?: number,
    awayScore?: number,
    screenshotBase64?: string,
    userUid?: string,
    _playerId?: string
  ) {
    if (typeof matchIdOrParams === 'object') {
      return this.submitMatchResult(matchIdOrParams);
    }
    return this.submitMatchResult({
      matchId: matchIdOrParams,
      userUid: userUid!,
      homeScore: homeScore!,
      awayScore: awayScore!,
      screenshotBase64,
    });
  },

  async confirmResult(matchId: string, userUid: string) {
    return this.confirmMatchResult(matchId, userUid);
  },

  // Command Center: Get disputes for specific tournament
  async getTournamentDisputes(tournamentId: string): Promise<DisputeRecord[]> {
    return this.getAllDisputes(tournamentId);
  },

  // Command Center: Admin match resolution (Force Score, Walkover, Disqualify)
  async adminResolveMatch(params: {
    matchId: string;
    decision: 'SCORE_OVERRIDE' | 'WALKOVER_HOME' | 'WALKOVER_AWAY' | 'DISQUALIFY_BOTH';
    homeScore?: number;
    awayScore?: number;
    reason: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    const { matchId, decision, homeScore = 0, awayScore = 0, reason, adminUid, adminEmail } = params;

    if (decision === 'WALKOVER_HOME') {
      await this.resolveMatchAdmin({
        matchId,
        decision: 'ADVANCE_HOME',
        reason,
        adminUid,
        adminEmail,
      });
    } else if (decision === 'WALKOVER_AWAY') {
      await this.resolveMatchAdmin({
        matchId,
        decision: 'ADVANCE_AWAY',
        reason,
        adminUid,
        adminEmail,
      });
    } else if (decision === 'DISQUALIFY_BOTH') {
      await this.resolveMatchAdmin({
        matchId,
        decision: 'DISQUALIFY_BOTH',
        reason,
        adminUid,
        adminEmail,
      });
    } else {
      // SCORE_OVERRIDE
      await this.finalizeMatchConfirmation(matchId, homeScore, awayScore, adminUid);
      await auditService.logAction(
        'ADMIN_MATCH_RESOLVED' as any,
        adminUid,
        adminEmail,
        undefined,
        matchId,
        { decision, homeScore, awayScore, reason }
      );
    }
  },

  // Command Center: Reset match for rematch
  async adminResetMatchForRematch(params: {
    matchId: string;
    reason: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    await this.resolveMatchAdmin({
      matchId: params.matchId,
      decision: 'REPLAY',
      reason: params.reason,
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
    });
  },

  // Command Center: Resolve dispute
  async adminResolveDispute(params: {
    disputeId: string;
    matchId: string;
    ruling: 'UPHELD' | 'OVERTURNED';
    officialHomeScore: number;
    officialAwayScore: number;
    officialWinnerId: string;
    officialWinnerUid?: string;
    notes: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    await this.resolveDispute(
      params.disputeId,
      params.matchId,
      params.officialHomeScore,
      params.officialAwayScore,
      params.adminUid,
      params.notes
    );
  },

  // Command Center: Extend deadline
  async adminExtendMatchDeadline(params: {
    matchId: string;
    newDeadlineIso: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    const matchRef = doc(db, 'matches', params.matchId);
    await updateDoc(matchRef, {
      deadline: params.newDeadlineIso,
      updatedAt: new Date().toISOString(),
    });

    await auditService.logAction(
      'MATCH_DEADLINE_EXTENDED' as any,
      params.adminUid,
      params.adminEmail,
      undefined,
      params.matchId,
      { newDeadline: params.newDeadlineIso }
    );
  },
};
