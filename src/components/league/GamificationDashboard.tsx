import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Award,
  Shield,
  Target,
  Sparkles,
  Calendar,
  Zap,
  Users,
  Swords,
  CheckCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { LeagueStandingRow, UserProfile, WeeklyLeagueChallenge, RivalryHeadToHead, PlayerAchievement, AchievementType } from '../../types';
import { gamificationService, ACHIEVEMENT_REGISTRY } from '../../services/gamificationService';
import { AchievementBadge } from '../common/AchievementBadge';

interface GamificationDashboardProps {
  standings: LeagueStandingRow[];
  activeSeasonId: string;
  currentUserProfile: UserProfile | null;
  onSelectPlayerProfile: (playerId: string) => void;
}

export const GamificationDashboard: React.FC<GamificationDashboardProps> = ({
  standings,
  activeSeasonId,
  currentUserProfile,
  onSelectPlayerProfile,
}) => {
  // Daily check-in state
  const [dailyStatus, setDailyStatus] = useState<{
    alreadyClaimed: boolean;
    streakCount: number;
    pointsEarned?: number;
    isFirstClaimToday?: boolean;
    date: string;
  } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Rivalry head-to-head state
  const [rival1Id, setRival1Id] = useState<string>(currentUserProfile?.playerId || (standings[0]?.playerId ?? ''));
  const [rival2Id, setRival2Id] = useState<string>(standings[1]?.playerId ?? '');
  const [h2hResult, setH2HResult] = useState<RivalryHeadToHead | null>(null);
  const [isH2HLoading, setIsH2HLoading] = useState(false);

  // Weekly challenges state
  const [challenges, setChallenges] = useState<WeeklyLeagueChallenge[]>([]);

  // Achievements state
  const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievement[]>([]);

  // Load player achievements
  useEffect(() => {
    const pId = currentUserProfile?.playerId || currentUserProfile?.userId;
    if (pId) {
      gamificationService
        .getPlayerAchievements(pId)
        .then((list) => setPlayerAchievements(list))
        .catch((err) => console.warn('Player achievements error:', err));
    }
  }, [currentUserProfile?.playerId, currentUserProfile?.userId]);

  // Load daily claim status
  useEffect(() => {
    if (currentUserProfile) {
      gamificationService
        .checkDailyClaimStatus(currentUserProfile.id)
        .then((status) => setDailyStatus(status))
        .catch((err) => console.warn('Daily status error:', err));
    }
  }, [currentUserProfile?.id]);

  // Load weekly challenges
  useEffect(() => {
    gamificationService
      .getWeeklyChallenges(activeSeasonId)
      .then((c) => setChallenges(c))
      .catch((err) => console.warn('Challenges error:', err));
  }, [activeSeasonId]);

  // Load head-to-head rivalry when selection changes
  useEffect(() => {
    if (rival1Id && rival2Id && rival1Id !== rival2Id) {
      setIsH2HLoading(true);
      gamificationService
        .getHeadToHeadRivalry(rival1Id, rival2Id, activeSeasonId)
        .then((res) => {
          setH2HResult(res);
          setIsH2HLoading(false);
        })
        .catch(() => setIsH2HLoading(false));
    } else {
      setH2HResult(null);
    }
  }, [rival1Id, rival2Id, activeSeasonId]);

  const handleClaimDaily = async () => {
    if (!currentUserProfile) return;
    setIsClaiming(true);
    setClaimMessage(null);
    try {
      const res = await gamificationService.claimDailyCheckIn({
        userId: currentUserProfile.id,
        playerId: currentUserProfile.playerId || currentUserProfile.userId || '',
        displayName: currentUserProfile.displayName,
      });

      setDailyStatus({
        alreadyClaimed: true,
        streakCount: res.streakCount,
        pointsEarned: res.pointsEarned,
        isFirstClaimToday: res.isFirstClaimToday,
        date: new Date().toISOString(),
      });

      setClaimMessage({
        text: res.message,
        success: true,
      });
    } catch (err: any) {
      setClaimMessage({
        text: err.message || 'Failed to claim check-in reward.',
        success: false,
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Derived Leaderboards:
  // 1. Top Scorers (Goals For)
  const topScorers = [...standings]
    .sort((a, b) => b.goalsFor - a.goalsFor || b.points - a.points)
    .filter((s) => s.goalsFor > 0)
    .slice(0, 5);

  // 2. Clean Sheet Kings
  const topCleanSheets = [...standings]
    .sort((a, b) => (b.cleanSheets || 0) - (a.cleanSheets || 0) || b.points - a.points)
    .filter((s) => (s.cleanSheets || 0) > 0)
    .slice(0, 5);

  // 3. Hot Streaks (Current Win Streak)
  const topStreaks = [...standings]
    .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0) || (b.longestWinStreak || 0) - (a.longestWinStreak || 0))
    .filter((s) => (s.currentStreak || 0) > 0)
    .slice(0, 5);

  // 4. Elite Win Rates (minimum 3 matches played)
  const topWinRates = [...standings]
    .filter((s) => s.matchesPlayed >= 3)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* 1. Daily Check-In & Bonus Bar */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-black to-amber-950/30 border border-white/10 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-500/30">
              <Zap className="w-3 h-3" /> DAILY LEAGUE ENGAGEMENT
            </span>
            <span className="text-white/40 text-xs font-mono">00:00 – 23:59 EAT</span>
          </div>
          <h2 className="font-heading font-black text-xl text-white">
            Daily Check-In & Early Bird Bounty
          </h2>
          <p className="text-xs text-white/70 max-w-xl">
            Claim your daily check-in to build active login streaks (+5 pts). Be the{' '}
            <strong className="text-amber-300">first verified player in Kenya</strong> to claim
            between 00:00 and 23:59 EAT to earn the double bonus (+10 pts)!
          </p>
          {dailyStatus?.alreadyClaimed && (
            <div className="flex items-center gap-2 pt-1 font-mono text-xs text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>Checked in today! Current Streak: {dailyStatus.streakCount} Day(s)</span>
            </div>
          )}
          {claimMessage && (
            <div
              className={`p-2.5 rounded-xl font-mono text-xs border ${
                claimMessage.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {claimMessage.text}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-full md:w-auto">
          {currentUserProfile ? (
            <button
              onClick={handleClaimDaily}
              disabled={isClaiming || dailyStatus?.alreadyClaimed}
              className={`w-full md:w-auto px-6 py-3.5 rounded-2xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                dailyStatus?.alreadyClaimed
                  ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:scale-105 shadow-lg shadow-emerald-500/20 active:scale-95'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>
                {isClaiming
                  ? 'CLAIMING REWARD...'
                  : dailyStatus?.alreadyClaimed
                  ? 'CHECKED IN TODAY'
                  : 'CLAIM DAILY CHECK-IN (+5 PTS)'}
              </span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-white/5 text-white/50 text-xs font-mono text-center">
              Sign in with Google to claim daily rewards
            </div>
          )}
        </div>
      </div>

      {/* 2. Four Competitive Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Leaderboard A: Top Goal Scorers */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                  Top Scorers
                </h3>
                <div className="text-[10px] font-mono text-white/40">Goals For</div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400">GOLDEN BOOT</span>
          </div>

          <div className="space-y-2">
            {topScorers.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-white/40">No goals yet</div>
            ) : (
              topScorers.map((s, idx) => (
                <div
                  key={s.playerId}
                  onClick={() => onSelectPlayerProfile(s.playerId)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-black text-[10px] ${
                        idx === 0
                          ? 'bg-amber-400 text-black'
                          : idx === 1
                          ? 'bg-slate-300 text-black'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="truncate text-xs">
                      <div className="font-bold text-white truncate">{s.displayName}</div>
                      <div className="text-[10px] font-mono text-white/40">{s.playerId}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono font-black text-emerald-400">
                      {s.goalsFor} G
                    </div>
                    <div className="text-[9px] font-mono text-white/40">{s.matchesPlayed} MP</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard B: Clean Sheets */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                  Clean Sheets
                </h3>
                <div className="text-[10px] font-mono text-white/40">Zero Goals Conceded</div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-400">GOLDEN GLOVE</span>
          </div>

          <div className="space-y-2">
            {topCleanSheets.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-white/40">
                No clean sheets yet
              </div>
            ) : (
              topCleanSheets.map((s, idx) => (
                <div
                  key={s.playerId}
                  onClick={() => onSelectPlayerProfile(s.playerId)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-black text-[10px] ${
                        idx === 0 ? 'bg-cyan-400 text-black' : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="truncate text-xs">
                      <div className="font-bold text-white truncate">{s.displayName}</div>
                      <div className="text-[10px] font-mono text-white/40">{s.playerId}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono font-black text-cyan-400">
                      {s.cleanSheets} CS
                    </div>
                    <div className="text-[9px] font-mono text-white/40">
                      {s.goalsAgainst} GA
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard C: Active Win Streaks */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                  Win Streaks
                </h3>
                <div className="text-[10px] font-mono text-white/40">Consecutive Wins</div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-orange-400">HOT FORM</span>
          </div>

          <div className="space-y-2">
            {topStreaks.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-white/40">
                No active win streaks
              </div>
            ) : (
              topStreaks.map((s, idx) => (
                <div
                  key={s.playerId}
                  onClick={() => onSelectPlayerProfile(s.playerId)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center font-mono font-black text-[10px] text-white/70">
                      {idx + 1}
                    </span>
                    <div className="truncate text-xs">
                      <div className="font-bold text-white truncate">{s.displayName}</div>
                      <div className="text-[10px] font-mono text-white/40">{s.playerId}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-1 font-mono">
                    <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                    <span className="text-xs font-black text-orange-300">+{s.currentStreak}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard D: Highest Win Rate */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-black text-xs text-white uppercase tracking-wider">
                  Win Rate Elite
                </h3>
                <div className="text-[10px] font-mono text-white/40">Min. 3 Matches</div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-amber-400">EFFICIENCY</span>
          </div>

          <div className="space-y-2">
            {topWinRates.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-white/40">
                Need at least 3 matches
              </div>
            ) : (
              topWinRates.map((s, idx) => (
                <div
                  key={s.playerId}
                  onClick={() => onSelectPlayerProfile(s.playerId)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center font-mono font-black text-[10px] text-white/70">
                      {idx + 1}
                    </span>
                    <div className="truncate text-xs">
                      <div className="font-bold text-white truncate">{s.displayName}</div>
                      <div className="text-[10px] font-mono text-white/40">{s.playerId}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono font-black text-amber-300">
                      {s.winRate}%
                    </div>
                    <div className="text-[9px] font-mono text-white/40">
                      {s.wins}W / {s.losses}L
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Head-to-Head (Rivalry) Inspector */}
      <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-emerald-400" />
            <h3 className="font-heading font-black text-base text-white uppercase tracking-wider">
              Head-to-Head (Rivalry) Inspector
            </h3>
          </div>
          <span className="text-xs font-mono text-white/50">
            Compare authoritative head-to-head records across any two members
          </span>
        </div>

        {/* Player Selector controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-white/60 uppercase">Player 1</label>
            <select
              value={rival1Id}
              onChange={(e) => setRival1Id(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select Player 1...</option>
              {standings.map((m) => (
                <option key={m.playerId} value={m.playerId}>
                  {m.displayName} ({m.playerId})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-white/60 uppercase">Player 2</label>
            <select
              value={rival2Id}
              onChange={(e) => setRival2Id(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select Player 2...</option>
              {standings.map((m) => (
                <option key={m.playerId} value={m.playerId}>
                  {m.displayName} ({m.playerId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Result Display */}
        {isH2HLoading ? (
          <div className="py-12 text-center text-xs font-mono text-white/40">
            Analyzing confirmed head-to-head history...
          </div>
        ) : h2hResult ? (
          <div className="p-6 rounded-2xl bg-[#070D09] border border-emerald-500/20 space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center items-center">
              <div className="space-y-1">
                <div className="font-heading font-black text-sm text-white truncate">
                  {h2hResult.player1DisplayName}
                </div>
                <div className="text-xs font-mono text-emerald-400">{h2hResult.player1Id}</div>
                <div className="text-3xl font-heading font-black text-emerald-400 pt-2">
                  {h2hResult.player1Wins} W
                </div>
              </div>

              <div className="space-y-1 font-mono">
                <div className="text-[11px] text-white/40 uppercase">CONFIRMED MATCHES</div>
                <div className="text-2xl font-black text-white">{h2hResult.totalMatches}</div>
                <div className="text-xs text-amber-400 font-bold">{h2hResult.draws} DRAWS</div>
              </div>

              <div className="space-y-1">
                <div className="font-heading font-black text-sm text-white truncate">
                  {h2hResult.player2DisplayName}
                </div>
                <div className="text-xs font-mono text-emerald-400">{h2hResult.player2Id}</div>
                <div className="text-3xl font-heading font-black text-emerald-400 pt-2">
                  {h2hResult.player2Wins} W
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-center font-mono text-xs">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">GOALS SCORED</div>
                <div className="font-bold text-white pt-1">
                  {h2hResult.player1Goals} – {h2hResult.player2Goals}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">WIN LEADER</div>
                <div className="font-bold text-amber-300 pt-1">
                  {h2hResult.leader === 'TIE'
                    ? 'Dead Heat (Tie)'
                    : h2hResult.leader === 'PLAYER_1'
                    ? h2hResult.player1DisplayName
                    : h2hResult.player2DisplayName}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-black/30 border border-white/5 text-center text-xs font-mono text-white/40">
            Select two distinct verified league players to view their head-to-head match history.
          </div>
        )}
      </div>

      {/* 4. Weekly League Challenges */}
      <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-heading font-black text-base text-white uppercase tracking-wider">
              Active Weekly League Challenges
            </h3>
          </div>
          <span className="text-xs font-mono text-amber-400 font-bold">BONUS POINTS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {challenges.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-2xl bg-[#060D08] border border-white/10 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase">
                  +{c.rewardPoints} PTS
                </span>
                <span className="text-[10px] font-mono text-white/40">Weekly Target</span>
              </div>
              <div>
                <h4 className="font-heading font-black text-sm text-white">{c.title}</h4>
                <p className="text-xs text-white/60 pt-1">{c.description}</p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <Target className="w-3 h-3" /> Target: {c.targetMetric}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Official League Achievements & Progression (Section 14) */}
      <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-heading font-black text-base text-white uppercase tracking-wider">
                ACHIEVEMENTS & MILESTONES
              </h3>
              <p className="text-[11px] font-mono text-white/50">
                Unlock official badges and bonus points across your competitive career
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            {playerAchievements.length} / {Object.keys(ACHIEVEMENT_REGISTRY).length} UNLOCKED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {Object.entries(ACHIEVEMENT_REGISTRY).map(([typeKey, meta]) => {
            const unlocked = playerAchievements.find((a) => a.type === typeKey);
            return (
              <AchievementBadge
                key={typeKey}
                type={typeKey as AchievementType}
                title={meta.title}
                description={meta.description}
                isUnlocked={Boolean(unlocked)}
                unlockedAt={unlocked?.earnedAt}
                rewardPoints={unlocked?.pointsAwarded || meta.pointsAwarded || 10}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
