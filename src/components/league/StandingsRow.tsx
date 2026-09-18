import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  ChevronDown,
  ChevronUp,
  Swords,
  User,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { LeagueMember } from '../../types';

interface StandingsRowProps {
  member: LeagueMember;
  position: number;
  isCurrentUser?: boolean;
  onViewProfile?: (playerId: string) => void;
  onViewCard?: (member: LeagueMember) => void;
  onChallenge?: (playerId: string) => void;
  canChallenge?: boolean;
}

export const StandingsRow: React.FC<StandingsRowProps> = ({
  member,
  position,
  isCurrentUser = false,
  onViewProfile,
  onViewCard,
  onChallenge,
  canChallenge = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Position rank styling
  const isPodium = position <= 3;
  const rankColors = {
    1: 'text-amber-400 bg-amber-500/15 border-amber-400/40',
    2: 'text-slate-300 bg-slate-400/15 border-slate-300/40',
    3: 'text-amber-600 bg-amber-700/15 border-amber-600/40',
  }[position] || 'text-white/70 bg-white/5 border-white/10';

  // Movement calculation
  let movement: { type: 'up' | 'down' | 'same'; diff: number } = { type: 'same', diff: 0 };
  if (member.previousPosition && member.previousPosition > 0) {
    if (member.previousPosition > position) {
      movement = { type: 'up', diff: member.previousPosition - position };
    } else if (member.previousPosition < position) {
      movement = { type: 'down', diff: position - member.previousPosition };
    }
  }

  const formList = member.currentForm || [];

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isCurrentUser
          ? 'bg-emerald-950/30 border-emerald-500/40 shadow-md shadow-emerald-950/40'
          : isExpanded
          ? 'bg-[#0e1711] border-white/20'
          : 'bg-[#080d0a]/70 hover:bg-[#0c130e] border-white/[0.07]'
      }`}
    >
      {/* Primary Mobile & Desktop Row Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer select-none touch-target"
      >
        {/* Left: Rank, Movement & Player Info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Rank Badge */}
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center font-heading font-black text-xs sm:text-sm shrink-0 ${rankColors}`}
          >
            {position === 1 ? (
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              `#${position}`
            )}
          </div>

          {/* Movement Indicator */}
          <div className="w-5 text-center shrink-0 text-[10px] font-mono font-bold">
            {movement.type === 'up' ? (
              <span className="text-emerald-400 flex items-center justify-center">
                ▲{movement.diff}
              </span>
            ) : movement.type === 'down' ? (
              <span className="text-rose-400 flex items-center justify-center">
                ▼{movement.diff}
              </span>
            ) : (
              <span className="text-white/25 flex items-center justify-center">
                —
              </span>
            )}
          </div>

          {/* Player Avatar & Names */}
          <div className="flex items-center gap-2 min-w-0">
            {member.photoURL ? (
              <img
                src={member.photoURL}
                alt={member.displayName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover border border-white/15 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                {member.displayName?.charAt(0) || 'P'}
              </div>
            )}

            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-heading font-bold text-xs sm:text-sm text-white truncate">
                  {member.displayName}
                </span>
                {isCurrentUser && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] uppercase font-bold shrink-0">
                    YOU
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/50 truncate">
                <span>@{member.efootballUsername || member.playerId}</span>
                {member.currentStreak && member.currentStreak >= 2 ? (
                  <span className="inline-flex items-center gap-0.5 px-1 rounded bg-orange-500/20 text-orange-400 font-bold">
                    <Flame className="w-2.5 h-2.5" />
                    <span>{member.currentStreak}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Key Stats (Points, Goal Diff) & Expand Arrow */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Desktop stats preview (visible on md+) */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-white/70">
            <span className="w-7 text-center">{member.matchesPlayed || 0}P</span>
            <span className="w-7 text-center text-emerald-400 font-bold">{member.wins || 0}W</span>
            <span className="w-7 text-center text-white/50">{member.draws || 0}D</span>
            <span className="w-7 text-center text-rose-400">{member.losses || 0}L</span>
            <span className="w-10 text-right">
              {member.goalDifference > 0 ? `+${member.goalDifference}` : member.goalDifference} GD
            </span>
          </div>

          {/* Primary Mobile Points & GD Badges */}
          <div className="text-right flex flex-col items-end">
            <div className="font-heading font-black text-sm sm:text-base text-amber-400">
              {member.points || 0} <span className="text-[10px] font-mono text-amber-400/80">PTS</span>
            </div>
            <div className="text-[10px] font-mono text-white/50">
              {member.goalDifference > 0 ? `+${member.goalDifference}` : member.goalDifference || 0} GD
            </div>
          </div>

          <div className="text-white/40 pl-1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expandable Match Record & Actions (Mobile First) */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.08] space-y-3 animate-in fade-in duration-150">
          {/* Detailed Stat Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center text-xs font-mono bg-black/40 p-2.5 rounded-xl border border-white/5">
            <div>
              <div className="text-[9px] text-white/40 uppercase">Played</div>
              <div className="font-bold text-white mt-0.5">{member.matchesPlayed || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-emerald-400 uppercase">Won</div>
              <div className="font-bold text-emerald-400 mt-0.5">{member.wins || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-white/40 uppercase">Drawn</div>
              <div className="font-bold text-white/70 mt-0.5">{member.draws || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-rose-400 uppercase">Lost</div>
              <div className="font-bold text-rose-400 mt-0.5">{member.losses || 0}</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[9px] text-white/40 uppercase">GF</div>
              <div className="font-bold text-white mt-0.5">{member.goalsFor || 0}</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[9px] text-white/40 uppercase">GA</div>
              <div className="font-bold text-white mt-0.5">{member.goalsAgainst || 0}</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[9px] text-amber-400 uppercase">Win%</div>
              <div className="font-bold text-amber-300 mt-0.5">{member.winRate || 0}%</div>
            </div>
          </div>

          {/* Form Pills */}
          {formList.length > 0 && (
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Recent Form:</span>
              <div className="flex items-center gap-1">
                {formList.slice(-5).map((f, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                      f === 'W'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : f === 'D'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Action Buttons */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {onViewProfile && (
              <button
                type="button"
                onClick={() => onViewProfile(member.playerId)}
                className="flex-1 min-w-[100px] py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-mono text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 touch-target"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </button>
            )}

            {onViewCard && (
              <button
                type="button"
                onClick={() => onViewCard(member)}
                className="flex-1 min-w-[100px] py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 touch-target"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>League Card</span>
              </button>
            )}

            {canChallenge && !isCurrentUser && onChallenge && (
              <button
                type="button"
                onClick={() => onChallenge(member.playerId)}
                className="flex-1 min-w-[110px] py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 touch-target active:scale-95"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Challenge</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
