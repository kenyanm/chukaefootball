import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  SocialActivity,
  SocialActivityType,
  CommunityPost,
  CommunityPostType,
  CommunityReport,
  ReportReason,
  UserBlock,
  InAppNotification,
  NotificationType,
  PlayerRivalrySummary,
  LeagueMember,
  LeagueMatch,
  UserProfile,
} from '../types';
import { normalizeUsername } from '../utils/usernameUtils';

export interface PublicSearchResult {
  playerId: string;
  efootballUsername: string;
  displayName: string;
  photoURL?: string;
  position: number;
  points: number;
  form: string[];
  streak: number;
  isVerifiedMember: boolean;
}

// Regex to guard against leaking sensitive contact info / M-Pesa transaction codes in public posts
const SENSITIVE_INFO_REGEX = /(\+?254\s?7\d{8}|07\d{8}|01\d{8}|[A-Z0-9]{10}\b|mpesa|m-pesa)/i;

export const socialService = {
  // ==========================================================================
  // 1. SOCIAL ACTIVITY (FACTUAL SYSTEM-GENERATED EVENTS)
  // ==========================================================================

  /**
   * Records an authoritative social activity event into Firestore.
   * Uses deterministic document IDs to prevent duplication of system events.
   */
  async recordActivity(
    activity: Omit<SocialActivity, 'createdAt' | 'timestamp'> & { activityId?: string }
  ): Promise<string> {
    const actId =
      activity.activityId ||
      `ACT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, 'socialActivity', actId);

    // Sanitize message: clamp to 250 characters and strip linebreaks
    const safeMessage = activity.message
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 250);

    const data: SocialActivity = {
      ...activity,
      activityId: actId,
      message: safeMessage,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      visibility: activity.visibility || 'PUBLIC',
    };

    await setDoc(docRef, data, { merge: true });
    return actId;
  },

  /**
   * Fetches recent social activity events.
   */
  async getRecentActivities(limitCount = 25): Promise<SocialActivity[]> {
    try {
      const q = query(
        collection(db, 'socialActivity'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as SocialActivity);
    } catch (err) {
      console.warn('Unable to load social activity with timestamp index, falling back:', err);
      try {
        const snap = await getDocs(query(collection(db, 'socialActivity'), limit(limitCount)));
        const list = snap.docs.map((d) => d.data() as SocialActivity);
        return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      } catch {
        return [];
      }
    }
  },

  /**
   * Alias for getRecentActivities
   */
  async getPublicActivityFeed(limitCount = 25): Promise<SocialActivity[]> {
    return this.getRecentActivities(limitCount);
  },

  // ==========================================================================
  // 2. PLAYER DISCOVERY & SEARCH
  // ==========================================================================

  /**
   * Powerful player search across eFootball username, normalized username,
   * CHUKA ID, and display name.
   * Case-insensitive, whitespace-tolerant, and strictly safe (no PII).
   */
  async searchPlayers(
    searchQuery: string,
    seasonIdOrMembers?: string | LeagueMember[],
    allUsers?: UserProfile[]
  ): Promise<PublicSearchResult[]> {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return [];

    let leagueMembers: LeagueMember[] = [];
    if (Array.isArray(seasonIdOrMembers)) {
      leagueMembers = seasonIdOrMembers;
    } else if (typeof seasonIdOrMembers === 'string') {
      try {
        const q = query(collection(db, 'leagueMembers'), where('leagueId', '==', seasonIdOrMembers));
        const snap = await getDocs(q);
        leagueMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMember));
      } catch {
        leagueMembers = [];
      }
    }

    const normalizedQuery = normalizeUsername(cleanQuery);
    const upperQuery = cleanQuery.toUpperCase();

    // Map all users by playerId for fast lookup of photo & display name
    const userMap = new Map<string, UserProfile>();
    if (allUsers) {
      allUsers.forEach((u) => {
        if (u.playerId) userMap.set(u.playerId, u);
      });
    }

    const results: PublicSearchResult[] = [];

    leagueMembers.forEach((member) => {
      const memberNorm = normalizeUsername(member.efootballUsername || '');
      const chukaId = (member.playerId || '').toUpperCase();
      const displayNameUpper = (member.displayName || '').toUpperCase();
      const rawUserUpper = (member.efootballUsername || '').toUpperCase();

      const matchesNorm = memberNorm.includes(normalizedQuery);
      const matchesChukaId = chukaId.includes(upperQuery);
      const matchesDisplay = displayNameUpper.includes(upperQuery);
      const matchesRaw = rawUserUpper.includes(upperQuery);

      if (matchesNorm || matchesChukaId || matchesDisplay || matchesRaw) {
        const user = userMap.get(member.playerId);
        results.push({
          playerId: member.playerId,
          efootballUsername: member.efootballUsername || 'eFootball User',
          displayName: member.displayName || 'Player',
          photoURL: member.squadImageUrl || user?.photoURL || undefined,
          position: member.currentPosition || 999,
          points: member.points || 0,
          form: (member.currentForm || []).map(String),
          streak: member.currentStreak || 0,
          isVerifiedMember: member.status === 'VERIFIED',
        });
      }
    });

    // Sort: verified first, then by rank position
    return results.sort((a, b) => {
      if (a.position === b.position) return b.points - a.points;
      return a.position - b.position;
    });
  },

  // ==========================================================================
  // 3. RIVALRY SYSTEM
  // ==========================================================================

  /**
   * Inspects all confirmed League matches for a player and builds
   * exact rivalry summaries. Does not fabricate rivalries if no matches exist.
   */
  getPlayerRivalries(
    playerId: string,
    confirmedMatches: LeagueMatch[],
    allMembers: LeagueMember[]
  ): PlayerRivalrySummary[] {
    if (!playerId) return [];

    const memberMap = new Map<string, LeagueMember>();
    allMembers.forEach((m) => memberMap.set(m.playerId, m));

    // Filter confirmed matches involving this player
    const playerMatches = confirmedMatches.filter(
      (m) =>
        m.status === 'CONFIRMED' &&
        (m.homePlayerId === playerId || m.awayPlayerId === playerId)
    );

    const opponentMap = new Map<string, LeagueMatch[]>();

    playerMatches.forEach((m) => {
      const opponentId = m.homePlayerId === playerId ? m.awayPlayerId : m.homePlayerId;
      if (!opponentId) return;
      const current = opponentMap.get(opponentId) || [];
      current.push(m);
      opponentMap.set(opponentId, current);
    });

    const rivalries: PlayerRivalrySummary[] = [];

    opponentMap.forEach((matches, oppId) => {
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;

      // Sort matches chronologically to find latest
      const sorted = [...matches].sort(
        (a, b) => new Date(b.confirmedAt || b.submittedAt || b.createdAt || '').getTime() -
                  new Date(a.confirmedAt || a.submittedAt || a.createdAt || '').getTime()
      );

      sorted.forEach((m) => {
        const isHome = m.homePlayerId === playerId;
        const myScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
        const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);

        goalsFor += myScore;
        goalsAgainst += oppScore;

        if (myScore > oppScore) wins++;
        else if (myScore < oppScore) losses++;
        else draws++;
      });

      const member = memberMap.get(oppId);
      const latest = sorted[0];
      const isHomeLatest = latest.homePlayerId === playerId;
      const latestDisplay = `${isHomeLatest ? latest.homeScore : latest.awayScore} - ${
        isHomeLatest ? latest.awayScore : latest.homeScore
      }`;

      rivalries.push({
        opponentPlayerId: oppId,
        opponentUsername:
          member?.efootballUsername ||
          (latest.homePlayerId === oppId ? latest.homeEfootball : latest.awayEfootball) ||
          'Opponent',
        opponentDisplayName:
          member?.displayName ||
          (latest.homePlayerId === oppId ? latest.homePlayerName : latest.awayPlayerName) ||
          oppId,
        matchesPlayed: matches.length,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        latestMeetingDate: latest.confirmedAt || latest.submittedAt || latest.createdAt || '',
        latestScoreDisplay: latestDisplay,
        lastMeetingMatchId: latest.id,
      });
    });

    // Sort by matches played descending (biggest rivalries first)
    return rivalries.sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  },

  // ==========================================================================
  // 4. WHATSAPP SHARING
  // ==========================================================================

  getAchievementWhatsAppUrl(params: {
    username: string;
    achievementTitle: string;
    playerId: string;
    icon?: string;
  }): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.ke';
    const profileUrl = `${origin}?player=${encodeURIComponent(params.playerId)}`;
    const text =
      `🔥 I just unlocked an official achievement on CHUKA eFOOTBALL!\n\n` +
      `Player: ${params.username}\n` +
      `Badge: ${params.icon || '🏅'} ${params.achievementTitle}\n\n` +
      `Check my official profile:\n${profileUrl}\n\n` +
      `Chuka University Official eFootball Platform`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  },

  getChallengeWhatsAppUrl(params: {
    challengerUsername: string;
    opponentUsername: string;
    playerId: string;
  }): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.ke';
    const leagueUrl = `${origin}?tab=LEAGUE`;
    const text =
      `⚔️ I just issued a League Match challenge on CHUKA eFOOTBALL!\n\n` +
      `Challenger: ${params.challengerUsername}\n` +
      `Opponent: ${params.opponentUsername}\n\n` +
      `Accept and play in the League Arena:\n${leagueUrl}\n\n` +
      `Play. Compete. Build your record.`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  },

  getLeagueCardWhatsAppUrl(params: {
    username: string;
    playerId: string;
    rank: number;
    points: number;
  }): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.ke';
    const profileUrl = `${origin}?player=${encodeURIComponent(params.playerId)}`;
    const text =
      `🎴 Check out my official CHUKA eFOOTBALL League Card!\n\n` +
      `Player: ${params.username} (${params.playerId})\n` +
      `Current Rank: ${params.rank > 0 ? `#${params.rank}` : 'Contender'}\n` +
      `League Points: ${params.points} PTS\n\n` +
      `View my card and full record:\n${profileUrl}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  },

  getMatchResultWhatsAppUrl(params: {
    homeUser: string;
    homeScore: number;
    awayScore: number;
    awayUser: string;
  }): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.ke';
    const leagueUrl = `${origin}?tab=LEAGUE`;
    const text =
      `⚽ Confirmed CHUKA eFOOTBALL League Match Result:\n\n` +
      `${params.homeUser} ${params.homeScore} - ${params.awayScore} ${params.awayUser}\n\n` +
      `View updated standings & statistics:\n${leagueUrl}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  },

  getSocialHubWhatsAppUrl(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.ke';
    const text =
      `🎮 Join CHUKA eFOOTBALL — Chuka University's Official eFootball League & Weekly Tournament!\n\n` +
      `Play. Compete. Build your record.\n\n` +
      `Explore live arena, player rankings, and cards:\n${origin}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  },

  // ==========================================================================
  // 5. COMMUNITY POSTING & MODERATION
  // ==========================================================================

  /**
   * Allows verified League members to publish a community post.
   * Strictly filters against PII, phone numbers, and M-Pesa statements.
   */
  async createCommunityPost(params: {
    authorUid: string;
    authorPlayerId: string;
    authorUsername: string;
    authorDisplayName: string;
    authorPhotoURL?: string;
    authorPosition?: number;
    type: CommunityPostType;
    content: string;
    imageUrl?: string;
  }): Promise<{ success: boolean; error?: string; postId?: string }> {
    const trimmed = (params.content || '').trim();
    if (trimmed.length < 3) {
      return { success: false, error: 'Post must be at least 3 characters long.' };
    }
    if (trimmed.length > 500) {
      return { success: false, error: 'Post exceeds maximum 500 characters limit.' };
    }

    // Guard against PII / payment info in community posts
    if (SENSITIVE_INFO_REGEX.test(trimmed)) {
      return {
        success: false,
        error: 'Posts cannot contain phone numbers, payment codes, or private contact details.',
      };
    }

    const postId = `POST_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const postData: CommunityPost = {
      postId,
      authorUid: params.authorUid,
      authorPlayerId: params.authorPlayerId,
      authorUsername: params.authorUsername,
      authorDisplayName: params.authorDisplayName,
      authorPhotoURL: params.authorPhotoURL || '',
      authorPosition: params.authorPosition || undefined,
      type: params.type,
      content: trimmed,
      imageUrl: params.imageUrl || '',
      status: 'ACTIVE',
      reportCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'communityPosts', postId), postData);
    return { success: true, postId };
  },

  /**
   * Fetches active community posts, filtering out blocked authors.
   */
  async getCommunityPosts(blockedPlayerIds: string[] = []): Promise<CommunityPost[]> {
    try {
      const q = query(
        collection(db, 'communityPosts'),
        where('status', '==', 'ACTIVE'),
        orderBy('createdAt', 'desc'),
        limit(40)
      );
      const snap = await getDocs(q);
      const posts = snap.docs.map((d) => d.data() as CommunityPost);
      if (blockedPlayerIds.length === 0) return posts;
      const blockSet = new Set(blockedPlayerIds);
      return posts.filter((p) => !blockSet.has(p.authorPlayerId));
    } catch {
      // Index fallback
      const snap = await getDocs(query(collection(db, 'communityPosts'), limit(40)));
      const posts = snap.docs
        .map((d) => d.data() as CommunityPost)
        .filter((p) => p.status === 'ACTIVE');
      posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (blockedPlayerIds.length === 0) return posts;
      const blockSet = new Set(blockedPlayerIds);
      return posts.filter((p) => !blockSet.has(p.authorPlayerId));
    }
  },

  /**
   * Deletes a community post. Authorized by author or admin.
   */
  async deleteCommunityPost(postId: string, userUid?: string, isAdmin?: boolean): Promise<boolean> {
    const ref = doc(db, 'communityPosts', postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as CommunityPost;
    if (userUid && data.authorUid !== userUid && !isAdmin) {
      throw new Error('PERMISSION_DENIED: You cannot delete another player\'s post.');
    }
    await deleteDoc(ref);
    return true;
  },

  /**
   * Submits a report against a community post.
   */
  async reportCommunityPost(params: {
    postId: string;
    reportedByUid: string;
    reportedByPlayerId?: string;
    reason: ReportReason;
    description: string;
  }): Promise<{ success: boolean; message: string }> {
    const reportId = `REPORT_${params.postId}_${params.reportedByUid}`;
    const reportData: CommunityReport = {
      reportId,
      postId: params.postId,
      reportedBy: params.reportedByUid,
      reportedByPlayerId: params.reportedByPlayerId || '',
      reason: params.reason,
      description: params.description.trim().substring(0, 300),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'communityReports', reportId), reportData);

    // Increment report counter on the post
    try {
      const postRef = doc(db, 'communityPosts', params.postId);
      const snap = await getDoc(postRef);
      if (snap.exists()) {
        const post = snap.data() as CommunityPost;
        const newCount = (post.reportCount || 0) + 1;
        await updateDoc(postRef, {
          reportCount: newCount,
          // If reports exceed threshold, flag for moderation
          status: newCount >= 3 ? 'REPORTED' : post.status,
        });
      }
    } catch (e) {
      console.warn('Could not increment post report count', e);
    }

    return { success: true, message: 'Report submitted for administrator review.' };
  },

  /**
   * Admin resolution for reports.
   */
  async resolveCommunityReport(
    reportId: string,
    resolution: string,
    action: 'DISMISS' | 'REMOVE_POST',
    reviewerUid: string
  ): Promise<boolean> {
    const reportRef = doc(db, 'communityReports', reportId);
    const snap = await getDoc(reportRef);
    if (!snap.exists()) return false;
    const report = snap.data() as CommunityReport;

    await updateDoc(reportRef, {
      status: 'RESOLVED',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerUid,
      resolution: `${action}: ${resolution}`,
    });

    if (action === 'REMOVE_POST') {
      const postRef = doc(db, 'communityPosts', report.postId);
      await updateDoc(postRef, { status: 'REMOVED' });
    }

    return true;
  },

  // ==========================================================================
  // 6. PLAYER BLOCKING
  // ==========================================================================

  async blockPlayer(
    blockerUid: string,
    blockedPlayerId: string,
    blockedUsername?: string
  ): Promise<boolean> {
    if (!blockerUid || !blockedPlayerId) return false;
    const blockId = `${blockerUid}_${blockedPlayerId}`;
    const data: UserBlock = {
      blockId,
      blockerUid,
      blockedPlayerId,
      blockedUsername: blockedUsername || '',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'userBlocks', blockId), data);
    return true;
  },

  async blockUser(
    blockerUid: string,
    blockedPlayerId: string,
    blockedUsername?: string
  ): Promise<boolean> {
    return this.blockPlayer(blockerUid, blockedPlayerId, blockedUsername);
  },

  async unblockPlayer(blockerUid: string, blockedPlayerId: string): Promise<boolean> {
    const blockId = `${blockerUid}_${blockedPlayerId}`;
    await deleteDoc(doc(db, 'userBlocks', blockId));
    return true;
  },

  async getBlockedPlayerIds(blockerUid: string): Promise<string[]> {
    if (!blockerUid) return [];
    try {
      const q = query(collection(db, 'userBlocks'), where('blockerUid', '==', blockerUid));
      const snap = await getDocs(q);
      return snap.docs.map((d) => (d.data() as UserBlock).blockedPlayerId);
    } catch {
      return [];
    }
  },

  // ==========================================================================
  // 7. IN-APP NOTIFICATIONS
  // ==========================================================================

  async createNotification(
    params: Omit<InAppNotification, 'notificationId' | 'createdAt' | 'isRead'>
  ): Promise<string> {
    const notificationId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notif: InAppNotification = {
      ...params,
      notificationId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'notifications', notificationId), notif);
    return notificationId;
  },

  async getNotifications(recipientUid: string): Promise<InAppNotification[]> {
    if (!recipientUid) return [];
    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', recipientUid),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as InAppNotification);
    } catch {
      // Fallback if composite index is pending
      const q = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', recipientUid),
        limit(30)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as InAppNotification);
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  },

  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const ref = doc(db, 'notifications', notificationId);
      await updateDoc(ref, { isRead: true });
      return true;
    } catch {
      return false;
    }
  },

  async markAllNotificationsAsRead(recipientUid: string): Promise<boolean> {
    const notifs = await this.getNotifications(recipientUid);
    const unread = notifs.filter((n) => !n.isRead);
    await Promise.all(
      unread.map((n) => updateDoc(doc(db, 'notifications', n.notificationId), { isRead: true }))
    );
    return true;
  },
};
