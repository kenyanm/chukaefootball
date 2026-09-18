import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Swords,
  Users,
  ChevronRight,
  Radio,
  QrCode,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  Flame,
  ArrowRight,
  Shield,
  Clock,
} from 'lucide-react';
import { Tournament, UserProfile, MatchFixture, LeagueMember, LeagueMatch } from '../types';
import { tournamentService } from '../services/tournamentService';
import { playerService } from '../services/playerService';
import { matchService } from '../services/matchService';
import { leagueService } from '../services/leagueService';
import { RegistrationModal } from '../components/RegistrationModal';
import { MatchRoomModal } from '../components/MatchRoomModal';
import { ChampionCardModal } from '../components/ChampionCardModal';
import { ChukaCrestLogo } from '../components/ChukaCrestLogo';
import { EfootballLogo } from '../components/EfootballLogo';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { ScanLeagueCardModal } from '../components/league/ScanLeagueCardModal';
import { PublicLeagueProfileModal } from '../components/league/PublicLeagueProfileModal';
import { DailyFirstCard } from '../components/common/DailyFirstCard';
import { StandingsRow } from '../components/league/StandingsRow';
import { PWAInstallBanner } from '../components/pwa/PWAInstallBanner';
import { useAuth } from '../context/AuthContext';
import { NavTab } from '../components/Navigation';

interface HomeViewProps {
  onNavigate: (tab: NavTab) => void;
}

const WHATSAPP_LINK = 'https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk';

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const { userProfile, loginWithGoogle, isSigningIn } = useAuth();

  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [topLeagueMembers, setTopLeagueMembers] = useState<LeagueMember[]>([]);
  const [userLeagueMember, setUserLeagueMember] = useState<LeagueMember | null>(null);
  const [recentConfirmedMatches, setRecentConfirmedMatches] = useState<LeagueMatch[]>([]);
  const [liveLeagueMatchesCount, setLiveLeagueMatchesCount] = useState<number>(0);
  const [openChallengesCount, setOpenChallengesCount] = useState<number>(0);
  const [activePlayerMatch, setActivePlayerMatch] = useState<MatchFixture | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedForRegister, setSelectedForRegister] = useState<Tournament | null>(null);
  const [activeMatchModal, setActiveMatchModal] = useState<MatchFixture | null>(null);
  const [selectedChampionTournament, setSelectedChampionTournament] = useState<Tournament | null>(null);
  const [isScanCardModalOpen, setIsScanCardModalOpen] = useState(false);
  const [selectedScannedPlayerId, setSelectedScannedPlayerId] = useState<string | null>(null);

  const loadHomeData = async () => {
    setLoading(true);
    try {
      // 1. Tournaments
      let all: Tournament[] = [];
      try {
        all = (await tournamentService.getAllTournaments()) || [];
      } catch (tErr) {
        console.warn('Tournaments fetch notice:', tErr);
        all = [];
      }
      setAllTournaments(all);

      if (all.length > 0) {
        const active =
          all.find((t) => t.status === 'LIVE') ||
          all.find((t) => t.status === 'REGISTRATION_OPEN') ||
          all.find((t) => t.status === 'VERIFICATION') ||
          all[0];
        setCurrentTournament(active);
      }

      // 2. League Standings & Recent Matches
      try {
        const leagueMembers = await leagueService.getAllLeagueMembers('SEASON_01');
        const activeMembers = (leagueMembers || [])
          .filter((m) => m.status === 'VERIFIED')
          .sort((a, b) => (b.points || 0) - (a.points || 0));

        setTopLeagueMembers(activeMembers.slice(0, 5));

        if (userProfile) {
          const found = activeMembers.find((m) => m.playerId === userProfile.playerId);
          setUserLeagueMember(found || null);
        }

        const leagueMatches = await leagueService.getLeagueMatches('SEASON_01');
        const confirmedMatches = (leagueMatches || [])
          .filter((m) => m.status === 'CONFIRMED')
          .sort(
            (a, b) =>
              new Date(b.confirmedAt || b.submittedAt || b.createdAt || '').getTime() -
              new Date(a.confirmedAt || a.submittedAt || a.createdAt || '').getTime()
          );

        setRecentConfirmedMatches(confirmedMatches.slice(0, 4));

        const liveCount = (leagueMatches || []).filter(
          (m) => m.status === 'PLAYING' || m.status === 'ROOM_READY'
        ).length;
        setLiveLeagueMatchesCount(liveCount);

        const challenges = await leagueService.getSeasonChallenges('SEASON_01');
        const pending = (challenges || []).filter((c) => c.status === 'PENDING').length;
        setOpenChallengesCount(pending);
      } catch (err) {
        console.warn('League highlights load warning:', err);
      }

      // 3. Check for User Active Knockout Match
      if (userProfile?.id) {
        try {
          const userMatches = await matchService.getUserMatches(userProfile.id);
          const active = (userMatches || []).find(
            (m) =>
              m.status === 'SCHEDULED' ||
              m.status === 'IN_PROGRESS' ||
              m.status === 'SUBMITTED' ||
              m.status === 'AWAITING_CONFIRMATION' ||
              m.status === 'DISPUTED'
          );
          setActivePlayerMatch(active || null);
        } catch (mErr) {
          console.warn('Active match notice:', mErr);
        }
      }
    } catch (e) {
      console.error('Home load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [userProfile?.id]);

  return (
    <div id="home-view-container" className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. PWA INSTALL BANNER (Official Sports Card Presentation) */}
      <section id="home-pwa-install-section" className="w-full">
        <PWAInstallBanner />
      </section>

      {/* 2. SIGNED-IN ATHLETE COMPACT BAR */}
      {userProfile && (
        <section
          id="athlete-compact-status"
          className="p-4 sm:p-5 rounded-3xl bg-[#070e09] border border-emerald-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {userProfile.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover border border-emerald-400/60 shadow-md shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white font-heading font-black text-lg flex items-center justify-center border border-emerald-400/50 shrink-0">
                {userProfile.displayName.charAt(0)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-sm sm:text-base text-white uppercase truncate">
                  {userProfile.displayName}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                  {userProfile.playerId}
                </span>
              </div>
              <div className="text-[11px] font-mono text-white/50 truncate">
                🎮 @{userProfile.efootballUsername || 'eFootball™ Mobile'}
              </div>
            </div>
          </div>

          {/* Compact Football Stats Row */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
            <div className="flex items-center gap-3 text-xs font-mono text-white/70">
              <span>
                <strong className="text-white">
                  {userLeagueMember?.matchesPlayed ?? userProfile.wins ?? 0}
                </strong>{' '}
                MP
              </span>
              <span>
                <strong className="text-emerald-400">{userLeagueMember?.wins ?? userProfile.wins ?? 0}</strong>{' '}
                W
              </span>
              <span>
                <strong className="text-white/60">{userLeagueMember?.draws ?? 0}</strong> D
              </span>
              <span>
                <strong className="text-rose-400">{userLeagueMember?.losses ?? userProfile.losses ?? 0}</strong>{' '}
                L
              </span>
              <span className="text-amber-400 font-bold">
                {userLeagueMember?.points ?? (userProfile.wins ? userProfile.wins * 3 : 0)} PTS
              </span>
            </div>

            {activePlayerMatch ? (
              <button
                type="button"
                onClick={() => setActiveMatchModal(activePlayerMatch)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-heading font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse shadow-md"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Next Match</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('PROFILE')}
                className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* 3. OFFICIAL STADIUM COMPETITION HERO */}
      <section
        id="competition-hero"
        className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[#041208] via-[#07190d] to-[#020704] p-5 sm:p-7 shadow-xl shadow-emerald-950/40"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-xl">
            {/* Official Federation Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
              <ChukaCrestLogo size="sm" withBorder={false} className="w-3.5 h-3.5" />
              <span>Chuka University Official eFootball League</span>
            </div>

            {/* Clean Professional Title */}
            <div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight uppercase">
                CHUKA <span className="text-emerald-400">eFOOTBALL</span>
              </h1>
              <p className="font-mono text-xs text-white/70 tracking-wide uppercase mt-0.5">
                Official Campus 1v1 Mobile Esports
              </p>
            </div>

            {/* Status Pills: Live League & Next Knockout */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-emerald-500/30 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE: League Season 01</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-amber-500/30 text-amber-300">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Next Cup: Weekly Knockout</span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                id="btn-home-join-league"
                type="button"
                onClick={() => onNavigate('LEAGUE')}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-[#04140a] font-heading font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 touch-target"
              >
                <Trophy className="w-4 h-4 shrink-0" />
                <span>JOIN LEAGUE</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-amber-300 font-mono font-bold text-[10px]">
                  KSh 50
                </span>
              </button>

              <button
                id="btn-home-knockout"
                type="button"
                onClick={() => onNavigate('KNOCKOUT')}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 touch-target"
              >
                <Swords className="w-4 h-4 shrink-0" />
                <span>KNOCKOUT</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-white font-mono font-bold text-[10px]">
                  KSh 20
                </span>
              </button>

              <button
                id="btn-home-live-arena"
                type="button"
                onClick={() => onNavigate('ARENA')}
                className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-heading font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 touch-target"
              >
                <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span>ARENA</span>
              </button>

              <button
                id="btn-home-players"
                type="button"
                onClick={() => onNavigate('PLAYERS')}
                className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-heading font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 touch-target"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>PLAYERS</span>
              </button>
            </div>

            {!userProfile && (
              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs text-white/50">New competitor?</span>
                <GoogleSignInButton
                  onClick={loginWithGoogle}
                  loading={isSigningIn}
                  disabled={isSigningIn}
                  size="sm"
                  text="signin_with"
                  theme="light"
                  className="shadow-md hover:scale-[1.02]"
                />
              </div>
            )}
          </div>

          {/* Right Crest Display */}
          <div className="hidden lg:flex flex-col items-center justify-center p-5 rounded-2xl bg-black/40 border border-emerald-500/20 shadow-xl shrink-0 space-y-2">
            <div className="flex items-center gap-3">
              <ChukaCrestLogo size="md" />
              <div className="h-8 w-[1px] bg-white/20" />
              <EfootballLogo size="md" variant="badge" />
            </div>
            <div className="text-center">
              <div className="text-[11px] font-heading font-black uppercase text-amber-400">
                Official Campus League
              </div>
              <div className="text-[9px] font-mono text-white/50">Verified Results &amp; Standings</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LIVE ARENA STATUS BAR (Compact when matches are active) */}
      {liveLeagueMatchesCount > 0 && (
        <section
          id="live-arena-bar"
          onClick={() => onNavigate('ARENA')}
          className="p-3 sm:p-3.5 rounded-2xl bg-[#0c130e] border border-red-500/40 hover:border-red-400 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs font-mono"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
            <span className="font-heading font-black text-white uppercase text-xs sm:text-sm">
              LIVE ARENA: {liveLeagueMatchesCount} FIXTURE
              {liveLeagueMatchesCount > 1 ? 'S' : ''} IN PLAY
            </span>
          </div>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span>Watch Live</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </section>
      )}

      {/* 5. LEAGUE STANDINGS (Top 5 Table) */}
      <section id="home-standings-section" className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="font-heading font-black text-base sm:text-lg text-white uppercase tracking-wider">
              League Standings
            </h2>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold">
              Season 01
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('LEAGUE')}
            className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Full Table</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {topLeagueMembers.length > 0 ? (
          <div className="space-y-2">
            {topLeagueMembers.map((member, idx) => (
              <StandingsRow
                key={member.id}
                member={member}
                position={idx + 1}
                isCurrentUser={userProfile?.playerId === member.playerId}
                onViewProfile={(playerId) => setSelectedScannedPlayerId(playerId)}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center rounded-2xl bg-[#080d0a]/60 border border-dashed border-white/10 text-white/50 text-xs font-mono">
            No verified league members registered yet. Be the first to register your KSh 50 League Card!
          </div>
        )}
      </section>

      {/* 6. RECENT RESULTS (Compact Football Scorelines) */}
      <section id="home-recent-results-section" className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h2 className="font-heading font-black text-base sm:text-lg text-white uppercase tracking-wider">
              Recent Results
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('ARENA')}
            className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>All Results</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentConfirmedMatches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recentConfirmedMatches.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-2xl bg-[#070d09] border border-white/[0.08] hover:border-white/20 transition-all flex items-center justify-between font-mono text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="truncate flex-1 text-right font-bold text-white">
                    {m.player1Name || m.homePlayerName}
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-black/80 border border-emerald-500/30 text-amber-300 font-heading font-black text-sm shrink-0">
                    {m.player1Score ?? m.homeScore ?? 0} — {m.player2Score ?? m.awayScore ?? 0}
                  </div>
                  <div className="truncate flex-1 text-left font-bold text-white">
                    {m.player2Name || m.awayPlayerName}
                  </div>
                </div>
                <div className="pl-2.5 text-[9px] text-emerald-400 font-bold shrink-0 hidden sm:block">
                  ✓ VERIFIED
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center rounded-2xl bg-[#080d0a]/60 border border-dashed border-white/10 text-white/50 text-xs font-mono">
            No confirmed matches recorded yet for Season 01. Complete a fixture to show results here!
          </div>
        )}
      </section>

      {/* 7. TODAY'S CLAIM (Compact Official Check-In) */}
      <section id="home-daily-first-section">
        <DailyFirstCard
          userProfile={userProfile}
          onViewProfile={(playerId) => setSelectedScannedPlayerId(playerId)}
        />
      </section>

      {/* 8. QUICK OFFICIAL UTILITIES */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => setIsScanCardModalOpen(true)}
          className="p-3.5 rounded-2xl bg-[#070e0a] hover:bg-[#0b150f] border border-emerald-500/30 text-emerald-300 transition-all flex items-center justify-between group active:scale-98 touch-target"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <div className="font-heading font-black text-xs sm:text-sm text-white uppercase">
                Scan Player Card
              </div>
              <div className="text-[10px] font-mono text-white/50">Verify rival digital QR card</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100" />
        </button>

        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3.5 rounded-2xl bg-[#070e0a] hover:bg-[#0b150f] border border-emerald-500/30 text-emerald-300 transition-all flex items-center justify-between group active:scale-98 touch-target"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-heading font-black text-xs sm:text-sm text-white uppercase">
                Official WhatsApp Hub
              </div>
              <div className="text-[10px] font-mono text-white/50">Join the official Chuka community chat</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100" />
        </a>
      </section>

      {/* ALL WORKING MODALS PRESERVED */}
      {selectedForRegister && (
        <RegistrationModal
          tournament={selectedForRegister}
          isOpen={Boolean(selectedForRegister)}
          onClose={() => setSelectedForRegister(null)}
          onRegisteredSuccess={() => loadHomeData()}
        />
      )}

      {activeMatchModal && (
        <MatchRoomModal
          match={activeMatchModal}
          isOpen={Boolean(activeMatchModal)}
          onClose={() => setActiveMatchModal(null)}
          onUpdated={() => loadHomeData()}
          onViewBracket={() => {
            setActiveMatchModal(null);
            onNavigate('KNOCKOUT');
          }}
        />
      )}

      {selectedChampionTournament && (
        <ChampionCardModal
          tournament={selectedChampionTournament}
          isOpen={Boolean(selectedChampionTournament)}
          onClose={() => setSelectedChampionTournament(null)}
          finalScore={selectedChampionTournament.championScore || '3 — 1'}
        />
      )}

      <ScanLeagueCardModal
        isOpen={isScanCardModalOpen}
        onClose={() => setIsScanCardModalOpen(false)}
        onSelectPlayer={(playerId) => setSelectedScannedPlayerId(playerId)}
      />

      <PublicLeagueProfileModal
        playerId={selectedScannedPlayerId}
        seasonId="SEASON_01"
        isOpen={Boolean(selectedScannedPlayerId)}
        onClose={() => setSelectedScannedPlayerId(null)}
        onOpenChallenge={() => {
          setSelectedScannedPlayerId(null);
          onNavigate('ARENA');
        }}
      />
    </div>
  );
};
