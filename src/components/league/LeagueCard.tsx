import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Share2,
  Download,
  QrCode,
  Sparkles,
  Trophy,
  User,
  Flame,
  RotateCw,
  Calendar,
  Check,
  Shield,
  Clock,
} from 'lucide-react';
import { LeagueMember } from '../../types';
import { generateLeagueProfileQrDataUrl, getPublicLeagueProfileUrl } from '../../utils/qrUtils';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { EfootballLogo } from '../EfootballLogo';

interface LeagueCardProps {
  member: LeagueMember;
  onViewQr?: () => void;
  onShare?: () => void;
  compact?: boolean;
}

export const LeagueCard: React.FC<LeagueCardProps> = ({
  member,
  onViewQr,
  onShare,
  compact = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [side, setSide] = useState<'FRONT' | 'BACK'>('FRONT');

  useEffect(() => {
    let isMounted = true;
    generateLeagueProfileQrDataUrl(member.playerId).then((url) => {
      if (isMounted) setQrDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [member.playerId]);

  const handleShare = () => {
    const url = getPublicLeagueProfileUrl(member.playerId);
    if (navigator.share) {
      navigator
        .share({
          title: `${member.displayName} — CHUKA eFOOTBALL League Card`,
          text: `Check out ${member.displayName}'s official CHUKA eFOOTBALL League Card & stats!`,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    if (onShare) onShare();
  };

  const handleSaveCard = () => {
    window.print();
  };

  const isVerified = member.status === 'VERIFIED';
  const formList = member.currentForm || [];

  return (
    <div
      id={`league-card-${member.playerId}`}
      className={`relative overflow-hidden rounded-3xl border ${
        isVerified
          ? 'border-emerald-500/50 shadow-2xl shadow-emerald-950/60'
          : 'border-white/15'
      } bg-gradient-to-b from-[#081810] via-[#040d08] to-[#020503] transition-all duration-300 ${
        compact ? 'p-4 max-w-sm' : 'p-5 sm:p-7 max-w-md w-full'
      }`}
    >
      {/* Pitch Geometry & Ambient Esports Glow */}
      <div className="absolute inset-0 bg-pitch-pattern opacity-25 pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Gold or Neon Green Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-400" />

      {/* Flip Toggle Button in Corner */}
      <div className="relative z-20 flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <ChukaCrestLogo size="sm" withBorder={false} />
          <div>
            <div className="font-heading font-black text-xs sm:text-sm tracking-wider uppercase text-white flex items-center gap-1">
              <span>CHUKA</span>
              <span className="text-emerald-400">eFOOTBALL</span>
            </div>
            <div className="text-[9px] font-mono tracking-widest uppercase text-amber-400 font-bold">
              DIGITAL LEAGUE IDENTITY
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isVerified ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9px] font-mono font-black uppercase tracking-widest shadow-sm shadow-emerald-500/30">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>VERIFIED MEMBER</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold uppercase">
              <span>PENDING</span>
            </div>
          )}

          {/* Flip Card Switch */}
          <button
            type="button"
            onClick={() => setSide(side === 'FRONT' ? 'BACK' : 'FRONT')}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-[10px] font-mono flex items-center gap-1 touch-target"
            title="Flip to details"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden sm:inline">{side === 'FRONT' ? 'STATS' : 'CARD'}</span>
          </button>
        </div>
      </div>

      {/* CARD FRONT VIEW */}
      {side === 'FRONT' ? (
        <div className="relative z-10 space-y-4 animate-in fade-in duration-150">
          {/* Player Identity Row */}
          <div className="flex items-start gap-3.5">
            {/* Squad/Player Photo */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-400/50 bg-black/60 shadow-lg flex items-center justify-center">
                {member.squadImageUrl || member.photoURL ? (
                  <img
                    src={member.squadImageUrl || member.photoURL}
                    alt={member.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-10 h-10 text-white/40" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 text-black flex items-center justify-center font-bold shadow-md text-xs">
                ⚽
              </div>
            </div>

            {/* Names, CHUKA ID & Position */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wider">
                {member.playerId}
              </div>
              <h3 className="font-heading font-black text-lg sm:text-xl text-white truncate leading-tight">
                {member.displayName}
              </h3>
              <div className="text-xs text-white/70 font-mono truncate">
                <span className="text-white/40">eFootball: </span>
                <span className="text-amber-300 font-bold">
                  @{member.efootballUsername || 'eFootball User'}
                </span>
              </div>

              {/* Position & Points Pills */}
              <div className="pt-1.5 flex items-center gap-2">
                <div className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-mono text-white/60 uppercase">POS:</span>
                  <span className="text-xs font-heading font-black text-white">
                    {member.currentPosition && member.currentPosition > 0
                      ? `#${member.currentPosition}`
                      : 'UNRANKED'}
                  </span>
                </div>
                <div className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-black">
                  {member.points || 0} PTS
                </div>
              </div>
            </div>
          </div>

          {/* Clean Stats Grid (P | W | D | L | GD as requested) */}
          <div className="grid grid-cols-5 gap-1.5 p-3 rounded-2xl bg-black/60 border border-white/[0.08] text-center font-mono">
            <div>
              <div className="text-[9px] text-white/50 uppercase font-semibold">P</div>
              <div className="text-sm font-black text-white mt-0.5">{member.matchesPlayed || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-emerald-400 uppercase font-semibold">W</div>
              <div className="text-sm font-black text-emerald-300 mt-0.5">{member.wins || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-amber-400 uppercase font-semibold">D</div>
              <div className="text-sm font-black text-amber-300 mt-0.5">{member.draws || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-rose-400 uppercase font-semibold">L</div>
              <div className="text-sm font-black text-rose-300 mt-0.5">{member.losses || 0}</div>
            </div>
            <div>
              <div className="text-[9px] text-teal-400 uppercase font-semibold">GD</div>
              <div className="text-sm font-black text-teal-300 mt-0.5">
                {member.goalDifference > 0 ? `+${member.goalDifference}` : member.goalDifference || 0}
              </div>
            </div>
          </div>

          {/* High-Contrast QR Code Section */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white rounded-xl shadow-lg shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${member.playerId}`}
                    className="w-16 h-16 sm:w-18 sm:h-18"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-black/50" />
                  </div>
                )}
              </div>
              <div className="text-left space-y-0.5">
                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-3 h-3" />
                  <span>PUBLIC CARD QR</span>
                </div>
                <p className="text-[10px] text-white/60 leading-tight max-w-[130px]">
                  Opponents scan to verify official stats & launch matches.
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                id={`btn-share-card-${member.playerId}`}
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 touch-target"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{copied ? 'COPIED' : 'SHARE'}</span>
              </button>
              <button
                type="button"
                id={`btn-save-card-${member.playerId}`}
                onClick={handleSaveCard}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 touch-target"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>SAVE</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CARD BACK / DETAIL VIEW as mandated in Section 9 */
        <div className="relative z-10 space-y-4 animate-in fade-in duration-150">
          <div className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>AUTHENTICATED RECORD BACK</span>
          </div>

          {/* Form Guide (last 5 matches) */}
          <div className="p-3 rounded-2xl bg-black/60 border border-white/[0.08] space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-[10px] text-white/50 uppercase">
              <span>Form Guide (Last 5 Fixtures)</span>
              <span>{member.winRate || 0}% Win Rate</span>
            </div>
            {formList.length > 0 ? (
              <div className="flex items-center gap-1.5">
                {formList.slice(-5).map((f, i) => (
                  <span
                    key={i}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
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
            ) : (
              <div className="text-xs text-white/40">No confirmed fixtures completed yet.</div>
            )}
          </div>

          {/* Detailed Statistics */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
              <div className="text-[10px] text-white/50 uppercase">Clean Sheets</div>
              <div className="font-heading font-black text-base text-white">
                {member.cleanSheets || 0}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
              <div className="text-[10px] text-orange-400 uppercase flex items-center gap-1">
                <Flame className="w-3 h-3" />
                <span>Best Win Streak</span>
              </div>
              <div className="font-heading font-black text-base text-orange-300">
                {member.longestWinStreak || member.currentStreak || 0} Wins
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
              <div className="text-[10px] text-white/50 uppercase">Goals Scored</div>
              <div className="font-heading font-black text-base text-emerald-400">
                {member.goalsFor || 0} GF
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
              <div className="text-[10px] text-white/50 uppercase">Goals Conceded</div>
              <div className="font-heading font-black text-base text-white/70">
                {member.goalsAgainst || 0} GA
              </div>
            </div>
          </div>

          {/* Official Registration Timestamp */}
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-[10px] font-mono text-white/50">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>Registered:</span>
            </div>
            <span>
              {member.verifiedAt
                ? new Date(member.verifiedAt).toLocaleDateString('en-KE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Pending verification'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 touch-target"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copied ? 'Link Copied' : 'Share Card'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveCard}
              className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 touch-target"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
