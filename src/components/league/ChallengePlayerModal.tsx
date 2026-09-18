import React, { useState, useEffect } from 'react';
import { X, Swords, AlertCircle, CheckCircle2, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { leagueService } from '../../services/leagueService';
import { LeagueMember } from '../../types';
import { ChukaCrestLogo } from '../ChukaCrestLogo';

interface ChallengePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlayerId: string;
  seasonId: string;
  onChallengeCreated?: () => void;
}

export const ChallengePlayerModal: React.FC<ChallengePlayerModalProps> = ({
  isOpen,
  onClose,
  targetPlayerId,
  seasonId,
  onChallengeCreated,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [targetMember, setTargetMember] = useState<LeagueMember | null>(null);
  const [currentMember, setCurrentMember] = useState<LeagueMember | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !targetPlayerId) return;

    let isMounted = true;
    setIsLoading(true);
    setFeedback(null);
    setMessage('');

    Promise.all([
      leagueService.getMemberByPlayerId(targetPlayerId, seasonId),
      currentUser ? leagueService.getLeagueMember(currentUser.uid, seasonId) : Promise.resolve(null),
    ])
      .then(([target, current]) => {
        if (isMounted) {
          setTargetMember(target);
          setCurrentMember(current);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load player details' });
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetPlayerId, seasonId, currentUser]);

  if (!isOpen) return null;

  const handleSubmitChallenge = async () => {
    if (!currentUser || !userProfile || !currentMember || !targetMember) {
      setFeedback({ type: 'error', message: 'You must have an active League Card to issue a challenge.' });
      return;
    }

    if (currentMember.status !== 'VERIFIED') {
      setFeedback({ type: 'error', message: 'Your League Card must be verified (KSh 50) before issuing challenges.' });
      return;
    }

    if (currentMember.playerId === targetMember.playerId) {
      setFeedback({ type: 'error', message: 'You cannot challenge yourself.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await leagueService.createChallenge({
        challengerUid: currentUser.uid,
        challengerPlayerId: currentMember.playerId,
        challengerName: currentMember.displayName,
        challengerEfootball: currentMember.efootballUsername,
        challengedUid: targetMember.userId,
        challengedPlayerId: targetMember.playerId,
        challengedName: targetMember.displayName,
        challengedEfootball: targetMember.efootballUsername,
        seasonId,
        message: message.trim() || undefined,
      });

      setFeedback({ type: 'success', message: '⚔️ Official Challenge Sent! The opponent will be notified.' });
      if (onChallengeCreated) onChallengeCreated();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send challenge' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="challenge-player-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="challenge-player-modal-content"
        className="relative max-w-md w-full bg-[#080d09] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-emerald-400" />
            <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider">
              Issue Official Challenge
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-white/50 text-xs font-mono animate-pulse">
            Loading opponent details...
          </div>
        ) : targetMember ? (
          <div className="space-y-4">
            {/* Target Opponent Preview Card */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {targetMember.photoURL ? (
                  <img
                    src={targetMember.photoURL}
                    alt={targetMember.displayName}
                    className="w-12 h-12 rounded-full object-cover border border-emerald-500/40"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-700/50 flex items-center justify-center text-white font-bold text-base">
                    {targetMember.displayName.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-heading font-bold text-sm text-white flex items-center gap-1.5">
                    <span>{targetMember.displayName}</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xs text-emerald-400 font-mono font-medium">
                    @{targetMember.efootballUsername}
                  </div>
                  <div className="text-[10px] text-white/50 font-mono mt-0.5">
                    {targetMember.playerId} • {targetMember.points || 0} pts
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/50 uppercase font-mono">Rank</div>
                <div className="font-heading font-black text-amber-400 text-base">
                  #{targetMember.rank || '-'}
                </div>
              </div>
            </div>

            {/* Custom Challenge Note */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                Challenge Note (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Ready for an official League match! Room code ready."
                rows={2}
                maxLength={140}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
              <div className="text-[10px] text-white/40 text-right mt-1">
                {message.length}/140
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitChallenge}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#051a0e] text-xs font-heading font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Swords className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending...' : 'Send Challenge'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-white/50 text-xs">
            Opponent record not found.
          </div>
        )}
      </div>
    </div>
  );
};
