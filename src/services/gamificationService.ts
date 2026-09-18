import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import {
  AchievementType,
  PlayerAchievement,
  PlayerTitle,
  DailyClaim,
  RivalryHeadToHead,
  WeeklyLeagueChallenge,
  HallOfFameRecord,
  LeagueMatch,
  LeagueMember,
  UserProfile,
  ChampionRecord,
} from '../types';
import { normalizeEfootballUsername } from '../utils/usernameUtils';
import { socialService } from './socialService';

// Configuration constants
export const GIANT_KILLER_RANK_GAP_THRESHOLD = 5; // Rank gap requirement (e.g. 5 positions higher)

export interface AchievementMeta {
  type: AchievementType;
  title: string;
  description: string;
  iconName: string;
  pointsAwarded?: number;
}

export const ACHIEVEMENT_REGISTRY: Record<AchievementType, AchievementMeta> = {
  FIRST_WIN: {
    type: 'FIRST_WIN',
    title: 'First Blood',
    description: 'Claimed your first confirmed victory in the Chuka eFootball League.',
    iconName: 'Trophy',
  },
  FIVE_WINS: {
    type: 'FIVE_WINS',
    title: 'High Five',
    description: 'Secured 5 confirmed League victories.',
    iconName: 'Award',
  },
  TEN_WINS: {
    type: 'TEN_WINS',
    title: 'Decade of Dominance',
    description: 'Won 10 confirmed League matches.',
    iconName: 'Shield',
  },
  TWENTY_WINS: {
    type: 'TWENTY_WINS',
    title: 'Twenty-Piece',
    description: 'Amassed 20 confirmed League victories.',
    iconName: 'Swords',
  },
  FIFTY_WINS: {
    type: 'FIFTY_WINS',
    title: 'Chuka Centurion',
    description: 'Legendary milestone: 50 confirmed League victories.',
    iconName: 'Crown',
  },
  HUNDRED_GOALS: {
    type: 'HUNDRED_GOALS',
    title: 'Century of Goals',
    description: 'Scored 100 or more total goals in confirmed League matches.',
    iconName: 'Flame',
  },
  FIVE_WIN_STREAK: {
    type: 'FIVE_WIN_STREAK',
    title: 'On Fire',
    description: 'Won 5 consecutive confirmed League matches without interruption.',
    iconName: 'Zap',
  },
  TEN_WIN_STREAK: {
    type: 'TEN_WIN_STREAK',
    title: 'Unstoppable Force',
    description: 'Won 10 consecutive confirmed League matches without interruption.',
    iconName: 'Flame',
  },
  TWENTY_WIN_STREAK: {
    type: 'TWENTY_WIN_STREAK',
    title: 'League Immortal',
    description: 'God-tier streak: 20 consecutive confirmed League victories.',
    iconName: 'Sparkles',
  },
  CLEAN_SHEET: {
    type: 'CLEAN_SHEET',
    title: 'Iron Curtain',
    description: 'Recorded a clean sheet (0 goals conceded) in a confirmed League victory.',
    iconName: 'ShieldCheck',
  },
  GIANT_KILLER: {
    type: 'GIANT_KILLER',
    title: 'Giant Killer',
    description: `Defeated an opponent ranked ${GIANT_KILLER_RANK_GAP_THRESHOLD} or more positions higher in the standings.`,
    iconName: 'Target',
  },
  RISING_STAR: {
    type: 'RISING_STAR',
    title: 'Rising Star',
    description: 'Climbed 5 or more positions in the League standings or won 3 of your first 5 matches.',
    iconName: 'TrendingUp',
  },
  VETERAN: {
    type: 'VETERAN',
    title: 'Chuka Veteran',
    description: 'Played 25 or more confirmed League matches.',
    iconName: 'Medal',
  },
};

/**
 * Get current date string in Nairobi timezone (UTC+3)
 */
export function getKenyaDateString(): string {
  const now = new Date();
  // Adjust to East Africa Time (UTC + 3 hours)
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const eatTime = new Date(now.getTime() + eatOffsetMs);
  return eatTime.toISOString().split('T')[0];
}

export const gamificationService = {
  // ==========================================================================
  // 1. ACHIEVEMENTS ENGINE (IDEMPOTENT & STRICTLY AUTHORITATIVE)
  // ==========================================================================

  /**
   * Evaluates and awards achievements for a confirmed League match.
   * Disputed or voided matches are completely ignored.
   */
  async evaluateMatchAchievements(params: {
    match: LeagueMatch;
    homeMember: LeagueMember;
    awayMember: LeagueMember;
    homePreRank?: number;
    awayPreRank?: number;
  }): Promise<void> {
    const { match, homeMember, awayMember, homePreRank, awayPreRank } = params;

    if (match.status !== 'CONFIRMED') {
      return; // Only confirmed matches generate achievements
    }

    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;

    const winnerId =
      homeScore > awayScore
        ? match.homePlayerId
        : awayScore > homeScore
        ? match.awayPlayerId
        : null;

    if (!winnerId) {
      // It's a draw, check for milestone matches played / veteran
      await this.checkMatchesPlayedAchievements(homeMember);
      await this.checkMatchesPlayedAchievements(awayMember);
      return;
    }

    const isHomeWinner = winnerId === match.homePlayerId;
    const winnerMember = isHomeWinner ? homeMember : awayMember;
    const loserMember = isHomeWinner ? awayMember : homeMember;
    const winnerScore = isHomeWinner ? homeScore : awayScore;
    const loserScore = isHomeWinner ? awayScore : homeScore;
    const winnerRank = isHomeWinner ? homePreRank : awayPreRank;
    const loserRank = isHomeWinner ? awayPreRank : homePreRank;

    // 1. Win milestone achievements
    const totalWins = (winnerMember.wins || 0) + 1; // including this match
    if (totalWins >= 1) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'FIRST_WIN',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
      });
    }
    if (totalWins >= 5) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'FIVE_WINS',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
      });
    }
    if (totalWins >= 10) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'TEN_WINS',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
      });
    }
    if (totalWins >= 20) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'TWENTY_WINS',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
      });
    }
    if (totalWins >= 50) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'FIFTY_WINS',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
      });
    }

    // 2. Clean sheet
    if (loserScore === 0) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'CLEAN_SHEET',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
        metadata: {
          opponentPlayerId: loserMember.playerId,
          opponentName: loserMember.displayName,
          scoreDisplay: `${winnerScore} – ${loserScore}`,
        },
      });
    }

    // 3. Goal milestone
    const totalGoals = (winnerMember.goalsFor || 0) + winnerScore;
    if (totalGoals >= 100) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'HUNDRED_GOALS',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
        metadata: { goalsCount: totalGoals },
      });
    }

    // 4. Giant Killer: Winner was ranked >= GIANT_KILLER_RANK_GAP_THRESHOLD positions below loser
    if (
      winnerRank &&
      loserRank &&
      winnerRank > loserRank &&
      winnerRank - loserRank >= GIANT_KILLER_RANK_GAP_THRESHOLD
    ) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'GIANT_KILLER',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
        metadata: {
          rankGap: winnerRank - loserRank,
          opponentPlayerId: loserMember.playerId,
          opponentName: loserMember.displayName,
          scoreDisplay: `${winnerScore} – ${loserScore}`,
        },
      });
    }

    // 5. Streaks evaluation
    const streak = (winnerMember.currentStreak || 0) + 1;
    if (streak >= 5) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'FIVE_WIN_STREAK',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
        metadata: { streakLength: streak },
      });
    }
    if (streak >= 10) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'TEN_WIN_STREAK',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
        metadata: { streakLength: streak },
      });
    }
    if (streak >= 20) {
      await this.awardAchievement({
        playerId: winnerMember.playerId,
        userId: winnerMember.userId,
        type: 'TWENTY_WIN_STREAK',
        sourceMatchId: match.id,
        sourceSeasonId: match.seasonId,
        metadata: { streakLength: streak },
      });
    }

    // 6. Check veteran / matches played for both
    await this.checkMatchesPlayedAchievements(winnerMember);
    await this.checkMatchesPlayedAchievements(loserMember);
  },

  /**
   * Helper to check matches played milestones
   */
  async checkMatchesPlayedAchievements(member: LeagueMember): Promise<void> {
    const totalMatches = (member.matchesPlayed || 0) + 1;
    if (totalMatches >= 25) {
      await this.awardAchievement({
        playerId: member.playerId,
        userId: member.userId,
        type: 'VETERAN',
        sourceSeasonId: member.leagueId,
      });
    }
  },

  /**
   * Idempotently awards an achievement to a player.
   * Document ID `ACHV_${playerId}_${type}` ensures it can NEVER be duplicated!
   */
  async awardAchievement(params: {
    playerId: string;
    userId: string;
    type: AchievementType;
    sourceMatchId?: string;
    sourceSeasonId?: string;
    metadata?: Record<string, any>;
  }): Promise<PlayerAchievement | null> {
    try {
      const { playerId, userId, type, sourceMatchId, sourceSeasonId, metadata } = params;
      const docId = `ACHV_${playerId}_${type}`;
      const achvRef = doc(db, 'achievements', docId);

      const existing = await getDoc(achvRef);
      if (existing.exists()) {
        return existing.data() as PlayerAchievement;
      }

      const meta = ACHIEVEMENT_REGISTRY[type];
      const achievement: PlayerAchievement = {
        id: docId,
        playerId,
        userId,
        achievementType: type,
        title: meta.title,
        description: meta.description,
        iconName: meta.iconName,
        earnedAt: new Date().toISOString(),
        sourceMatchId: sourceMatchId || '',
        sourceSeasonId: sourceSeasonId || '',
        metadata: metadata || {},
      };

      await setDoc(achvRef, achievement);

      const points = meta.pointsAwarded || 20;

      // Social Hub & In-App Notification (asynchronously, strictly non-blocking)
      socialService
        .recordActivity({
          activityId: `ACT_${docId}`,
          type: 'ACHIEVEMENT_EARNED',
          playerId,
          message: `Earned official achievement: ${meta.title} (${points} pts)`,
          achievementId: docId,
          visibility: 'PUBLIC',
          metadata: {
            achievementTitle: meta.title,
            achievementIcon: meta.iconName,
            points,
          },
        })
        .catch(() => {});

      socialService
        .createNotification({
          recipientUid: userId,
          recipientPlayerId: playerId,
          type: 'ACHIEVEMENT_EARNED',
          title: '🏆 Achievement Unlocked!',
          message: `You earned "${meta.title}" (+${points} PTS)!`,
          linkTab: 'PROFILE',
          metadata: { achievementId: docId },
        })
        .catch(() => {});

      return achievement;
    } catch (err) {
      console.warn('[gamificationService] Achievement award skipped or error:', err);
      return null;
    }
  },

  /**
   * Get all achievements for a player
   */
  async getPlayerAchievements(playerId: string): Promise<PlayerAchievement[]> {
    try {
      const q = query(
        collection(db, 'achievements'),
        where('playerId', '==', playerId),
        orderBy('earnedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as PlayerAchievement);
    } catch (e) {
      console.error('Error fetching player achievements:', e);
      return [];
    }
  },

  // ==========================================================================
  // 2. PLAYER TITLES ENGINE
  // ==========================================================================

  /**
   * Computes dynamic titles earned by the player derived strictly from confirmed statistics.
   */
  computePlayerTitles(params: {
    matchesPlayed: number;
    wins: number;
    goalsFor: number;
    goalsAgainst: number;
    currentStreak: number;
    cleanSheets?: number;
    achievements?: PlayerAchievement[];
  }): PlayerTitle[] {
    const titles: PlayerTitle[] = [];
    const achvTypes = new Set(params.achievements?.map((a) => a.achievementType) || []);

    // 1. Hot Streak
    if (params.currentStreak >= 3) {
      titles.push({
        id: 'HOT_STREAK',
        title: `🔥 ${params.currentStreak} MATCH STREAK`,
        badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        description: 'Currently in dominant form with 3+ back-to-back victories.',
        earnedAt: new Date().toISOString(),
      });
    }

    // 2. Giant Killer
    if (achvTypes.has('GIANT_KILLER')) {
      titles.push({
        id: 'GIANT_KILLER',
        title: '👑 GIANT KILLER',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        description: 'Defeated a powerhouse opponent ranked 5+ positions higher.',
        earnedAt: new Date().toISOString(),
      });
    }

    // 3. Goal Machine
    const avgGoals = params.matchesPlayed > 0 ? params.goalsFor / params.matchesPlayed : 0;
    if (params.goalsFor >= 20 || (params.matchesPlayed >= 5 && avgGoals >= 2.5)) {
      titles.push({
        id: 'GOAL_MACHINE',
        title: '⚽ GOAL MACHINE',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        description: 'Lethal attacking potency with prolific goal contributions.',
        earnedAt: new Date().toISOString(),
      });
    }

    // 4. The Wall (Defensive Rock)
    if ((params.cleanSheets && params.cleanSheets >= 3) || achvTypes.has('CLEAN_SHEET')) {
      titles.push({
        id: 'THE_WALL',
        title: '🧤 THE WALL',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        description: 'Impenetrable defense with proven clean sheets.',
        earnedAt: new Date().toISOString(),
      });
    }

    // 5. Rising Star
    if (achvTypes.has('RISING_STAR')) {
      titles.push({
        id: 'RISING_STAR',
        title: '📈 RISING STAR',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        description: 'Rapidly ascending through the competitive rankings.',
        earnedAt: new Date().toISOString(),
      });
    }

    // 6. Veteran
    if (params.matchesPlayed >= 25 || achvTypes.has('VETERAN')) {
      titles.push({
        id: 'VETERAN',
        title: '🏆 VETERAN',
        badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        description: 'Seasoned Chuka eFootball competitor with 25+ matches.',
        earnedAt: new Date().toISOString(),
      });
    } else if (params.matchesPlayed >= 5) {
      titles.push({
        id: 'COMPETITOR',
        title: '💪 LEAGUE CONTENDER',
        badgeColor: 'bg-white/10 text-white/80 border-white/20',
        description: 'Active league fighter on the Chuka rankings.',
        earnedAt: new Date().toISOString(),
      });
    }

    return titles;
  },

  // ==========================================================================
  // 3. STREAK ENGINE
  // ==========================================================================

  /**
   * Calculates current streak and longest historical win streak from confirmed results
   */
  calculateStreaks(resultsChronological: Array<'W' | 'D' | 'L'>): {
    currentStreak: number;
    longestWinStreak: number;
    streakDisplay: string;
  } {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (const r of resultsChronological) {
      if (r === 'W') {
        tempStreak += 1;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    // Current streak is unbroken sequence of 'W's starting from the latest match backward
    for (let i = resultsChronological.length - 1; i >= 0; i--) {
      if (resultsChronological[i] === 'W') {
        currentStreak += 1;
      } else {
        break;
      }
    }

    let streakDisplay = '—';
    if (currentStreak >= 2) {
      streakDisplay = `🔥 ${currentStreak} MATCH WIN STREAK`;
    } else if (currentStreak === 1) {
      streakDisplay = '1 Win';
    }

    return {
      currentStreak,
      longestWinStreak: longestStreak,
      streakDisplay,
    };
  },

  // ==========================================================================
  // 4. RANKING MOVEMENT ENGINE
  // ==========================================================================

  /**
   * Computes ranking movement compared to previous position
   */
  computeRankingMovement(
    currentPos: number,
    previousPos?: number
  ): { diff: number; display: string } {
    if (!previousPos || previousPos <= 0 || currentPos <= 0) {
      return { diff: 0, display: '—' };
    }

    // If previous was 8 and current is 3, player climbed 5 spots (diff = +5)
    const diff = previousPos - currentPos;

    if (diff > 0) {
      return { diff, display: `↑ ${diff}` };
    } else if (diff < 0) {
      return { diff, display: `↓ ${Math.abs(diff)}` };
    } else {
      return { diff: 0, display: '—' };
    }
  },

  // ==========================================================================
  // 5. HEAD-TO-HEAD / RIVALRIES ENGINE
  // ==========================================================================

  /**
   * Computes head-to-head rivalry statistics between two players
   */
  async getHeadToHeadRivalry(
    playerAId: string,
    playerBId: string,
    seasonId?: string
  ): Promise<RivalryHeadToHead> {
    try {
      // Query matches where playerA was home or away
      const matchQuery = seasonId
        ? query(collection(db, 'leagueMatches'), where('seasonId', '==', seasonId))
        : query(collection(db, 'leagueMatches'));

      const snap = await getDocs(matchQuery);
      const allConfirmed = snap.docs
        .map((d) => d.data() as LeagueMatch)
        .filter((m) => m.status === 'CONFIRMED');

      // Filter matches between playerA and playerB
      const h2hMatches = allConfirmed.filter(
        (m) =>
          (m.homePlayerId === playerAId && m.awayPlayerId === playerBId) ||
          (m.homePlayerId === playerBId && m.awayPlayerId === playerAId)
      );

      let playerAWins = 0;
      let playerBWins = 0;
      let draws = 0;
      let playerAGoals = 0;
      let playerBGoals = 0;

      let playerAName = playerAId;
      let playerAEfootball = 'Player';
      let playerBName = playerBId;
      let playerBEfootball = 'Player';

      const recentMeetings: RivalryHeadToHead['recentMeetings'] = [];

      // Sort chronologically descending (latest first)
      h2hMatches.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      for (const m of h2hMatches) {
        const isAHome = m.homePlayerId === playerAId;
        const scoreA = isAHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
        const scoreB = isAHome ? m.awayScore ?? 0 : m.homeScore ?? 0;

        if (isAHome) {
          playerAName = m.homePlayerName || playerAName;
          playerAEfootball = m.homeEfootballUsername || playerAEfootball;
          playerBName = m.awayPlayerName || playerBName;
          playerBEfootball = m.awayEfootballUsername || playerBEfootball;
        } else {
          playerBName = m.homePlayerName || playerBName;
          playerBEfootball = m.homeEfootballUsername || playerBEfootball;
          playerAName = m.awayPlayerName || playerAName;
          playerAEfootball = m.awayEfootballUsername || playerAEfootball;
        }

        playerAGoals += scoreA;
        playerBGoals += scoreB;

        let summary = 'Draw';
        if (scoreA > scoreB) {
          playerAWins += 1;
          summary = `${playerAEfootball} Won`;
        } else if (scoreB > scoreA) {
          playerBWins += 1;
          summary = `${playerBEfootball} Won`;
        } else {
          draws += 1;
        }

        recentMeetings.push({
          matchId: m.id,
          date: m.confirmedAt || m.createdAt,
          homeScore: m.homeScore ?? 0,
          awayScore: m.awayScore ?? 0,
          homePlayerId: m.homePlayerId,
          awayPlayerId: m.awayPlayerId,
          seasonId: m.seasonId,
          summary: `${scoreA} – ${scoreB} (${summary})`,
        });
      }

      return {
        playerAId,
        playerAName,
        playerAEfootball,
        playerBId,
        playerBName,
        playerBEfootball,
        totalMeetings: h2hMatches.length,
        playerAWins,
        playerBWins,
        draws,
        playerAGoals,
        playerBGoals,
        recentMeetings,
      };
    } catch (e) {
      console.error('Error calculating Head-to-Head rivalry:', e);
      return {
        playerAId,
        playerAName: playerAId,
        playerAEfootball: 'Player',
        playerBId,
        playerBName: playerBId,
        playerBEfootball: 'Player',
        totalMeetings: 0,
        playerAWins: 0,
        playerBWins: 0,
        draws: 0,
        playerAGoals: 0,
        playerBGoals: 0,
        recentMeetings: [],
      };
    }
  },

  // ==========================================================================
  // 6. DAILY FIRST CLAIM SYSTEM
  // ==========================================================================

  /**
   * Allows an active league player to claim their daily activity badge.
   * Atomically checks `dailyClaims/${dateStr}_${playerId}` to prevent duplicate claims.
   * Tracks whether this was the very first claim across the entire league for that day.
   */
  async submitDailyClaim(params: {
    userId: string;
    playerId: string;
    displayName: string;
    efootballUsername: string;
  }): Promise<{ success: boolean; isDayFirstClaim: boolean; message: string; claim?: DailyClaim }> {
    const { userId, playerId, displayName, efootballUsername } = params;
    const dateStr = getKenyaDateString();
    const claimDocId = `CLAIM_${dateStr}_${playerId}`;
    const claimRef = doc(db, 'dailyClaims', claimDocId);
    const dayFirstRef = doc(db, 'dailyFirstClaims', dateStr);

    try {
      // Check if already claimed today
      const existingClaim = await getDoc(claimRef);
      if (existingClaim.exists()) {
        const claimData = existingClaim.data() as DailyClaim;
        return {
          success: false,
          isDayFirstClaim: claimData.isDayFirstClaim,
          message: 'You have already checked in today! Check back tomorrow morning.',
          claim: claimData,
        };
      }

      // Check if there is already a day-first claimer
      let isDayFirstClaim = false;
      const dayFirstSnap = await getDoc(dayFirstRef);
      if (!dayFirstSnap.exists()) {
        isDayFirstClaim = true;
      }

      const newClaim: DailyClaim = {
        id: claimDocId,
        dateStr,
        playerId,
        userId,
        displayName,
        efootballUsername,
        claimedAt: new Date().toISOString(),
        isDayFirstClaim,
      };

      const batch = writeBatch(db);
      batch.set(claimRef, newClaim);

      if (isDayFirstClaim) {
        batch.set(dayFirstRef, {
          dateStr,
          playerId,
          userId,
          displayName,
          efootballUsername,
          claimedAt: newClaim.claimedAt,
        });
      }

      await batch.commit();

      if (isDayFirstClaim) {
        socialService
          .recordActivity({
            activityId: `ACT_FIRST_${dateStr}`,
            type: 'DAILY_FIRST_CLAIM',
            playerId,
            playerUsername: efootballUsername,
            playerDisplayName: displayName,
            message: `${efootballUsername} claimed the #1 First Check-in for ${dateStr} (EAT)!`,
            visibility: 'PUBLIC',
            metadata: { dateStr },
          })
          .catch(() => {});
      }

      socialService
        .createNotification({
          recipientUid: userId,
          recipientPlayerId: playerId,
          type: 'DAILY_FIRST_OPEN',
          title: isDayFirstClaim ? "🌅 You Won Today's First Claim!" : '✅ Daily Check-in Confirmed',
          message: isDayFirstClaim
            ? 'You were the very first player in the entire League to check in today!'
            : 'Your daily check-in is officially recorded for today.',
          linkTab: 'LEAGUE',
        })
        .catch(() => {});

      return {
        success: true,
        isDayFirstClaim,
        message: isDayFirstClaim
          ? '🌅 INCREDIBLE! You are the #1 FIRST PLAYER in the entire League to check in today!'
          : '✅ Daily check-in confirmed! Keep your competitive presence strong.',
        claim: newClaim,
      };
    } catch (e: any) {
      console.error('Error submitting daily claim:', e);
      return {
        success: false,
        isDayFirstClaim: false,
        message: e?.message || 'Failed to submit daily claim.',
      };
    }
  },

  /**
   * Get the #1 first claimer for today's date
   */
  async getTodayFirstClaim(dateStr?: string): Promise<DailyClaim | null> {
    try {
      const date = dateStr || getKenyaDateString();
      const firstRef = doc(db, 'dailyFirstClaims', date);
      const snap = await getDoc(firstRef);
      if (!snap.exists()) return null;
      return snap.data() as DailyClaim;
    } catch {
      return null;
    }
  },

  /**
   * Get recent daily claims
   */
  async getRecentDailyClaims(maxLimit = 30): Promise<DailyClaim[]> {
    try {
      const q = query(collection(db, 'dailyClaims'), orderBy('claimedAt', 'desc'), limit(maxLimit));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as DailyClaim);
    } catch {
      return [];
    }
  },

  // ==========================================================================
  // 7. FACTUAL LEADERBOARDS ENGINE
  // ==========================================================================

  /**
   * Calculates factual leaderboards from verified members' confirmed statistics
   */
  async getFactualLeaderboards(seasonId: string): Promise<{
    pointsLeaderboard: LeagueMember[];
    goalsLeaderboard: LeagueMember[];
    streakLeaderboard: LeagueMember[];
    goalDifferenceLeaderboard: LeagueMember[];
    matchesPlayedLeaderboard: LeagueMember[];
    cleanSheetsLeaderboard: LeagueMember[];
  }> {
    try {
      const q = query(
        collection(db, 'leagueMembers'),
        where('leagueId', '==', seasonId),
        where('status', '==', 'VERIFIED')
      );
      const snap = await getDocs(q);
      const members = snap.docs.map((d) => d.data() as LeagueMember);

      // 1. Points (standard standings order)
      const points = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));

      // 2. Goals Scored
      const goals = [...members]
        .filter((m) => (m.goalsFor || 0) > 0)
        .sort((a, b) => (b.goalsFor || 0) - (a.goalsFor || 0));

      // 3. Longest Win Streak
      const streaks = [...members]
        .filter((m) => (m.longestWinStreak || 0) > 0)
        .sort((a, b) => (b.longestWinStreak || 0) - (a.longestWinStreak || 0));

      // 4. Goal Difference
      const gd = [...members].sort((a, b) => (b.goalDifference || 0) - (a.goalDifference || 0));

      // 5. Matches Played
      const matches = [...members]
        .filter((m) => (m.matchesPlayed || 0) > 0)
        .sort((a, b) => (b.matchesPlayed || 0) - (a.matchesPlayed || 0));

      // 6. Clean Sheets
      const cleanSheets = [...members]
        .filter((m) => (m.cleanSheets || 0) > 0)
        .sort((a, b) => (b.cleanSheets || 0) - (a.cleanSheets || 0));

      return {
        pointsLeaderboard: points,
        goalsLeaderboard: goals,
        streakLeaderboard: streaks,
        goalDifferenceLeaderboard: gd,
        matchesPlayedLeaderboard: matches,
        cleanSheetsLeaderboard: cleanSheets,
      };
    } catch (e) {
      console.error('Error generating leaderboards:', e);
      return {
        pointsLeaderboard: [],
        goalsLeaderboard: [],
        streakLeaderboard: [],
        goalDifferenceLeaderboard: [],
        matchesPlayedLeaderboard: [],
        cleanSheetsLeaderboard: [],
      };
    }
  },

  // ==========================================================================
  // 8. WEEKLY LEAGUE CHALLENGES
  // ==========================================================================

  /**
   * Get active weekly challenges
   */
  async getActiveWeeklyChallenges(seasonId: string): Promise<WeeklyLeagueChallenge[]> {
    try {
      const q = query(
        collection(db, 'weeklyChallenges'),
        where('seasonId', '==', seasonId),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        // Return default system challenges for the season
        return [
          {
            id: 'CHALLENGE_MATCHES_3',
            seasonId,
            weekNumber: 1,
            title: 'Active Fighter',
            description: 'Complete 3 confirmed League matches this week.',
            targetCount: 3,
            category: 'MATCHES_PLAYED',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            isActive: true,
          },
          {
            id: 'CHALLENGE_GOALS_5',
            seasonId,
            weekNumber: 1,
            title: 'Sharp Shooter',
            description: 'Score 5 or more goals in confirmed League matches.',
            targetCount: 5,
            category: 'GOALS',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            isActive: true,
          },
          {
            id: 'CHALLENGE_CLEAN_SHEET_1',
            seasonId,
            weekNumber: 1,
            title: 'Locked Door',
            description: 'Secure at least 1 clean sheet victory.',
            targetCount: 1,
            category: 'CLEAN_SHEET',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            isActive: true,
          },
        ];
      }
      return snap.docs.map((d) => d.data() as WeeklyLeagueChallenge);
    } catch {
      return [];
    }
  },

  /**
   * Computes a player's progress toward a weekly challenge
   */
  computeChallengeProgress(
    member: LeagueMember,
    challenge: WeeklyLeagueChallenge
  ): { current: number; target: number; completed: boolean; percent: number } {
    let current = 0;
    switch (challenge.category) {
      case 'MATCHES_PLAYED':
        current = member.matchesPlayed || 0;
        break;
      case 'WINS':
        current = member.wins || 0;
        break;
      case 'GOALS':
        current = member.goalsFor || 0;
        break;
      case 'CLEAN_SHEET':
        current = member.cleanSheets || 0;
        break;
      case 'STREAK':
        current = member.currentStreak || 0;
        break;
    }

    const target = challenge.targetCount || 1;
    const completed = current >= target;
    const percent = Math.min(100, Math.round((current / target) * 100));

    return { current, target, completed, percent };
  },

  // ==========================================================================
  // 9. HALL OF FAME (SEPARATE KNOCKOUT & LEAGUE CHAMPIONS)
  // ==========================================================================

  /**
   * Fetches real historical champions:
   * Keeps Weekly Knockout Champions and League Season Champions strictly separate.
   * No invented champions; displays only records actually in Firebase.
   */
  async getHallOfFame(): Promise<{
    knockoutChampions: ChampionRecord[];
    leagueChampions: HallOfFameRecord[];
  }> {
    try {
      // 1. Fetch Knockout Champions from existing authoritative champions collection
      const koQuery = query(collection(db, 'champions'), orderBy('createdAt', 'desc'), limit(50));
      const koSnap = await getDocs(koQuery);
      const knockoutChampions = koSnap.docs.map((d) => d.data() as ChampionRecord);

      // 2. Fetch League Champions from hallOfFame collection
      const leagueQuery = query(
        collection(db, 'hallOfFame'),
        where('category', '==', 'LEAGUE'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const leagueSnap = await getDocs(leagueQuery);
      const leagueChampions = leagueSnap.docs.map((d) => d.data() as HallOfFameRecord);

      return { knockoutChampions, leagueChampions };
    } catch (e) {
      console.error('Error loading Hall of Fame:', e);
      return { knockoutChampions: [], leagueChampions: [] };
    }
  },

  // ==========================================================================
  // 10. WHATSAPP PRE-FILLED MESSAGE BUILDERS
  // ==========================================================================

  /**
   * 12. WhatsApp Challenge Message
   */
  buildWhatsAppChallengeMessage(params: {
    senderEfootball: string;
    senderPlayerId: string;
    opponentEfootball: string;
    opponentPlayerId: string;
    leagueUrl?: string;
  }): string {
    const url = params.leagueUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.web.app');
    return (
      `⚽ *CHUKA eFOOTBALL LEAGUE CHALLENGE*\n\n` +
      `Hey *${params.opponentEfootball}* (${params.opponentPlayerId})!\n` +
      `I (*${params.senderEfootball}* • ${params.senderPlayerId}) have challenged you to a 1v1 match in the Chuka eFootball League.\n\n` +
      `📱 Match Details: 10 mins • Extra Time • Penalties\n` +
      `👉 Accept & Coordinate in Match Room:\n` +
      `${url}?tab=LEAGUE`
    );
  },

  /**
   * 13. Match Coordination Message
   */
  buildWhatsAppCoordinationMessage(params: {
    matchId: string;
    senderEfootball: string;
    opponentEfootball: string;
    isHost: boolean;
    roomNumber?: string;
  }): string {
    return (
      `🎮 *CHUKA eFOOTBALL MATCH ROOM*\n\n` +
      `Match: *${params.matchId}*\n` +
      `Host: *${params.senderEfootball}*\n` +
      `Challenger: *${params.opponentEfootball}*\n\n` +
      (params.roomNumber
        ? `🔑 Room Number: *${params.roomNumber}*\nPlease join now on eFootball Mobile!`
        : `Please create/share your eFootball Mobile Match Room Number to begin.`) +
      `\n\n📌 Remember to screenshot the final full-time screen for dual confirmation.`
    );
  },

  /**
   * 14. League Invite Message
   */
  buildWhatsAppInviteMessage(params: {
    senderEfootball: string;
    senderPlayerId: string;
    inviteUrl?: string;
  }): string {
    const url = params.inviteUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.web.app');
    return (
      `🏆 *JOIN THE CHUKA eFOOTBALL LEAGUE!*\n\n` +
      `Compete with Chuka University's best eFootball mobile players in the official continuous League!\n\n` +
      `✨ *What You Get:*\n` +
      `• Official Chuka League Player Card with QR Code\n` +
      `• Live Standings, Form & Win Streak tracking\n` +
      `• Unlockable Achievements & Dynamic Gaming Titles\n` +
      `• 1v1 Challenges & Head-to-Head Rivalry records\n` +
      `• Entry fee: Only KSh50\n\n` +
      `Join me (*${params.senderEfootball}* • ${params.senderPlayerId}) and climb the rankings:\n` +
      `${url}?tab=LEAGUE`
    );
  },

  // ==========================================================================
  // 11. USERNAME CONFLICT RESOLUTION & ADMIN TOOLS
  // ==========================================================================

  /**
   * Checks if a normalized eFootball username is already claimed
   */
  async isUsernameTaken(normalizedUsername: string, excludeUid?: string): Promise<boolean> {
    if (!normalizedUsername) return false;

    // Check users collection
    const uq = query(
      collection(db, 'users'),
      where('efootballUsernameNormalized', '==', normalizedUsername),
      limit(2)
    );
    const snap = await getDocs(uq);
    if (!snap.empty) {
      for (const d of snap.docs) {
        if (!excludeUid || d.id !== excludeUid) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Admin-only: Force update/resolve username conflict with audit logging
   */
  async resolveUsernameConflict(params: {
    targetUid: string;
    newEfootballUsername: string;
    adminUid: string;
    adminEmail?: string;
    reason: string;
  }): Promise<void> {
    const { targetUid, newEfootballUsername, adminUid, adminEmail, reason } = params;
    const normalized = normalizeEfootballUsername(newEfootballUsername);

    const userRef = doc(db, 'users', targetUid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('User not found.');
    }

    const userData = userSnap.data() as UserProfile;
    const oldUsername = userData.efootballUsername || '';

    // Update user profile
    await updateDoc(userRef, {
      efootballUsername: newEfootballUsername,
      efootballUsernameNormalized: normalized,
      updatedAt: new Date().toISOString(),
    });

    // Audit log
    const logRef = doc(collection(db, 'adminLogs'));
    await setDoc(logRef, {
      id: logRef.id,
      action: 'USERNAME_CONFLICT_RESOLVED',
      actor: adminUid,
      actorEmail: adminEmail || 'wayongohlaurence@gmail.com',
      timestamp: new Date().toISOString(),
      metadata: {
        targetUid,
        playerId: userData.playerId,
        oldUsername,
        newUsername: newEfootballUsername,
        normalized,
        reason,
      },
    });
  },

  /**
   * Check if a player has claimed daily check-in today
   */
  async checkDailyClaimStatus(userId: string): Promise<{
    alreadyClaimed: boolean;
    streakCount?: number;
    pointsEarned?: number;
    isFirstClaimToday?: boolean;
    date?: string;
  }> {
    try {
      const dateStr = getKenyaDateString();
      const q = query(
        collection(db, 'dailyClaims'),
        where('userId', '==', userId),
        where('dateStr', '==', dateStr),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        return { alreadyClaimed: false };
      }
      const data = snap.docs[0].data() as DailyClaim;
      return {
        alreadyClaimed: true,
        streakCount: 1,
        pointsEarned: 5,
        isFirstClaimToday: data.isDayFirstClaim,
        date: data.claimedAt,
      };
    } catch {
      return { alreadyClaimed: false };
    }
  },

  /**
   * Alias for getActiveWeeklyChallenges
   */
  async getWeeklyChallenges(seasonId: string): Promise<WeeklyLeagueChallenge[]> {
    return this.getActiveWeeklyChallenges(seasonId);
  },

  /**
   * Claim daily check-in
   */
  async claimDailyCheckIn(params: {
    userId: string;
    playerId: string;
    displayName: string;
    efootballUsername?: string;
  }): Promise<{
    success: boolean;
    isFirstClaimToday: boolean;
    streakCount: number;
    pointsEarned: number;
    message: string;
  }> {
    const res = await this.submitDailyClaim({
      userId: params.userId,
      playerId: params.playerId,
      displayName: params.displayName,
      efootballUsername: params.efootballUsername || params.displayName,
    });
    return {
      success: res.success,
      isFirstClaimToday: res.isDayFirstClaim,
      streakCount: 1,
      pointsEarned: res.isDayFirstClaim ? 10 : 5,
      message: res.message,
    };
  },

  /**
   * Get formatted list of champions for the Community Hub
   */
  async getChampionsList(): Promise<Array<{ id: string; name: string; title: string; category: 'KNOCKOUT' | 'LEAGUE'; date: string; photoURL?: string }>> {
    try {
      const hof = await this.getHallOfFame();
      const list: Array<{ id: string; name: string; title: string; category: 'KNOCKOUT' | 'LEAGUE'; date: string; photoURL?: string }> = [];
      hof.knockoutChampions.forEach((kc) => {
        list.push({
          id: kc.id,
          name: kc.playerDisplayName || kc.playerId,
          title: kc.tournamentName || 'Knockout Champion',
          category: 'KNOCKOUT',
          date: kc.createdAt,
          photoURL: kc.playerPhotoUrl,
        });
      });
      hof.leagueChampions.forEach((lc) => {
        list.push({
          id: lc.id,
          name: lc.displayName || lc.playerId,
          title: lc.tournamentOrSeasonName || 'League Champion',
          category: 'LEAGUE',
          date: lc.dateAchieved,
          photoURL: lc.photoURL,
        });
      });
      return list;
    } catch {
      return [];
    }
  },
};
