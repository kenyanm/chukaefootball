import React, { useEffect, useState } from 'react';
import {
  X,
  Trophy,
  ShieldCheck,
  User,
  Activity,
  Flame,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Swords,
  Share2,
  QrCode,
  CreditCard,
  Check,
  MessageSquare,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { leagueService } from '../../services/leagueService';
import { socialService } from '../../services/socialService';
import { PublicLeagueProfile, PlayerRivalrySummary, LeagueMatch, LeagueMember } from '../../types';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { generateLeagueProfileQrDataUrl, getPublicLeagueProfileUrl } from '../../utils/qrUtils';
import { useAuth } from '../../context/AuthContext';

interface PublicLeagueProfileModalProps {
  playerId: string | null;
  seasonId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenChallenge?: (playerId: string) => void;
  onViewLeagueCard?: (playerId: string) => void;
  onInspectRivalry?: (playerAId: string, playerBId: string) => void;
}

export const PublicLeagueProfileModal: React.FC<PublicLeagueProfileModalProps> = ({
  playerId,
  seasonId,
  isOpen,
  onClose,
  onOpenChallenge,
  onViewLeagueCard,
  onInspectRivalry,
}) => {
  const { userProfile, currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicLeagueProfile | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);
  const [showRivalries, setShowRivalries] = useState(false);
  const [rivalries, setRivalries] = useState<PlayerRivalrySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !playerId) {
      setProfile(null);
      setRivalries([]);
      setShowQr(false);
      setShowRivalries(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      leagueService.getPublicLeagueProfile(playerId, seasonId),
      generateLeagueProfileQrDataUrl(playerId),
      leagueService.getPlayerLeagueMatches(playerId, seasonId),
      leagueService.getLeagueMembers(seasonId),
    ])
      .then(([prof, qr, matches, members]) => {
        if (isMounted) {
          setProfile(prof);
          setQrUrl(qr);
          const computedRivalries = socialService.getPlayerRivalries(playerId, matches, members);
          setRivalries(computedRivalries);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Error loading public profile data:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, playerId, seasonId]);

  if (!isOpen) return null;

  const handleCopyShareUrl = () => {
    if (!playerId) return;
    const url = getPublicLeagueProfileUrl(playerId);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!profile) return;
    const url = socialService.getLeagueCardWhatsAppUrl({
      username: profile.efootballUsername || profile.displayName,
      playerId: profile.playerId,
      rank: profile.currentPosition,
      points: profile.points,
    });
    window.open(url, '_blank');
  };

  const isSelf = userProfile?.playerId === playerId;
  const canChallenge = !!userProfile?.playerId && !isSelf && !!onOpenChallenge;

  return (
    <div
      id="public-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        id="public-profile-card"
        className="relative w-full max-w-xl rounded-3xl bg-[#080C09] border border-white/10 shadow-2xl p-5 sm:p-7 space-y-5 my-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <ChukaCrestLogo size="sm" />
            <div>
              <div className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>CHUKA</span>
                <span className="text-emerald-400">eFOOTBALL LEAGUE</span>
              </div>
              <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest">
                OFFICIAL PUBLIC PLAYER PROFILE
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-mono text-white/50 uppercase tracking-wider">
              Loading Official League Profile...
            </div>
          </div>
        ) : profile ? (
          <div className="space-y-5">
            {/* Player Main Banner */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-emerald-500/30 bg-black/70 flex-shrink-0 flex items-center justify-center">
                  {profile.squadImageUrl || profile.photoURL ? (
                    <img
                      src={profile.squadImageUrl || profile.photoURL}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-8 h-8 text-white/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {profile.playerId}
                    </span>
                    {profile.isVerifiedMember && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        VERIFIED
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading font-black text-lg text-white truncate">
                    {profile.displayName}
                  </h3>
                  <div className="text-xs font-mono text-white/60">
                    eFootball:{' '}
                    <span className="text-amber-300 font-bold">
                      {profile.efootballUsername || 'eFootball User'}
                    </span>
                  </div>

                  {/* Player Titles */}
                  {profile.titles && profile.titles.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {profile.titles.map((title, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold font-mono uppercase flex items-center gap-1"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Position rank pill & movement */}
              <div className="text-left sm:text-right flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 w-full sm:w-auto">
                <div className="text-[10px] font-mono text-white/40 uppercase">LEAGUE STANDING</div>
                <div className="text-xl sm:text-2xl font-heading font-black text-white flex items-center gap-1 sm:justify-end">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>
                    {profile.currentPosition > 0 ? `#${profile.currentPosition}` : 'Contender'}
                  </span>
                </div>
                {profile.rankingMovement && (
                  <div
                    className={`text-[10px] font-mono font-bold flex items-center gap-0.5 sm:justify-end ${
                      profile.rankingMovement.direction === 'UP'
                        ? 'text-emerald-400'
                        : profile.rankingMovement.direction === 'DOWN'
                        ? 'text-rose-400'
                        : 'text-white/40'
                    }`}
                  >
                    {profile.rankingMovement.direction === 'UP' && <ArrowUp className="w-3 h-3" />}
                    {profile.rankingMovement.direction === 'DOWN' && <ArrowDown className="w-3 h-3" />}
                    {profile.rankingMovement.direction === 'SAME' && <Minus className="w-3 h-3" />}
                    <span>{profile.rankingMovement.display}</span>
                  </div>
                )}
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {profile.points} PTS
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {canChallenge && (
                <button
                  id="profile-btn-challenge"
                  onClick={() => {
                    onOpenChallenge?.(profile.playerId);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>CHALLENGE</span>
                </button>
              )}

              {onViewLeagueCard && (
                <button
                  id="profile-btn-card"
                  onClick={() => {
                    onViewLeagueCard(profile.playerId);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>LEAGUE CARD</span>
                </button>
              )}

              <button
                id="profile-btn-share-whatsapp"
                onClick={handleWhatsAppShare}
                className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WHATSAPP</span>
              </button>

              <button
                id="profile-btn-copy-link"
                onClick={handleCopyShareUrl}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'COPIED!' : 'SHARE'}</span>
              </button>

              <button
                id="profile-btn-toggle-qr"
                onClick={() => setShowQr((prev) => !prev)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQr ? 'HIDE QR' : 'QR CODE'}</span>
              </button>
            </div>

            {/* QR Code Section (Collapsible) */}
            {showQr && qrUrl && (
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col items-center justify-center space-y-2 text-center animate-in fade-in">
                <img
                  src={qrUrl}
                  alt="Player QR Code"
                  className="w-36 h-36 rounded-xl border border-white/20 p-2 bg-white"
                />
                <div className="text-xs font-mono text-white/60">
                  Scan to view verified League profile & statistics
                </div>
              </div>
            )}

            {/* Official Statistics Grid */}
            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">PLAYED</div>
                <div className="text-base font-black text-white">{profile.matchesPlayed}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-400 uppercase">WINS</div>
                <div className="text-base font-black text-emerald-300">{profile.wins}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-[10px] text-amber-400 uppercase">DRAWS</div>
                <div className="text-base font-black text-amber-300">{profile.draws}</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="text-[10px] text-rose-400 uppercase">LOSSES</div>
                <div className="text-base font-black text-rose-300">{profile.losses}</div>
              </div>
            </div>

            {/* Extended Metrics: Goals For, Goals Against, Goal Diff, Win Rate */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">GOALS (GF / GA)</div>
                <div className="font-bold text-white">
                  {profile.goalsFor} <span className="text-white/40">/</span> {profile.goalsAgainst}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">GOAL DIFF</div>
                <div
                  className={`font-bold ${
                    profile.goalDifference > 0
                      ? 'text-emerald-400'
                      : profile.goalDifference < 0
                      ? 'text-rose-400'
                      : 'text-white/70'
                  }`}
                >
                  {profile.goalDifference > 0 ? `+${profile.goalDifference}` : profile.goalDifference}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">WIN RATE</div>
                <div className="font-bold text-amber-300">{profile.winRate}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">STREAK / FORM</div>
                <div className="font-bold flex items-center justify-center gap-1 text-emerald-400">
                  {(profile.currentStreak || 0) >= 3 && <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />}
                  <span>
                    {(profile.currentStreak || 0) > 0 ? `+${profile.currentStreak}` : profile.currentStreak || '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Head-to-Head Rivalries Accordion Button */}
            <div className="space-y-2">
              <button
                id="profile-btn-rivalries-toggle"
                onClick={() => setShowRivalries((prev) => !prev)}
                className="w-full p-3 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Swords className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white uppercase tracking-wider">
                    Official Head-to-Head Rivalries
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {rivalries.length} OPPONENTS
                  </span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-white/50 transition-transform ${
                    showRivalries ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {showRivalries && (
                <div className="space-y-2 p-3 rounded-2xl bg-black/30 border border-white/5 animate-in fade-in">
                  {rivalries.length === 0 ? (
                    <div className="py-6 text-center text-xs font-mono text-white/40 space-y-1">
                      <div>No confirmed League rivalries yet.</div>
                      <div className="text-[11px] text-white/30">
                        Rivalries are only recorded from confirmed, official League matches.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rivalries.map((r) => (
                        <div
                          key={r.opponentPlayerId}
                          className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 font-mono text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{r.opponentUsername}</span>
                              <span className="text-[10px] text-white/40">({r.opponentPlayerId})</span>
                            </div>
                            <div className="text-[11px] text-white/60">
                              Played {r.matchesPlayed} • {r.wins}W - {r.draws}D - {r.losses}L • GD{' '}
                              <span
                                className={
                                  r.goalDifference > 0
                                    ? 'text-emerald-400'
                                    : r.goalDifference < 0
                                    ? 'text-rose-400'
                                    : 'text-white/60'
                                }
                              >
                                {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-white/70">
                              Latest: {r.latestScoreDisplay}
                            </span>
                            {onInspectRivalry && (
                              <button
                                onClick={() => {
                                  onInspectRivalry(profile.playerId, r.opponentPlayerId);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] uppercase transition-all"
                              >
                                Head-to-Head
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Unlocked Achievements Gallery */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/70 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Unlocked Achievements</span>
                </span>
                <span className="text-amber-400 font-bold font-mono text-[10px]">
                  {profile.achievements ? profile.achievements.length : 0} UNLOCKED
                </span>
              </div>

              {!profile.achievements || profile.achievements.length === 0 ? (
                <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center text-xs font-mono text-white/40">
                  No competitive achievements unlocked yet. Play league matches to earn badges!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.achievements.map((achv) => (
                    <div
                      key={achv.id}
                      className="p-2.5 rounded-xl bg-black/40 border border-amber-500/20 flex items-start gap-2.5"
                    >
                      <span className="text-xl p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                        {achv.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-heading font-black text-xs text-white truncate">
                            {achv.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-amber-400">
                            +{achv.pointsAwarded} PTS
                          </span>
                        </div>
                        <p className="text-[10px] text-white/60 line-clamp-1">{achv.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Last 5 League Results */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recent League Results (Last 5)</span>
                </span>
                <span className="text-white/40">Official Confirmed</span>
              </div>

              {profile.recentMatches.length === 0 ? (
                <div className="p-4 rounded-xl bg-black/30 border border-white/5 text-center text-xs font-mono text-white/40">
                  No confirmed League matches played yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {profile.recentMatches.map((m) => (
                    <div
                      key={m.matchId}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between font-mono text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                            m.result === 'W'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : m.result === 'D'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {m.result}
                        </span>
                        <span className="text-white font-bold">{m.scoreDisplay}</span>
                        <span className="text-white/40">vs</span>
                        <span className="text-white/80 truncate max-w-[140px]">
                          {m.opponentName}
                        </span>
                      </div>
                      <div className="text-[10px] text-white/40">{m.opponentPlayerId}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-mono text-white/40 text-center">
              All statistics are officially recorded on CHUKA eFOOTBALL. Personal contact and
              payment details are strictly private.
            </div>
          </div>
        ) : (
          <div className="py-12 text-center space-y-2">
            <div className="text-sm font-mono text-white/60">Player not found in League registry.</div>
          </div>
        )}
      </div>
    </div>
  );
};
