import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Swords,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Smartphone,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { UserProfile, Tournament, TournamentEntry, MatchFixture } from '../types';
import { matchService } from '../services/matchService';
import { registrationService } from '../services/registrationService';
import { RegistrationStatusBadge } from './RegistrationStatusBadge';
import { ChukaCrestLogo } from './ChukaCrestLogo';
import { EfootballLogo } from './EfootballLogo';

interface PlayerHomeDashboardProps {
  userProfile: UserProfile;
  tournaments: Tournament[];
  onNavigate: (tab: any) => void;
  onOpenMatch: (match: MatchFixture) => void;
  onOpenRegister: (tournament: Tournament) => void;
}

export const PlayerHomeDashboard: React.FC<PlayerHomeDashboardProps> = ({
  userProfile,
  tournaments,
  onNavigate,
  onOpenMatch,
  onOpenRegister,
}) => {
  const [activeMatch, setActiveMatch] = useState<MatchFixture | null>(null);
  const [userEntries, setUserEntries] = useState<TournamentEntry[]>([]);
  const [allMatches, setAllMatches] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPlayerData = async () => {
      try {
        const [entries, matches] = await Promise.all([
          registrationService.getUserTournamentEntries(userProfile.id),
          matchService.getUserMatches(userProfile.id),
        ]);

        if (!isMounted) return;
        setUserEntries(entries || []);
        setAllMatches(matches || []);

        // Find active match: SCHEDULED, IN_PROGRESS, SUBMITTED, AWAITING_CONFIRMATION, or DISPUTED
        const active = (matches || []).find(
          (m) =>
            m.status === 'SCHEDULED' ||
            m.status === 'IN_PROGRESS' ||
            m.status === 'SUBMITTED' ||
            m.status === 'AWAITING_CONFIRMATION' ||
            m.status === 'DISPUTED'
        );
        setActiveMatch(active || null);
      } catch (err) {
        console.error('Error loading player dashboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPlayerData();
    return () => {
      isMounted = false;
    };
  }, [userProfile.id]);

  // Group user's tournament involvements
  const entryTournaments = userEntries.map((entry) => {
    const tournament = tournaments.find((t) => t.id === entry.tournamentId);
    return {
      entry,
      tournament,
    };
  });

  // Active / Current tournaments (LIVE)
  const currentTournaments = entryTournaments.filter(
    (item) => item.tournament && item.tournament.status === 'LIVE'
  );

  // Upcoming registered tournaments (REGISTRATION_OPEN or UPCOMING)
  const upcomingRegistered = entryTournaments.filter(
    (item) =>
      item.tournament &&
      (item.tournament.status === 'REGISTRATION_OPEN' ||
        item.tournament.status === 'VERIFICATION' ||
        item.tournament.status === 'BRACKET_READY' ||
        item.tournament.status === 'UPCOMING')
  );

  // Tournament history (COMPLETED)
  const completedHistory = entryTournaments.filter(
    (item) => item.tournament && item.tournament.status === 'COMPLETED'
  );

  // Championships
  const championshipsCount =
    userProfile.stats?.championships ||
    tournaments.filter((t) => t.championPlayerId === userProfile.playerId).length;

  const isHomePlayer = activeMatch ? activeMatch.homePlayerUid === userProfile.id : false;
  const opponentName = activeMatch
    ? isHomePlayer
      ? activeMatch.awayPlayerName
      : activeMatch.homePlayerName
    : '';
  const opponentId = activeMatch
    ? isHomePlayer
      ? activeMatch.awayPlayerId
      : activeMatch.homePlayerId
    : '';

  return (
    <div id="player-home-dashboard" className="space-y-6">
      {/* 1. PLAYER IDENTITY & STATS HEADER (Requirement 1) */}
      <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-[#0c1810] via-[#08110b] to-[#040805] border border-emerald-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-400/60 shadow-lg shadow-emerald-500/20"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-700 text-white font-heading font-black text-2xl flex items-center justify-center border-2 border-emerald-400/60">
                  {userProfile.displayName.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1.5 -right-1.5">
                <ChukaCrestLogo size="sm" withBorder={true} />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider uppercase">
                  CHUKA ATHLETE
                </span>
                <EfootballLogo size="sm" variant="badge" />
                {championshipsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold uppercase">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>{championshipsCount}x CHAMPION</span>
                  </span>
                )}
              </div>

              <h1 className="font-heading font-black text-2xl sm:text-3xl text-white uppercase mt-1 leading-tight">
                {userProfile.displayName}
              </h1>

              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-400">
                  {userProfile.playerId}
                </span>
                <span className="text-white/40 text-xs">•</span>
                <span className="text-xs text-white/60 font-medium">eFootball™ Mobile</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="p-3 rounded-2xl bg-black/50 border border-white/10 text-center min-w-[70px]">
              <span className="text-[10px] uppercase font-bold text-white/50 block">Matches</span>
              <span className="font-heading font-black text-lg sm:text-xl text-white">
                {userProfile.stats?.matchesPlayed || allMatches.length || 0}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-black/50 border border-white/10 text-center min-w-[70px]">
              <span className="text-[10px] uppercase font-bold text-white/50 block">Wins</span>
              <span className="font-heading font-black text-lg sm:text-xl text-emerald-400">
                {userProfile.stats?.wins ||
                  allMatches.filter((m) => m.winnerUid === userProfile.id).length ||
                  0}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/30 text-center min-w-[70px]">
              <span className="text-[10px] uppercase font-bold text-amber-400 block">Trophies</span>
              <span className="font-heading font-black text-lg sm:text-xl text-amber-400">
                {championshipsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE MATCH CARD: "YOUR NEXT MATCH" (Requirement 1 Main Card) */}
      {activeMatch && (
        <div
          id="active-match-main-card"
          className="p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-[#07130b] to-emerald-950/80 border-2 border-emerald-400 shadow-2xl shadow-emerald-950/90 relative overflow-hidden space-y-5 animate-pulse-border"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-heading font-black text-sm sm:text-base text-white uppercase tracking-wider">
                YOUR NEXT MATCH
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono text-[10px] font-bold uppercase">
                {isHomePlayer ? '🏠 HOME PLAYER' : '✈️ AWAY PLAYER'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                  activeMatch.status === 'DISPUTED'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : activeMatch.status === 'SUBMITTED'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {activeMatch.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
            {/* You vs Opponent */}
            <div className="sm:col-span-2 space-y-2">
              <div className="text-xs text-white/50 uppercase font-semibold">
                Round: <span className="text-white font-bold">{activeMatch.roundName}</span> •
                Fixture: <span className="font-mono text-emerald-400">#{activeMatch.matchId}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="font-heading font-black text-xl sm:text-2xl text-white">
                  {userProfile.displayName}
                </div>
                <span className="font-heading font-extrabold text-amber-400 text-sm italic">VS</span>
                <div>
                  <div className="font-heading font-black text-xl sm:text-2xl text-white">
                    {opponentName || 'Opponent'}
                  </div>
                  <div className="font-mono text-xs text-orange-400">{opponentId}</div>
                </div>
              </div>

              {activeMatch.deadline && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono pt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deadline: {new Date(activeMatch.deadline).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* Action button: [ OPEN MATCH ] */}
            <div className="flex justify-end sm:justify-center">
              <button
                id="btn-open-active-match"
                onClick={() => onOpenMatch(activeMatch)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95"
              >
                <Swords className="w-4 h-4" />
                <span>[ OPEN MATCH ]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MY TOURNAMENTS (Requirement 6) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-lg sm:text-xl text-white uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>My Tournaments</span>
          </h2>

          <button
            onClick={() => onNavigate('TOURNAMENTS')}
            className="text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Full Calendar</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {userEntries.length === 0 ? (
          <div className="p-6 rounded-3xl bg-black/40 border border-dashed border-white/10 text-center space-y-3">
            <Trophy className="w-8 h-8 text-white/30 mx-auto" />
            <div className="text-xs text-white/70">
              You have not registered for any weekly tournaments yet.
            </div>
            <button
              onClick={() => onNavigate('TOURNAMENTS')}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all"
            >
              Browse Weekly Tournaments
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {entryTournaments.map(({ entry, tournament }) => {
              if (!tournament) return null;
              const isLive = tournament.status === 'LIVE';
              const isCompleted = tournament.status === 'COMPLETED';
              const isUserChampion = tournament.championPlayerId === userProfile.playerId;

              return (
                <div
                  key={entry.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-[#08100b] border ${
                    isLive
                      ? 'border-emerald-500/40 shadow-lg shadow-emerald-950/40'
                      : isUserChampion
                      ? 'border-amber-500/40 shadow-lg shadow-amber-950/40'
                      : 'border-white/10'
                  } space-y-3 flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        WEEK {String(tournament.weekNumber).padStart(2, '0')}
                      </span>

                      {/* Display status badge using Requirement 3 badge */}
                      <RegistrationStatusBadge status={isUserChampion ? 'CHAMPION' : entry.status} size="sm" />
                    </div>

                    <h3 className="font-heading font-black text-base text-white uppercase truncate">
                      {tournament.name}
                    </h3>

                    {/* Result or status note */}
                    <div className="text-xs text-white/60 mt-1">
                      {isCompleted ? (
                        isUserChampion ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5" /> 🏆 Champion
                          </span>
                        ) : (
                          <span className="text-zinc-400">Tournament Concluded</span>
                        )
                      ) : isLive ? (
                        <span className="text-orange-400 font-bold flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" /> 🔥 LIVE • {tournament.currentRound || 'Round 1'}
                        </span>
                      ) : entry.status === 'VERIFIED' ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ✓ VERIFIED - Eligible for official bracket
                        </span>
                      ) : entry.status === 'PAYMENT_PENDING' ? (
                        <span className="text-amber-300 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> PAYMENT PENDING • Admin verification
                        </span>
                      ) : entry.status === 'PAYMENT_REJECTED' ? (
                        <span className="text-red-400 font-medium">
                          PAYMENT REJECTED • Please resubmit code
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">
                          PAYMENT REQUIRED • KSh 20
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    {isLive && activeMatch && (
                      <button
                        onClick={() => onOpenMatch(activeMatch)}
                        className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        [ OPEN MATCH ]
                      </button>
                    )}

                    {(entry.status === 'PAYMENT_REQUIRED' || entry.status === 'PAYMENT_REJECTED') && (
                      <button
                        onClick={() => onOpenRegister(tournament)}
                        className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        {entry.status === 'PAYMENT_REJECTED' ? '[ RESUBMIT PAYMENT ]' : '[ COMPLETE PAYMENT ]'}
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        onClick={() => onNavigate('BRACKETS')}
                        className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        View Bracket
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
