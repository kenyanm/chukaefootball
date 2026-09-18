import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Swords,
  CreditCard,
  ShieldCheck,
  Search,
  Sparkles,
  Users,
  AlertCircle,
  HelpCircle,
  Info,
  Calendar,
  ExternalLink,
  QrCode,
  ShieldAlert,
  Award,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
} from 'lucide-react';
import { leagueService } from '../services/leagueService';
import {
  LeagueSeason,
  LeagueMember,
  LeagueMatch,
  UserProfile,
} from '../types';
import { ChukaCrestLogo } from '../components/ChukaCrestLogo';
import { LeagueCard } from '../components/league/LeagueCard';
import { LeaguePaymentModal } from '../components/league/LeaguePaymentModal';
import { PublicLeagueProfileModal } from '../components/league/PublicLeagueProfileModal';
import { FindOpponentModal } from '../components/league/FindOpponentModal';
import { LeagueMatchDetailModal } from '../components/league/LeagueMatchDetailModal';
import { LeagueAdminSection } from '../components/league/LeagueAdminSection';
import { GamificationDashboard } from '../components/league/GamificationDashboard';
import { StandingsRow } from '../components/league/StandingsRow';
import { LeagueCardModal } from '../components/league/LeagueCardModal';
import { ChallengePlayerModal } from '../components/league/ChallengePlayerModal';
import { EmptyState } from '../components/common/EmptyState';

interface LeagueViewProps {
  currentUserProfile: UserProfile | null;
  isAdmin: boolean;
}

export const LeagueView: React.FC<LeagueViewProps> = ({
  currentUserProfile,
  isAdmin,
}) => {
  const [activeSeason, setActiveSeason] = useState<LeagueSeason | null>(null);
  const [activeTab, setActiveTab] = useState<
    'STANDINGS' | 'MY_CARD' | 'MATCHES' | 'MEMBERS' | 'GAMIFICATION' | 'RULES' | 'ADMIN'
  >('STANDINGS');
  const [standings, setStandings] = useState<LeagueMember[]>([]);
  const [myMemberRecord, setMyMemberRecord] = useState<LeagueMember | null>(null);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isFindOpponentOpen, setIsFindOpponentOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<LeagueMatch | null>(null);
  const [selectedPublicPlayerId, setSelectedPublicPlayerId] = useState<string | null>(null);
  const [selectedCardMember, setSelectedCardMember] = useState<LeagueMember | null>(null);
  const [selectedChallengePlayerId, setSelectedChallengePlayerId] = useState<string | null>(null);

  const loadLeagueData = async () => {
    setIsLoading(true);
    try {
      const season = await leagueService.getActiveSeason();
      setActiveSeason(season);

      const [stdList, matList] = await Promise.all([
        leagueService.getSeasonStandings(season.id),
        leagueService.getSeasonMatches(season.id),
      ]);
      setStandings(stdList);
      setMatches(matList);

      if (currentUserProfile) {
        const mem = await leagueService.getMemberByUserId(currentUserProfile.id, season.id);
        setMyMemberRecord(mem);
      }
    } catch (err) {
      console.error('Failed to load league data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeagueData();
  }, [currentUserProfile?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const profileId = params.get('profile') || params.get('player');
      if (profileId) {
        setSelectedPublicPlayerId(profileId);
      }
    }
  }, []);

  const isVerifiedMember = myMemberRecord?.status === 'VERIFIED';
  const isPendingMember = myMemberRecord?.status === 'PENDING_PAYMENT_VERIFICATION';

  const filteredStandings = standings.filter((m) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      m.displayName.toLowerCase().includes(term) ||
      m.playerId.toLowerCase().includes(term) ||
      (m.efootballUsername && m.efootballUsername.toLowerCase().includes(term))
    );
  });

  const myMatches = matches.filter(
    (m) =>
      currentUserProfile &&
      (m.homePlayerUid === currentUserProfile.id || m.awayPlayerUid === currentUserProfile.id)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#041109] via-[#081B10] to-[#030906] p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ChukaCrestLogo size="sm" />
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] font-bold tracking-widest uppercase">
                PERMANENT LEAGUE SYSTEM · {activeSeason?.name || 'SEASON 01'}
              </span>
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-4xl text-white tracking-tight">
              CHUKA <span className="text-emerald-400">eFOOTBALL LEAGUE</span>
            </h1>
            <p className="text-sm text-white/70 max-w-2xl font-sans leading-relaxed">
              The continuous member-vs-member competition. Purchase your KSh50 League
              Participation Card, activate your digital card & QR profile, challenge verified
              members, and climb the official standings.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {!isVerifiedMember ? (
              <button
                id="btn-get-league-card"
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isPendingMember ? 'PAYMENT PENDING REVIEW' : 'GET LEAGUE CARD (KSh 50)'}
                </span>
              </button>
            ) : (
              <button
                id="btn-find-league-opponent"
                onClick={() => setIsFindOpponentOpen(true)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Swords className="w-4 h-4" />
                <span>FIND OPPONENT</span>
              </button>
            )}

            {isVerifiedMember && (
              <button
                id="btn-view-my-card"
                onClick={() => setActiveTab('MY_CARD')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs font-bold transition-all"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>MY CARD & QR</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('STANDINGS')}
          className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'STANDINGS'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>LEAGUE STANDINGS</span>
        </button>

        <button
          onClick={() => setActiveTab('GAMIFICATION')}
          className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'GAMIFICATION'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>GAMIFICATION & AWARDS</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_CARD')}
          className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'MY_CARD'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>MY LEAGUE & CARD</span>
        </button>

        <button
          onClick={() => setActiveTab('MATCHES')}
          className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'MATCHES'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>MATCHES ({myMatches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'MEMBERS'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>MEMBERS ({standings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RULES')}
          className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'RULES'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>RULES & FAQ</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'ADMIN'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ADMIN DESK</span>
          </button>
        )}
      </div>

      {/* Tab: Standings Table */}
      {activeTab === 'STANDINGS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-mono text-white/60">
              Official League Table · Rank based on Points &gt; GD &gt; GF &gt; Wins &gt; ID
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member, ID, or eFootball..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs placeholder:text-white/40 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {filteredStandings.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="NO STANDINGS YET"
              description="Be the first verified player to register your League Card and lead Season 01."
              actionLabel="JOIN LEAGUE (KSh 50)"
              onAction={() => setIsPaymentModalOpen(true)}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredStandings.map((m, idx) => (
                <StandingsRow
                  key={m.id}
                  member={m}
                  position={m.currentPosition || idx + 1}
                  isCurrentUser={currentUserProfile?.id === m.userId}
                  onViewProfile={(playerId) => setSelectedPublicPlayerId(playerId)}
                  onViewCard={(member) => setSelectedCardMember(member)}
                  onChallenge={(playerId) => setSelectedChallengePlayerId(playerId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Gamification & Awards */}
      {activeTab === 'GAMIFICATION' && (
        <GamificationDashboard
          standings={standings}
          activeSeasonId={activeSeason?.id || 'SEASON_01'}
          currentUserProfile={currentUserProfile}
          onSelectPlayerProfile={(pId) => setSelectedPublicPlayerId(pId)}
        />
      )}

      {/* Tab: My League & Card */}
      {activeTab === 'MY_CARD' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Card Presentation */}
          <div className="flex flex-col items-center">
            {myMemberRecord ? (
              <LeagueCard member={myMemberRecord} />
            ) : (
              <div className="p-8 rounded-3xl bg-black/40 border border-white/10 text-center space-y-4 max-w-md w-full">
                <CreditCard className="w-12 h-12 text-white/30 mx-auto" />
                <h3 className="font-heading font-black text-lg text-white">
                  No Active League Card Found
                </h3>
                <p className="text-xs text-white/60">
                  Purchase a KSh50 League Participation Card to register your membership, get your
                  verified digital card & QR code, and start playing official matches.
                </p>
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase"
                >
                  GET LEAGUE CARD (KSh 50)
                </button>
              </div>
            )}
          </div>

          {/* Member Status & Quick Actions */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="font-heading font-black text-sm text-white uppercase tracking-wider">
                  MEMBERSHIP STATUS
                </div>
                {isVerifiedMember ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    VERIFIED LEAGUE MEMBER
                  </span>
                ) : isPendingMember ? (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                    PENDING VERIFICATION
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 font-mono text-xs">
                    NOT REGISTERED
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">CHUKA Player ID:</span>
                  <span className="text-emerald-400 font-bold">
                    {currentUserProfile?.playerId || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Current Position:</span>
                  <span className="text-amber-400 font-bold">
                    {myMemberRecord?.currentPosition ? `#${myMemberRecord.currentPosition}` : 'UNRANKED'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">League Matches Played:</span>
                  <span className="text-white font-bold">{myMemberRecord?.matchesPlayed || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Total Points:</span>
                  <span className="text-emerald-400 font-bold">{myMemberRecord?.points || 0} PTS</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => setIsFindOpponentOpen(true)}
                  disabled={!isVerifiedMember}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase disabled:opacity-40"
                >
                  CHALLENGE OPPONENT
                </button>
                {myMemberRecord && (
                  <button
                    onClick={() => setSelectedPublicPlayerId(myMemberRecord.playerId)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs font-bold"
                  >
                    PREVIEW PUBLIC QR
                  </button>
                )}
              </div>
            </div>

            {/* Why KSh50 summary */}
            <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Why KSh50 League Card?</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                The KSh50 League Participation Card activates your official CHUKA eFOOTBALL League
                membership. It gives you a registered place in the League, a digital League Card
                and QR profile, access to official League matches, and ensures all standings are
                based on identifiable, verified participants.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Matches */}
      {activeTab === 'MATCHES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-white/60">
            <span>Your Official League Matches</span>
            <button
              onClick={() => setIsFindOpponentOpen(true)}
              disabled={!isVerifiedMember}
              className="text-emerald-400 hover:underline font-bold disabled:opacity-50"
            >
              + Challenge New Opponent
            </button>
          </div>

          {myMatches.length === 0 ? (
            <div className="p-12 rounded-3xl bg-black/40 border border-white/5 text-center space-y-3 font-mono">
              <Swords className="w-10 h-10 text-white/20 mx-auto" />
              <div className="text-sm text-white/60">No League matches yet.</div>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                Challenge registered members in the directory to begin playing official League
                matches.
              </p>
              {isVerifiedMember && (
                <button
                  onClick={() => setIsFindOpponentOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase"
                >
                  FIND OPPONENT NOW
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {myMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMatch(m)}
                  className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-emerald-500/40 cursor-pointer flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center font-mono w-16">
                      <div className="text-[10px] text-white/40 uppercase">STATUS</div>
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          m.status === 'CONFIRMED'
                            ? 'text-emerald-400'
                            : m.status === 'DISPUTED'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {m.status === 'AWAITING_OPPONENT_CONFIRMATION'
                          ? 'PENDING'
                          : m.status}
                      </span>
                    </div>

                    <div className="space-y-0.5 font-mono text-xs">
                      <div className="font-heading font-black text-sm text-white">
                        {m.homePlayerName} vs {m.awayPlayerName}
                      </div>
                      <div className="text-white/50 text-[11px]">
                        Room: <span className="text-emerald-400 font-bold">{m.roomNumber || 'NOT SET'}</span> · Match ID: {m.id}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    {m.status === 'CONFIRMED' ? (
                      <div className="text-lg font-heading font-black text-white">
                        {m.homeScore} – {m.awayScore}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-400 font-bold">MANAGE MATCH →</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Members Directory */}
      {activeTab === 'MEMBERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-white/60">
            <span>Verified Members in {activeSeason?.name || 'Season 01'}</span>
            <button
              onClick={() => setIsFindOpponentOpen(true)}
              className="text-emerald-400 font-bold hover:underline"
            >
              Search & Challenge
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {standings.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">{m.playerId}</span>
                  <span className="text-amber-400 font-bold">POS #{m.currentPosition || '—'}</span>
                </div>
                <div>
                  <div className="font-heading font-black text-sm text-white">{m.displayName}</div>
                  <div className="text-[11px] text-white/50">
                    eFootball: {m.efootballUsername || 'eFootball User'}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-white/70">
                    {m.matchesPlayed || 0} MP · {m.wins || 0} W · {m.points || 0} PTS
                  </span>
                  <button
                    onClick={() => setSelectedPublicPlayerId(m.playerId)}
                    className="text-emerald-400 hover:underline"
                  >
                    View Card
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Rules & FAQ */}
      {activeTab === 'RULES' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-black/40 border border-white/10 space-y-6 text-sm text-white/80 font-sans leading-relaxed">
          <div className="space-y-2 border-b border-white/10 pb-4">
            <h2 className="font-heading font-black text-xl text-white">
              CHUKA eFOOTBALL LEAGUE — OFFICIAL RULES
            </h2>
            <p className="text-xs font-mono text-white/50">
              The continuous member-vs-member competition rules & scoring policy.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-heading font-black text-emerald-400 uppercase text-xs">
                1. Continuous Member Competition
              </h3>
              <p>
                Unlike the weekly knockout tournaments, the League has no fixed knockout bracket.
                Members can challenge other registered members to official League matches at any
                mutually agreed time.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-black text-emerald-400 uppercase text-xs">
                2. Dual Confirmation Requirement
              </h3>
              <p>
                To prevent false results, one player submits the score, and the opponent MUST
                confirm the result. The submitter cannot unilaterally finalize the result. If
                there is a disagreement, either player can file an official dispute for
                administrative review.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-black text-emerald-400 uppercase text-xs">
                3. Scoring & Standings Tie-Breakers
              </h3>
              <p>
                Win = 3 Points, Draw = 1 Point, Loss = 0 Points. Official ranking is determined
                by: Points &gt; Goal Difference &gt; Goals For &gt; Wins &gt; Player ID.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-black text-emerald-400 uppercase text-xs">
                4. Why KSh50 League Participation Card?
              </h3>
              <p>
                The KSh50 activates your official CHUKA eFOOTBALL League membership. It gives you a
                registered place in the League, a digital League Card and QR profile, access to
                official League matches, and ensures all standings are based on identifiable,
                verified participants.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-400" />
                <span>Prize Notice</span>
              </div>
              <p>
                The KSh50 fee is a participation and membership card fee. It does NOT automatically
                guarantee a prize. Any League prize, sponsorship, reward, or payout must be
                separately published and configured by the administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Admin Desk */}
      {activeTab === 'ADMIN' && isAdmin && currentUserProfile && activeSeason && (
        <LeagueAdminSection
          currentUserProfile={currentUserProfile}
          activeSeason={activeSeason}
          onRefreshAll={loadLeagueData}
        />
      )}

      {/* Payment Modal */}
      {currentUserProfile && activeSeason && (
        <LeaguePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          userProfile={currentUserProfile}
          activeSeason={activeSeason}
          onPaymentSubmitted={loadLeagueData}
        />
      )}

      {/* Find Opponent Modal */}
      {currentUserProfile && activeSeason && (
        <FindOpponentModal
          isOpen={isFindOpponentOpen}
          onClose={() => setIsFindOpponentOpen(false)}
          currentUserProfile={currentUserProfile}
          currentMember={myMemberRecord}
          seasonId={activeSeason.id}
          onChallengeCreated={loadLeagueData}
        />
      )}

      {/* Match Detail Modal */}
      {selectedMatch && currentUserProfile && (
        <LeagueMatchDetailModal
          isOpen={Boolean(selectedMatch)}
          onClose={() => setSelectedMatch(null)}
          match={selectedMatch}
          currentUserProfile={currentUserProfile}
          onMatchUpdated={() => {
            setSelectedMatch(null);
            loadLeagueData();
          }}
        />
      )}

      {/* Public League Profile Modal (QR scan view) */}
      {selectedPublicPlayerId && activeSeason && (
        <PublicLeagueProfileModal
          isOpen={Boolean(selectedPublicPlayerId)}
          onClose={() => setSelectedPublicPlayerId(null)}
          playerId={selectedPublicPlayerId}
          seasonId={activeSeason.id}
        />
      )}

      {/* Selected Card Modal */}
      {selectedCardMember && (
        <LeagueCardModal
          isOpen={Boolean(selectedCardMember)}
          onClose={() => setSelectedCardMember(null)}
          member={selectedCardMember}
        />
      )}

      {/* Selected Challenge Player Modal */}
      {selectedChallengePlayerId && activeSeason && (
        <ChallengePlayerModal
          isOpen={Boolean(selectedChallengePlayerId)}
          onClose={() => setSelectedChallengePlayerId(null)}
          targetPlayerId={selectedChallengePlayerId}
          seasonId={activeSeason.id}
          onChallengeCreated={loadLeagueData}
        />
      )}
    </div>
  );
};
