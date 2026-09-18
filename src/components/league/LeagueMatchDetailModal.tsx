import React, { useState } from 'react';
import {
  X,
  Swords,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageCircle,
  Copy,
  Check,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { leagueService } from '../../services/leagueService';
import { LeagueMatch, LeagueDisputeReason, UserProfile } from '../../types';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { WhatsAppLogo } from '../WhatsAppLogo';

interface LeagueMatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: LeagueMatch | null;
  currentUserProfile: UserProfile;
  onMatchUpdated: () => void;
}

export const LeagueMatchDetailModal: React.FC<LeagueMatchDetailModalProps> = ({
  isOpen,
  onClose,
  match,
  currentUserProfile,
  onMatchUpdated,
}) => {
  const [roomNumberInput, setRoomNumberInput] = useState(match?.roomNumber || '');
  const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);
  const [homeScoreInput, setHomeScoreInput] = useState<number>(0);
  const [awayScoreInput, setAwayScoreInput] = useState<number>(0);
  const [evidenceUrlInput, setEvidenceUrlInput] = useState('');
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [isConfirmingResult, setIsConfirmingResult] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState<LeagueDisputeReason>('WRONG_SCORE');
  const [disputeExplanation, setDisputeExplanation] = useState('');
  const [isFilingDispute, setIsFilingDispute] = useState(false);

  if (!isOpen || !match) return null;

  const isHome = match.homePlayerUid === currentUserProfile.id;
  const isAway = match.awayPlayerUid === currentUserProfile.id;
  const opponentName = isHome ? match.awayPlayerName : match.homePlayerName;
  const opponentPlayerId = isHome ? match.awayPlayerId : match.homePlayerId;
  const opponentEfootball = isHome ? match.awayEfootball : match.homeEfootball;

  const isSubmitter = match.submittedByUid === currentUserProfile.id;
  const isPendingConfirmation = match.status === 'AWAITING_OPPONENT_CONFIRMATION';

  const handleCopyRoom = () => {
    if (match.roomNumber) {
      navigator.clipboard.writeText(match.roomNumber);
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 2000);
    }
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!/^\d{6}$/.test(roomNumberInput.trim())) {
      setErrorMsg('Room number must be exactly 6 numeric digits.');
      return;
    }

    setIsUpdatingRoom(true);
    try {
      await leagueService.updateMatchRoom({
        matchId: match.id,
        roomNumber: roomNumberInput.trim(),
        userUid: currentUserProfile.id,
      });
      onMatchUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update match room.');
    } finally {
      setIsUpdatingRoom(false);
    }
  };

  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmittingResult(true);

    try {
      await leagueService.submitLeagueMatchResult({
        matchId: match.id,
        homeScore: Number(homeScoreInput),
        awayScore: Number(awayScoreInput),
        evidenceUrl: evidenceUrlInput.trim(),
        submitterUid: currentUserProfile.id,
      });
      onMatchUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit match result.');
    } finally {
      setIsSubmittingResult(false);
    }
  };

  const handleConfirmResult = async () => {
    setErrorMsg('');
    setIsConfirmingResult(true);

    try {
      await leagueService.confirmLeagueMatchResult({
        matchId: match.id,
        confirmerUid: currentUserProfile.id,
      });
      onMatchUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm result.');
    } finally {
      setIsConfirmingResult(false);
    }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!disputeExplanation.trim()) {
      setErrorMsg('Please enter an explanation for your dispute.');
      return;
    }

    setIsFilingDispute(true);
    try {
      await leagueService.disputeLeagueMatchResult({
        matchId: match.id,
        reportedByUid: currentUserProfile.id,
        reason: disputeReason,
        explanation: disputeExplanation.trim(),
        evidenceUrl: evidenceUrlInput.trim(),
      });
      setShowDisputeForm(false);
      onMatchUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit dispute.');
    } finally {
      setIsFilingDispute(false);
    }
  };

  // Safe coordination via community WhatsApp link (never exposes personal phones publicly)
  const WHATSAPP_COORDINATION_LINK = 'https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#080C09] border border-white/10 shadow-2xl p-6 sm:p-8 space-y-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <ChukaCrestLogo size="sm" />
            <div>
              <div className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>OFFICIAL</span>
                <span className="text-emerald-400">LEAGUE MATCH</span>
              </div>
              <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                MATCH ID: {match.id}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Fixture Matchup Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-white/50 border-b border-white/5 pb-2">
            <span>CHUKA eFOOTBALL LEAGUE</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                match.status === 'CONFIRMED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : match.status === 'DISPUTED'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : match.status === 'AWAITING_OPPONENT_CONFIRMATION'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              {match.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-7 items-center gap-2">
            {/* Home Player */}
            <div className="col-span-3 text-left space-y-1">
              <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                HOME {match.homePlayerUid === currentUserProfile.id && '(YOU)'}
              </div>
              <div className="font-heading font-black text-sm sm:text-base text-white truncate">
                {match.homePlayerName}
              </div>
              <div className="text-[10px] font-mono text-white/50 truncate">
                {match.homePlayerId} · {match.homeEfootball}
              </div>
            </div>

            {/* Score / VS Center */}
            <div className="col-span-1 text-center">
              {match.status === 'CONFIRMED' || match.status === 'AWAITING_OPPONENT_CONFIRMATION' ? (
                <div className="text-xl sm:text-2xl font-heading font-black text-white font-mono">
                  {match.homeScore} – {match.awayScore}
                </div>
              ) : (
                <div className="text-xs font-mono text-amber-400 font-bold bg-white/5 py-1 rounded-lg">
                  VS
                </div>
              )}
            </div>

            {/* Away Player */}
            <div className="col-span-3 text-right space-y-1">
              <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                AWAY {match.awayPlayerUid === currentUserProfile.id && '(YOU)'}
              </div>
              <div className="font-heading font-black text-sm sm:text-base text-white truncate">
                {match.awayPlayerName}
              </div>
              <div className="text-[10px] font-mono text-white/50 truncate">
                {match.awayPlayerId} · {match.awayEfootball}
              </div>
            </div>
          </div>
        </div>

        {/* Room Coordination Section */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-emerald-400" />
              <span>eFootball Match Room</span>
            </span>
            <a
              href={WHATSAPP_COORDINATION_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold"
            >
              <WhatsAppLogo className="w-3.5 h-3.5" size={14} />
              <span>Coordinate on WhatsApp</span>
            </a>
          </div>

          {match.roomNumber ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-emerald-500/30">
              <div>
                <div className="text-[10px] text-white/40 uppercase">ROOM CODE (6 DIGITS)</div>
                <div className="text-lg font-heading font-black text-emerald-300 tracking-widest">
                  {match.roomNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyRoom}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              >
                {copiedRoom ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRoom ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpdateRoom} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit room code"
                value={roomNumberInput}
                onChange={(e) => setRoomNumberInput(e.target.value.replace(/\D/g, ''))}
                className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs tracking-widest uppercase focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isUpdatingRoom}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase"
              >
                {isUpdatingRoom ? 'SAVING...' : 'SET ROOM'}
              </button>
            </form>
          )}
        </div>

        {/* Dynamic State Actions: Result Submission vs Dual Confirmation */}
        {match.status === 'CONFIRMED' ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2 font-mono">
            <div className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>OFFICIAL RESULT CONFIRMED</span>
            </div>
            <p className="text-xs text-white/70">
              Both players agreed to the result. Official League statistics and standings have been
              recorded.
            </p>
          </div>
        ) : match.status === 'DISPUTED' ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2 font-mono">
            <div className="inline-flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>MATCH RESULT UNDER DISPUTE</span>
            </div>
            <p className="text-xs text-white/70">
              This match has been referred to the official administrative desk. Standings will update
              only after administrative resolution.
            </p>
          </div>
        ) : isPendingConfirmation ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Result Submitted — Awaiting Agreement</span>
              </div>
              <span className="text-[10px] text-white/40">
                Submitted by {match.submittedByPlayerId}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-white/50 uppercase">REPORTED SCORE</div>
                <div className="text-base font-black text-white">
                  {match.homePlayerName} {match.homeScore} – {match.awayScore}{' '}
                  {match.awayPlayerName}
                </div>
              </div>
            </div>

            {isSubmitter ? (
              <p className="text-xs text-white/60 italic text-center">
                You submitted this result. Waiting for your opponent ({opponentName}) to review and
                confirm.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-white/80">
                  Your opponent reported the score above. Do you confirm this is the accurate final
                  result?
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmResult}
                    disabled={isConfirmingResult}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                  >
                    {isConfirmingResult ? 'CONFIRMING...' : 'CONFIRM RESULT'}
                  </button>
                  <button
                    onClick={() => setShowDisputeForm(!showDisputeForm)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-heading font-black text-xs uppercase"
                  >
                    DISPUTE
                  </button>
                </div>

                {showDisputeForm && (
                  <form
                    onSubmit={handleFileDispute}
                    className="p-4 rounded-xl bg-black/60 border border-rose-500/30 space-y-3"
                  >
                    <div className="text-xs font-bold text-rose-300 uppercase">
                      FILE RESULT DISPUTE
                    </div>
                    <div>
                      <label className="block text-[10px] text-white/60 uppercase mb-1">
                        Dispute Reason *
                      </label>
                      <select
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value as LeagueDisputeReason)}
                        className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 text-white font-mono text-xs focus:border-rose-500 focus:outline-none"
                      >
                        <option value="WRONG_SCORE">Wrong score entered</option>
                        <option value="WRONG_OPPONENT">Wrong opponent</option>
                        <option value="MATCH_DID_NOT_HAPPEN">Match did not take place</option>
                        <option value="SCREENSHOT_DISAGREEMENT">Screenshot disagreement</option>
                        <option value="OTHER">Other reason</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-white/60 uppercase mb-1">
                        Explanation *
                      </label>
                      <textarea
                        required
                        rows={2}
                        placeholder="State your side of the match..."
                        value={disputeExplanation}
                        onChange={(e) => setDisputeExplanation(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 text-white font-mono text-xs focus:border-rose-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDisputeForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isFilingDispute}
                        className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-heading font-black text-xs uppercase"
                      >
                        {isFilingDispute ? 'SUBMITTING...' : 'OFFICIALLY DISPUTE'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Result Submission Form */
          <form
            onSubmit={handleSubmitResult}
            className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-4 font-mono"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Enter Final Match Score</span>
              </span>
              <span className="text-[10px] text-white/40">Requires Opponent Agreement</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-white/60 uppercase mb-1">
                  {match.homePlayerName} (HOME)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  required
                  value={homeScoreInput}
                  onChange={(e) => setHomeScoreInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-lg font-bold text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-white/60 uppercase mb-1">
                  {match.awayPlayerName} (AWAY)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  required
                  value={awayScoreInput}
                  onChange={(e) => setAwayScoreInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-lg font-bold text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-white/60 uppercase mb-1">
                Screenshot / Evidence URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={evidenceUrlInput}
                onChange={(e) => setEvidenceUrlInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmittingResult}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all"
              >
                {isSubmittingResult ? 'SUBMITTING...' : 'SUBMIT RESULT FOR CONFIRMATION'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
