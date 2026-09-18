import React, { useState, useEffect } from 'react';
import {
  Users,
  Flame,
  Swords,
  CheckCircle2,
  Clock,
  AlertOctagon,
  UserCheck,
} from 'lucide-react';
import { Tournament, MatchFixture } from '../types';
import { matchService } from '../services/matchService';

interface TournamentLiveStatsProps {
  tournament: Tournament;
  className?: string;
}

export const TournamentLiveStats: React.FC<TournamentLiveStatsProps> = ({
  tournament,
  className = '',
}) => {
  const [matches, setMatches] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchMatches = async () => {
      try {
        const list = await matchService.getTournamentMatches(tournament.id);
        if (isMounted) setMatches(list);
      } catch (e) {
        console.error('Error loading live matches stats', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMatches();
    return () => {
      isMounted = false;
    };
  }, [tournament.id]);

  const totalMatches = matches.length;
  const completedMatches = matches.filter((m) => m.status === 'CONFIRMED').length;
  const pendingMatches = matches.filter(
    (m) => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS' || m.status === 'SUBMITTED' || m.status === 'AWAITING_CONFIRMATION'
  ).length;

  const now = Date.now();
  const overdueMatches = matches.filter(
    (m) =>
      m.status !== 'CONFIRMED' &&
      m.deadline &&
      new Date(m.deadline).getTime() < now
  ).length;

  // Players remaining in the tournament:
  // Each completed match eliminates 1 player. Verified count - completed matches.
  // When final is done, 1 champion remains. Minimum 1 or 0.
  const verifiedCount = tournament.verifiedCount || 0;
  const playersRemaining = Math.max(1, verifiedCount - completedMatches);

  return (
    <div
      id="live-tournament-information-grid"
      className={`p-5 rounded-3xl bg-gradient-to-br from-[#0c1a11] via-[#08110b] to-[#040805] border border-emerald-500/40 shadow-xl space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <h3 className="font-heading font-black text-sm sm:text-base text-white uppercase tracking-wider">
            Live Tournament Operations
          </h3>
        </div>
        <span className="font-mono text-[11px] text-emerald-400 font-bold uppercase">
          WEEK {String(tournament.weekNumber).padStart(2, '0')} • LIVE
        </span>
      </div>

      {/* 7-Point Live Information Metrics (Requirement 18) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
        {/* 1. Verified Players */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified</span>
          </div>
          <div className="font-heading font-black text-xl sm:text-2xl text-white">
            {verifiedCount}
          </div>
          <div className="text-[9px] text-white/40">Players</div>
        </div>

        {/* 2. Current Round */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Round</span>
          </div>
          <div className="font-heading font-black text-sm sm:text-base text-orange-300 truncate py-1">
            {tournament.currentRound || 'Round 1'}
          </div>
          <div className="text-[9px] text-white/40">Active Stage</div>
        </div>

        {/* 3. Matches */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <Swords className="w-3.5 h-3.5 text-emerald-400" />
            <span>Matches</span>
          </div>
          <div className="font-heading font-black text-xl sm:text-2xl text-white">
            {totalMatches}
          </div>
          <div className="text-[9px] text-white/40">Total Fixtures</div>
        </div>

        {/* 4. Completed Matches */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed</span>
          </div>
          <div className="font-heading font-black text-xl sm:text-2xl text-emerald-400">
            {completedMatches}
          </div>
          <div className="text-[9px] text-emerald-400/60">Confirmed</div>
        </div>

        {/* 5. Pending Matches */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending</span>
          </div>
          <div className="font-heading font-black text-xl sm:text-2xl text-amber-400">
            {pendingMatches}
          </div>
          <div className="text-[9px] text-amber-400/60">In Progress</div>
        </div>

        {/* 6. Overdue Matches */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            <span>Overdue</span>
          </div>
          <div
            className={`font-heading font-black text-xl sm:text-2xl ${
              overdueMatches > 0 ? 'text-rose-400 animate-pulse' : 'text-white/60'
            }`}
          >
            {overdueMatches}
          </div>
          <div className="text-[9px] text-white/40">Needs Admin</div>
        </div>

        {/* 7. Players Remaining */}
        <div className="p-3 rounded-2xl bg-black/50 border border-white/5 col-span-2 sm:col-span-4 lg:col-span-1">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-white/50 mb-1">
            <UserCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Remaining</span>
          </div>
          <div className="font-heading font-black text-xl sm:text-2xl text-teal-300">
            {playersRemaining}
          </div>
          <div className="text-[9px] text-teal-400/60">Contenders</div>
        </div>
      </div>
    </div>
  );
};
