import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Swords } from 'lucide-react';
import { MatchFixture } from '../../types';

interface ResultSubmissionCardProps {
  match: MatchFixture;
  isHomeUser?: boolean;
  isAwayUser?: boolean;
}

export const ResultSubmissionCard: React.FC<ResultSubmissionCardProps> = ({
  match,
  isHomeUser,
  isAwayUser,
}) => {
  const isCompleted = match.status === 'CONFIRMED';
  const isDisputed = match.status === 'DISPUTED';

  // Submissions map
  const homeSub = match.submissions && match.homePlayerUid ? match.submissions[match.homePlayerUid] : null;
  const awaySub = match.submissions && match.awayPlayerUid ? match.submissions[match.awayPlayerUid] : null;

  // Has home submitted
  const homeSubmitted = Boolean(homeSub || (match.submittedBy === 'HOME' && match.homeScore !== null && match.homeScore !== undefined));
  // Has away submitted
  const awaySubmitted = Boolean(awaySub || (match.submittedBy === 'AWAY' && match.awayScore !== null && match.awayScore !== undefined));

  return (
    <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 text-white/70 font-bold uppercase text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dual Result Verification</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : isDisputed
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : homeSubmitted && awaySubmitted
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-white/10 text-white/60'
          }`}
        >
          {isCompleted
            ? '✓ RESULTS CONFIRMED'
            : isDisputed
            ? '⚠️ DISPUTED RESULT'
            : homeSubmitted && awaySubmitted
            ? 'RESULTS AWAITING REVIEW'
            : homeSubmitted || awaySubmitted
            ? 'WAITING FOR OPPONENT'
            : 'NO RESULTS SUBMITTED'}
        </span>
      </div>

      {/* Two-sided Submission Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Home Player Side */}
        <div
          className={`p-3 rounded-xl border ${
            homeSubmitted
              ? 'bg-emerald-950/20 border-emerald-500/30 text-white'
              : 'bg-white/[0.02] border-white/5 text-white/50'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
            <span className="text-emerald-400 font-bold">
              {isHomeUser ? 'HOME (YOU)' : 'HOME'}
            </span>
            {homeSubmitted ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Submitted</span>
              </span>
            ) : (
              <span className="text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Pending</span>
              </span>
            )}
          </div>
          <div className="font-heading font-bold text-sm text-white truncate">
            {match.homePlayerName}
          </div>
          {homeSubmitted && (
            <div className="mt-1 font-heading font-black text-lg text-emerald-300">
              {homeSub ? `${homeSub.homeScore} – ${homeSub.awayScore}` : `${match.homeScore} – ${match.awayScore}`}
            </div>
          )}
        </div>

        {/* Away Player Side */}
        <div
          className={`p-3 rounded-xl border ${
            awaySubmitted
              ? 'bg-emerald-950/20 border-emerald-500/30 text-white'
              : 'bg-white/[0.02] border-white/5 text-white/50'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
            <span className="text-orange-400 font-bold">
              {isAwayUser ? 'AWAY (YOU)' : 'AWAY'}
            </span>
            {awaySubmitted ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Submitted</span>
              </span>
            ) : (
              <span className="text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Pending</span>
              </span>
            )}
          </div>
          <div className="font-heading font-bold text-sm text-white truncate">
            {match.awayPlayerName}
          </div>
          {awaySubmitted && (
            <div className="mt-1 font-heading font-black text-lg text-emerald-300">
              {awaySub ? `${awaySub.homeScore} – ${awaySub.awayScore}` : `${match.homeScore} – ${match.awayScore}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
