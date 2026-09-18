import React, { useState } from 'react';
import { X, DollarSign, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PrizeRecord, PrizeStatus } from '../../types';
import { championService } from '../../services/championService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ManualPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  prize: PrizeRecord | null;
  onRecorded: () => void;
}

export const ManualPayoutModal: React.FC<ManualPayoutModalProps> = ({
  isOpen,
  onClose,
  prize,
  onRecorded,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [status, setStatus] = useState<PrizeStatus>(prize?.status || 'PAID');
  const [mpesaReference, setMpesaReference] = useState<string>(prize?.mpesaReference || '');
  const [recipientPhone, setRecipientPhone] = useState<string>(prize?.recipientPhone || '');
  const [notes, setNotes] = useState<string>(prize?.disbursementNotes || 'Manual M-Pesa prize payout verified.');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen || !prize) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toastError('Unauthorized: Only designated admin can record prize payouts.');
      return;
    }

    if (status === 'PAID' && !mpesaReference.trim()) {
      toastError('M-Pesa transaction reference is required when marking status as PAID.');
      return;
    }

    setSubmitting(true);
    try {
      await championService.updatePrizeStatus(
        prize.id,
        status,
        {
          mpesaReference: mpesaReference.trim().toUpperCase(),
          recipientPhone: recipientPhone.trim(),
          notes: notes.trim(),
          adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
        }
      );

      success(`Prize record for ${prize.winnerName} updated to ${status}!`);
      onRecorded();
      onClose();
    } catch (err: any) {
      console.error('Failed to update prize payout:', err);
      toastError(err.message || 'Failed to update prize record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="manual-payout-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="manual-payout-modal"
        className="w-full max-w-lg bg-[#09110d] border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#20180a] to-[#09110d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white uppercase tracking-wider">
                Manual Prize Payout Recorder
              </h2>
              <p className="text-xs text-amber-400/80 font-mono">
                {prize.winnerName} ({prize.winnerId})
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Critical Constraint Banner (Requirement 22) */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed font-mono">
              <strong className="text-white block font-heading font-bold uppercase mb-0.5">
                CRITICAL FINANCIAL POLICY:
              </strong>
              Prizes are NEVER automatically marked PAID. The administrator must execute the external M-Pesa transfer manually and record the real confirmation code below.
            </div>
          </div>

          {/* Amount & Status Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-black/40 border border-white/10">
              <span className="text-[10px] text-white/40 uppercase font-mono block">Prize Amount</span>
              <span className="font-heading font-black text-xl text-emerald-400">
                KSh {prize.amount}
              </span>
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1 font-medium">Disbursement Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PrizeStatus)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
              >
                <option value="PENDING">PENDING</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="PAID">PAID (Disbursed)</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          {/* M-Pesa Transaction Code & Recipient Phone */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60 block mb-1 font-medium">
                M-Pesa Transaction Reference Code
              </label>
              <input
                type="text"
                value={mpesaReference}
                onChange={(e) => setMpesaReference(e.target.value)}
                placeholder="e.g. SBL49821XA"
                required={status === 'PAID'}
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-amber-400 font-mono font-bold uppercase text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1 font-medium">
                Recipient M-Pesa Phone Number
              </label>
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1 font-medium">
                Disbursement Notes / Audit Detail
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:border-amber-400 focus:outline-none"
              />
            </div>
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
              id="btn-save-prize-payout"
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#140e04] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>RECORD OFFICIAL PAYOUT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
