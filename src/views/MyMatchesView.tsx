import React, { useState, useEffect } from 'react';
import { Swords, Trophy, Copy, Check, Upload, AlertOctagon, ArrowRight, Smartphone, Shield } from 'lucide-react';
import { MatchFixture } from '../types';
import { matchService } from '../services/matchService';
import { useAuth } from '../context/AuthContext';
import { MatchRoomModal } from '../components/MatchRoomModal';
import { NavTab } from '../components/Navigation';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { ChukaCrestLogo } from '../components/ChukaCrestLogo';
import { EfootballLogo } from '../components/EfootballLogo';
import { AuthNoticeBanner } from '../components/AuthNoticeBanner';

interface MyMatchesViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const MyMatchesView: React.FC<MyMatchesViewProps> = ({ onNavigate }) => {
  const { currentUser, userProfile, loginWithGoogle, isSigningIn, authErrorNotice, clearAuthErrorNotice } = useAuth();
  const [matches, setMatches] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchFixture | null>(null);

  const loadMyMatches = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await matchService.getUserMatches(currentUser.uid);
      setMatches(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyMatches();
  }, [currentUser]);

  if (!currentUser || !userProfile) {
    return (
      <div className="max-w-lg mx-auto my-8 sm:my-14 p-6 sm:p-9 text-center rounded-3xl efootball-card-bg relative overflow-hidden shadow-2xl space-y-6">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-center gap-4 relative z-10">
          <ChukaCrestLogo size="lg" withBorder={true} />
          <div className="h-8 w-[1px] bg-white/20" />
          <EfootballLogo size="lg" variant="badge" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider">
            <Smartphone className="w-3.5 h-3.5" />
            <span>eFootball Matchday Center</span>
          </div>

          <h2 className="font-heading font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            My Match Fixtures
          </h2>

          <p className="text-xs sm:text-sm text-white/70 max-w-md mx-auto leading-relaxed">
            Sign in with your Google account to access your scheduled 1v1 match rooms, copy match room codes directly into eFootball™ Mobile, and upload screenshot proof of your victories.
          </p>
        </div>

        <div className="relative z-10 pt-1 flex flex-col items-center justify-center gap-3">
          <GoogleSignInButton
            onClick={() => loginWithGoogle()}
            loading={isSigningIn}
            disabled={isSigningIn}
            size="lg"
            text="signin_with"
            theme="light"
            className="w-full justify-center shadow-xl hover:scale-[1.01]"
          />
          {authErrorNotice && (
            <AuthNoticeBanner
              notice={authErrorNotice}
              onRetry={() => loginWithGoogle(true)}
              onDismiss={clearAuthErrorNotice}
              variant="inline"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="my-matches-view-container" className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Swords className="w-3.5 h-3.5" />
            <span>Active Match Center</span>
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
            My Tournament Matches
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
            Logged in as <strong className="text-white">{userProfile.displayName}</strong> (
            <span className="text-emerald-400 font-mono">{userProfile.playerId}</span>).
          </p>
        </div>

        <button
          onClick={() => onNavigate('TOURNAMENTS')}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shrink-0"
        >
          <span>Find Tournaments</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-white/50 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>Loading your fixtures...</div>
        </div>
      ) : matches.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#09110d] border border-dashed border-white/10 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Swords className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-xl text-white">No active matches found.</h3>
            <p className="text-xs text-white/60 max-w-sm mx-auto mt-1">
              You do not have any matches in progress right now. Register for an open weekly tournament to get seeded into the knockout bracket!
            </p>
          </div>
          <button
            onClick={() => onNavigate('TOURNAMENTS')}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
          >
            Browse Open Tournaments
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => {
            const isHome = m.homePlayerUid === currentUser.uid;
            const isCompleted = m.status === 'CONFIRMED';
            const isLive = m.status === 'IN_PROGRESS' || m.status === 'RESULT_SUBMITTED';

            return (
              <div
                key={m.id}
                onClick={() => setSelectedMatch(m)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-lg space-y-4 ${
                  isCompleted
                    ? 'bg-[#09110c] border-emerald-500/30 hover:border-emerald-400'
                    : isLive
                    ? 'bg-[#141209] border-amber-500/40 hover:border-amber-400 shadow-amber-950/20'
                    : 'bg-black/60 border-white/10 hover:border-white/25'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">{m.matchId}</span>
                    <span className="text-white/40">•</span>
                    <span className="text-amber-300 font-bold">{m.roundName}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isLive
                        ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Score / Participants */}
                <div className="grid grid-cols-7 items-center text-center py-2">
                  <div className="col-span-3 text-left">
                    <span className="text-[9px] font-bold uppercase text-emerald-400">
                      {isHome ? 'YOU (HOME)' : 'HOME'}
                    </span>
                    <div className="font-heading font-black text-base text-white truncate">
                      {m.homePlayerName}
                    </div>
                    <div className="text-xs text-white/50 font-mono">{m.homePlayerId}</div>
                  </div>

                  <div className="col-span-1 font-heading font-black text-xl text-amber-400">
                    {m.homeScore !== undefined && m.homeScore !== null ? `${m.homeScore} : ${m.awayScore}` : 'VS'}
                  </div>

                  <div className="col-span-3 text-right">
                    <span className="text-[9px] font-bold uppercase text-orange-400">
                      {!isHome ? 'YOU (AWAY)' : 'AWAY'}
                    </span>
                    <div className="font-heading font-black text-base text-white truncate">
                      {m.awayPlayerName}
                    </div>
                    <div className="text-xs text-white/50 font-mono">{m.awayPlayerId}</div>
                  </div>
                </div>

                {/* Action hint banner */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
                  {m.roomStatus === 'READY' && !isCompleted ? (
                    <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                      <span>🟢 Room Ready</span>
                      <span className="text-white/60 font-sans">(Tap to view code)</span>
                    </span>
                  ) : isHome && !isCompleted ? (
                    <span className="text-amber-300 font-semibold animate-pulse">
                      Tap to enter eFootball Room Code
                    </span>
                  ) : !isHome && !isCompleted ? (
                    <span className="text-white/50">
                      Standby for Home Player Room Code
                    </span>
                  ) : (
                    <span className="text-white/50">Tap to inspect room &amp; submit scores</span>
                  )}

                  <span className="text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                    Open Room →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Match Room Modal */}
      {selectedMatch && (
        <MatchRoomModal
          match={selectedMatch}
          isOpen={Boolean(selectedMatch)}
          onClose={() => setSelectedMatch(null)}
          onUpdated={() => {
            loadMyMatches();
          }}
        />
      )}
    </div>
  );
};
