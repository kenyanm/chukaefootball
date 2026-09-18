import React, { useState } from 'react';
import { Trophy, Share2, Check, X, Shield, Calendar, Award, Sparkles } from 'lucide-react';
import { Tournament } from '../types';
import { useToast } from '../context/ToastContext';
import { ChukaCrestLogo } from './ChukaCrestLogo';
import { EfootballLogo } from './EfootballLogo';

interface ChampionCardModalProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  finalScore?: string; // e.g. "3 — 1"
}

export const ChampionCardModal: React.FC<ChampionCardModalProps> = ({
  tournament,
  isOpen,
  onClose,
  finalScore = '3 — 1',
}) => {
  const { success, info } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const weekStr = String(tournament.weekNumber).padStart(2, '0');
  const championName = tournament.championName || 'CHAMPION';
  const championPlayerId = tournament.championPlayerId || 'CHUKA-000000';
  const tournamentDate = tournament.endDate
    ? new Date(tournament.endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Chuka Tournament Final';

  const shareText = `🏆 CHUKA eFOOTBALL WEEK ${weekStr} CHAMPION 🏆\n\nPlayer: ${championName} (${championPlayerId})\nFinal Score: ${finalScore}\nTournament Date: ${tournamentDate}\n\nOfficial eFootball Mobile Tournament for Chuka University.\nCompete. Connect. Become Champion.`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CHUKA eFOOTBALL WEEK ${weekStr} CHAMPION`,
          text: shareText,
          url: window.location.origin,
        });
        success('Card Shared', 'Champion card shared successfully!');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      success('Copied to Clipboard', 'Champion card text copied! You can paste it into WhatsApp or Instagram.');
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      info('Share Card', shareText);
    }
  };

  return (
    <div
      id="modal-champion-screen"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-[#09110c] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-950/80 my-6 text-center space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close champion modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* CHAMPION SCREEN & CARD (Requirements 19 & 20) */}
        <div className="space-y-4">
          {/* Trophy Header */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-yellow-500/30 to-amber-500/20 border-2 border-amber-400/60 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
            <Sparkles className="w-5 h-5 text-yellow-300 absolute -top-1 -right-1" />
          </div>

          <div className="flex items-center justify-center gap-3">
            <ChukaCrestLogo size="sm" withBorder={true} />
            <div className="h-4 w-px bg-white/20" />
            <EfootballLogo size="sm" variant="badge" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-black uppercase tracking-widest mb-1.5">
              🏆 CHUKA eFOOTBALL
            </div>
            <h2 className="font-heading font-black text-2xl sm:text-3xl text-white uppercase tracking-wider">
              WEEK {weekStr} CHAMPION
            </h2>
          </div>
        </div>

        {/* Card Canvas Frame */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-black/80 via-[#07130b] to-black/80 border border-amber-500/30 shadow-inner space-y-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest block mb-1">
              CHAMPION OF CHUKA UNIVERSITY
            </span>
            <div className="font-heading font-black text-3xl sm:text-4xl text-white uppercase tracking-wide truncate">
              {championName}
            </div>
            <div className="font-mono text-sm text-emerald-400 font-bold mt-0.5">
              {championPlayerId}
            </div>
          </div>

          <div className="py-3 border-y border-white/10 flex items-center justify-around">
            <div>
              <span className="text-[9px] uppercase font-bold text-white/50 block">FINAL SCORE</span>
              <div className="font-heading font-black text-2xl text-amber-400 font-mono">
                {finalScore}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[9px] uppercase font-bold text-white/50 block">TOURNAMENT DATE</span>
              <div className="text-xs font-mono font-bold text-white/80 mt-1">
                {tournamentDate}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/50">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Official Chuka University eFootball Mobile Tournament</span>
          </div>
        </div>

        {/* [ SHARE ] Button - Requirement 20 */}
        <div className="space-y-2">
          <button
            id="btn-share-champion-card"
            onClick={handleShare}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/25 active:scale-95 flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>[ SHARE ]</span>
          </button>
          <p className="text-[10px] text-white/40">
            Public verification card. Contains no private personal data.
          </p>
        </div>
      </div>
    </div>
  );
};
