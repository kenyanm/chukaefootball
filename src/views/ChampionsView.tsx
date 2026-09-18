import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Calendar,
  Medal,
  Award,
  ExternalLink,
  Sparkles,
  Share2,
  CheckCircle2,
  Clock,
  Swords,
} from 'lucide-react';
import { ChampionRecord, Tournament } from '../types';
import { championService } from '../services/championService';
import { tournamentService } from '../services/tournamentService';
import { ChampionCardModal } from '../components/ChampionCardModal';
import { ChukaCrestLogo } from '../components/ChukaCrestLogo';
import { EfootballLogo } from '../components/EfootballLogo';

interface ChampionsViewProps {
  onNavigate?: (tab: any) => void;
}

export const ChampionsView: React.FC<ChampionsViewProps> = ({ onNavigate }) => {
  const [champions, setChampions] = useState<ChampionRecord[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChampionTourn, setSelectedChampionTourn] = useState<Tournament | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadChampionsData = async () => {
      setLoading(true);
      try {
        const [allChamps, allTourns] = await Promise.all([
          championService.getAllChampions(),
          tournamentService.getAllTournaments(),
        ]);
        if (isMounted) {
          setChampions(allChamps);
          setTournaments(allTourns);
        }
      } catch (err) {
        console.error('Error loading champions:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadChampionsData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenCard = (champ: ChampionRecord) => {
    const matchingTourn = tournaments.find((t) => t.id === champ.tournamentId);
    if (matchingTourn) {
      setSelectedChampionTourn(matchingTourn);
    } else {
      // Synthesize tournament structure for modal view
      const synthTourn: Tournament = {
        id: champ.tournamentId,
        weekNumber: champ.weekNumber,
        name: champ.tournamentName,
        registrationOpenDate: champ.tournamentDate,
        registrationCloseDate: champ.tournamentDate,
        verificationDate: champ.tournamentDate,
        startDate: champ.tournamentDate,
        endDate: champ.tournamentDate,
        entryFee: 20,
        registeredCount: 0,
        verifiedCount: 0,
        status: 'COMPLETED',
        championPlayerId: champ.playerId,
        championName: champ.displayName,
        championPhoto: champ.photoURL,
        championScore: champ.finalScore,
        completedDate: champ.tournamentDate,
        createdAt: champ.createdAt,
      };
      setSelectedChampionTourn(synthTourn);
    }
  };

  return (
    <div id="champions-view-container" className="space-y-8 pb-16">
      {/* Hero Banner (PART S) */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-amber-950/40 via-[#100c06] to-[#080603] border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>CHUKA eFOOTBALL HALL OF FAME</span>
              </span>
              <EfootballLogo size="sm" variant="badge" />
            </div>

            <h1 className="font-heading font-black text-2xl sm:text-4xl text-white uppercase tracking-wider">
              Weekly Tournament Champions
            </h1>

            <p className="text-xs sm:text-sm text-white/70 max-w-2xl leading-relaxed">
              Official historical championship records of Chuka University's weekly eFootball™ mobile tournament.
              Every weekly champion earns permanent university recognition and the official KSh 1,000 cash prize.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ChukaCrestLogo size="lg" withBorder={true} className="hidden sm:block" />
          </div>
        </div>
      </div>

      {/* Champions Roster */}
      {loading ? (
        <div className="p-12 text-center text-white/50 text-sm animate-pulse">
          Loading championship records...
        </div>
      ) : champions.length === 0 ? (
        <div className="p-12 rounded-3xl bg-black/40 border border-dashed border-white/10 text-center space-y-4">
          <Award className="w-12 h-12 text-amber-400/40 mx-auto" />
          <div className="text-base font-heading font-bold text-white uppercase">
            No Completed Tournaments Yet
          </div>
          <p className="text-xs text-white/60 max-w-md mx-auto">
            The weekly knockout tournament is underway. As soon as the final match is officially confirmed, the weekly champion and prize record will appear here.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('TOURNAMENTS')}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all"
            >
              Browse Active Tournaments
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {champions.map((champ) => (
            <div
              key={champ.id}
              id={`champion-card-${champ.weekNumber}`}
              className="p-6 rounded-3xl bg-gradient-to-b from-[#141008] via-[#0c0a06] to-black border border-amber-500/30 hover:border-amber-500/60 shadow-xl transition-all flex flex-col justify-between space-y-5 group"
            >
              <div className="space-y-4">
                {/* Header: Week & Prize */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
                    WEEK {String(champ.weekNumber).padStart(2, '0')}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                      champ.prizeStatus === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {champ.prizeStatus === 'PAID' ? 'KSh 1,000 PAID' : 'KSh 1,000 PRIZE'}
                  </span>
                </div>

                {/* Champion Identity */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {champ.photoURL ? (
                      <img
                        src={champ.photoURL}
                        alt={champ.displayName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md shadow-amber-500/20"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-amber-600 text-white font-heading font-black text-2xl flex items-center justify-center border-2 border-amber-400">
                        {champ.displayName.charAt(0)}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 text-black">
                      <Trophy className="w-3 h-3 fill-current" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-black text-xl text-white uppercase group-hover:text-amber-300 transition-colors">
                      {champ.displayName}
                    </h3>
                    <div className="font-mono text-xs font-bold text-amber-400">
                      {champ.playerId}
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">
                      {champ.tournamentName}
                    </div>
                  </div>
                </div>

                {/* Final Score Stat */}
                <div className="p-3.5 rounded-2xl bg-black/60 border border-white/5 flex items-center justify-between">
                  <div className="text-[11px] uppercase font-bold text-white/50">Final Score</div>
                  <div className="font-heading font-black text-lg text-emerald-400 tracking-wider">
                    {champ.finalScore}
                  </div>
                </div>

                {/* Tournament Date */}
                <div className="flex items-center gap-1.5 text-xs text-white/60 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-white/40" />
                  <span>
                    Completed {new Date(champ.tournamentDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenCard(champ)}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-heading font-bold text-xs uppercase tracking-wider transition-all border border-amber-500/40 flex items-center justify-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>[ VIEW CHAMPION CARD ]</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Champion Card Modal */}
      {selectedChampionTourn && (
        <ChampionCardModal
          tournament={selectedChampionTourn}
          isOpen={true}
          onClose={() => setSelectedChampionTourn(null)}
        />
      )}
    </div>
  );
};
