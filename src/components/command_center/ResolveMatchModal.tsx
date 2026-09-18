import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, Clock, Swords, UserX, Award } from 'lucide-react';
import { MatchFixture } from '../../types';
import { matchService } from '../../services/matchService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ResolveMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchFixture | null;
  onResolved: () => void;
}

export const ResolveMatchModal: React.FC<ResolveMatchModalProps> = ({
  isOpen,
  onClose,
  match,
  onResolved,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'OFFICIAL_RESULT' | 'EXTEND_DEADLINE' | 'WALKOVER'>('OFFICIAL_RESULT');
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [winnerSide, setWinnerSide] = useState<'HOME' | 'AWAY'>('HOME');
  const [extendedMinutes, setExtendedMinutes] = useState<number>(30);
  const [reason, setReason] = useState<string>('Administrative match resolution.');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen || !match) return null;

  const handleResolve = async () => {
    if (!isAdmin) {
      toastError('Unauthorized: Only designated admin can resolve matches.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'OFFICIAL_RESULT') {
        if (homeScore === awayScore) {
          toastError('Single-elimination knockout matches cannot end in a draw. Please input the decisive score.');
          setSubmitting(false);
          return;
        }

        const selectedWinnerId = homeScore > awayScore ? match.homePlayerId : match.awayPlayerId;
        const selectedWinnerUid = homeScore > awayScore ? (match.homePlayerUid || '') : (match.awayPlayerUid || '');

        await matchService.adminResolveMatch({
          matchId: match.id,
          decision: 'SCORE_OVERRIDE',
          homeScore,
          awayScore,
          reason,
          adminUid: currentUser?.uid || 'admin',
          adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
        });

        success(`Match ${match.matchId} resolved with official score ${homeScore} — ${awayScore}!`);
      } else if (mode === 'WALKOVER') {
        await matchService.adminResolveMatch({
          matchId: match.id,
          decision: winnerSide === 'HOME' ? 'WALKOVER_HOME' : 'WALKOVER_AWAY',
          homeScore: winnerSide === 'HOME' ? 3 : 0,
          awayScore: winnerSide === 'HOME' ? 0 : 3,
          reason: `Walkover awarded to ${winnerSide === 'HOME' ? match.homePlayerName : match.awayPlayerName}. Reason: ${reason}`,
          adminUid: currentUser?.uid || 'admin',
          adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
        });

        success(`Walkover awarded to ${winnerSide === 'HOME' ? match.homePlayerName : match.awayPlayerName}!`);
      } else if (mode === 'EXTEND_DEADLINE') {
        const currentDeadlineTime = match.deadline ? new Date(match.deadline).getTime() : Date.now();
        const newDeadline = new Date(currentDeadlineTime + extendedMinutes * 60000).toISOString();

        await matchService.adminExtendMatchDeadline({
          matchId: match.id,
          newDeadlineIso: newDeadline,
          adminUid: currentUser?.uid || 'admin',
          adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
        });

        success(`Deadline extended by ${extendedMinutes} minutes!`);
      }

      onResolved();
      onClose();
    } catch (err: any) {
      console.error('Failed to resolve match:', err);
      toastError(err.message || 'Failed to resolve match.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="resolve-match-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="resolve-match-modal"
        className="w-full max-w-xl bg-[#09110d] border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#201509] to-[#09110d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white uppercase tracking-wider">
                Admin Match Resolution
              </h2>
              <p className="text-xs text-amber-400/80 font-mono">
                {match.matchId} • {match.roundName || `Round ${match.roundNumber}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Match Context Card */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
            <div className="flex-1">
              <span className="text-[10px] text-white/40 uppercase font-mono block">HOME</span>
              <span className="font-heading font-black text-white text-sm block">
                {match.homePlayerName}
              </span>
              <span className="font-mono text-[10px] text-white/50">{match.homePlayerId}</span>
            </div>
            <div className="text-center px-4">
              <span className="font-heading font-black text-amber-400 text-base">VS</span>
              <span className="text-[10px] font-mono block px-2 py-0.5 rounded bg-white/5 text-white/60 mt-1">
                {match.status}
              </span>
            </div>
            <div className="flex-1 text-right">
              <span className="text-[10px] text-white/40 uppercase font-mono block">AWAY</span>
              <span className="font-heading font-black text-white text-sm block">
                {match.awayPlayerName}
              </span>
              <span className="font-mono text-[10px] text-white/50">{match.awayPlayerId}</span>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-black/50 border border-white/5">
            <button
              type="button"
              onClick={() => setMode('OFFICIAL_RESULT')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                mode === 'OFFICIAL_RESULT'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Set Score
            </button>
            <button
              type="button"
              onClick={() => setMode('WALKOVER')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                mode === 'WALKOVER'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Award Walkover
            </button>
            <button
              type="button"
              onClick={() => setMode('EXTEND_DEADLINE')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                mode === 'EXTEND_DEADLINE'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Extend Deadline
            </button>
          </div>

          {/* Mode Body */}
          {mode === 'OFFICIAL_RESULT' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <label className="text-xs text-white/60 block mb-1">
                    {match.homePlayerName} Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={homeScore}
                    onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                    className="w-20 text-center py-2 rounded-xl bg-black border border-white/20 text-white font-heading font-black text-2xl focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <label className="text-xs text-white/60 block mb-1">
                    {match.awayPlayerName} Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={awayScore}
                    onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                    className="w-20 text-center py-2 rounded-xl bg-black border border-white/20 text-white font-heading font-black text-2xl focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="text-xs text-center text-amber-300 font-mono">
                Decisive Winner:{' '}
                <strong>
                  {homeScore > awayScore
                    ? match.homePlayerName
                    : awayScore > homeScore
                    ? match.awayPlayerName
                    : 'DRAWS NOT ALLOWED IN KNOCKOUT'}
                </strong>
              </div>
            </div>
          )}

          {mode === 'WALKOVER' && (
            <div className="space-y-3">
              <label className="text-xs text-white/60 block font-medium">Award 3—0 Walkover To:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWinnerSide('HOME')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    winnerSide === 'HOME'
                      ? 'bg-emerald-500/20 border-emerald-500 text-white'
                      : 'bg-black/30 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">HOME</div>
                  <div className="font-heading font-black text-sm mt-1">{match.homePlayerName}</div>
                  <div className="text-[10px] font-mono text-white/40">{match.homePlayerId}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerSide('AWAY')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    winnerSide === 'AWAY'
                      ? 'bg-emerald-500/20 border-emerald-500 text-white'
                      : 'bg-black/30 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">AWAY</div>
                  <div className="font-heading font-black text-sm mt-1">{match.awayPlayerName}</div>
                  <div className="text-[10px] font-mono text-white/40">{match.awayPlayerId}</div>
                </button>
              </div>
            </div>
          )}

          {mode === 'EXTEND_DEADLINE' && (
            <div className="space-y-3">
              <label className="text-xs text-white/60 block font-medium">Extend Match Deadline By:</label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExtendedMinutes(mins)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                      extendedMinutes === mins
                        ? 'bg-amber-500 border-amber-400 text-black'
                        : 'bg-black/30 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason / Notes */}
          <div>
            <label className="text-xs text-white/60 block mb-1 font-medium">
              Administrative Resolution Log Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:border-amber-400 focus:outline-none"
              placeholder="e.g., Away player unresponsive within 30m window."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-resolve-match"
              type="button"
              disabled={submitting}
              onClick={handleResolve}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#140e04] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRM ADMINISTRATIVE RESOLUTION</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
