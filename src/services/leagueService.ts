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
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, removeUndefined } from '../firebase/config';
import {
  LeagueSeason,
  LeagueMember,
  LeaguePayment,
  LeagueChallenge,
  LeagueMatch,
  LeagueDispute,
  LeagueStandingRow,
  PublicLeagueProfile,
} from '../types';
import { auditService } from './auditService';
import { googleSheetsService } from './googleSheetsService';
import { generateLeagueProfileQrDataUrl, getPublicLeagueProfileUrl } from '../utils/qrUtils';
import { gamificationService } from './gamificationService';
import { socialService } from './socialService';
import { normalizeEfootballUsername } from '../utils/usernameUtils';

export const LEAGUE_CONFIG = {
  DEFAULT_SEASON_ID: 'SEASON_01',
  DEFAULT_SEASON_NAME: 'CHUKA eFOOTBALL LEAGUE — SEASON 01',
  ENTRY_FEE: 50,
  PAYMENT_PHONE: '0111359682',
  ADMIN_ESCALATION_PHONE: '0180752220',
  DEFAULT_POINTS_WIN: 3,
  DEFAULT_POINTS_DRAW: 1,
  DEFAULT_POINTS_LOSS: 0,
};

export const leagueService = {
  // ==========================================================================
  // 1. SEASON MANAGEMENT
  // ==========================================================================

  /**
   * Get active season or bootstrap Season 01 if none exists
   */
  async getActiveSeason(): Promise<LeagueSeason> {
    try {
      const q = query(collection(db, 'leagues'), where('status', 'in', ['ACTIVE', 'OPEN']));
      const snap = await getDocs(q);

      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as LeagueSeason;
      }

      // Check if Season 01 exists
      const season1Doc = await getDoc(doc(db, 'leagues', LEAGUE_CONFIG.DEFAULT_SEASON_ID));
      if (season1Doc.exists()) {
        return { id: season1Doc.id, ...season1Doc.data() } as LeagueSeason;
      }

      // Bootstrap Season 01 default
      const defaultSeason: LeagueSeason = {
        id: LEAGUE_CONFIG.DEFAULT_SEASON_ID,
        name: LEAGUE_CONFIG.DEFAULT_SEASON_NAME,
        seasonNumber: 1,
        entryFee: LEAGUE_CONFIG.ENTRY_FEE,
        paymentDestinationPhone: LEAGUE_CONFIG.PAYMENT_PHONE,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        status: 'ACTIVE',
        pointsForWin: LEAGUE_CONFIG.DEFAULT_POINTS_WIN,
        pointsForDraw: LEAGUE_CONFIG.DEFAULT_POINTS_DRAW,
        pointsForLoss: LEAGUE_CONFIG.DEFAULT_POINTS_LOSS,
        totalMembers: 0,
        totalMatches: 0,
        publishedPrizePoolNote:
          'The KSh50 League Card activates your official membership. Any season prize pool or sponsorship is separately published.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'leagues', defaultSeason.id), defaultSeason);
      return defaultSeason;
    } catch (error) {
      console.warn('Error fetching active league season, falling back to memory default:', error);
      return {
        id: LEAGUE_CONFIG.DEFAULT_SEASON_ID,
        name: LEAGUE_CONFIG.DEFAULT_SEASON_NAME,
        seasonNumber: 1,
        entryFee: LEAGUE_CONFIG.ENTRY_FEE,
        paymentDestinationPhone: LEAGUE_CONFIG.PAYMENT_PHONE,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
        totalMembers: 0,
        totalMatches: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  /**
   * Get all seasons (current & historical)
   */
  async getAllSeasons(): Promise<LeagueSeason[]> {
    try {
      const snap = await getDocs(collection(db, 'leagues'));
      if (snap.empty) {
        const active = await this.getActiveSeason();
        return [active];
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueSeason));
      return list.sort((a, b) => b.seasonNumber - a.seasonNumber);
    } catch (e) {
      return [];
    }
  },

  /**
   * Create a new season (e.g. Season 02)
   */
  async createSeason(
    data: Omit<LeagueSeason, 'createdAt' | 'updatedAt' | 'totalMembers' | 'totalMatches'>,
    adminEmail?: string
  ): Promise<LeagueSeason> {
    const now = new Date().toISOString();
    const season: LeagueSeason = {
      ...data,
      totalMembers: 0,
      totalMatches: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'leagues', season.id), season);
    await auditService.logAction(
      'LEAGUE_SEASON_CREATED',
      adminEmail || 'admin',
      adminEmail,
      season.id,
      undefined,
      { name: season.name, fee: season.entryFee }
    );
    return season;
  },

  /**
   * Update season configuration
   */
  async updateSeason(
    seasonId: string,
    updates: Partial<LeagueSeason>,
    adminEmail?: string
  ): Promise<void> {
    const ref = doc(db, 'leagues', seasonId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    await auditService.logAction(
      'LEAGUE_SEASON_UPDATED',
      adminEmail || 'admin',
      adminEmail,
      seasonId,
      undefined,
      updates
    );
  },

  // ==========================================================================
  // 2. LEAGUE MEMBERSHIP & PARTICIPATION CARDS
  // ==========================================================================

  /**
   * Get League Member by userId and seasonId
   */
  async getLeagueMember(userId: string, seasonId: string): Promise<LeagueMember | null> {
    try {
      const q = query(
        collection(db, 'leagueMembers'),
        where('userId', '==', userId),
        where('leagueId', '==', seasonId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as LeagueMember;
    } catch (e) {
      return null;
    }
  },

  /**
   * Get League Member by playerId (e.g. CHUKA-000042) and seasonId
   */
  async getLeagueMemberByPlayerId(playerId: string, seasonId: string): Promise<LeagueMember | null> {
    try {
      const q = query(
        collection(db, 'leagueMembers'),
        where('playerId', '==', playerId),
        where('leagueId', '==', seasonId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as LeagueMember;
    } catch (e) {
      return null;
    }
  },

  /**
   * Get all League Members for a season
   */
  async getAllLeagueMembers(seasonId: string): Promise<LeagueMember[]> {
    try {
      const q = query(collection(db, 'leagueMembers'), where('leagueId', '==', seasonId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMember));
    } catch (e) {
      return [];
    }
  },

  /**
   * Alias for getAllLeagueMembers
   */
  async getLeagueMembers(seasonId: string): Promise<LeagueMember[]> {
    return this.getAllLeagueMembers(seasonId);
  },

  /**
   * Alias for getLeagueMemberByPlayerId
   */
  async getMemberByPlayerId(playerId: string, seasonId: string): Promise<LeagueMember | null> {
    return this.getLeagueMemberByPlayerId(playerId, seasonId);
  },

  /**
   * Submit KSh 50 League Membership Payment
   */
  async submitLeaguePayment(params: {
    userId: string;
    playerId: string;
    accountName: string;
    displayName: string;
    efootballUsername: string;
    photoURL?: string;
    squadImageUrl?: string;
    mpesaCode: string;
    phoneNumber: string;
    seasonId: string;
  }): Promise<{ paymentId: string; status: 'PENDING' | 'DUPLICATE_FLAGGED' }> {
    const {
      userId,
      playerId,
      accountName,
      displayName,
      efootballUsername,
      photoURL,
      squadImageUrl,
      mpesaCode,
      phoneNumber,
      seasonId,
    } = params;

    const cleanCode = mpesaCode.trim().toUpperCase();
    const codeRegex = /^[A-Z0-9]{8,12}$/;
    if (!codeRegex.test(cleanCode)) {
      throw new Error('Invalid M-Pesa transaction code format. Must be 8 to 12 alphanumeric characters.');
    }

    // Check for duplicate M-Pesa code in league payments
    const dupQ = query(
      collection(db, 'leaguePayments'),
      where('mpesaCode', '==', cleanCode)
    );
    const dupSnap = await getDocs(dupQ);
    const isSuspectedDuplicate = !dupSnap.empty;

    const paymentId = `LPAY_${seasonId}_${cleanCode}`;
    const memberDocId = `${seasonId}_${playerId}`;
    const now = new Date().toISOString();

    const safeQrData = getPublicLeagueProfileUrl(playerId);

    const paymentRecord: LeaguePayment = {
      id: paymentId,
      leagueId: seasonId,
      userId,
      playerId,
      accountName: accountName || displayName,
      amount: LEAGUE_CONFIG.ENTRY_FEE,
      currency: 'KES',
      mpesaCode: cleanCode,
      phoneNumber,
      destinationPhone: LEAGUE_CONFIG.PAYMENT_PHONE,
      status: 'PENDING',
      isSuspectedDuplicate,
      duplicateFlag: isSuspectedDuplicate,
      flaggedReason: isSuspectedDuplicate
        ? 'Duplicate M-Pesa transaction code detected in League payments registry.'
        : undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Save payment record
    await setDoc(doc(db, 'leaguePayments', paymentId), paymentRecord);

    // Create or update member doc as PENDING_PAYMENT
    const memberRef = doc(db, 'leagueMembers', memberDocId);
    const memberSnap = await getDoc(memberRef);

    const memberData: LeagueMember = {
      id: memberDocId,
      leagueId: seasonId,
      userId,
      playerId,
      displayName,
      efootballUsername,
      efootballUsernameNormalized: normalizeEfootballUsername(efootballUsername),
      photoURL: photoURL || '',
      squadImageUrl: squadImageUrl || '',
      status: memberSnap.exists() && memberSnap.data()?.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING_PAYMENT',
      joinedAt: memberSnap.exists() ? memberSnap.data()?.joinedAt || now : now,
      cardQrData: safeQrData,
      matchesPlayed: memberSnap.exists() ? memberSnap.data()?.matchesPlayed || 0 : 0,
      wins: memberSnap.exists() ? memberSnap.data()?.wins || 0 : 0,
      draws: memberSnap.exists() ? memberSnap.data()?.draws || 0 : 0,
      losses: memberSnap.exists() ? memberSnap.data()?.losses || 0 : 0,
      goalsFor: memberSnap.exists() ? memberSnap.data()?.goalsFor || 0 : 0,
      goalsAgainst: memberSnap.exists() ? memberSnap.data()?.goalsAgainst || 0 : 0,
      goalDifference: memberSnap.exists() ? memberSnap.data()?.goalDifference || 0 : 0,
      points: memberSnap.exists() ? memberSnap.data()?.points || 0 : 0,
      winRate: memberSnap.exists() ? memberSnap.data()?.winRate || 0 : 0,
      currentPosition: memberSnap.exists() ? memberSnap.data()?.currentPosition || 0 : 0,
      updatedAt: now,
    };

    await setDoc(memberRef, removeUndefined(memberData), { merge: true });

    await auditService.logAction(
      'LEAGUE_PAYMENT_SUBMITTED',
      userId,
      undefined,
      seasonId,
      undefined,
      {
        paymentId,
        playerId,
        mpesaCode: cleanCode,
        isDuplicate: isSuspectedDuplicate,
      }
    );

    return {
      paymentId,
      status: isSuspectedDuplicate ? 'DUPLICATE_FLAGGED' : 'PENDING',
    };
  },

  /**
   * Admin verifies KSh 50 League Payment & activates League Member
   */
  async verifyLeaguePayment(params: {
    paymentId: string;
    adminUid?: string;
    adminEmail?: string;
    verifiedBy?: string;
    adminNotes?: string;
  }): Promise<void> {
    const adminUid = params.adminUid || params.verifiedBy || 'admin';
    const adminEmail = params.adminEmail || params.verifiedBy;
    const { paymentId } = params;
    const paymentRef = doc(db, 'leaguePayments', paymentId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      throw new Error(`League payment ${paymentId} not found`);
    }

    const payment = paymentSnap.data() as LeaguePayment;
    const now = new Date().toISOString();

    // Update payment to VERIFIED
    await updateDoc(paymentRef, {
      status: 'VERIFIED',
      verifiedBy: adminEmail || adminUid,
      verifiedAt: now,
      updatedAt: now,
    });

    // Update member to VERIFIED
    const memberDocId = `${payment.leagueId}_${payment.playerId}`;
    const memberRef = doc(db, 'leagueMembers', memberDocId);
    await updateDoc(memberRef, {
      status: 'VERIFIED',
      verifiedBy: adminEmail || adminUid,
      verifiedAt: now,
      cardIssuedAt: now,
      updatedAt: now,
    });

    // Recompute standings so the new verified member appears in official standings immediately
    await this.recomputeLeagueStandings(payment.leagueId);

    await auditService.logAction(
      'LEAGUE_PAYMENT_VERIFIED',
      adminUid,
      adminEmail,
      payment.leagueId,
      undefined,
      { paymentId, playerId: payment.playerId }
    );

    await auditService.logAction(
      'LEAGUE_MEMBER_ACTIVATED',
      adminUid,
      adminEmail,
      payment.leagueId,
      undefined,
      { playerId: payment.playerId }
    );

    const playerName = payment.accountName || payment.playerId;

    // Social Hub Activity & In-App Notification (async, non-blocking)
    socialService
      .recordActivity({
        activityId: `ACT_JOIN_${payment.playerId}`,
        type: 'PLAYER_JOINED_LEAGUE',
        playerId: payment.playerId,
        playerUsername: playerName,
        playerDisplayName: playerName,
        message: `${playerName} activated their official KSh 50 League Card!`,
        visibility: 'PUBLIC',
        metadata: { seasonId: payment.leagueId },
      })
      .catch(() => {});

    socialService
      .createNotification({
        recipientUid: payment.userId,
        recipientPlayerId: payment.playerId,
        type: 'CARD_ACTIVATED',
        title: '🎴 League Card Activated!',
        message: 'Your official CHUKA eFOOTBALL League Card is verified and active for Season 01.',
        linkTab: 'LEAGUE',
        metadata: { seasonId: payment.leagueId },
      })
      .catch(() => {});
  },

  /**
   * Admin rejects League Payment
   */
  async rejectLeaguePayment(params: {
    paymentId: string;
    reason: string;
    adminUid?: string;
    adminEmail?: string;
    rejectedBy?: string;
  }): Promise<void> {
    const adminUid = params.adminUid || params.rejectedBy || 'admin';
    const adminEmail = params.adminEmail || params.rejectedBy;
    const { paymentId, reason } = params;
    const paymentRef = doc(db, 'leaguePayments', paymentId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      throw new Error(`League payment ${paymentId} not found`);
    }

    const payment = paymentSnap.data() as LeaguePayment;
    const now = new Date().toISOString();

    await updateDoc(paymentRef, {
      status: 'REJECTED',
      rejectionReason: reason,
      verifiedBy: adminEmail || adminUid,
      verifiedAt: now,
      updatedAt: now,
    });

    const memberDocId = `${payment.leagueId}_${payment.playerId}`;
    const memberRef = doc(db, 'leagueMembers', memberDocId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists() && memberSnap.data()?.status !== 'VERIFIED') {
      await updateDoc(memberRef, {
        status: 'REJECTED',
        updatedAt: now,
      });
    }

    await auditService.logAction(
      'LEAGUE_PAYMENT_REJECTED',
      adminUid,
      adminEmail,
      payment.leagueId,
      undefined,
      { paymentId, playerId: payment.playerId, reason }
    );
  },

  /**
   * Get all League Payments for a season
   */
  async getAllLeaguePayments(seasonId: string): Promise<LeaguePayment[]> {
    try {
      const q = query(
        collection(db, 'leaguePayments'),
        where('leagueId', '==', seasonId)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaguePayment));
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      return [];
    }
  },

  // ==========================================================================
  // 3. FIND OPPONENT & MATCH REQUESTS (CHALLENGES)
  // ==========================================================================

  /**
   * Get all verified League members eligible to be challenged
   */
  async getEligibleOpponents(currentUserId: string, seasonId: string): Promise<LeagueMember[]> {
    try {
      const q = query(
        collection(db, 'leagueMembers'),
        where('leagueId', '==', seasonId),
        where('status', '==', 'VERIFIED')
      );
      const snap = await getDocs(q);
      const allMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMember));
      return allMembers.filter((m) => m.userId !== currentUserId);
    } catch (e) {
      return [];
    }
  },

  /**
   * Create a Match Challenge
   * Strict Rule: Only verified League members, cannot challenge self, duplicate challenge check
   */
  async createChallenge(params: {
    challengerUid: string;
    challengerPlayerId: string;
    challengerName: string;
    challengerEfootball: string;
    challengedUid: string;
    challengedPlayerId: string;
    challengedName: string;
    challengedEfootball: string;
    seasonId: string;
    message?: string;
  }): Promise<LeagueChallenge> {
    const {
      challengerUid,
      challengerPlayerId,
      challengedUid,
      challengedPlayerId,
      seasonId,
      challengerName,
      challengerEfootball,
      challengedName,
      challengedEfootball,
      message,
    } = params;

    // 1. Cannot challenge self
    if (challengerUid === challengedUid || challengerPlayerId === challengedPlayerId) {
      throw new Error('You cannot challenge yourself to an official League match.');
    }

    // 2. Both must be VERIFIED League members
    const [m1, m2] = await Promise.all([
      this.getLeagueMember(challengerUid, seasonId),
      this.getLeagueMember(challengedUid, seasonId),
    ]);

    if (!m1 || m1.status !== 'VERIFIED') {
      throw new Error('You must be a verified League Member with an active KSh50 League Card to issue challenges.');
    }
    if (!m2 || m2.status !== 'VERIFIED') {
      throw new Error('The chosen opponent is not a verified League Member.');
    }

    // 3. Duplicate pending challenge protection
    const pendingQ = query(
      collection(db, 'leagueChallenges'),
      where('leagueId', '==', seasonId),
      where('challengerUid', '==', challengerUid),
      where('challengedUid', '==', challengedUid),
      where('status', '==', 'PENDING')
    );
    const pendingSnap = await getDocs(pendingQ);
    if (!pendingSnap.empty) {
      throw new Error('A pending challenge already exists with this opponent.');
    }

    const challengeId = `CHAL_${Date.now()}_${challengerPlayerId}_${challengedPlayerId}`;
    const challenge: LeagueChallenge = {
      id: challengeId,
      leagueId: seasonId,
      challengerUid,
      challengerPlayerId,
      challengerName,
      challengerEfootball,
      challengedUid,
      challengedPlayerId,
      challengedName,
      challengedEfootball,
      status: 'PENDING',
      message: message || 'I challenge you to an official CHUKA eFOOTBALL League match!',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'leagueChallenges', challengeId), challenge);

    await auditService.logAction(
      'LEAGUE_CHALLENGE_ISSUED',
      challengerUid,
      undefined,
      seasonId,
      undefined,
      { challengerPlayerId, challengedPlayerId }
    );

    // Notify challenged opponent
    socialService
      .createNotification({
        recipientUid: challengedUid,
        recipientPlayerId: challengedPlayerId,
        type: 'CHALLENGE_RECEIVED',
        title: '⚔️ New League Challenge!',
        message: `${challengerEfootball || challengerName} challenged you to an official match!`,
        linkTab: 'LEAGUE',
        metadata: { challengeId, challengerPlayerId },
      })
      .catch(() => {});

    return challenge;
  },

  /**
   * Respond to a challenge (ACCEPT or DECLINE)
   * If ACCEPTED, creates an official League Match
   */
  async respondToChallenge(params: {
    challengeId: string;
    response: 'ACCEPT' | 'DECLINE';
    userUid: string;
    seasonId: string;
  }): Promise<{ challenge: LeagueChallenge; match?: LeagueMatch }> {
    const { challengeId, response, userUid, seasonId } = params;
    const chalRef = doc(db, 'leagueChallenges', challengeId);
    const chalSnap = await getDoc(chalRef);

    if (!chalSnap.exists()) {
      throw new Error('Challenge not found');
    }

    const challenge = chalSnap.data() as LeagueChallenge;
    if (challenge.challengedUid !== userUid) {
      throw new Error('You are not authorized to respond to this challenge.');
    }
    if (challenge.status !== 'PENDING') {
      throw new Error(`This challenge is already ${challenge.status}.`);
    }

    const now = new Date().toISOString();

    if (response === 'DECLINE') {
      await updateDoc(chalRef, {
        status: 'DECLINED',
        respondedAt: now,
      });

      await auditService.logAction(
        'LEAGUE_CHALLENGE_DECLINED',
        userUid,
        undefined,
        seasonId,
        undefined,
        { challengeId }
      );

      return { challenge: { ...challenge, status: 'DECLINED', respondedAt: now } };
    }

    // ACCEPT: Confirm BOTH players are still verified League members
    const [m1, m2] = await Promise.all([
      this.getLeagueMember(challenge.challengerUid, seasonId),
      this.getLeagueMember(challenge.challengedUid, seasonId),
    ]);

    if (!m1 || m1.status !== 'VERIFIED' || !m2 || m2.status !== 'VERIFIED') {
      throw new Error('Both players must be registered League Members for this match to count.');
    }

    // Create unique League match
    const matchNumber = Date.now();
    const matchId = `LEAGUE-MATCH-${matchNumber.toString().slice(-6)}`;

    const leagueMatch: LeagueMatch = {
      id: matchId,
      leagueId: seasonId,
      matchNumber,
      homePlayerUid: challenge.challengerUid,
      homePlayerId: challenge.challengerPlayerId,
      homePlayerName: challenge.challengerName,
      homeEfootball: challenge.challengerEfootball,
      awayPlayerUid: challenge.challengedUid,
      awayPlayerId: challenge.challengedPlayerId,
      awayPlayerName: challenge.challengedName,
      awayEfootball: challenge.challengedEfootball,
      status: 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'leagueMatches', matchId), leagueMatch);

    await updateDoc(chalRef, {
      status: 'ACCEPTED',
      respondedAt: now,
      leagueMatchId: matchId,
    });

    await auditService.logAction(
      'LEAGUE_CHALLENGE_ACCEPTED',
      userUid,
      undefined,
      seasonId,
      matchId,
      { challengeId, matchId }
    );

    await auditService.logAction(
      'LEAGUE_MATCH_CREATED',
      userUid,
      undefined,
      seasonId,
      matchId,
      {
        homePlayerId: leagueMatch.homePlayerId,
        awayPlayerId: leagueMatch.awayPlayerId,
      }
    );

    return {
      challenge: { ...challenge, status: 'ACCEPTED', respondedAt: now, leagueMatchId: matchId },
      match: leagueMatch,
    };
  },

  /**
   * Get pending challenges for a user (incoming or outgoing)
   */
  async getPendingChallenges(userUid: string, seasonId: string): Promise<LeagueChallenge[]> {
    try {
      const incomingQ = query(
        collection(db, 'leagueChallenges'),
        where('leagueId', '==', seasonId),
        where('challengedUid', '==', userUid),
        where('status', '==', 'PENDING')
      );
      const outgoingQ = query(
        collection(db, 'leagueChallenges'),
        where('leagueId', '==', seasonId),
        where('challengerUid', '==', userUid),
        where('status', '==', 'PENDING')
      );

      const [inSnap, outSnap] = await Promise.all([getDocs(incomingQ), getDocs(outgoingQ)]);
      const combined = [
        ...inSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueChallenge)),
        ...outSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueChallenge)),
      ];

      return combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      return [];
    }
  },

  /**
   * Get all challenges for a season
   */
  async getSeasonChallenges(seasonId: string): Promise<LeagueChallenge[]> {
    try {
      const q = query(
        collection(db, 'leagueChallenges'),
        where('leagueId', '==', seasonId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueChallenge));
    } catch {
      return [];
    }
  },

  // ==========================================================================
  // 4. LEAGUE MATCHES & RESULT DUAL CONFIRMATION
  // ==========================================================================

  /**
   * Get all League matches for a season with optional status filter
   */
  async getLeagueMatches(seasonId: string, filter?: string): Promise<LeagueMatch[]> {
    try {
      const q = query(
        collection(db, 'leagueMatches'),
        where('leagueId', '==', seasonId)
      );
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMatch));

      if (filter && filter !== 'ALL') {
        if (filter === 'ACTIVE') {
          list = list.filter((m) => ['SCHEDULED', 'ROOM_READY', 'PLAYING'].includes(m.status));
        } else if (filter === 'PENDING_CONFIRMATION') {
          list = list.filter((m) => m.status === 'AWAITING_OPPONENT_CONFIRMATION');
        } else {
          list = list.filter((m) => m.status === filter);
        }
      }

      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      return [];
    }
  },

  /**
   * Get League matches for a specific player
   */
  async getPlayerLeagueMatches(playerId: string, seasonId: string): Promise<LeagueMatch[]> {
    try {
      const homeQ = query(
        collection(db, 'leagueMatches'),
        where('leagueId', '==', seasonId),
        where('homePlayerId', '==', playerId)
      );
      const awayQ = query(
        collection(db, 'leagueMatches'),
        where('leagueId', '==', seasonId),
        where('awayPlayerId', '==', playerId)
      );

      const [homeSnap, awaySnap] = await Promise.all([getDocs(homeQ), getDocs(awayQ)]);
      const combined = [
        ...homeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMatch)),
        ...awaySnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMatch)),
      ];

      return combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      return [];
    }
  },

  /**
   * Get specific match by ID
   */
  async getLeagueMatch(matchId: string): Promise<LeagueMatch | null> {
    try {
      const snap = await getDoc(doc(db, 'leagueMatches', matchId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as LeagueMatch;
    } catch (e) {
      return null;
    }
  },

  /**
   * Update Match Room Number (6 numeric digits)
   */
  async updateMatchRoom(params: {
    matchId: string;
    roomNumber: string;
    userUid: string;
  }): Promise<void> {
    const { matchId, roomNumber, userUid } = params;
    const cleanRoom = roomNumber.trim();

    if (!/^\d{6}$/.test(cleanRoom)) {
      throw new Error('Room number must be exactly 6 numeric digits.');
    }

    const matchRef = doc(db, 'leagueMatches', matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) throw new Error('Match not found');

    const match = matchSnap.data() as LeagueMatch;
    if (match.homePlayerUid !== userUid && match.awayPlayerUid !== userUid) {
      throw new Error('You are not a participant in this match.');
    }

    const now = new Date().toISOString();
    await updateDoc(matchRef, {
      roomNumber: cleanRoom,
      roomHostUid: userUid,
      roomCreatedAt: now,
      status: 'ROOM_READY',
      updatedAt: now,
    });
  },

  /**
   * Submit Match Result (Either player can submit)
   * The submitter CANNOT self-confirm. Sets status to AWAITING_OPPONENT_CONFIRMATION.
   */
  async submitLeagueMatchResult(params: {
    matchId: string;
    homeScore: number;
    awayScore: number;
    evidenceUrl?: string;
    submitterUid: string;
  }): Promise<void> {
    const { matchId, homeScore, awayScore, evidenceUrl, submitterUid } = params;

    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0 ||
      homeScore > 50 ||
      awayScore > 50
    ) {
      throw new Error('Scores must be valid non-negative integers between 0 and 50.');
    }

    const matchRef = doc(db, 'leagueMatches', matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) throw new Error('Match not found');

    const match = matchSnap.data() as LeagueMatch;

    if (match.status === 'CONFIRMED') {
      throw new Error('This match result is already confirmed and finalized.');
    }

    if (match.homePlayerUid !== submitterUid && match.awayPlayerUid !== submitterUid) {
      throw new Error('You are not a registered participant in this match.');
    }

    // Hard Rule: Check both players are verified members
    const [m1, m2] = await Promise.all([
      this.getLeagueMember(match.homePlayerUid, match.leagueId),
      this.getLeagueMember(match.awayPlayerUid, match.leagueId),
    ]);

    if (!m1 || m1.status !== 'VERIFIED' || !m2 || m2.status !== 'VERIFIED') {
      throw new Error('Both players must be registered League Members for this match to count.');
    }

    const submitterPlayerId =
      match.homePlayerUid === submitterUid ? match.homePlayerId : match.awayPlayerId;

    const now = new Date().toISOString();

    await updateDoc(
      matchRef,
      removeUndefined({
        homeScore,
        awayScore,
        evidenceUrl: evidenceUrl || '',
        submittedByUid: submitterUid,
        submittedByPlayerId: submitterPlayerId,
        submittedAt: now,
        status: 'AWAITING_OPPONENT_CONFIRMATION',
        updatedAt: now,
      })
    );

    await auditService.logAction(
      'LEAGUE_RESULT_SUBMITTED',
      submitterUid,
      undefined,
      match.leagueId,
      matchId,
      { homeScore, awayScore, submitterPlayerId }
    );
  },

  /**
   * Opponent confirms match result
   * Both players agree -> Status becomes CONFIRMED -> League standings updated idempotently.
   */
  async confirmLeagueMatchResult(params: {
    matchId: string;
    confirmerUid: string;
  }): Promise<void> {
    const { matchId, confirmerUid } = params;
    const matchRef = doc(db, 'leagueMatches', matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) throw new Error('Match not found');

    const match = matchSnap.data() as LeagueMatch;

    if (match.status !== 'AWAITING_OPPONENT_CONFIRMATION') {
      throw new Error(`Cannot confirm result in current status (${match.status}).`);
    }

    // Anti-Abuse: Submitter CANNOT self-confirm
    if (match.submittedByUid === confirmerUid) {
      throw new Error('The submitting player cannot self-confirm the result. The opponent must confirm.');
    }

    // Confirmer must be the other participant
    if (match.homePlayerUid !== confirmerUid && match.awayPlayerUid !== confirmerUid) {
      throw new Error('You are not the opponent in this match.');
    }

    // Both players must be VERIFIED League members
    const [m1, m2] = await Promise.all([
      this.getLeagueMember(match.homePlayerUid, match.leagueId),
      this.getLeagueMember(match.awayPlayerUid, match.leagueId),
    ]);

    if (!m1 || m1.status !== 'VERIFIED' || !m2 || m2.status !== 'VERIFIED') {
      throw new Error('Both players must be registered League Members for this match to count.');
    }

    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;

    let winnerPlayerId: string | 'DRAW' = 'DRAW';
    let winnerUid: string | 'DRAW' = 'DRAW';

    if (homeScore > awayScore) {
      winnerPlayerId = match.homePlayerId;
      winnerUid = match.homePlayerUid;
    } else if (awayScore > homeScore) {
      winnerPlayerId = match.awayPlayerId;
      winnerUid = match.awayPlayerUid;
    }

    const now = new Date().toISOString();

    // Idempotency: ensure isStatsApplied is flagged so points are never duplicated
    await updateDoc(matchRef, {
      status: 'CONFIRMED',
      winnerPlayerId,
      winnerUid,
      confirmedAt: now,
      confirmedByUid: confirmerUid,
      isStatsApplied: true,
      updatedAt: now,
    });

    // Recompute standings and stats for all members in the season
    await this.recomputeLeagueStandings(match.leagueId);

    // Gamification Engine: Evaluate achievements for this confirmed league match
    try {
      await gamificationService.evaluateMatchAchievements({
        match: { ...match, homeScore, awayScore, status: 'CONFIRMED' },
        homeMember: m1,
        awayMember: m2,
        homePreRank: m1.currentPosition,
        awayPreRank: m2.currentPosition,
      });
    } catch (gamifyErr) {
      console.warn('Gamification evaluation notice on match confirm:', gamifyErr);
    }

    await auditService.logAction(
      'LEAGUE_RESULT_CONFIRMED',
      confirmerUid,
      undefined,
      match.leagueId,
      matchId,
      { homeScore, awayScore, winnerPlayerId }
    );

    // Social Hub Activity & Notifications (async, non-blocking)
    socialService
      .recordActivity({
        activityId: `ACT_MATCH_${matchId}`,
        type: 'MATCH_CONFIRMED',
        playerId: match.homePlayerId,
        playerUsername: match.homeEfootballUsername,
        playerDisplayName: match.homePlayerName,
        relatedPlayerId: match.awayPlayerId,
        relatedPlayerUsername: match.awayEfootballUsername,
        relatedPlayerDisplayName: match.awayPlayerName,
        matchId: match.id,
        seasonId: match.leagueId,
        message: `${match.homeEfootballUsername || match.homePlayerName} ${homeScore} – ${awayScore} ${match.awayEfootballUsername || match.awayPlayerName}`,
        metadata: {
          scoreDisplay: `${homeScore} – ${awayScore}`,
          homeScore,
          awayScore,
          winnerPlayerId,
        },
        visibility: 'PUBLIC',
      })
      .catch(() => {});

    if (match.submittedByUid) {
      socialService
        .createNotification({
          recipientUid: match.submittedByUid,
          recipientPlayerId: match.submittedByPlayerId || '',
          type: 'RESULT_CONFIRMED',
          title: '✅ Match Result Confirmed!',
          message: `Your match result (${homeScore} – ${awayScore}) has been confirmed by your opponent.`,
          linkTab: 'LEAGUE',
          metadata: { matchId: match.id },
        })
        .catch(() => {});
    }
  },

  // ==========================================================================
  // 5. DISPUTES
  // ==========================================================================

  /**
   * Opponent disputes the submitted result
   */
  async disputeLeagueMatchResult(params: {
    matchId: string;
    reportedByUid: string;
    reason: LeagueDispute['reason'];
    explanation: string;
    evidenceUrl?: string;
  }): Promise<LeagueDispute> {
    const { matchId, reportedByUid, reason, explanation, evidenceUrl } = params;
    const matchRef = doc(db, 'leagueMatches', matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) throw new Error('Match not found');

    const match = matchSnap.data() as LeagueMatch;
    if (match.homePlayerUid !== reportedByUid && match.awayPlayerUid !== reportedByUid) {
      throw new Error('You are not a participant in this match.');
    }

    const reportedByPlayerId =
      match.homePlayerUid === reportedByUid ? match.homePlayerId : match.awayPlayerId;

    const disputeId = `DISP_${matchId}_${Date.now()}`;
    const dispute: LeagueDispute = {
      id: disputeId,
      leagueId: match.leagueId,
      matchId,
      reportedByUid,
      reportedByPlayerId,
      reason,
      explanation,
      evidenceUrl: evidenceUrl || '',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'leagueDisputes', disputeId), removeUndefined(dispute));

    // Match status moves to DISPUTED -> standings DO NOT update!
    await updateDoc(matchRef, {
      status: 'DISPUTED',
      updatedAt: new Date().toISOString(),
    });

    await auditService.logAction(
      'LEAGUE_RESULT_DISPUTED',
      reportedByUid,
      undefined,
      match.leagueId,
      matchId,
      { disputeId, reason }
    );

    // Notify opponent
    const targetUid = reportedByUid === match.homePlayerUid ? match.awayPlayerUid : match.homePlayerUid;
    const targetPlayerId = reportedByUid === match.homePlayerUid ? match.awayPlayerId : match.homePlayerId;
    if (targetUid) {
      socialService
        .createNotification({
          recipientUid: targetUid,
          recipientPlayerId: targetPlayerId,
          type: 'RESULT_DISPUTED',
          title: '⚠️ Match Result Disputed',
          message: `The submitted result for your match was disputed. An administrator will review screenshot evidence.`,
          linkTab: 'LEAGUE',
          metadata: { matchId, disputeId },
        })
        .catch(() => {});
    }

    return dispute;
  },

  /**
   * Admin resolves League Dispute
   */
  async adminResolveLeagueDispute(params: {
    disputeId: string;
    matchId: string;
    ruling: LeagueDispute['adminRuling'];
    officialHomeScore?: number;
    officialAwayScore?: number;
    adminNotes?: string;
    adminUid: string;
    adminEmail?: string;
  }): Promise<void> {
    const {
      disputeId,
      matchId,
      ruling,
      officialHomeScore,
      officialAwayScore,
      adminNotes,
      adminUid,
      adminEmail,
    } = params;

    const disputeRef = doc(db, 'leagueDisputes', disputeId);
    const matchRef = doc(db, 'leagueMatches', matchId);

    const [disputeSnap, matchSnap] = await Promise.all([getDoc(disputeRef), getDoc(matchRef)]);
    if (!disputeSnap.exists()) throw new Error('Dispute not found');
    if (!matchSnap.exists()) throw new Error('Match not found');

    const match = matchSnap.data() as LeagueMatch;
    const now = new Date().toISOString();

    if (ruling === 'VOID_MATCH') {
      await updateDoc(matchRef, {
        status: 'VOID',
        updatedAt: now,
      });
    } else if (ruling === 'REQUEST_REPLAY') {
      await updateDoc(matchRef, {
        status: 'ROOM_READY',
        homeScore: null,
        awayScore: null,
        submittedByUid: null,
        submittedByPlayerId: null,
        submittedAt: null,
        updatedAt: now,
      });
    } else {
      // Score override / confirmation
      const hScore =
        officialHomeScore !== undefined
          ? officialHomeScore
          : ruling === 'CONFIRM_HOME_WIN'
          ? 3
          : ruling === 'CONFIRM_AWAY_WIN'
          ? 0
          : 1;
      const aScore =
        officialAwayScore !== undefined
          ? officialAwayScore
          : ruling === 'CONFIRM_AWAY_WIN'
          ? 3
          : ruling === 'CONFIRM_HOME_WIN'
          ? 0
          : 1;

      const winnerPlayerId =
        hScore > aScore
          ? match.homePlayerId
          : aScore > hScore
          ? match.awayPlayerId
          : 'DRAW';

      const winnerUid =
        hScore > aScore
          ? match.homePlayerUid
          : aScore > hScore
          ? match.awayPlayerUid
          : 'DRAW';

      await updateDoc(matchRef, {
        homeScore: hScore,
        awayScore: aScore,
        winnerPlayerId,
        winnerUid,
        status: 'CONFIRMED',
        confirmedAt: now,
        confirmedByUid: adminUid,
        isStatsApplied: true,
        updatedAt: now,
      });

      // Recalculate standings with the new result
      await this.recomputeLeagueStandings(match.leagueId);

      // Evaluate gamification achievements for this newly confirmed match
      try {
        const [m1, m2] = await Promise.all([
          this.getLeagueMember(match.homePlayerUid, match.leagueId),
          this.getLeagueMember(match.awayPlayerUid, match.leagueId),
        ]);
        if (m1 && m2) {
          await gamificationService.evaluateMatchAchievements({
            match: { ...match, homeScore: hScore, awayScore: aScore, status: 'CONFIRMED' },
            homeMember: m1,
            awayMember: m2,
            homePreRank: m1.currentPosition,
            awayPreRank: m2.currentPosition,
          });
        }
      } catch (gamifyErr) {
        console.warn('Gamification evaluation notice on dispute resolution:', gamifyErr);
      }
    }

    await updateDoc(disputeRef, {
      status: 'RESOLVED',
      adminRuling: ruling,
      officialHomeScore: officialHomeScore ?? null,
      officialAwayScore: officialAwayScore ?? null,
      adminNotes: adminNotes || '',
      resolvedBy: adminEmail || adminUid,
      resolvedAt: now,
    });

    await auditService.logAction(
      'LEAGUE_DISPUTE_RESOLVED',
      adminUid,
      adminEmail,
      match.leagueId,
      matchId,
      { disputeId, ruling, adminNotes }
    );
  },

  /**
   * Get all disputes for a season
   */
  async getLeagueDisputes(seasonId: string): Promise<LeagueDispute[]> {
    try {
      const q = query(
        collection(db, 'leagueDisputes'),
        where('leagueId', '==', seasonId)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueDispute));
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      return [];
    }
  },

  // ==========================================================================
  // 6. STANDINGS CALCULATION (DERIVED STRICTLY FROM CONFIRMED MATCHES)
  // ==========================================================================

  /**
   * Recompute League Standings & Update Member Cached Stats
   *
   * Scoring system (configurable per season):
   * WIN = 3 PTS, DRAW = 1 PT, LOSS = 0 PTS
   *
   * Ranking tie-breaker order:
   * 1. Points (descending)
   * 2. Goal Difference (descending)
   * 3. Goals For (descending)
   * 4. Wins (descending)
   * 5. Deterministic Player ID (ascending)
   */
  async recomputeLeagueStandings(seasonId: string): Promise<LeagueStandingRow[]> {
    try {
      // 1. Get season configuration for points
      const seasonDoc = await getDoc(doc(db, 'leagues', seasonId));
      const season = seasonDoc.exists() ? (seasonDoc.data() as LeagueSeason) : null;
      const ptsWin = season?.pointsForWin ?? 3;
      const ptsDraw = season?.pointsForDraw ?? 1;
      const ptsLoss = season?.pointsForLoss ?? 0;

      // 2. Fetch all VERIFIED members
      const members = await this.getAllLeagueMembers(seasonId);
      const verifiedMembers = members.filter((m) => m.status === 'VERIFIED');

      // 3. Fetch all CONFIRMED matches for this season
      const matchQ = query(
        collection(db, 'leagueMatches'),
        where('leagueId', '==', seasonId),
        where('status', '==', 'CONFIRMED')
      );
      const matchSnap = await getDocs(matchQ);
      const confirmedMatches = matchSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMatch));

      // 4. Initialize stat map for each verified member
      interface PlayerStatAcc {
        playerId: string;
        userId: string;
        displayName: string;
        efootballUsername: string;
        photoURL?: string;
        squadImageUrl?: string;
        matchesPlayed: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        points: number;
        recentForm: Array<'W' | 'D' | 'L'>;
        cleanSheets: number;
      }

      const memberMap = new Map<string, LeagueMember>();
      const statsMap = new Map<string, PlayerStatAcc>();
      for (const m of verifiedMembers) {
        memberMap.set(m.playerId, m);
        statsMap.set(m.playerId, {
          playerId: m.playerId,
          userId: m.userId,
          displayName: m.displayName,
          efootballUsername: m.efootballUsername,
          photoURL: m.photoURL,
          squadImageUrl: m.squadImageUrl,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          recentForm: [],
          cleanSheets: 0,
        });
      }

      // Sort confirmed matches chronologically to calculate accurate recent form & streaks
      const sortedMatches = [...confirmedMatches].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // 5. Aggregate match results
      for (const match of sortedMatches) {
        const homeScore = match.homeScore ?? 0;
        const awayScore = match.awayScore ?? 0;

        const homeStat = statsMap.get(match.homePlayerId);
        const awayStat = statsMap.get(match.awayPlayerId);

        if (homeStat) {
          homeStat.matchesPlayed += 1;
          homeStat.goalsFor += homeScore;
          homeStat.goalsAgainst += awayScore;

          if (awayScore === 0) {
            homeStat.cleanSheets += 1;
          }

          if (homeScore > awayScore) {
            homeStat.wins += 1;
            homeStat.points += ptsWin;
            homeStat.recentForm.push('W');
          } else if (homeScore === awayScore) {
            homeStat.draws += 1;
            homeStat.points += ptsDraw;
            homeStat.recentForm.push('D');
          } else {
            homeStat.losses += 1;
            homeStat.points += ptsLoss;
            homeStat.recentForm.push('L');
          }
        }

        if (awayStat) {
          awayStat.matchesPlayed += 1;
          awayStat.goalsFor += awayScore;
          awayStat.goalsAgainst += homeScore;

          if (homeScore === 0) {
            awayStat.cleanSheets += 1;
          }

          if (awayScore > homeScore) {
            awayStat.wins += 1;
            awayStat.points += ptsWin;
            awayStat.recentForm.push('W');
          } else if (awayScore === homeScore) {
            awayStat.draws += 1;
            awayStat.points += ptsDraw;
            awayStat.recentForm.push('D');
          } else {
            awayStat.losses += 1;
            awayStat.points += ptsLoss;
            awayStat.recentForm.push('L');
          }
        }
      }

      // 6. Convert to list and compute Goal Difference, Win Rate, and Streaks
      const rows: LeagueStandingRow[] = [];
      for (const stat of statsMap.values()) {
        const gd = stat.goalsFor - stat.goalsAgainst;
        const winRate =
          stat.matchesPlayed > 0 ? Math.round((stat.wins / stat.matchesPlayed) * 100) : 0;
        const last5 = stat.recentForm.slice(-5);
        const streakInfo = gamificationService.calculateStreaks(stat.recentForm);

        rows.push({
          position: 0, // Assigned after sort
          playerId: stat.playerId,
          userId: stat.userId,
          displayName: stat.displayName,
          efootballUsername: stat.efootballUsername,
          photoURL: stat.photoURL,
          squadImageUrl: stat.squadImageUrl,
          matchesPlayed: stat.matchesPlayed,
          wins: stat.wins,
          draws: stat.draws,
          losses: stat.losses,
          goalsFor: stat.goalsFor,
          goalsAgainst: stat.goalsAgainst,
          goalDifference: gd,
          points: stat.points,
          winRate,
          recentForm: last5,
          currentStreak: streakInfo.currentStreak,
          longestWinStreak: streakInfo.longestWinStreak,
          streakDisplay: streakInfo.streakDisplay,
          cleanSheets: stat.cleanSheets,
        });
      }

      // 7. Sort using strict documented tie-breaker hierarchy:
      // 1. Points (descending)
      // 2. Goal Difference (descending)
      // 3. Goals For (descending)
      // 4. Wins (descending)
      // 5. Deterministic Player ID (ascending)
      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.playerId.localeCompare(b.playerId);
      });

      // 8. Assign positions, compute ranking movement and titles, and update Firestore
      const batch = writeBatch(db);
      let batchCount = 0;

      rows.forEach((row, index) => {
        const pos = index + 1;
        row.position = pos;

        const origMember = memberMap.get(row.playerId);
        const prevPos = origMember?.currentPosition;
        row.previousPosition = prevPos;
        row.rankingMovement = gamificationService.computeRankingMovement(pos, prevPos);

        const titles = gamificationService
          .computePlayerTitles({
            matchesPlayed: row.matchesPlayed,
            wins: row.wins,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            currentStreak: row.currentStreak || 0,
            cleanSheets: row.cleanSheets || 0,
          })
          .map((t) => t.title);
        row.titles = titles;

        const memberDocId = `${seasonId}_${row.playerId}`;
        const memberRef = doc(db, 'leagueMembers', memberDocId);
        batch.update(
          memberRef,
          removeUndefined({
            matchesPlayed: row.matchesPlayed,
            wins: row.wins,
            draws: row.draws,
            losses: row.losses,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            points: row.points,
            winRate: row.winRate,
            currentPosition: pos,
            previousPosition: prevPos,
            currentStreak: row.currentStreak,
            longestWinStreak: row.longestWinStreak,
            cleanSheets: row.cleanSheets,
            titles,
            updatedAt: new Date().toISOString(),
          })
        );
        batchCount++;
      });

      if (batchCount > 0 && auth.currentUser) {
        try {
          await batch.commit();
        } catch (commitErr) {
          console.warn('Standings batch sync to Firestore skipped/deferred:', commitErr);
        }
      }

      return rows;
    } catch (e) {
      console.error('Error recomputing league standings:', e);
      return [];
    }
  },

  /**
   * Get current standings for a season
   */
  async getLeagueStandings(seasonId: string): Promise<LeagueStandingRow[]> {
    return this.recomputeLeagueStandings(seasonId);
  },

  // ==========================================================================
  // 7. PUBLIC QR PROFILE (SAFE ZERO-PII EXPOSURE)
  // ==========================================================================

  /**
   * Fetch Public League Profile for QR scanning / public link
   * Strictly omits phone numbers, WhatsApp, M-Pesa details, UIDs, and private notes.
   */
  async getPublicLeagueProfile(
    playerId: string,
    seasonId: string
  ): Promise<PublicLeagueProfile | null> {
    try {
      const member = await this.getLeagueMemberByPlayerId(playerId, seasonId);
      if (!member) return null;

      // Get player matches for last 5 results
      const matches = await this.getPlayerLeagueMatches(playerId, seasonId);
      const confirmedMatches = matches.filter((m) => m.status === 'CONFIRMED');

      const recentMatches = confirmedMatches.slice(0, 5).map((m) => {
        const isHome = m.homePlayerId === playerId;
        const myScore = isHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
        const oppScore = isHome ? m.awayScore ?? 0 : m.homeScore ?? 0;
        const oppName = isHome ? m.awayPlayerName : m.homePlayerName;
        const oppId = isHome ? m.awayPlayerId : m.homePlayerId;

        let res: 'W' | 'D' | 'L' = 'D';
        if (myScore > oppScore) res = 'W';
        else if (myScore < oppScore) res = 'L';

        return {
          matchId: m.id,
          opponentName: oppName,
          opponentPlayerId: oppId,
          result: res,
          scoreDisplay: `${myScore} – ${oppScore}`,
          date: m.confirmedAt || m.createdAt,
        };
      });

      // Fetch achievements for player
      const achievements = await gamificationService.getPlayerAchievements(playerId);

      const recentResults: Array<'W' | 'D' | 'L'> = recentMatches.map((m) => m.result);
      const streakInfo = gamificationService.calculateStreaks(recentResults);

      const rankingMovement = gamificationService.computeRankingMovement(
        member.currentPosition,
        member.previousPosition
      );

      const titles =
        member.titles && member.titles.length > 0
          ? member.titles
          : gamificationService
              .computePlayerTitles({
                matchesPlayed: member.matchesPlayed || 0,
                wins: member.wins || 0,
                goalsFor: member.goalsFor || 0,
                goalsAgainst: member.goalsAgainst || 0,
                currentStreak: member.currentStreak || streakInfo.currentStreak,
                cleanSheets: member.cleanSheets || 0,
              })
              .map((t) => t.title);

      return {
        playerId: member.playerId,
        displayName: member.displayName,
        efootballUsername: member.efootballUsername,
        photoURL: member.photoURL,
        squadImageUrl: member.squadImageUrl,
        currentPosition: member.currentPosition || 0,
        previousPosition: member.previousPosition,
        rankingMovement,
        matchesPlayed: member.matchesPlayed || 0,
        wins: member.wins || 0,
        draws: member.draws || 0,
        losses: member.losses || 0,
        goalsFor: member.goalsFor || 0,
        goalsAgainst: member.goalsAgainst || 0,
        goalDifference: member.goalDifference || 0,
        points: member.points || 0,
        winRate: member.winRate || 0,
        currentStreak: member.currentStreak ?? streakInfo.currentStreak,
        longestWinStreak: member.longestWinStreak ?? streakInfo.longestWinStreak,
        streakDisplay: member.currentStreak ? `${member.currentStreak > 0 ? '+' : ''}${member.currentStreak}` : streakInfo.streakDisplay,
        cleanSheets: member.cleanSheets || 0,
        titles,
        achievements,
        recentMatches,
        isVerifiedMember: member.status === 'VERIFIED',
        memberSince: member.verifiedAt || member.joinedAt,
      };
    } catch (e) {
      return null;
    }
  },

  // ==========================================================================
  // 8. GOOGLE SHEETS SYNCHRONIZATION
  // ==========================================================================

  /**
   * Sync complete League dataset to Google Sheets reporting layer
   */
  async syncLeagueToGoogleSheets(
    seasonId: string,
    adminEmail?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const [season, members, payments, matches, disputes] = await Promise.all([
        this.getActiveSeason(),
        this.getAllLeagueMembers(seasonId),
        this.getAllLeaguePayments(seasonId),
        this.getLeagueMatches(seasonId),
        this.getLeagueDisputes(seasonId),
      ]);

      const standings = await this.recomputeLeagueStandings(seasonId);

      // Build payload for Google Sheets sync
      const payload = {
        sheetType: 'CHUKA_LEAGUE_EXPORT',
        seasonId,
        timestamp: new Date().toISOString(),
        season: {
          id: season.id,
          name: season.name,
          entryFee: season.entryFee,
          status: season.status,
          totalMembers: members.length,
          totalMatches: matches.length,
        },
        members: members.map((m) => ({
          playerId: m.playerId,
          displayName: m.displayName,
          efootballUsername: m.efootballUsername,
          status: m.status,
          position: m.currentPosition,
          points: m.points,
          wins: m.wins,
          draws: m.draws,
          losses: m.losses,
          joinedAt: m.joinedAt,
        })),
        standings: standings.map((s) => ({
          position: s.position,
          playerId: s.playerId,
          displayName: s.displayName,
          efootballUsername: s.efootballUsername,
          mp: s.matchesPlayed,
          w: s.wins,
          d: s.draws,
          l: s.losses,
          gf: s.goalsFor,
          ga: s.goalsAgainst,
          gd: s.goalDifference,
          points: s.points,
          winRate: `${s.winRate}%`,
        })),
        payments: payments.map((p) => ({
          paymentId: p.id,
          playerId: p.playerId,
          accountName: p.accountName,
          amount: p.amount,
          mpesaCode: p.mpesaCode,
          status: p.status,
          createdAt: p.createdAt,
        })),
        matches: matches.map((m) => ({
          matchId: m.id,
          homePlayerId: m.homePlayerId,
          homePlayerName: m.homePlayerName,
          awayPlayerId: m.awayPlayerId,
          awayPlayerName: m.awayPlayerName,
          status: m.status,
          homeScore: m.homeScore ?? '',
          awayScore: m.awayScore ?? '',
          winnerPlayerId: m.winnerPlayerId ?? '',
        })),
        disputes: disputes.map((d) => ({
          disputeId: d.id,
          matchId: d.matchId,
          reportedByPlayerId: d.reportedByPlayerId,
          reason: d.reason,
          status: d.status,
          ruling: d.adminRuling ?? '',
        })),
      };

      const result = await googleSheetsService.appendCustomReport(payload);

      await auditService.logAction(
        'LEAGUE_SHEETS_SYNCED',
        adminEmail || 'admin',
        adminEmail,
        seasonId,
        undefined,
        { memberCount: members.length, matchCount: matches.length }
      );

      return {
        success: result.success,
        message: result.message || 'League data successfully synced to Google Sheets reporting layer.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Error syncing League to Google Sheets.',
      };
    }
  },

  // Convenience aliases for views and admin sections
  async getSeasonStandings(seasonId: string): Promise<LeagueStandingRow[]> {
    return this.getLeagueStandings(seasonId);
  },
  async getSeasonMatches(seasonId: string, filter?: string): Promise<LeagueMatch[]> {
    return this.getLeagueMatches(seasonId, filter);
  },
  async getMemberByUserId(userId: string, seasonId: string): Promise<LeagueMember | null> {
    return this.getLeagueMember(userId, seasonId);
  },
  async getPendingPayments(seasonId: string): Promise<LeaguePayment[]> {
    return this.getPendingLeaguePayments(seasonId);
  },
  async getDisputes(seasonId: string): Promise<LeagueDispute[]> {
    return this.getLeagueDisputes(seasonId);
  },
  async resolveLeagueDispute(params: {
    disputeId: string;
    matchId: string;
    resolvedBy?: string;
    ruling?: string;
    newStatus?: 'CONFIRMED' | 'VOIDED';
    finalHomeScore?: number;
    finalAwayScore?: number;
    notes?: string;
    adminUid?: string;
    adminEmail?: string;
  }): Promise<void> {
    const adminUid = params.adminUid || params.resolvedBy || 'admin';
    const adminEmail = params.adminEmail || params.resolvedBy;
    let ruling: LeagueDispute['adminRuling'] = 'VOID_MATCH';
    if (params.newStatus === 'CONFIRMED') {
      const h = params.finalHomeScore ?? 0;
      const a = params.finalAwayScore ?? 0;
      if (h > a) ruling = 'CONFIRM_HOME_WIN';
      else if (a > h) ruling = 'CONFIRM_AWAY_WIN';
      else ruling = 'CONFIRM_DRAW';
    } else if (params.newStatus === 'VOIDED') {
      ruling = 'VOID_MATCH';
    }
    return this.adminResolveLeagueDispute({
      disputeId: params.disputeId,
      matchId: params.matchId,
      ruling,
      officialHomeScore: params.finalHomeScore,
      officialAwayScore: params.finalAwayScore,
      adminNotes: params.notes || params.ruling,
      adminUid,
      adminEmail,
    });
  },
};
