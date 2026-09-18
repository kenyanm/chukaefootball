import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Filter, Sparkles, Swords, Calendar } from 'lucide-react';
import { Tournament, MatchFixture } from '../types';
import { tournamentService } from '../services/tournamentService';
import { matchService } from '../services/matchService';
import { BracketView } from '../components/BracketView';
import { NavTab } from '../components/Navigation';

interface BracketsViewProps {
  selectedTournamentId?: string;
  onNavigate: (tab: NavTab) => void;
}

export const BracketsView: React.FC<BracketsViewProps> = ({
  selectedTournamentId,
  onNavigate,
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournamentId, setActiveTournamentId] = useState<string>(selectedTournamentId || '');
  const [matches, setMatches] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState(true);

  // Load available tournaments
  const loadTournaments = async () => {
    try {
      const list = await tournamentService.getAllTournaments();
      setTournaments(list);

      if (!activeTournamentId && list.length > 0) {
        // Default to live tournament or first
        const live = list.find((t) => t.status === 'LIVE') || list[0];
        setActiveTournamentId(live.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // Update if prop changes
  useEffect(() => {
    if (selectedTournamentId) {
      setActiveTournamentId(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  // Load matches for selected tournament
  const loadMatches = async (tournId: string) => {
    if (!tournId) return;
    setLoading(true);
    try {
      const fixtures = await matchService.getTournamentMatches(tournId);
      setMatches(fixtures);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTournamentId) {
      loadMatches(activeTournamentId);
    }
  }, [activeTournamentId]);

  const currentTourn = tournaments.find((t) => t.id === activeTournamentId);

  return (
    <div id="brackets-view-container" className="space-y-6 pb-16">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Knockout Bracket Tree</span>
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
            Tournament Brackets
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
            Single-elimination knockout stage. Home players create the eFootball room; winners advance automatically to the next round.
          </p>
        </div>

        {/* Tournament Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              id="bracket-tournament-select"
              value={activeTournamentId}
              onChange={(e) => setActiveTournamentId(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-[#09110d] border border-emerald-500/30 text-white font-heading font-bold text-xs uppercase tracking-wider focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id} className="bg-black text-white">
                  {t.name} ({t.status.replace('_', ' ')})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-400">
              ▼
            </div>
          </div>

          <button
            onClick={() => activeTournamentId && loadMatches(activeTournamentId)}
            title="Refresh Fixtures"
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selected Tournament Overview Sub-Banner */}
      {currentTourn && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0d1c12] via-[#09130d] to-black border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="font-heading font-black text-base sm:text-lg text-white uppercase">
                {currentTourn.name}
              </div>
              <div className="text-xs text-white/60">
                Stage: <strong className="text-emerald-400">{currentTourn.currentRound || 'Knockout'}</strong> • Verified Contenders:{' '}
                <strong className="text-white">{currentTourn.verifiedCount}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                currentTourn.status === 'LIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              {currentTourn.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Main Bracket Canvas */}
      {loading ? (
        <div className="p-16 text-center text-xs text-white/50 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>Loading tournament knockout bracket...</div>
        </div>
      ) : (
        <BracketView
          matches={matches}
          onRefreshMatches={() => activeTournamentId && loadMatches(activeTournamentId)}
        />
      )}
    </div>
  );
};
