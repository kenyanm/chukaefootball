import React, { useState, useEffect } from 'react';
import { Users, Search, Trophy, ShieldCheck, Award, Swords, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { playerService } from '../services/playerService';

export const PlayersView: React.FC = () => {
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CHAMPIONS' | 'TOP_WINS'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await playerService.getAllPlayers();
        setPlayers(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredPlayers = players.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.displayName.toLowerCase().includes(q) ||
      p.playerId.toLowerCase().includes(q) ||
      (Boolean(p.efootballUsername) && p.efootballUsername!.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filter === 'CHAMPIONS') {
      return (p.championships || 0) > 0;
    }
    if (filter === 'TOP_WINS') {
      return (p.wins || 0) > 0;
    }
    return true;
  });

  return (
    <div id="players-view-container" className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Community Directory</span>
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
            Chuka Player Roster
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
            Official roster of verified Chuka University eFootball Mobile competitors. Search by name or unique CHUKA Player ID.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-2xl shrink-0">
          {(['ALL', 'CHAMPIONS', 'TOP_WINS'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                filter === mode
                  ? 'bg-emerald-500 text-[#051a0e] shadow-md shadow-emerald-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {mode.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <input
          id="input-player-search"
          type="text"
          placeholder="Search by player name or Player ID (e.g. CHUKA-000001)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#09110d] border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
        />
        <Search className="w-5 h-5 text-white/40 absolute left-3.5 top-3.5" />
      </div>

      {/* Players Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10 text-white/50 text-xs">
          {searchQuery
            ? `No players found matching "${searchQuery}".`
            : 'No players registered in directory yet. Sign in to get your official CHUKA Player ID!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player) => (
            <div
              key={player.id}
              className="p-4 sm:p-5 rounded-2xl bg-[#09100d] border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-4 shadow-lg group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {player.efootballAccountImageUrl || player.photoURL ? (
                    <img
                      src={player.efootballAccountImageUrl || player.photoURL}
                      alt={player.displayName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-emerald-400/40 group-hover:border-emerald-400 transition-colors"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-[#004d28] flex items-center justify-center text-white font-heading font-black text-lg">
                      {player.displayName.charAt(0)}
                    </div>
                  )}

                  <div>
                    <h3 className="font-heading font-bold text-base text-white group-hover:text-emerald-300 transition-colors truncate max-w-[160px]">
                      {player.displayName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block px-2 py-0.5 rounded bg-black border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400">
                        {player.playerId}
                      </span>
                      {player.efootballUsername && (
                        <span className="text-[10px] text-emerald-300/80 font-mono truncate max-w-[100px]" title={`eFootball: ${player.efootballUsername}`}>
                          🎮 {player.efootballUsername}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(player.championships || 0) > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    <Trophy className="w-3 h-3" /> Champion
                  </span>
                )}
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 text-center">
                <div className="p-2 rounded-xl bg-black/40">
                  <div className="text-[10px] font-bold uppercase text-emerald-400">Wins</div>
                  <div className="font-mono font-bold text-base text-white mt-0.5">{player.wins || 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-black/40">
                  <div className="text-[10px] font-bold uppercase text-white/40">Losses</div>
                  <div className="font-mono font-bold text-base text-white/70 mt-0.5">{player.losses || 0}</div>
                </div>
                <div className="p-2 rounded-xl bg-black/40">
                  <div className="text-[10px] font-bold uppercase text-amber-400">Cups</div>
                  <div className="font-mono font-bold text-base text-amber-300 mt-0.5">
                    {player.championships || 0}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
