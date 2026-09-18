import React, { useState } from 'react';
import { Trophy, Swords, Sparkles, UserCheck, ShieldCheck, ChevronRight, Check, Radio, Eye, Layers } from 'lucide-react';
import { MatchFixture } from '../types';
import { MatchRoomModal } from './MatchRoomModal';

interface BracketViewProps {
  matches: MatchFixture[];
  onRefreshMatches?: () => void;
}

export const BracketView: React.FC<BracketViewProps> = ({ matches, onRefreshMatches }) => {
  const [selectedMatch, setSelectedMatch] = useState<MatchFixture | null>(null);
  const [viewMode, setViewMode] = useState<'FOCUS' | 'FULL'>('FOCUS');
  const [selectedRound, setSelectedRound] = useState<number>(1);

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-20 px-6 rounded-3xl border border-dashed border-white/10 bg-[#08110c] space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
          <Trophy className="w-7 h-7" />
        </div>
        <h3 className="font-heading font-black text-xl text-white uppercase tracking-wide">
          Knockout Bracket Pending
        </h3>
        <p className="text-xs text-white/60 max-w-md mx-auto">
          Knockout bracket will be published once Verification Day concludes. All verified contenders will be seeded into single-elimination matchups.
        </p>
      </div>
    );
  }

  // Group matches by round number
  const roundsMap = new Map<number, MatchFixture[]>();
  matches.forEach((m) => {
    const list = roundsMap.get(m.roundNumber) || [];
    list.push(m);
    roundsMap.set(m.roundNumber, list);
  });

  const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);
  const activeRound = roundsMap.has(selectedRound) ? selectedRound : sortedRoundNumbers[0];

  const getStatusPill = (m: MatchFixture) => {
    if (m.status === 'CONFIRMED') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-bold flex items-center gap-1">
          <Check className="w-2.5 h-2.5" />
          <span>COMPLETED</span>
        </span>
      );
    }
    if (m.status === 'ROOM_READY' || (m.status as string) === 'PLAYING' || (m.status as string) === 'IN_PROGRESS' || (m.status as string) === 'READY_TO_PLAY') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-mono font-bold flex items-center gap-1 animate-pulse">
          <Radio className="w-2.5 h-2.5" />
          <span>LIVE</span>
        </span>
      );
    }
    if (m.status === 'SUBMITTED' || m.status === 'AWAITING_CONFIRMATION') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-1">
          <span>VERIFYING</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10 text-[9px] font-mono font-bold">
        UPCOMING
      </span>
    );
  };

  const renderMatchCard = (m: MatchFixture) => {
    const isCompleted = m.status === 'CONFIRMED';
    const isHomeWinner = m.winnerId === m.homePlayerId || (isCompleted && (m.homeScore ?? 0) > (m.awayScore ?? 0));
    const isAwayWinner = m.winnerId === m.awayPlayerId || (isCompleted && (m.awayScore ?? 0) > (m.homeScore ?? 0));
    const isHomeBye = m.homePlayerId === 'BYE';
    const isAwayBye = m.awayPlayerId === 'BYE';

    return (
      <div
        key={m.id}
        id={`bracket-match-${m.id}`}
        onClick={() => setSelectedMatch(m)}
        className="p-3.5 sm:p-4 rounded-2xl bg-[#09120c] border border-white/10 hover:border-emerald-500/40 cursor-pointer transition-all space-y-3 group shadow-lg active:scale-98"
      >
        {/* Round label: "SEMI-FINAL · MATCH 2" & Status pill */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-[10px] font-mono">
          <span className="font-bold text-white/70 uppercase">
            {m.roundName || `ROUND ${m.roundNumber}`} · MATCH #{m.bracketPosition || m.matchPosition || m.matchId.slice(-4)}
          </span>
          {getStatusPill(m)}
        </div>

        {/* Player 1 Slot */}
        <div
          className={`p-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 ${
            isHomeWinner
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
              : 'bg-black/40 border border-white/5 text-white/80'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
              {m.homePlayerName ? m.homePlayerName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-heading font-black text-white truncate flex items-center gap-1">
                <span>{m.homePlayerName}</span>
                {isHomeWinner && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-black text-[8px] font-mono font-bold uppercase">
                    ADVANCED
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-emerald-400/70">{m.homePlayerId}</div>
            </div>
          </div>
          <div className="font-mono text-base font-black text-amber-300 shrink-0 px-2">
            {m.homeScore !== undefined && m.homeScore !== null ? m.homeScore : '-'}
          </div>
        </div>

        {/* Player 2 Slot */}
        <div
          className={`p-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 ${
            isAwayWinner
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
              : 'bg-black/40 border border-white/5 text-white/80'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-300 font-black text-xs flex items-center justify-center shrink-0 border border-orange-500/30">
              {m.awayPlayerName ? m.awayPlayerName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-heading font-black text-white truncate flex items-center gap-1">
                <span>{m.awayPlayerName}</span>
                {isAwayWinner && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-black text-[8px] font-mono font-bold uppercase">
                    ADVANCED
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-orange-400/70">{m.awayPlayerId}</div>
            </div>
          </div>
          <div className="font-mono text-base font-black text-amber-300 shrink-0 px-2">
            {m.awayScore !== undefined && m.awayScore !== null ? m.awayScore : '-'}
          </div>
        </div>

        {/* Footer: Tap hint */}
        <div className="flex items-center justify-between text-[10px] text-white/40 pt-1">
          <span>Tap to enter Match Room</span>
          <ChevronRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full space-y-4">
      {/* Top Bar: Round Selectors & Mode Toggle (Section 12) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 p-2.5 rounded-2xl border border-white/10">
        {/* Round Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {sortedRoundNumbers.map((rNum) => {
            const rMatches = roundsMap.get(rNum) || [];
            const rName = rMatches[0]?.roundName || `R${rNum}`;
            const isActive = viewMode === 'FOCUS' && activeRound === rNum;
            return (
              <button
                key={rNum}
                type="button"
                onClick={() => {
                  setSelectedRound(rNum);
                  setViewMode('FOCUS');
                }}
                className={`px-3 py-1.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all shrink-0 touch-target ${
                  isActive
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25'
                    : 'bg-white/5 hover:bg-white/10 text-white/70'
                }`}
              >
                {rName} ({rMatches.length})
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle: Single Round Focus vs Full Bracket Tree */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('FOCUS')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
              viewMode === 'FOCUS'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>FOCUS</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('FULL')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
              viewMode === 'FULL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>FULL TREE</span>
          </button>
        </div>
      </div>

      {/* SINGLE ROUND FOCUS MODE (Mobile Optimized - No horizontal scrolling required!) */}
      {viewMode === 'FOCUS' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-white/60 px-1">
            <span>
              Showing {roundsMap.get(activeRound)?.length || 0} fixtures in this round
            </span>
            <span className="text-emerald-400">Single elimination</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(roundsMap.get(activeRound) || []).map((m) => renderMatchCard(m))}
          </div>
        </div>
      ) : (
        /* FULL BRACKET MODE (Multi-column Tree for tablets/desktop) */
        <div
          id="tournament-bracket-canvas"
          className="bracket-scroll overflow-x-auto pb-8 pt-2 flex items-start gap-6 min-h-[500px] scroll-smooth"
        >
          {sortedRoundNumbers.map((roundNum) => {
            const roundMatches = roundsMap.get(roundNum) || [];
            const roundName = roundMatches[0]?.roundName || `Round ${roundNum}`;
            const isFinal = roundNum === sortedRoundNumbers[sortedRoundNumbers.length - 1];

            return (
              <div
                key={roundNum}
                className="flex flex-col shrink-0 w-72 sm:w-80"
                style={{ justifyContent: 'space-around' }}
              >
                {/* Round Header */}
                <div className="sticky top-0 z-10 mb-4 p-3 rounded-2xl bg-[#0b140f]/90 backdrop-blur-md border border-emerald-500/30 text-center shadow-xl">
                  <div className="flex items-center justify-center gap-1.5 font-heading font-black text-sm uppercase tracking-wider text-emerald-400">
                    {isFinal && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span>{roundName}</span>
                  </div>
                  <div className="text-[10px] text-white/50 font-mono mt-0.5">
                    {roundMatches.length} {roundMatches.length === 1 ? 'Fixture' : 'Fixtures'}
                  </div>
                </div>

                {/* Match Cards List */}
                <div className="flex flex-col gap-4 justify-around flex-1">
                  {roundMatches.map((m) => renderMatchCard(m))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Match Modal */}
      {selectedMatch && (
        <MatchRoomModal
          match={selectedMatch}
          isOpen={Boolean(selectedMatch)}
          onClose={() => setSelectedMatch(null)}
          onUpdated={() => {
            if (onRefreshMatches) onRefreshMatches();
          }}
        />
      )}
    </div>
  );
};
