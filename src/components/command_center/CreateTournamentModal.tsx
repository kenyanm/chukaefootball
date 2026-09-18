import React, { useState } from 'react';
import { X, Trophy, Calendar, DollarSign, Shield, Gamepad2, Users, Clock, Sparkles } from 'lucide-react';
import { Tournament, TournamentStatus } from '../../types';
import { tournamentService, formatWeekTitle } from '../../services/tournamentService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (tourn: Tournament) => void;
  existingTournaments: Tournament[];
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingTournaments,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  // Determine next sensible week number
  const highestWeek = existingTournaments.reduce((max, t) => Math.max(max, t.weekNumber || 0), 4);
  const defaultWeek = highestWeek + 1;

  // Form State with exact required defaults (Requirement 4)
  const [weekNumber, setWeekNumber] = useState<number>(defaultWeek);
  const [tournamentName, setTournamentName] = useState<string>(formatWeekTitle(defaultWeek));
  const [game, setGame] = useState<string>('eFootball Mobile');
  const [platform, setPlatform] = useState<string>('Mobile / Android');
  const [entryFee, setEntryFee] = useState<number>(20);
  const [prizePool, setPrizePool] = useState<number>(1000);
  const [maxPlayers, setMaxPlayers] = useState<number>(1024);
  const [roomJoinWindowMinutes, setRoomJoinWindowMinutes] = useState<number>(5);

  // Date defaults: spaced sensibly across 12 days
  const now = new Date();
  const defaultRegOpen = new Date(now.getTime() + 1000 * 60 * 60).toISOString().slice(0, 16); // 1 hr from now
  const defaultRegClose = new Date(now.getTime() + 86400000 * 4).toISOString().slice(0, 16); // 4 days
  const defaultVerifStart = new Date(now.getTime() + 86400000 * 4 + 3600000).toISOString().slice(0, 16); // 4 days + 1 hr
  const defaultVerifEnd = new Date(now.getTime() + 86400000 * 5).toISOString().slice(0, 16); // 5 days
  const defaultCompStart = new Date(now.getTime() + 86400000 * 6).toISOString().slice(0, 16); // 6 days
  const defaultCompEnd = new Date(now.getTime() + 86400000 * 12).toISOString().slice(0, 16); // 12 days

  const [registrationOpens, setRegistrationOpens] = useState<string>(defaultRegOpen);
  const [registrationCloses, setRegistrationCloses] = useState<string>(defaultRegClose);
  const [verificationStarts, setVerificationStarts] = useState<string>(defaultVerifStart);
  const [verificationEnds, setVerificationEnds] = useState<string>(defaultVerifEnd);
  const [competitionStarts, setCompetitionStarts] = useState<string>(defaultCompStart);
  const [competitionEnds, setCompetitionEnds] = useState<string>(defaultCompEnd);

  const [initialStatus, setInitialStatus] = useState<TournamentStatus>('REGISTRATION_OPEN');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Auto-update tournament title when week number changes if user hasn't customized it
  const handleWeekChange = (num: number) => {
    setWeekNumber(num);
    setTournamentName(formatWeekTitle(num));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toastError('Unauthorized: Only the designated administrator can create tournaments.');
      return;
    }

    if (weekNumber < 1) {
      toastError('Week Number must be a positive integer.');
      return;
    }

    if (entryFee < 0) {
      toastError('Entry fee cannot be negative.');
      return;
    }

    if (prizePool < 0) {
      toastError('Prize pool cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await tournamentService.createTournament({
        weekNumber: Number(weekNumber),
        name: tournamentName.trim(),
        game: game.trim(),
        platform: platform.trim(),
        entryFee: Number(entryFee),
        prizePool: Number(prizePool),
        maxPlayers: Number(maxPlayers),
        status: initialStatus,
        registrationOpenDate: new Date(registrationOpens).toISOString(),
        registrationCloseDate: new Date(registrationCloses).toISOString(),
        verificationStartDate: new Date(verificationStarts).toISOString(),
        verificationEndDate: new Date(verificationEnds).toISOString(),
        verificationDate: new Date(verificationStarts).toISOString(),
        startDate: new Date(competitionStarts).toISOString(),
        endDate: new Date(competitionEnds).toISOString(),
        roomJoinWindowMinutes: Number(roomJoinWindowMinutes),
        adminUid: currentUser?.uid || 'admin',
        adminEmail: currentUser?.email || 'wayongohlaurence@gmail.com',
      });

      success(`Successfully created ${created.name}!`);
      onCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to create tournament:', err);
      toastError(err.message || 'Failed to create tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="create-tournament-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="create-tournament-modal"
        className="w-full max-w-2xl bg-[#09110d] border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden my-8"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#0d2215] to-[#09110d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white uppercase tracking-wider">
                Create Tournament
              </h2>
              <p className="text-xs text-emerald-400/80 font-mono">
                Command Center • Independent Weekly Tournament Lifecycle
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* General Metadata */}
          <div className="space-y-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>1. Tournament Identity &amp; Platform</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Week Number</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={weekNumber}
                  onChange={(e) => handleWeekChange(parseInt(e.target.value) || 1)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-white/60 mb-1 font-medium">Tournament Name</label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-heading font-black uppercase tracking-wider focus:border-emerald-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Game Title</label>
                <input
                  type="text"
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Platform</label>
                <input
                  type="text"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Economics & Capacity (Requirements 4, 5, 6) */}
          <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>2. Economics, Capacity &amp; Match Rules</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Entry Fee (KSh)</label>
                <input
                  type="number"
                  min="0"
                  value={entryFee}
                  onChange={(e) => setEntryFee(parseInt(e.target.value) || 20)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-amber-400 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-white/40 font-mono">Default: KSh20</span>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Prize Pool (KSh)</label>
                <input
                  type="number"
                  min="0"
                  value={prizePool}
                  onChange={(e) => setPrizePool(parseInt(e.target.value) || 1000)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-emerald-400 font-mono font-bold text-sm focus:border-emerald-400 focus:outline-none"
                />
                <span className="text-[10px] text-white/40 font-mono">Default: KSh1000</span>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Max Players</label>
                <input
                  type="number"
                  min="8"
                  max="4096"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 1024)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-white/40 font-mono">Default: 1024</span>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1 font-medium">Room Join (Mins)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={roomJoinWindowMinutes}
                  onChange={(e) => setRoomJoinWindowMinutes(parseInt(e.target.value) || 5)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-white/40 font-mono">Default: 5 mins</span>
              </div>
            </div>
          </div>

          {/* Schedule Dates */}
          <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>3. Tournament Lifecycle Milestones</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Registration Opens</label>
                <input
                  type="datetime-local"
                  value={registrationOpens}
                  onChange={(e) => setRegistrationOpens(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Registration Closes</label>
                <input
                  type="datetime-local"
                  value={registrationCloses}
                  onChange={(e) => setRegistrationCloses(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Verification Starts</label>
                <input
                  type="datetime-local"
                  value={verificationStarts}
                  onChange={(e) => setVerificationStarts(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-amber-300 text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Verification Ends</label>
                <input
                  type="datetime-local"
                  value={verificationEnds}
                  onChange={(e) => setVerificationEnds(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-amber-300 text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Competition Starts</label>
                <input
                  type="datetime-local"
                  value={competitionStarts}
                  onChange={(e) => setCompetitionStarts(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-emerald-300 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Competition Ends</label>
                <input
                  type="datetime-local"
                  value={competitionEnds}
                  onChange={(e) => setCompetitionEnds(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-emerald-300 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Initial Status */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Initial Lifecycle Status</span>
              <span className="text-[11px] text-white/40">Default is REGISTRATION_OPEN to accept entrants immediately.</span>
            </div>
            <select
              value={initialStatus}
              onChange={(e) => setInitialStatus(e.target.value as TournamentStatus)}
              className="px-3 py-1.5 rounded-xl bg-[#0c1a11] border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold focus:outline-none"
            >
              <option value="REGISTRATION_OPEN">REGISTRATION_OPEN</option>
              <option value="UPCOMING">UPCOMING</option>
              <option value="VERIFICATION">VERIFICATION</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-tournament"
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>CREATE TOURNAMENT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
