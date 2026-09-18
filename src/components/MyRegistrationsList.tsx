import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Trophy,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Tournament, TournamentEntry, UserProfile } from '../types';
import { registrationService } from '../services/registrationService';
import { tournamentService } from '../services/tournamentService';

interface MyRegistrationsListProps {
  userProfile: UserProfile;
  onNavigate?: (tab: any) => void;
  onOpenRegister?: (tournament: Tournament) => void;
}

export const MyRegistrationsList: React.FC<MyRegistrationsListProps> = ({
  userProfile,
  onNavigate,
  onOpenRegister,
}) => {
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userEntries, allTournaments] = await Promise.all([
        registrationService.getUserTournamentEntries(userProfile.id),
        tournamentService.getAllTournaments(),
      ]);
      setEntries(userEntries || []);
      setTournaments(allTournaments || []);
    } catch (err) {
      console.error('Error loading my registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userProfile.id]);

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-black/40 border border-white/10 text-center text-xs text-white/50 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
        <span>Loading your registrations...</span>
      </div>
    );
  }

  return (
    <div id="my-registrations-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="font-heading font-black text-xl text-white uppercase tracking-wider">
            MY REGISTRATIONS
          </h2>
        </div>
        <button
          onClick={loadData}
          className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 text-xs flex items-center gap-1 font-mono"
          title="Refresh Registrations"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[#09110d] border border-dashed border-white/10 text-xs text-white/60 space-y-3">
          <Calendar className="w-8 h-8 text-white/30 mx-auto" />
          <p>You have not registered for any weekly tournaments yet.</p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('TOURNAMENTS')}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all"
            >
              Browse Tournaments
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const tournament = tournaments.find((t) => t.id === entry.tournamentId);
            const isTournClosed =
              tournament &&
              (tournament.status === 'COMPLETED' ||
                tournament.status === 'CANCELLED' ||
                tournament.lockedAt != null ||
                (tournament.status !== 'REGISTRATION_OPEN' &&
                  entry.status !== 'VERIFIED' &&
                  entry.status !== 'PAYMENT_PENDING'));

            const isVerified = entry.status === 'VERIFIED' || entry.registrationStatus === 'VERIFIED';
            const isPending =
              entry.status === 'PENDING' ||
              entry.status === 'PAYMENT_PENDING' ||
              entry.registrationStatus === 'PAYMENT_PENDING';
            const isRejected =
              entry.status === 'PAYMENT_REJECTED' ||
              entry.status === 'REJECTED' ||
              entry.registrationStatus === 'PAYMENT_REJECTED';
            const isPaymentRequired = entry.status === 'PAYMENT_REQUIRED';

            // Verification Result display
            let verificationResultNode: React.ReactNode = null;
            if (isVerified) {
              verificationResultNode = (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✓ VERIFIED - Eligible for official bracket</span>
                </div>
              );
            } else if (isPending) {
              verificationResultNode = (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-bold">PAYMENT PENDING</div>
                    <div className="text-[11px] text-amber-300/80">
                      Submitted for verification. Admin Laurence Wayongo reviews and approves on Verification Day.
                    </div>
                  </div>
                </div>
              );
            } else if (isRejected) {
              verificationResultNode = (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>PAYMENT REJECTED</span>
                  </div>
                  <div className="text-[11px] text-red-200/80">
                    Reason: {entry.rejectionReason || 'Invalid or unverified transaction code.'}
                  </div>
                  {tournament && onOpenRegister && (
                    <div className="pt-1">
                      <button
                        onClick={() => onOpenRegister(tournament)}
                        className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-[11px] uppercase tracking-wider transition-all"
                      >
                        [ RESUBMIT PAYMENT ]
                      </button>
                    </div>
                  )}
                </div>
              );
            } else if (isTournClosed) {
              verificationResultNode = (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4 text-white/40 shrink-0" />
                  <span>REGISTRATION CLOSED - Tournament concluded or bracket seeded.</span>
                </div>
              );
            } else if (isPaymentRequired) {
              verificationResultNode = (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>PAYMENT REQUIRED (KSh 20 entry fee)</span>
                  </div>
                  {tournament && onOpenRegister && (
                    <button
                      onClick={() => onOpenRegister(tournament)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] uppercase tracking-wider transition-all"
                    >
                      [ PAY NOW ]
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#08100b] border border-white/10 hover:border-white/20 transition-all space-y-3"
              >
                {/* Header: Tournament + Week + Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        WEEK {String(tournament?.weekNumber || 1).padStart(2, '0')}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="font-heading font-black text-sm text-white uppercase truncate">
                        {tournament?.name || entry.tournamentId}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 font-mono mt-0.5">
                      Submitted: {entry.submittedAt ? new Date(entry.submittedAt).toLocaleString() : new Date(entry.registeredAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Registration Status Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono text-white/40">Registration:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isVerified
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isRejected
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isVerified
                          ? 'VERIFIED'
                          : isRejected
                          ? 'PAYMENT REJECTED'
                          : isPaymentRequired
                          ? 'PAYMENT REQUIRED'
                          : 'PAYMENT PENDING'}
                      </span>
                    </div>

                    {/* Payment Status Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono text-white/40">Payment:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isVerified
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isRejected
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isVerified
                          ? 'VERIFIED'
                          : isRejected
                          ? 'REJECTED'
                          : isPaymentRequired
                          ? 'UNPAID'
                          : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verification Result Callout */}
                {verificationResultNode}

                {/* Privacy Safeguard Notice: Never display sensitive payment codes/phones publicly */}
                <div className="text-[10px] text-white/40 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
                  <span>Your M-Pesa details are securely encrypted and only accessible to administrator review.</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
