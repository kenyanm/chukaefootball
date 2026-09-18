import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Users,
  CreditCard,
  Swords,
  Search,
  ExternalLink,
  Check,
  AlertCircle,
} from 'lucide-react';
import { leagueService } from '../../services/leagueService';
import {
  LeagueSeason,
  LeaguePayment,
  LeagueMember,
  LeagueMatch,
  LeagueDispute,
  UserProfile,
} from '../../types';

interface LeagueAdminSectionProps {
  currentUserProfile: UserProfile;
  activeSeason: LeagueSeason;
  onRefreshAll?: () => void;
}

export const LeagueAdminSection: React.FC<LeagueAdminSectionProps> = ({
  currentUserProfile,
  activeSeason,
  onRefreshAll,
}) => {
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'MEMBERS' | 'DISPUTES' | 'CONFIG'>('PAYMENTS');
  const [payments, setPayments] = useState<LeaguePayment[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [disputes, setDisputes] = useState<LeagueDispute[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Resolution modal state
  const [selectedDispute, setSelectedDispute] = useState<LeagueDispute | null>(null);
  const [resolvedHomeScore, setResolvedHomeScore] = useState(0);
  const [resolvedAwayScore, setResolvedAwayScore] = useState(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [payList, memList, dispList, matchList] = await Promise.all([
        leagueService.getPendingPayments(activeSeason.id),
        leagueService.getAllLeagueMembers(activeSeason.id),
        leagueService.getDisputes(activeSeason.id),
        leagueService.getSeasonMatches(activeSeason.id),
      ]);
      setPayments(payList);
      setMembers(memList);
      setDisputes(dispList);
      setMatches(matchList);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load League admin data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSeason.id]);

  const handleVerifyPayment = async (payment: LeaguePayment) => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      await leagueService.verifyLeaguePayment({
        paymentId: payment.id,
        verifiedBy: currentUserProfile.email,
        adminNotes: 'Verified via League Admin Desk',
      });
      setActionFeedback({ type: 'success', message: `Verified payment for ${(payment as any).displayName || payment.accountName} (${payment.playerId}). Member activated!` });
      await loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Verification failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayment = async (payment: LeaguePayment) => {
    const reason = window.prompt('Enter rejection reason (e.g. M-Pesa code not found, unpaid):');
    if (!reason) return;

    setIsProcessing(true);
    setActionFeedback(null);
    try {
      await leagueService.rejectLeaguePayment({
        paymentId: payment.id,
        rejectedBy: currentUserProfile.email,
        reason,
      });
      setActionFeedback({ type: 'success', message: `Rejected payment ${payment.mpesaCode}.` });
      await loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Rejection failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolveDispute = async (status: 'CONFIRMED' | 'VOIDED') => {
    if (!selectedDispute) return;
    setIsProcessing(true);
    setActionFeedback(null);

    try {
      await leagueService.resolveLeagueDispute({
        disputeId: selectedDispute.id,
        matchId: selectedDispute.matchId,
        resolvedBy: currentUserProfile.email,
        ruling: `Admin resolved as ${status}`,
        newStatus: status,
        finalHomeScore: resolvedHomeScore,
        finalAwayScore: resolvedAwayScore,
        notes: adminNotes || 'Resolved through League Admin Desk',
      });

      setActionFeedback({ type: 'success', message: `Dispute resolved! Match updated to ${status} and standings recalculated.` });
      setSelectedDispute(null);
      await loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to resolve dispute.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecomputeStandings = async () => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const updated = await leagueService.recomputeLeagueStandings(activeSeason.id);
      setActionFeedback({
        type: 'success',
        message: `Standings recomputed successfully! Processed ${updated.length} verified league members with official tie-breakers.`,
      });
      await loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to recompute standings.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncGoogleSheets = async () => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const res = await leagueService.syncLeagueToGoogleSheets(activeSeason.id, currentUserProfile.email);
      if (res.success) {
        setActionFeedback({ type: 'success', message: 'Official League sync to Google Sheets successful!' });
      } else {
        setActionFeedback({ type: 'error', message: (res as any).error || res.message || 'Sync returned an error.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to sync to Google Sheets.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-black/60 border border-emerald-500/20">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>LEAGUE COMMAND DESK · {activeSeason.name}</span>
          </div>
          <h2 className="font-heading font-black text-xl text-white">
            CHUKA eFOOTBALL LEAGUE ADMINISTRATION
          </h2>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRecomputeStandings}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-mono font-bold transition-all disabled:opacity-50"
            title="Recalculate all statistics and dynamic positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>RECOMPUTE STANDINGS</span>
          </button>
          <button
            onClick={handleSyncGoogleSheets}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold transition-all disabled:opacity-50"
            title="Sync all League members and matches to Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>SHEETS SYNC</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center justify-between gap-2 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-white/40 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-4 py-2 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'PAYMENTS'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>PAYMENTS ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`px-4 py-2 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'MEMBERS'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>MEMBERS ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DISPUTES')}
          className={`px-4 py-2 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'DISPUTES'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>DISPUTES ({disputes.filter((d) => d.status === 'PENDING').length})</span>
        </button>
      </div>

      {/* Tab: Pending Payments Desk */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-white/60">
            <span>KSh 50 League Participation Card Verification Requests</span>
            <span>Destination: 0111359682</span>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 rounded-3xl bg-black/40 border border-white/5 text-center text-xs font-mono text-white/40">
              No pending League payments awaiting verification.
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-emerald-400">{p.playerId}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-amber-300 font-bold tracking-wider">{p.mpesaCode}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-white/70 font-bold">KSh {p.amount}</span>
                    </div>
                    <div className="font-heading font-black text-sm text-white">
                      {p.displayName}
                    </div>
                    <div className="text-[11px] font-mono text-white/50">
                      M-Pesa Phone: <span className="text-white/80">{p.phoneNumber}</span> · Account Name:{' '}
                      <span className="text-white/80">{p.accountName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleRejectPayment(p)}
                      disabled={isProcessing}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold uppercase transition-all"
                    >
                      REJECT
                    </button>
                    <button
                      onClick={() => handleVerifyPayment(p)}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all"
                    >
                      VERIFY & ACTIVATE
                    </button>
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
          <div className="text-xs font-mono text-white/60">
            Registered Members in {activeSeason.name}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/5 text-white/50 uppercase text-[10px] border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">POS</th>
                  <th className="py-3 px-4">PLAYER</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-center">MP</th>
                  <th className="py-3 px-4 text-center">W-D-L</th>
                  <th className="py-3 px-4 text-center">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="py-3 px-4 font-bold text-amber-400">
                      {m.currentPosition ? `#${m.currentPosition}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-heading font-bold text-white">
                      {m.displayName}
                    </td>
                    <td className="py-3 px-4 text-emerald-400">{m.playerId}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.status === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-white">
                      {m.matchesPlayed || 0}
                    </td>
                    <td className="py-3 px-4 text-center text-white/60">
                      {m.wins || 0}-{m.draws || 0}-{m.losses || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">
                      {m.points || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Disputes Resolution Desk */}
      {activeTab === 'DISPUTES' && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-white/60">
            Active Disputes Awaiting Administrative Review
          </div>

          {disputes.length === 0 ? (
            <div className="p-8 rounded-3xl bg-black/40 border border-white/5 text-center text-xs font-mono text-white/40">
              No disputes reported. All league matches settled cleanly!
            </div>
          ) : (
            <div className="space-y-3">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl bg-black/50 border border-rose-500/30 space-y-3 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-bold uppercase">
                      REASON: {d.reason.replace(/_/g, ' ')}
                    </span>
                    <span className="text-white/40">{d.status}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-white/5 space-y-1">
                    <div className="text-white/50 text-[10px] uppercase">EXPLANATION FROM REPORTER</div>
                    <p className="text-white/90">{d.explanation}</p>
                    {d.evidenceUrl && (
                      <a
                        href={d.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:underline pt-1 text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View Evidence / Screenshot</span>
                      </a>
                    )}
                  </div>

                  {d.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        setSelectedDispute(d);
                        setResolvedHomeScore(d.reportedScoreHome);
                        setResolvedAwayScore(d.reportedScoreAway);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-heading font-black text-xs uppercase tracking-wider"
                    >
                      RESOLVE DISPUTE
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Dispute Resolution Dialog */}
          {selectedDispute && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <div className="w-full max-w-md p-6 rounded-3xl bg-[#080C09] border border-white/10 space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-heading font-black text-sm text-white uppercase">
                    RESOLVE LEAGUE DISPUTE
                  </h3>
                  <button
                    onClick={() => setSelectedDispute(null)}
                    className="text-white/50 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/50 uppercase text-[10px] mb-1">
                        HOME SCORE
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={resolvedHomeScore}
                        onChange={(e) => setResolvedHomeScore(parseInt(e.target.value) || 0)}
                        className="w-full p-2 rounded-xl bg-black border border-white/15 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 uppercase text-[10px] mb-1">
                        AWAY SCORE
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={resolvedAwayScore}
                        onChange={(e) => setResolvedAwayScore(parseInt(e.target.value) || 0)}
                        className="w-full p-2 rounded-xl bg-black border border-white/15 text-white text-center font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/50 uppercase text-[10px] mb-1">
                      ADMINISTRATIVE RULING NOTES
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Reasoning for official record..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full p-2 rounded-xl bg-black border border-white/15 text-white text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleResolveDispute('VOIDED')}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs uppercase"
                    >
                      VOID MATCH
                    </button>
                    <button
                      onClick={() => handleResolveDispute('CONFIRMED')}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase"
                    >
                      CONFIRM SCORE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
