import React, { useState } from 'react';
import { X, AlertOctagon, CheckCircle2, RotateCcw, Image, ShieldCheck } from 'lucide-react';
import { DisputeRecord, MatchFixture } from '../../types';
import { matchService } from '../../services/matchService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ResolveDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispute: DisputeRecord | null;
  match?: MatchFixture | null;
  onResolved: () => void;
}

export const ResolveDisputeModal: React.FC<ResolveDisputeModalProps> = ({
  isOpen,
  onClose,
  dispute,
  match,
  onResolved,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [decision, setDecision] = useState<'UPHOLD_RESULT' | 'OVERTURN_SCORE' | 'ORDER_REMATCH'>('UPHOLD_RESULT');
  const [homeScore, setHomeScore] = useState<number>(dispute?.homeScore || 0);
  const [awayScore, setAwayScore] = useState<number>(dispute?.awayScore || 0);
  const [adminNotes, setAdminNotes] = useState<string>('Evidence reviewed. Official administrative ruling rendered.');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen || !dispute) return null;

  const handleResolve = async () => {
    if (!isAdmin) {
      toastError('Unauthorized: Only designated admin can resolve match disputes.');
      return;
    }

    setSubmitting(true);
    try {
      if (decision === 'ORDER_REMATCH') {
        // Reset match to READY_TO_PLAY or PENDING_ROOM
        await matchService.adminResetMatchForRematch({
          matchId: dispute.matchId,
          reason: adminNotes,
          adminUid: currentUser?.uid || 'admin',
          adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
        });
        success(`Dispute resolved: Rematch ordered for match ${dispute.matchId}!`);
      } else {
        if (homeScore === awayScore) {
          toastError('Single-elimination knockout matches cannot end in a draw.');
          setSubmitting(false);
          return;
        }

        const selectedWinnerId = homeScore > awayScore ? dispute.homePlayerId : dispute.awayPlayerId;
        const selectedWinnerUid =
          homeScore > awayScore ? (match?.homePlayerUid || '') : (match?.awayPlayerUid || '');

        await matchService.adminResolveDispute({
          disputeId: dispute.id,
          matchId: dispute.matchId,
          ruling: decision === 'UPHOLD_RESULT' ? 'UPHELD' : 'OVERTURNED',
          officialHomeScore: homeScore,
          officialAwayScore: awayScore,
          officialWinnerId: selectedWinnerId,
          officialWinnerUid: selectedWinnerUid,
          notes: adminNotes,
          adminUid: currentUser?.uid || 'admin',
          adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
        });

        success(`Dispute resolved and official result confirmed!`);
      }

      onResolved();
      onClose();
    } catch (err: any) {
      console.error('Failed to resolve dispute:', err);
      toastError(err.message || 'Failed to resolve dispute.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="resolve-dispute-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="resolve-dispute-modal"
        className="w-full max-w-2xl bg-[#09110d] border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#2a0e12] to-[#09110d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white uppercase tracking-wider">
                Admin Dispute Resolution
              </h2>
              <p className="text-xs text-rose-400/80 font-mono">
                Match {dispute.matchId} • Dispute ID: {dispute.id}
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
          {/* Dispute Reason & Complainant Details */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40 font-mono">DISPUTING PLAYER</span>
              <span className="font-bold text-rose-300">
                {dispute.disputedByName} ({dispute.disputedByPlayerId})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
              <span className="text-white/40 font-mono">FILED AT</span>
              <span className="text-white/70 font-mono">
                {new Date(dispute.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="border-t border-white/5 pt-2">
              <span className="text-[10px] uppercase font-mono text-white/40 block mb-1">
                Dispute Statement / Allegation:
              </span>
              <p className="text-xs text-white/90 bg-black/40 p-3 rounded-xl border border-white/5 italic">
                "{dispute.reason}"
              </p>
            </div>
          </div>

          {/* Evidence Screenshot Preview (if any) */}
          {dispute.evidenceScreenshotUrl && (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                <Image className="w-4 h-4 text-emerald-400" />
                <span>Submitted Screenshot Evidence:</span>
              </div>
              <div className="max-h-60 overflow-hidden rounded-xl border border-white/10 bg-black">
                <img
                  src={dispute.evidenceScreenshotUrl}
                  alt="Dispute Screenshot"
                  referrerPolicy="no-referrer"
                  className="w-full object-contain max-h-60"
                />
              </div>
            </div>
          )}

          {/* Ruling Options */}
          <div className="space-y-3">
            <label className="text-xs text-white/60 block font-medium">Administrative Ruling Decision</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision('UPHOLD_RESULT')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  decision === 'UPHOLD_RESULT'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-black/30 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                Uphold Result
              </button>
              <button
                type="button"
                onClick={() => setDecision('OVERTURN_SCORE')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  decision === 'OVERTURN_SCORE'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-black/30 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                Set Official Score
              </button>
              <button
                type="button"
                onClick={() => setDecision('ORDER_REMATCH')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  decision === 'ORDER_REMATCH'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : 'bg-black/30 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                Order Rematch
              </button>
            </div>
          </div>

          {/* Score inputs if upholding or overturning */}
          {decision !== 'ORDER_REMATCH' && (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              <span className="text-xs text-white/60 block font-mono">
                Official Scores for Final Confirmation:
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <label className="text-xs text-white/50 block mb-1">
                    {match?.homePlayerName || 'HOME'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={homeScore}
                    onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                    className="w-20 text-center py-2 rounded-xl bg-black border border-white/20 text-white font-heading font-black text-xl focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="text-center">
                  <label className="text-xs text-white/50 block mb-1">
                    {match?.awayPlayerName || 'AWAY'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={awayScore}
                    onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                    className="w-20 text-center py-2 rounded-xl bg-black border border-white/20 text-white font-heading font-black text-xl focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ruling Notes */}
          <div>
            <label className="text-xs text-white/60 block mb-1 font-medium">
              Administrative Ruling Notes (Recorded in Audit Log)
            </label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:border-rose-400 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-resolve-dispute"
              type="button"
              disabled={submitting}
              onClick={handleResolve}
              className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Ruling...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>EXECUTE RULING</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
