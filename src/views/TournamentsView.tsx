import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  LayoutGrid,
  Users,
  ShieldCheck,
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Award,
  Swords,
  Flame,
} from 'lucide-react';
import { Tournament, TournamentEntry } from '../types';
import { tournamentService } from '../services/tournamentService';
import { registrationService } from '../services/registrationService';
import { RegistrationModal } from '../components/RegistrationModal';
import { TournamentStatusHeader } from '../components/TournamentStatusHeader';
import { TournamentLiveStats } from '../components/TournamentLiveStats';
import { ChampionCardModal } from '../components/ChampionCardModal';
import { RealTournamentCalendar } from '../components/RealTournamentCalendar';
import { NavTab } from '../components/Navigation';

interface TournamentsViewProps {
  onNavigate: (tab: NavTab) => void;
  onSelectTournamentForBracket?: (tournamentId: string) => void;
}

const PAGE_SIZE = 20;

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  onNavigate,
  onSelectTournamentForBracket,
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'LIVE' | 'REGISTRATION_OPEN' | 'COMPLETED'>('ALL');
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'GRID'>('CALENDAR');
  const [loading, setLoading] = useState(true);

  // Selected tournament for viewing "OFFICIAL VERIFIED PLAYERS"
  const [viewingTournament, setViewingTournament] = useState<Tournament | null>(null);
  const [verifiedPlayers, setVerifiedPlayers] = useState<TournamentEntry[]>([]);
  const [playersSearch, setPlayersSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Registration modal
  const [registeringTournament, setRegisteringTournament] = useState<Tournament | null>(null);

  // Champion card modal
  const [championModalTournament, setChampionModalTournament] = useState<Tournament | null>(null);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const list = await tournamentService.getAllTournaments();
      setTournaments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // When user clicks [OFFICIAL VERIFIED PLAYERS] (Requirement 5)
  const handleOpenVerifiedList = async (tourn: Tournament) => {
    setViewingTournament(tourn);
    setLoadingPlayers(true);
    setCurrentPage(1);
    setPlayersSearch('');
    try {
      const players = await registrationService.getVerifiedPlayersPublic(tourn.id);
      setVerifiedPlayers(players);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const filteredTournaments = tournaments.filter((t) => {
    if (activeFilter === 'ALL') return true;
    return t.status === activeFilter;
  });

  // Filter verified players by search
  const filteredVerified = verifiedPlayers.filter((p) => {
    const q = playersSearch.toLowerCase().trim();
    if (!q) return true;
    return p.displayName.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filteredVerified.length / PAGE_SIZE) || 1;
  const paginatedPlayers = filteredVerified.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Check if any tournament is currently LIVE
  const liveTournament = tournaments.find((t) => t.status === 'LIVE');

  return (
    <div id="tournaments-view-container" className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Permanent Tournament Calendar</span>
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
            Chuka Weekly Tournaments
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-2xl">
            Each weekly tournament is an independent competition. You can register for upcoming editions even while another tournament is currently LIVE.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-black/60 border border-white/10 rounded-2xl shrink-0">
            <button
              id="btn-view-mode-calendar"
              onClick={() => setViewMode('CALENDAR')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'CALENDAR'
                  ? 'bg-emerald-500 text-[#051a0e] shadow-md shadow-emerald-500/25'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Real Calendar</span>
            </button>
            <button
              id="btn-view-mode-grid"
              onClick={() => setViewMode('GRID')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'GRID'
                  ? 'bg-emerald-500 text-[#051a0e] shadow-md shadow-emerald-500/25'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Cards Grid</span>
            </button>
          </div>

          {/* Filter Pills (shown in Grid view) */}
          {viewMode === 'GRID' && (
            <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-black/40 border border-white/10 rounded-2xl shrink-0">
              {(['ALL', 'LIVE', 'REGISTRATION_OPEN', 'COMPLETED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                    activeFilter === filter
                      ? 'bg-emerald-500 text-[#051a0e] shadow-md shadow-emerald-500/20'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LIVE TOURNAMENT OPERATIONS STATS (Requirement 18) */}
      {liveTournament && (
        <section id="live-tournament-stats-banner">
          <TournamentLiveStats tournament={liveTournament} />
        </section>
      )}

      {/* Tournaments Display: Real Calendar or Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        /* Requirement 24: Empty database exact text */
        <div className="p-16 text-center rounded-3xl bg-[#08110c] border border-dashed border-white/10 space-y-3">
          <Trophy className="w-10 h-10 text-white/30 mx-auto" />
          <h3 className="font-heading font-bold text-xl text-white">No active tournaments.</h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            The tournament schedule will open shortly. Check back for upcoming weekly editions or join our official WhatsApp group for launch announcements.
          </p>
        </div>
      ) : viewMode === 'CALENDAR' ? (
        <RealTournamentCalendar
          tournaments={tournaments}
          onOpenRegister={(tourn) => setRegisteringTournament(tourn)}
          onOpenVerified={(tourn) => handleOpenVerifiedList(tourn)}
          onOpenBracket={(id) => {
            if (onSelectTournamentForBracket) onSelectTournamentForBracket(id);
            onNavigate('BRACKETS');
          }}
        />
      ) : filteredTournaments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10 text-white/50 text-xs">
          No tournaments found matching the selected status filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTournaments.map((tourn) => {
            const isLive = tourn.status === 'LIVE';
            const isRegOpen = tourn.status === 'REGISTRATION_OPEN';
            const isCompleted = tourn.status === 'COMPLETED';

            return (
              <div
                key={tourn.id}
                className={`flex flex-col justify-between p-6 rounded-2xl border transition-all duration-200 shadow-xl ${
                  isLive
                    ? 'bg-gradient-to-b from-[#0e1d13] to-[#08120b] border-emerald-500/40 shadow-emerald-950/30'
                    : isRegOpen
                    ? 'bg-gradient-to-b from-[#18150c] to-[#0e0d08] border-orange-500/40 shadow-orange-950/20'
                    : isCompleted
                    ? 'bg-gradient-to-b from-[#141208] to-[#0a0904] border-amber-500/30'
                    : 'bg-[#09100d] border-white/10'
                }`}
              >
                <div>
                  {/* Top Bar: Week + Tournament Status Header (Requirement 17) */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
                      WEEK {String(tourn.weekNumber).padStart(2, '0')}
                    </span>
                    <TournamentStatusHeader status={tourn.status} size="sm" />
                  </div>

                  <h3 className="font-heading font-black text-xl text-white uppercase tracking-wide">
                    {tourn.name}
                  </h3>

                  {/* Champion Banner if completed (Requirement 20 - clickable to view shareable card) */}
                  {isCompleted && tourn.championName && (
                    <div
                      onClick={() => setChampionModalTournament(tourn)}
                      className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 cursor-pointer hover:border-amber-400 hover:bg-amber-500/15 transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center justify-between">
                          <span>🏆 Week {tourn.weekNumber} Champion</span>
                          <span className="text-[9px] text-amber-400 font-mono underline">[ View Card ]</span>
                        </div>
                        <div className="font-heading font-bold text-sm text-white truncate">
                          {tourn.championName}
                        </div>
                        <div className="text-[10px] text-white/50 font-mono">
                          {tourn.championPlayerId} {tourn.championScore ? `• Score: ${tourn.championScore}` : ''}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Date specs matching requirements */}
                  <div className="mt-4 space-y-2 text-xs text-white/70 py-3 border-y border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Registration:</span>
                      <span className="text-white font-medium">
                        {new Date(tourn.registrationOpenDate).toLocaleDateString()} — {new Date(tourn.registrationCloseDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Verification Day:</span>
                      <span className="text-amber-300 font-medium">
                        {new Date(tourn.verificationDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Competition:</span>
                      <span className="text-white font-medium">
                        {new Date(tourn.startDate).toLocaleDateString()} — {new Date(tourn.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-bold pt-1 border-t border-white/5">
                      <span className="text-white/50">Entry Fee:</span>
                      <span className="text-amber-400 font-mono text-sm">KSh {tourn.entryFee}</span>
                    </div>
                  </div>

                  {/* Registered & Verified Counter */}
                  <div className="flex items-center justify-between text-xs py-3">
                    <div className="flex items-center gap-1.5 text-white/70">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span><strong>{tourn.registeredCount}</strong> Registered</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span><strong>{tourn.verifiedCount}</strong> Verified</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    id={`btn-view-verified-${tourn.id}`}
                    onClick={() => handleOpenVerifiedList(tourn)}
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all text-center"
                  >
                    Verified List
                  </button>

                  {isRegOpen ? (
                    <button
                      id={`btn-reg-tourn-${tourn.id}`}
                      onClick={() => setRegisteringTournament(tourn)}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 text-center"
                    >
                      REGISTER NOW
                    </button>
                  ) : isLive || isCompleted ? (
                    <button
                      onClick={() => {
                        if (onSelectTournamentForBracket) onSelectTournamentForBracket(tourn.id);
                        onNavigate('BRACKETS');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#140e04] font-bold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>View Bracket</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="py-2.5 px-3 rounded-xl bg-white/5 text-white/40 font-bold text-xs uppercase tracking-wider cursor-not-allowed text-center"
                    >
                      {tourn.status}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PUBLIC PAGE: "WEEK X - OFFICIAL VERIFIED PLAYERS" (Requirement 5) */}
      {viewingTournament && (
        <div
          id="modal-verified-players-list"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl bg-[#09110d] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 my-6">
            <button
              onClick={() => setViewingTournament(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5"
              aria-label="Close verified players modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title & Meta */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase mb-1">
                WEEK {String(viewingTournament.weekNumber).padStart(2, '0')}
              </div>
              <h2 className="font-heading font-black text-2xl text-white uppercase">
                OFFICIAL VERIFIED PLAYERS
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
                <span className="text-emerald-400 font-bold font-mono">
                  TOTAL VERIFIED PLAYERS: {verifiedPlayers.length}
                </span>
                <span>•</span>
                <span>{viewingTournament.name}</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search verified player name or CHUKA Player ID..."
                value={playersSearch}
                onChange={(e) => {
                  setPlayersSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
            </div>

            {/* Privacy Compliance Banner (Requirement 5) */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] text-white/50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Official public roster. Payment details, email addresses, and phone numbers are strictly protected.
              </span>
            </div>

            {/* Table / List */}
            <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2.5 bg-white/5 border-b border-white/10 text-[10px] font-mono font-bold uppercase text-white/50 tracking-wider">
                <div className="col-span-2"># Number</div>
                <div className="col-span-4">Player ID</div>
                <div className="col-span-6">Display Name</div>
              </div>

              <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                {loadingPlayers ? (
                  <div className="p-8 text-center text-xs text-white/50">Loading verified players...</div>
                ) : paginatedPlayers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/50">
                    {playersSearch ? 'No matching verified player found.' : 'No verified players in this tournament yet.'}
                  </div>
                ) : (
                  paginatedPlayers.map((player, idx) => {
                    const playerNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <div
                        key={player.id}
                        className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02] text-xs"
                      >
                        <div className="col-span-2 font-mono font-bold text-white/50">
                          #{String(playerNumber).padStart(3, '0')}
                        </div>
                        <div className="col-span-4 font-mono font-bold text-emerald-400">
                          {player.playerId}
                        </div>
                        <div className="col-span-6 font-semibold text-white truncate flex items-center gap-2">
                          {player.photoURL ? (
                            <img
                              src={player.photoURL}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-full object-cover border border-emerald-500/40"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-[10px] font-bold text-white">
                              {player.displayName.charAt(0)}
                            </div>
                          )}
                          <span className="truncate">{player.displayName}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                <span className="text-white/50">
                  Page {currentPage} of {totalPages} ({filteredVerified.length} total players)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {registeringTournament && (
        <RegistrationModal
          tournament={registeringTournament}
          isOpen={Boolean(registeringTournament)}
          onClose={() => setRegisteringTournament(null)}
          onRegisteredSuccess={() => {
            loadTournaments();
          }}
        />
      )}

      {/* CHAMPION CARD MODAL (Requirement 20) */}
      {championModalTournament && (
        <ChampionCardModal
          tournament={championModalTournament}
          isOpen={Boolean(championModalTournament)}
          onClose={() => setChampionModalTournament(null)}
          finalScore={championModalTournament.championScore || '3 — 1'}
        />
      )}
    </div>
  );
};
