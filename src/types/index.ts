export type TournamentStatus =
  | 'UPCOMING'
  | 'REGISTRATION_OPEN'
  | 'VERIFICATION'
  | 'REGISTRATION_LOCKED'
  | 'BRACKET_READY'
  | 'LIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type MatchStatus =
  | 'SCHEDULED'
  | 'PENDING_ROOM'
  | 'ROOM_REQUIRED'
  | 'ROOM_READY'
  | 'AWAY_JOIN_WINDOW'
  | 'READY_TO_PLAY'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'RESULT_SUBMITTED'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'DISPUTED'
  | 'OVERDUE'
  | 'ADMIN_RESOLUTION'
  | 'CANCELLED';

export type DisputeStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export type EvidenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PURGED';

export type AuditAction =
  | 'PLAYER_REGISTERED'
  | 'TOURNAMENT_CREATED'
  | 'TOURNAMENT_EDITED'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'DUPLICATE_PAYMENT_DETECTED'
  | 'REGISTRATION_LOCKED'
  | 'BRACKET_GENERATED'
  | 'BRACKET_LOCKED'
  | 'BRACKET_RESET'
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'AWAY_PLAYER_READY'
  | 'GAME_STARTED'
  | 'MATCH_RESOLVED'
  | 'RESULT_SUBMITTED'
  | 'RESULT_CONFIRMED'
  | 'RESULT_DISPUTED'
  | 'DRAW_FLAGGED_ADMIN_RESOLUTION'
  | 'DISPUTE_RESOLVED'
  | 'PLAYER_ADVANCED'
  | 'PLAYER_ELIMINATED'
  | 'SCREENSHOT_DELETED'
  | 'CLEANUP_FAILED'
  | 'TOURNAMENT_COMPLETED'
  | 'CHAMPION_CROWNED'
  | 'PRIZE_RECORD_CREATED'
  | 'PRIZE_PAYOUT_RECORDED'
  | 'PRIZE_MARKED_PROCESSING'
  | 'PRIZE_MARKED_PAID'
  | 'PRIZE_MARKED_FAILED'
  | 'DEADLINE_RESOLVED'
  | 'PLAYER_SUSPENDED'
  | 'REGISTRATION_REMOVED'
  | 'LEAGUE_PAYMENT_SUBMITTED'
  | 'LEAGUE_PAYMENT_VERIFIED'
  | 'LEAGUE_PAYMENT_REJECTED'
  | 'LEAGUE_MEMBER_ACTIVATED'
  | 'LEAGUE_MEMBER_SUSPENDED'
  | 'LEAGUE_CHALLENGE_ISSUED'
  | 'LEAGUE_CHALLENGE_ACCEPTED'
  | 'LEAGUE_CHALLENGE_DECLINED'
  | 'LEAGUE_MATCH_CREATED'
  | 'LEAGUE_RESULT_SUBMITTED'
  | 'LEAGUE_RESULT_CONFIRMED'
  | 'LEAGUE_RESULT_DISPUTED'
  | 'LEAGUE_DISPUTE_RESOLVED'
  | 'LEAGUE_MATCH_VOIDED'
  | 'LEAGUE_STANDINGS_RECALCULATED'
  | 'LEAGUE_SEASON_CREATED'
  | 'LEAGUE_SEASON_UPDATED'
  | 'LEAGUE_SHEETS_SYNCED'
  | 'ACHIEVEMENT_AWARDED'
  | 'ACHIEVEMENT_REVOKED'
  | 'DAILY_CLAIMED'
  | 'USERNAME_CONFLICT_RESOLVED'
  | 'CHALLENGE_PROGRESS_UPDATED'
  | 'HALL_OF_FAME_CREATED'
  | 'HALL_OF_FAME_UPDATED';

export interface AuditLog {
  id: string;
  action: AuditAction;
  actor: string; // uid or system
  actorEmail?: string;
  timestamp: string;
  tournamentId?: string;
  matchId?: string;
  metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string; // Firebase Auth UID
  userId?: string; // Permanent CHUKA ID: e.g. "CHUKA-000001"
  playerId: string; // e.g. "CHUKA-000001"
  firebaseUid?: string; // Firebase Auth UID
  displayName: string;
  email: string;
  photoURL?: string;
  photoUrl?: string;
  efootballUsername?: string;
  efootballUsernameNormalized?: string;
  efootballAccountImageUrl?: string;
  whatsappNumber?: string;
  whatsappCountryCode?: string;
  whatsappUpdatedAt?: string;
  whatsappStatus?: 'SET' | 'NOT_SET';
  role?: 'PLAYER' | 'ADMIN' | string;
  status?: 'ACTIVE' | 'SUSPENDED' | string;
  createdAt?: string;
  registeredAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  wins: number;
  losses: number;
  championships: number;
  isAdmin?: boolean;
  isSuspended?: boolean;
  whatsappRequired?: boolean;
  sheetsSyncStatus?: 'SYNCED' | 'FAILED' | 'PENDING';
  sheetsSyncedAt?: string;
  sheetsSyncError?: string;
}

export interface TournamentRoundConfig {
  id: string; // e.g. "week-04_round-1"
  tournamentId: string;
  roundNumber: number;
  roundName: string; // e.g. "Round of 512", "Quarterfinal"
  startDate: string;
  deadline: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  matchCount?: number;
  completedMatchCount?: number;
  totalMatches?: number;
  createdAt?: string;
}

export type RoundSchedule = TournamentRoundConfig;

export interface Tournament {
  id: string;
  weekNumber: number;
  name: string; // e.g. "CHUKA eFOOTBALL WEEK 04"
  registrationOpenDate: string;
  registrationCloseDate: string;
  verificationDate: string;
  startDate: string;
  endDate: string;
  entryFee: number; // in KSh (default: 20)
  prizePool?: number; // default: 1000
  game?: string; // default: 'eFootball Mobile'
  platform?: string; // default: 'Mobile / Android'
  roomJoinWindowMinutes?: number; // default: 5
  verificationStartDate?: string;
  verificationEndDate?: string;
  bracketSize?: number | null;
  byesCount?: number | null;
  bracketLocked?: boolean;
  maxPlayers?: number;
  registeredCount: number;
  verifiedCount: number;
  status: TournamentStatus;
  currentRound?: string;
  totalRounds?: number;
  championPlayerId?: string;
  championName?: string;
  championPhoto?: string;
  championScore?: string;
  completedDate?: string;
  lockedAt?: string;
  lockedBy?: string;
  bracketVersion?: string | null;
  rulesConfig?: {
    matchDurationMinutes: number;
    extraTime: boolean;
    penalties: boolean;
    condition: string;
    substitutions: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface TournamentStats {
  id: string; // tournamentId
  statId?: string;
  tournamentId: string;
  verifiedPlayers: number;
  totalPlayers?: number;
  matchesTotal: number;
  totalMatches?: number;
  matchesCompleted: number;
  matchesPending: number;
  matchesDisputed: number;
  matchesOverdue: number;
  playersRemaining: number;
  currentRound: string;
  totalGoals?: number;
  averageGoalsPerMatch?: number;
  updatedAt: string;
}

export type PlayerRegistrationStatus =
  | 'NOT_REGISTERED'
  | 'PENDING'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_PENDING'
  | 'VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'DISQUALIFIED'
  | 'SUSPENDED'
  | 'ELIMINATED'
  | 'CHAMPION';

export interface TournamentEntry {
  id: string; // Deterministic: `${tournamentId}_${userId}`
  registrationId?: string; // Standard registrationId alias
  tournamentId: string;
  userId?: string; // Firebase Auth UID (scrubbed from public rosters)
  playerId: string;
  displayName: string;
  photoURL?: string;
  registeredAt: string; // ISO date
  paymentStatus?: 'UNPAID' | 'PENDING' | 'PAYMENT_PENDING' | 'VERIFIED' | 'PAYMENT_REJECTED' | 'REJECTED';
  registrationStatus?: 'PENDING_PAYMENT' | 'UNPAID' | 'PENDING' | 'PAYMENT_PENDING' | 'VERIFIED' | 'PAYMENT_REJECTED' | 'REJECTED' | 'CANCELLED';
  mpesaTransactionCode?: string;
  mpesaPhone?: string;
  mpesaCode?: string; // backwards compatibility alias
  duplicateFlag?: boolean;
  isSuspectedDuplicate?: boolean;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  status:
    | 'PAYMENT_REQUIRED'
    | 'PENDING'
    | 'PAYMENT_PENDING'
    | 'VERIFIED'
    | 'PAYMENT_REJECTED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'DISQUALIFIED'
    | 'SUSPENDED'
    | 'ELIMINATED'
    | 'CHAMPION';
  paymentId?: string;
}

export interface PaymentRecord {
  id: string; // paymentId
  paymentId?: string;
  registrationId: string;
  tournamentId: string;
  tournamentName?: string;
  userId: string;
  playerId: string;
  playerDisplayName: string;
  amount: number; // 20
  currency: string; // 'KES'
  paymentMethod: string; // 'MPESA'
  mpesaTransactionCode: string; // e.g. "QDH58291KL"
  mpesaPhone: string;
  mpesaCode?: string; // backwards compatibility alias
  timestamp: string;
  status: PaymentStatus; // 'PENDING' | 'VERIFIED' | 'REJECTED'
  duplicateFlag?: boolean;
  isSuspectedDuplicate?: boolean; // backwards compatibility alias
  duplicateOfPaymentId?: string;
  flaggedByAdmin?: boolean;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  reviewedBy?: string; // alias
  reviewedAt?: string; // alias
  createdAt?: string;
  updatedAt?: string;
}

export interface PlayerSubmission {
  homeScore: number;
  awayScore: number;
  submittedAt: string;
  submittedByUid: string;
  submittedByPlayerId: string;
  screenshotId?: string;
}

export interface MatchFixture {
  id: string;
  matchId: string; // e.g. "CHK-W04-M000421"
  tournamentId: string;
  round?: string; // alias for roundName
  roundId?: string;
  roundNumber: number;
  roundName: string; // "Round of 512", "Round 1", "Quarterfinal", "Semifinal", "Final"
  bracketPosition?: number;
  matchPosition?: number; // alias for bracketPosition
  homePlayerId: string;
  homePlayerUid?: string;
  homePlayerName: string;
  homeDisplayName?: string; // alias for homePlayerName
  homePlayerPhoto?: string;
  awayPlayerId: string;
  awayPlayerUid?: string;
  awayPlayerName: string;
  awayDisplayName?: string; // alias for awayPlayerName
  awayPlayerPhoto?: string;
  status: MatchStatus;
  deadline?: string;
  matchDeadline?: string; // alias for deadline
  roomNumber?: string; // eFootball Mobile 6-digit room number created by HOME player
  roomCreatedAt?: string;
  roomJoinWindowMinutes?: number; // Configured time for Away player to join (default: 5 mins)
  awayReady?: boolean; // Away player clicked [I'M READY]
  awayReadyAt?: string;
  roomStatus?: 'NOT_CREATED' | 'READY';
  homeScore?: number | null;
  awayScore?: number | null;
  submittedBy?: 'HOME' | 'AWAY';
  submittedByUid?: string;
  submittedAt?: string;
  submissions?: Record<string, PlayerSubmission>; // keyed by submitter UID
  winnerId?: string;
  winnerPlayerId?: string; // alias for winnerId
  winnerUid?: string;
  loserId?: string;
  loserPlayerId?: string; // alias for loserId
  loserUid?: string;
  isBye?: boolean;
  resultStatus?: string;
  evidenceStatus?: EvidenceStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface MatchEvidenceRecord {
  id: string;
  matchId: string;
  tournamentId: string;
  uploadedBy: string; // uid
  uploaderPlayerId?: string;
  storagePath?: string; // e.g. "match_evidence/CHK-W04-M0001/HOME_1720000000.jpg"
  screenshotUrl?: string; // Purged on confirmation
  status: EvidenceStatus;
  cleanupStatus?: 'PENDING' | 'PURGED' | 'FAILED';
  cleanupError?: string;
  lastCleanupAttemptAt?: string;
  uploadedAt: string;
  approvedAt?: string;
  deletedAt?: string;
}

export type PrizeStatus = 'PENDING_PAYOUT' | 'PAYOUT_PROCESSING' | 'PAID' | 'PAYOUT_FAILED';

export interface ChampionRecord {
  id: string; // e.g. "CHAMP_week-05"
  tournamentId: string;
  weekNumber: number;
  tournamentName: string;
  playerId: string;
  playerUid: string;
  displayName: string;
  photoURL?: string;
  finalMatchId: string;
  finalScore: string;
  tournamentDate: string;
  prizeAmount: number; // KSh 1,000
  prizeStatus: PrizeStatus;
  payoutMpesaCode?: string;
  payoutPhone?: string;
  payoutPaidAt?: string;
  payoutRecordedBy?: string;
  createdAt: string;
}

export interface PrizeRecord {
  id: string; // e.g. "PRIZE_week-05"
  tournamentId: string;
  weekNumber: number;
  tournamentName: string;
  championPlayerId: string;
  championPlayerUid: string;
  championDisplayName: string;
  amount: number; // KSh 1,000
  status: PrizeStatus;
  payoutMpesaCode?: string;
  payoutPhone?: string;
  payoutPaidAt?: string;
  payoutRecordedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DisputeRecord {
  id: string;
  matchId: string;
  tournamentId: string;
  reportedBy: string; // uid
  reportedByName: string;
  reportedPlayerId: string;
  reason:
    | 'WRONG_SCORE'
    | 'OPPONENT_NO_SHOW'
    | 'CONNECTION_ISSUE'
    | 'FAKE_SCREENSHOT'
    | 'INCORRECT_ROOM'
    | 'OTHER';
  notes: string;
  status: DisputeStatus;
  originalSubmissions?: Record<string, any>;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  resolutionDecision?: string;
}

export interface SystemSettings {
  whatsappCommunityUrl: string;
  defaultEntryFee: number;
  announcement?: string;
  mpesaPaybillOrTill?: string;
  mpesaAccountName?: string;
}

export interface MatchRoomPrivate {
  id: string; // matchId
  matchId: string;
  tournamentId: string;
  homePlayerUid: string;
  homePlayerId: string;
  awayPlayerUid: string;
  awayPlayerId: string;
  roomNumber: string; // validated 6 digits numeric only
  roomCreatedAt: string;
  roomJoinWindowMinutes: number; // default: 5
  awayReady?: boolean;
  awayReadyAt?: string;
  homeWhatsApp?: string;
  awayWhatsApp?: string;
  updatedAt: string;
  updatedBy?: string;
  history?: Array<{
    roomNumber: string;
    changedAt: string;
    changedBy: string;
  }>;
}

export type SheetsSyncStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNC_PENDING';

export interface SheetsSyncLog {
  id: string;
  timestamp: string;
  triggeredBy: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  entityType?: string;
  entityId?: string;
  attemptCount: number;
  completedAt?: string;
  tournamentsSynced: number;
  playersSynced: number;
  paymentsSynced: number;
  matchesSynced: number;
  championsSynced: number;
  prizesSynced: number;
  error?: string;
  durationMs?: number;
}

export interface SheetsConfig {
  webhookUrl?: string; // Google Apps Script /exec Web App URL
  appsScriptUrl?: string; // Alias for webhookUrl
  autoSyncEnabled?: boolean;
  lastSuccessfulSync?: string;
  lastError?: string;
  pendingCount?: number;
  failedCount?: number;
  hasEnvWebhook?: boolean;
}

// ============================================================================
// CHUKA eFOOTBALL — PERMANENT LEAGUE SYSTEM TYPES
// ============================================================================

export type LeagueSeasonStatus = 'UPCOMING' | 'OPEN' | 'ACTIVE' | 'CLOSED' | 'COMPLETED';

export interface LeagueSeason {
  id: string; // e.g. "SEASON_01"
  name: string; // "CHUKA eFOOTBALL LEAGUE — SEASON 01"
  seasonNumber: number;
  entryFee: number; // KSh 50
  paymentDestinationPhone: string; // "0111359682"
  startDate: string;
  endDate: string;
  status: LeagueSeasonStatus;
  pointsForWin: number; // default: 3
  pointsForDraw: number; // default: 1
  pointsForLoss: number; // default: 0
  totalMembers: number;
  totalMatches: number;
  publishedPrizePoolNote?: string; // e.g. "KSh50 is a participation fee. Any prize is separately published."
  createdAt: string;
  updatedAt: string;
}

export type LeagueMemberStatus = 'PENDING_PAYMENT' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface LeagueMember {
  id: string; // e.g. `${leagueId}_${playerId}`
  leagueId: string;
  userId: string; // Firebase Auth UID
  playerId: string; // Permanent CHUKA ID, e.g. "CHUKA-000042"
  displayName: string;
  efootballUsername: string;
  efootballUsernameNormalized?: string;
  photoURL?: string;
  squadImageUrl?: string;
  status: LeagueMemberStatus;
  joinedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  cardQrData: string; // Safe public profile URL or identifier, NO private PII
  cardIssuedAt?: string;

  // Derived statistics (calculated strictly from confirmed results)
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  winRate: number; // 0 - 100%
  currentPosition: number; // 1, 2, 3... derived from standings
  previousPosition?: number;
  currentStreak?: number;
  longestWinStreak?: number;
  currentForm?: Array<'W' | 'D' | 'L'>;
  cleanSheets?: number;
  titles?: string[];

  updatedAt: string;
}

export type LeaguePaymentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CANCELLED';

export interface LeaguePayment {
  id: string;
  leagueId: string;
  userId: string; // Auth UID
  playerId: string; // CHUKA-000042
  accountName: string;
  amount: number; // 50
  currency: 'KES';
  mpesaCode: string;
  phoneNumber: string; // M-Pesa phone used
  destinationPhone: string; // "0111359682"
  status: LeaguePaymentStatus;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  duplicateFlag?: boolean;
  isSuspectedDuplicate?: boolean;
  flaggedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeagueChallengeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface LeagueChallenge {
  id: string;
  leagueId: string;
  challengerUid: string;
  challengerPlayerId: string;
  challengerName: string;
  challengerEfootball: string;
  challengedUid: string;
  challengedPlayerId: string;
  challengedName: string;
  challengedEfootball: string;
  status: LeagueChallengeStatus;
  message?: string;
  createdAt: string;
  respondedAt?: string;
  leagueMatchId?: string;
}

export type LeagueMatchStatus =
  | 'SCHEDULED'
  | 'ROOM_READY'
  | 'PLAYING'
  | 'AWAITING_OPPONENT_CONFIRMATION'
  | 'CONFIRMED'
  | 'DISPUTED'
  | 'VOID';

export interface LeagueMatch {
  id: string; // e.g. "LEAGUE-MATCH-000001"
  leagueId: string;
  seasonId?: string; // alias for leagueId
  matchNumber: number;
  homePlayerUid: string;
  homePlayerId: string;
  homePlayerName: string;
  homeEfootball: string;
  homeEfootballUsername?: string; // alias for homeEfootball
  awayPlayerUid: string;
  awayPlayerId: string;
  awayPlayerName: string;
  awayEfootball: string;
  awayEfootballUsername?: string; // alias for awayEfootball
  status: LeagueMatchStatus;

  // Coordination room
  roomNumber?: string; // 6 digits
  roomHostUid?: string;
  roomCreatedAt?: string;

  // Result submission
  submittedByUid?: string;
  submittedByPlayerId?: string;
  submittedAt?: string;
  homeScore?: number;
  awayScore?: number;
  winnerPlayerId?: string | 'DRAW' | null;
  winnerUid?: string | 'DRAW' | null;
  evidenceUrl?: string;

  // Dual confirmation
  confirmedAt?: string;
  confirmedByUid?: string;
  isStatsApplied?: boolean; // Idempotency guard for stats

  createdAt: string;
  updatedAt: string;
}

export type LeagueDisputeReason =
  | 'WRONG_SCORE'
  | 'WRONG_OPPONENT'
  | 'MATCH_DID_NOT_HAPPEN'
  | 'SCREENSHOT_DISAGREEMENT'
  | 'OTHER';

export type LeagueDisputeRuling =
  | 'CONFIRM_HOME_WIN'
  | 'CONFIRM_AWAY_WIN'
  | 'CONFIRM_DRAW'
  | 'VOID_MATCH'
  | 'REQUEST_REPLAY';

export interface LeagueDispute {
  id: string;
  leagueId: string;
  matchId: string;
  reportedByUid: string;
  reportedByPlayerId: string;
  reason: LeagueDisputeReason;
  explanation: string;
  evidenceUrl?: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  adminRuling?: LeagueDisputeRuling;
  officialHomeScore?: number;
  officialAwayScore?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface LeagueStandingRow {
  position: number;
  previousPosition?: number;
  rankingMovement?: {
    diff: number; // e.g. +3 means climbed 3 spots, -2 means dropped 2 spots, 0 means unchanged
    display: string; // e.g. "↑ 3", "↓ 2", "—"
  };
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
  winRate: number;
  recentForm: Array<'W' | 'D' | 'L'>; // last 5
  currentStreak?: number;
  longestWinStreak?: number;
  streakDisplay?: string;
  cleanSheets?: number;
  titles?: string[];
}

export interface PublicLeagueProfile {
  playerId: string;
  displayName: string;
  efootballUsername: string;
  photoURL?: string;
  squadImageUrl?: string;
  currentPosition: number;
  previousPosition?: number;
  rankingMovement?: {
    diff: number;
    display: string;
  };
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  winRate: number;
  currentStreak: number;
  longestWinStreak: number;
  streakDisplay: string;
  cleanSheets: number;
  titles: string[];
  achievements: PlayerAchievement[];
  recentMatches: Array<{
    matchId: string;
    opponentName: string;
    opponentPlayerId: string;
    result: 'W' | 'D' | 'L';
    scoreDisplay: string;
    date: string;
  }>;
  isVerifiedMember: boolean;
  memberSince: string;
}

// ============================================================================
// GAMIFICATION & ENGAGEMENT ENGINE TYPES
// ============================================================================

export type AchievementType =
  | 'FIRST_WIN'
  | 'FIVE_WINS'
  | 'TEN_WINS'
  | 'TWENTY_WINS'
  | 'FIFTY_WINS'
  | 'HUNDRED_GOALS'
  | 'FIVE_WIN_STREAK'
  | 'TEN_WIN_STREAK'
  | 'TWENTY_WIN_STREAK'
  | 'CLEAN_SHEET'
  | 'GIANT_KILLER'
  | 'RISING_STAR'
  | 'VETERAN';

export interface PlayerAchievement {
  id: string; // Document ID: `ACHV_${playerId}_${achievementType}`
  playerId: string; // Permanent CHUKA ID, e.g. "CHUKA-000001"
  userId: string; // Auth UID
  achievementType: AchievementType;
  title: string;
  description: string;
  iconName: string; // Lucide icon identifier
  earnedAt: string; // ISO 8601
  sourceMatchId?: string; // Authoritative confirmed match that unlocked it
  sourceSeasonId?: string;
  metadata?: {
    rankGap?: number;
    streakLength?: number;
    opponentPlayerId?: string;
    opponentName?: string;
    scoreDisplay?: string;
    goalsCount?: number;
  };
}

export interface PlayerTitle {
  id: string;
  title: string;
  badgeColor: string; // Tailwind class identifier
  description: string;
  earnedAt: string;
}

export interface DailyClaim {
  id: string; // `CLAIM_${dateStr}_${playerId}` (e.g. CLAIM_2026-09-18_CHUKA-000001)
  dateStr: string; // YYYY-MM-DD
  playerId: string;
  userId: string;
  displayName: string;
  efootballUsername: string;
  claimedAt: string;
  isDayFirstClaim: boolean; // True if this player claimed first for the entire league that calendar day!
}

export interface RivalryHeadToHead {
  playerAId: string;
  playerAName: string;
  playerAEfootball: string;
  playerBId: string;
  playerBName: string;
  playerBEfootball: string;
  totalMeetings: number;
  playerAWins: number;
  playerBWins: number;
  draws: number;
  playerAGoals: number;
  playerBGoals: number;
  recentMeetings: Array<{
    matchId: string;
    date: string;
    homeScore: number;
    awayScore: number;
    homePlayerId: string;
    awayPlayerId: string;
    seasonId?: string;
    summary: string;
  }>;
}

export interface WeeklyLeagueChallenge {
  id: string;
  seasonId: string;
  weekNumber: number;
  title: string;
  description: string;
  targetCount: number;
  category: 'MATCHES_PLAYED' | 'WINS' | 'GOALS' | 'CLEAN_SHEET' | 'STREAK';
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface HallOfFameRecord {
  id: string;
  category: 'KNOCKOUT' | 'LEAGUE';
  weekOrSeasonNumber: number;
  tournamentOrSeasonName: string;
  playerId: string; // CHUKA ID
  userId: string;
  displayName: string;
  efootballUsername: string;
  photoURL?: string;
  dateAchieved: string;
  finalMatchSummary?: string; // for Knockout: e.g. "Won 3-1 vs CHUKA-000014 in Grand Final"
  finalStatsSummary?: string; // for League: e.g. "Champion: 28 Pts, 9W-1D-0L, +18 GD"
  prizeAmount?: number;
  createdAt: string;
}

// ============================================================================
// SOCIAL HUB & COMMUNITY LAYER TYPES
// ============================================================================

export type SocialActivityType =
  | 'PLAYER_JOINED_LEAGUE'
  | 'MATCH_CONFIRMED'
  | 'ACHIEVEMENT_EARNED'
  | 'WIN_STREAK_STARTED'
  | 'WIN_STREAK_EXTENDED'
  | 'RANKING_MOVEMENT'
  | 'DAILY_FIRST_CLAIM'
  | 'KNOCKOUT_CHAMPION'
  | 'LEAGUE_CHAMPION';

export interface SocialActivity {
  activityId: string;
  type: SocialActivityType;
  playerId: string;
  playerUsername?: string;
  playerDisplayName?: string;
  playerPhotoURL?: string;
  relatedPlayerId?: string;
  relatedPlayerUsername?: string;
  relatedPlayerDisplayName?: string;
  matchId?: string;
  tournamentId?: string;
  seasonId?: string;
  achievementId?: string;
  message: string;
  createdAt: string; // ISO
  timestamp: number;
  visibility: 'PUBLIC' | 'MEMBERS';
  metadata?: {
    streakCount?: number;
    scoreDisplay?: string;
    achievementTitle?: string;
    achievementIcon?: string;
    positionChange?: number;
    oldPosition?: number;
    newPosition?: number;
    points?: number;
    tournamentName?: string;
    roundName?: string;
    [key: string]: any;
  };
}

export type CommunityPostType =
  | 'MATCH_INVITATION'
  | 'GENERAL'
  | 'LOOKING_FOR_OPPONENT'
  | 'ACHIEVEMENT_SHARE'
  | 'LEAGUE_DISCUSSION';

export interface CommunityPost {
  postId: string;
  authorUid: string;
  authorPlayerId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  authorPosition?: number;
  type: CommunityPostType;
  content: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'REPORTED' | 'REMOVED';
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'IMPERSONATION'
  | 'SCAM'
  | 'INAPPROPRIATE_CONTENT'
  | 'FALSE_INFORMATION'
  | 'OTHER';

export interface CommunityReport {
  reportId: string;
  postId: string;
  reportedBy: string; // auth.uid
  reportedByPlayerId?: string;
  reason: ReportReason;
  description: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolution?: string;
}

export interface UserBlock {
  blockId: string; // `${blockerUid}_${blockedPlayerId}`
  blockerUid: string;
  blockedPlayerId: string;
  blockedUsername?: string;
  createdAt: string;
}

export type NotificationType =
  | 'CHALLENGE_RECEIVED'
  | 'RESULT_CONFIRMED'
  | 'RESULT_DISPUTED'
  | 'ACHIEVEMENT_EARNED'
  | 'RANKING_CHANGED'
  | 'CARD_ACTIVATED'
  | 'DAILY_FIRST_OPEN'
  | 'COMMUNITY_MENTION';

export interface InAppNotification {
  notificationId: string;
  recipientUid: string;
  recipientPlayerId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkTab?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface PlayerRivalrySummary {
  opponentPlayerId: string;
  opponentUsername: string;
  opponentDisplayName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  latestMeetingDate: string;
  latestScoreDisplay: string;
  lastMeetingMatchId?: string;
}

export interface PublicPlayerSearchResult {
  playerId: string;
  userId?: string;
  displayName: string;
  efootballUsername: string;
  photoURL?: string;
  squadImageUrl?: string;
  currentPosition?: number;
  position?: number;
  points: number;
  wins?: number;
  draws?: number;
  losses?: number;
  winRate?: number;
  currentStreak?: number;
  streak?: number;
  form?: string[];
  isVerifiedMember: boolean;
}



