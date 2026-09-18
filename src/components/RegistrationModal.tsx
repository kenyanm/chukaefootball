import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Tournament, TournamentEntry } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { registrationService } from '../services/registrationService';
import { RegistrationStatusBadge } from './RegistrationStatusBadge';
import { GoogleSignInButton } from './GoogleSignInButton';
import { WhatsAppLogo } from './WhatsAppLogo';
import { ChukaCrestLogo } from './ChukaCrestLogo';
import { TOURNAMENT_DEFAULTS } from '../config/tournamentConfig';
import { AuthNoticeBanner } from './AuthNoticeBanner';

interface RegistrationModalProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  onRegisteredSuccess: () => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onRegisteredSuccess,
}) => {
  const { userProfile, currentUser, loginWithGoogle, isSigningIn, authErrorNotice, clearAuthErrorNotice } = useAuth();
  const { success, error } = useToast();

  const [existingEntry, setExistingEntry] = useState<TournamentEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);

  // Step inside modal: 'OVERVIEW' | 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'VERIFIED'
  const [step, setStep] = useState<'OVERVIEW' | 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'VERIFIED'>('OVERVIEW');

  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeringDraft, setRegisteringDraft] = useState(false);

  // Load existing entry when modal opens
  useEffect(() => {
    if (!isOpen || !currentUser) {
      setExistingEntry(null);
      setStep('OVERVIEW');
      return;
    }

    const checkEntry = async () => {
      setLoadingEntry(true);
      try {
        const entry = await registrationService.getUserEntry(tournament.id, currentUser.uid);
        if (entry) {
          setExistingEntry(entry);
          if (entry.status === 'VERIFIED') {
            setStep('VERIFIED');
          } else if (entry.status === 'PENDING') {
            setStep('PAYMENT_PENDING');
          } else if (entry.status === 'PAYMENT_REQUIRED') {
            setStep('PAYMENT_REQUIRED');
          } else {
            setStep('OVERVIEW');
          }
        } else {
          setExistingEntry(null);
          setStep('OVERVIEW');
        }
      } catch (e) {
        console.error('Error checking user entry', e);
      } finally {
        setLoadingEntry(false);
      }
    };

    checkEntry();
  }, [isOpen, tournament.id, currentUser]);

  if (!isOpen) return null;

  // Format date helper
  const formatDateTime = (isoDate?: string) => {
    if (!isoDate) return 'TBD';
    const d = new Date(isoDate);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Step 1: Click [ REGISTER ]
  const handleStartRegistration = async () => {
    if (!userProfile) return;

    setRegisteringDraft(true);
    try {
      const draft = await registrationService.createDraftRegistration(tournament.id, userProfile);
      setExistingEntry(draft);
      setStep('PAYMENT_REQUIRED');
      success('Registration Initiated', 'Please submit your M-Pesa payment to complete registration.');
    } catch (err: any) {
      error('Registration Error', err.message || 'Failed to start registration.');
    } finally {
      setRegisteringDraft(false);
    }
  };

  // Step 2: Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const trimmedCode = mpesaCode.trim().toUpperCase();
    if (trimmedCode.length < 8) {
      error(
        'Invalid M-Pesa Code',
        'Please enter a valid 10-character M-Pesa transaction reference (e.g. QDH58291KL).'
      );
      return;
    }

    if (!mpesaPhone.trim()) {
      error('Phone Required', 'Please enter your M-Pesa phone number for verification.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registrationService.registerForTournament(
        tournament.id,
        tournament.name,
        tournament.entryFee,
        trimmedCode,
        mpesaPhone.trim(),
        userProfile
      );

      setExistingEntry(res.entry);
      setStep('PAYMENT_PENDING');
      success(
        'Payment Submitted!',
        `Your payment code ${trimmedCode} has been logged. It will be verified by administrators on Verification Day.`
      );
      onRegisteredSuccess();
    } catch (err: any) {
      console.error(err);
      error('Payment Submission Failed', err.message || 'Could not complete payment submission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-tournament-registration"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-[#0c130f] border border-emerald-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-emerald-950/80 my-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Not Signed In */}
        {!currentUser || !userProfile ? (
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <ChukaCrestLogo size="xl" />
            </div>
            <div>
              <h3 className="font-heading font-black text-2xl text-white uppercase tracking-wide">
                Sign In with Google
              </h3>
              <p className="text-xs text-white/70 max-w-sm mx-auto mt-1">
                You must sign in with Google to receive your permanent CHUKA Player ID before registering for tournaments.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center pt-2 space-y-3">
              <GoogleSignInButton
                id="btn-modal-login"
                onClick={() => loginWithGoogle()}
                loading={isSigningIn}
                disabled={isSigningIn}
                size="lg"
                text="continue_with"
                theme="light"
                className="w-full max-w-sm justify-center shadow-lg hover:shadow-xl hover:scale-[1.01]"
              />
              {authErrorNotice && (
                <AuthNoticeBanner
                  notice={authErrorNotice}
                  onRetry={() => loginWithGoogle(true)}
                  onDismiss={clearAuthErrorNotice}
                  variant="inline"
                />
              )}
            </div>
          </div>
        ) : loadingEntry ? (
          <div className="py-12 text-center text-white/60 space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-mono">Checking registration status...</div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tournament Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider uppercase">
                  WEEK {String(tournament.weekNumber).padStart(2, '0')}
                </span>
                <span className="text-xs text-white/50">•</span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> eFootball Mobile
                </span>
              </div>

              <h2 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-wide uppercase">
                {tournament.name}
              </h2>
            </div>

            {/* STEP 1: TOURNAMENT OVERVIEW & [ REGISTER ] */}
            {step === 'OVERVIEW' && (
              <div className="space-y-4">
                {/* Information Card */}
                <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Entry Fee
                    </span>
                    <span className="font-heading font-black text-2xl text-amber-400 font-mono">
                      KSh {tournament.entryFee}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs text-white/80">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-white/50">Registration closes:</span>
                      <span className="font-semibold text-right text-white">
                        {formatDateTime(tournament.registrationCloseDate)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-white/50">Verification:</span>
                      <span className="font-semibold text-right text-amber-300">
                        {formatDateTime(tournament.verificationDate)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-white/50">Competition:</span>
                      <span className="font-semibold text-right text-emerald-400">
                        {formatDateTime(tournament.startDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Player identity summary */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {userProfile.photoURL ? (
                      <img
                        src={userProfile.photoURL}
                        alt={userProfile.displayName}
                        className="w-9 h-9 rounded-xl object-cover border border-emerald-400/50"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-sm">
                        {userProfile.displayName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {userProfile.displayName}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono font-semibold">
                        {userProfile.playerId}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/50 uppercase font-mono">Player Ready</span>
                </div>

                {/* [ REGISTER ] button */}
                <button
                  id="btn-modal-register-action"
                  onClick={handleStartRegistration}
                  disabled={registeringDraft}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {registeringDraft ? (
                    <span>Initiating Registration...</span>
                  ) : (
                    <>
                      <span>[ REGISTER ]</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP 2: PAYMENT REQUIRED */}
            {step === 'PAYMENT_REQUIRED' && (
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                {/* Status Indicator */}
                <div className="flex items-center justify-between">
                  <RegistrationStatusBadge status="PAYMENT_REQUIRED" size="lg" />
                  <span className="text-xs font-mono font-bold text-amber-400">
                    KSh {tournament.entryFee}
                  </span>
                </div>

                {/* Administrator-configured payment instructions */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-black border border-emerald-500/40 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-heading font-black uppercase text-emerald-400 tracking-wide text-xs">
                    <CreditCard className="w-4 h-4" />
                    <span>Official M-Pesa Payment Instructions</span>
                  </div>
                  <div className="space-y-1.5 text-white/80 leading-relaxed text-[11px]">
                    <p>
                      1. Open M-Pesa on your phone and send exactly{' '}
                      <strong className="text-amber-300 font-mono font-bold">
                        KSh {tournament.entryFee || TOURNAMENT_DEFAULTS.ENTRY_FEE}
                      </strong>{' '}
                      to the official Chuka Tournament Treasury:
                    </p>
                    <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs space-y-1">
                      <div>
                        Payment destination:{' '}
                        <strong className="text-emerald-400 font-bold text-sm tracking-wide">
                          {TOURNAMENT_DEFAULTS.PAYMENT_DESTINATION}
                        </strong>
                      </div>
                      <div className="text-[10px] text-amber-300/80">
                        Account/Reference: {userProfile.playerId}
                      </div>
                    </div>
                    <p>
                      2. Copy the 10-character M-Pesa confirmation code and enter your payment phone
                      number below.
                    </p>
                  </div>
                </div>

                {/* Form inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1">
                      M-Pesa Transaction Code *
                    </label>
                    <input
                      id="input-mpesa-code"
                      type="text"
                      required
                      maxLength={15}
                      placeholder="e.g. QDH58291KL"
                      value={mpesaCode}
                      onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/20 text-white font-mono text-sm tracking-widest uppercase placeholder:text-white/30 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1">
                      M-Pesa Phone Number *
                    </label>
                    <input
                      id="input-mpesa-phone"
                      type="tel"
                      required
                      placeholder="e.g. 0712345678"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/20 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/80 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    After submission, your status becomes <strong>PAYMENT PENDING</strong>. You are not marked verified until an administrator reviews and approves the payment on Verification Day.
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-white/80">
                    <WhatsAppLogo className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>24h Escalation: <strong className="text-emerald-400 font-mono">0180752220</strong></span>
                  </div>
                  <a
                    href={`https://wa.me/254180752220?text=${encodeURIComponent(
                      `Hello Admin, regarding Knockout payment for ${userProfile.playerId} (${userProfile.displayName}) - Code: ${mpesaCode || 'PENDING'}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] font-mono uppercase"
                  >
                    Contact Admin
                  </a>
                </div>

                <button
                  id="btn-submit-payment"
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Verifying & Submitting...' : '[ SUBMIT PAYMENT ]'}
                </button>
              </form>
            )}

            {/* STEP 3: PAYMENT PENDING */}
            {step === 'PAYMENT_PENDING' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <RegistrationStatusBadge status="PAYMENT_PENDING" size="lg" />
                  <span className="text-xs font-mono text-white/50">Awaiting Approval</span>
                </div>

                <div className="p-5 rounded-2xl bg-orange-950/20 border border-orange-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                    <Clock className="w-4 h-4" />
                    <span>Payment Under Review</span>
                  </div>

                  <p className="text-xs text-white/80 leading-relaxed">
                    Your payment has been logged. Do not say <strong>Verified</strong> until an administrator approves your payment on Verification Day.
                  </p>

                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Player ID:</span>
                      <span className="text-emerald-400 font-bold">{userProfile.playerId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Verification Date:</span>
                      <span className="text-amber-300">
                        {formatDateTime(tournament.verificationDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Payment Status:</span>
                      <span className="text-orange-400 font-bold">PENDING APPROVAL</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-white/60">24-hour escalation:</span>
                    <a
                      href={`https://wa.me/254180752220?text=${encodeURIComponent(
                        `Hello Admin, checking Knockout payment verification for ${userProfile.playerId} (${userProfile.displayName})`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono font-bold"
                    >
                      <WhatsAppLogo className="w-3 h-3 text-emerald-400" />
                      <span>Admin WhatsApp: 0180752220</span>
                    </a>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider border border-white/15 transition-all"
                >
                  Close &amp; Return to Dashboard
                </button>
              </div>
            )}

            {/* STEP 4: VERIFIED */}
            {step === 'VERIFIED' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <RegistrationStatusBadge status="VERIFIED" size="lg" />
                  <span className="text-xs font-mono text-emerald-400 font-bold">ROSTER LOCKED</span>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg text-white uppercase">
                      You are Officially Verified!
                    </h3>
                    <p className="text-xs text-white/70 max-w-sm mx-auto mt-1">
                      Your entry and payment have been confirmed by Chuka University eFootball administrators. You are seeded for the knockout bracket.
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all"
                >
                  View My Tournament Status
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
