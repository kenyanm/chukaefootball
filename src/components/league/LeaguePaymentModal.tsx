import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  Phone,
  Sparkles,
  Info,
} from 'lucide-react';
import { leagueService, LEAGUE_CONFIG } from '../../services/leagueService';
import { UserProfile, LeagueSeason } from '../../types';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { WhatsAppLogo } from '../WhatsAppLogo';

interface LeaguePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  activeSeason: LeagueSeason;
  onPaymentSubmitted: () => void;
}

export const LeaguePaymentModal: React.FC<LeaguePaymentModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  activeSeason,
  onPaymentSubmitted,
}) => {
  const [mpesaCode, setMpesaCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(userProfile.whatsappNumber || '');
  const [accountName, setAccountName] = useState(userProfile.displayName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);

  if (!isOpen) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(LEAGUE_CONFIG.PAYMENT_PHONE);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanCode = mpesaCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Please enter your M-Pesa transaction confirmation code.');
      return;
    }

    if (!/^[A-Z0-9]{8,12}$/.test(cleanCode)) {
      setErrorMessage('Invalid M-Pesa code format. Must be 8 to 12 alphanumeric characters.');
      return;
    }

    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter the M-Pesa phone number used for payment.');
      return;
    }

    setIsSubmitting(true);
    try {
      await leagueService.submitLeaguePayment({
        userId: userProfile.id,
        playerId: userProfile.playerId,
        accountName: accountName.trim() || userProfile.displayName,
        displayName: userProfile.displayName,
        efootballUsername: userProfile.efootballUsername || '',
        photoURL: userProfile.photoURL || userProfile.photoUrl || '',
        squadImageUrl: userProfile.efootballAccountImageUrl || '',
        mpesaCode: cleanCode,
        phoneNumber: phoneNumber.trim(),
        seasonId: activeSeason.id,
      });

      onPaymentSubmitted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit League payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#080B09] border border-white/10 shadow-2xl p-6 sm:p-8 space-y-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <ChukaCrestLogo size="sm" />
            <div>
              <div className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>CHUKA</span>
                <span className="text-emerald-400">eFOOTBALL LEAGUE</span>
              </div>
              <div className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                PARTICIPATION CARD — KSh 50
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

        {/* Why Pay KSh 50 Explanatory Notice */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300 font-heading font-black text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Why KSh50?</span>
            </div>
            <button
              type="button"
              onClick={() => setShowWhyModal(!showWhyModal)}
              className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline"
            >
              {showWhyModal ? 'Collapse details' : 'Read full policy'}
            </button>
          </div>
          <p className="text-xs text-white/80 leading-relaxed font-sans">
            The KSh50 League Participation Card activates your official CHUKA eFOOTBALL League
            membership. Your payment gives you a registered place in the League, a unique digital
            League Card and QR profile, access to official League matches, League standings and
            statistics, and allows your wins and results to count toward your League record.
          </p>

          {showWhyModal && (
            <div className="pt-2 border-t border-emerald-500/20 space-y-2 text-xs text-white/70">
              <p className="leading-relaxed">
                Only registered League Members can play official League matches. This helps us keep
                the League standings based on identifiable registered players and prevents
                unregistered players from adding unofficial results.
              </p>
              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>IMPORTANT:</strong> The KSh50 is a participation/membership-card fee. It does
                  not automatically guarantee a prize. Any League prize, sponsorship, reward, or
                  payout must be separately published and configured by the administrator.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Destination Details */}
        <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">League Season:</span>
            <span className="text-white font-bold">{activeSeason.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Participation Fee:</span>
            <span className="text-emerald-400 font-bold text-sm">KSh 50.00</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
            <span className="text-white/60">Payment Type:</span>
            <span className="text-white font-bold">M-Pesa Send Money</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Destination Phone:</span>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-sm">
                {LEAGUE_CONFIG.PAYMENT_PHONE}
              </span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                title="Copy phone number"
              >
                {copiedPhone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Payment Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-white/70 uppercase tracking-wider mb-1.5">
              M-Pesa Transaction Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. QA12BC34DE"
              value={mpesaCode}
              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-sm tracking-wider uppercase placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-white/40 mt-1">
              Enter the exact confirmation code received in your M-Pesa SMS message.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-white/70 uppercase tracking-wider mb-1.5">
                M-Pesa Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-xs placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/70 uppercase tracking-wider mb-1.5">
                M-Pesa Account Name
              </label>
              <input
                type="text"
                placeholder="Name on M-Pesa"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-xs placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/60 font-mono space-y-1">
            <div className="font-bold text-white flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manual Verification Architecture</span>
            </div>
            <p>
              Your payment will be manually verified by the CHUKA administrative desk. Upon
              verification, your League Card QR and status become active immediately.
            </p>
          </div>

          {/* 24-hour escalation */}
          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/25 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-white/70">
              <WhatsAppLogo className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>24h Escalation: <strong className="text-emerald-400">0180752220</strong></span>
            </div>
            <a
              href={`https://wa.me/254180752220?text=${encodeURIComponent(
                `Hello Admin, regarding League Card payment for ${userProfile.playerId} (${userProfile.displayName}) - Code: ${mpesaCode || 'PENDING'}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 font-bold underline"
            >
              Contact Admin
            </a>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold font-mono uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT KSh 50 PAYMENT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
