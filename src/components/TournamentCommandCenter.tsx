import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Shield,
  Calendar,
  DollarSign,
  Users,
  Network,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Swords,
  RefreshCw,
  Lock,
  Unlock,
  AlertOctagon,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  FileSpreadsheet,
  Layers,
  History,
  Info,
} from 'lucide-react';
import {
  Tournament,
  TournamentStatus,
  TournamentEntry,
  PaymentRecord,
  MatchFixture,
  DisputeRecord,
  PrizeRecord,
  AuditLog,
  TournamentStats,
} from '../types';
import { tournamentService } from '../services/tournamentService';
import { registrationService } from '../services/registrationService';
import { bracketEngine } from '../services/bracketEngine';
import { matchService } from '../services/matchService';
import { championService } from '../services/championService';
import { auditService } from '../services/auditService';
import { sheetsSyncService } from '../services/sheetsSyncService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TournamentStatusHeader } from './TournamentStatusHeader';
import { CreateTournamentModal } from './command_center/CreateTournamentModal';
import { PreviewBracketModal } from './command_center/PreviewBracketModal';
import { ResolveMatchModal } from './command_center/ResolveMatchModal';
import { ResolveDisputeModal } from './command_center/ResolveDisputeModal';
import { ManualPayoutModal } from './command_center/ManualPayoutModal';

export const TournamentCommandCenter: React.FC = () => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { success, error: toastError, info } = useToast();

  // Primary Data
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournId, setSelectedTournId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TournamentStatus | 'ACTIVE'>('ALL');
  const [loadingTournaments, setLoadingTournaments] = useState<boolean>(true);

  // Selected Tournament Data Context
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [matches, setMatches] = useState<MatchFixture[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [prize, setPrize] = useState<PrizeRecord | null>(null);
  const [stats, setStats] = useState<TournamentStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingContext, setLoadingContext] = useState<boolean>(false);

  // Round progression and completion checks
  const [progression, setProgression] = useState<Awaited<ReturnType<typeof tournamentService.checkRoundProgression>> | null>(null);
  const [completionCheck, setCompletionCheck] = useState<Awaited<ReturnType<typeof tournamentService.canCompleteTournament>> | null>(null);

  // Google Sheets sync state
  const [sheetsOnline, setSheetsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncingSheets, setSyncingSheets] = useState<boolean>(false);

  // Workspace sub-navigation
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'LIFECYCLE' | 'REGISTRATION' | 'BRACKET' | 'LIVE_MONITOR' | 'MATCHES' | 'DISPUTES' | 'COMPLETION' | 'FINANCES' | 'AUDIT'
  >('LIFECYCLE');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showPreviewBracketModal, setShowPreviewBracketModal] = useState<boolean>(false);
  const [generatingBracket, setGeneratingBracket] = useState<boolean>(false);
  const [resolvingMatch, setResolvingMatch] = useState<MatchFixture | null>(null);
  const [resolvingDispute, setResolvingDispute] = useState<DisputeRecord | null>(null);
  const [editingPrize, setEditingPrize] = useState<PrizeRecord | null>(null);

  // Confirmation dialogs
  const [confirmLockReg, setConfirmLockReg] = useState<boolean>(false);
  const [confirmResetBracket, setConfirmResetBracket] = useState<boolean>(false);
  const [forceResetBracket, setForceResetBracket] = useState<boolean>(false);
  const [confirmCompleteTourn, setConfirmCompleteTourn] = useState<boolean>(false);

  // Search & Filters in workspace
  const [searchRoster, setSearchRoster] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'CONFIRMED' | 'DISPUTED'>('ALL');

  const selectedTournament = useMemo(() => {
    return tournaments.find((t) => t.id === selectedTournId) || null;
  }, [tournaments, selectedTournId]);

  // Load all tournaments
  const refreshTournaments = async () => {
    setLoadingTournaments(true);
    try {
      const list = await tournamentService.getAllTournaments();
      setTournaments(list);

      // Auto-select first active or first tournament if none selected
      if (!selectedTournId && list.length > 0) {
        const liveOne = list.find((t) => t.status === 'LIVE') || list.find((t) => t.status === 'REGISTRATION_OPEN') || list[0];
        setSelectedTournId(liveOne.id);
      }
    } catch (err: any) {
      console.error('Failed to load tournaments:', err);
      toastError('Failed to load tournament catalog.');
    } finally {
      setLoadingTournaments(false);
    }
  };

  useEffect(() => {
    refreshTournaments();
    checkSheetsHealth();
  }, []);

  // Check Google Sheets health
  const checkSheetsHealth = async () => {
    try {
      const health = await sheetsSyncService.checkHealth();
      setSheetsOnline(health.connected);
      if (health.lastSync) setLastSyncTime(health.lastSync);
    } catch (e) {
      setSheetsOnline(false);
    }
  };

  const handleManualSheetsSync = async () => {
    setSyncingSheets(true);
    try {
      const res = await sheetsSyncService.syncFullTournamentData(selectedTournId || 'global');
      if (res.success) {
        success('Google Sheets synchronized successfully!');
        setSheetsOnline(true);
        setLastSyncTime(new Date().toISOString());
      } else {
        toastError(`Sheets sync failed: ${res.error}`);
        setSheetsOnline(false);
      }
    } catch (err: any) {
      toastError(err.message || 'Sheets sync error.');
      setSheetsOnline(false);
    } finally {
      setSyncingSheets(false);
    }
  };

  // Load contextual data whenever selected tournament changes
  const loadTournamentContext = async (tournId: string) => {
    if (!tournId) return;
    setLoadingContext(true);
    try {
      const [
        entriesList,
        paymentsList,
        matchesList,
        disputesList,
        prizeRecord,
        statsRecord,
        progressionData,
        completionData,
        logsList,
      ] = await Promise.all([
        registrationService.getTournamentEntries(tournId),
        registrationService.getTournamentPayments(tournId),
        matchService.getTournamentMatches(tournId),
        matchService.getTournamentDisputes(tournId),
        championService.getPrizeByTournament(tournId),
        tournamentService.calculateAndSaveTournamentStats(tournId),
        tournamentService.checkRoundProgression(tournId),
        tournamentService.canCompleteTournament(tournId),
        auditService.getTournamentLogs(tournId),
      ]);

      setEntries(entriesList);
      setPayments(paymentsList);
      setMatches(matchesList);
      setDisputes(disputesList);
      setPrize(prizeRecord);
      setStats(statsRecord);
      setProgression(progressionData);
      setCompletionCheck(completionData);
      setAuditLogs(logsList);
    } catch (err: any) {
      console.error('Error loading tournament context:', err);
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    if (selectedTournId) {
      loadTournamentContext(selectedTournId);
    }
  }, [selectedTournId]);

  // Verified Entries helper
  const verifiedEntries = useMemo(() => {
    return entries.filter((e) => e.status === 'VERIFIED');
  }, [entries]);

  // Overdue matches
  const overdueMatches = useMemo(() => {
    const now = Date.now();
    return matches.filter(
      (m) => m.status !== 'CONFIRMED' && !m.isBye && m.deadline && new Date(m.deadline).getTime() < now
    );
  }, [matches]);

  // Disputed matches
  const disputedMatches = useMemo(() => {
    return matches.filter((m) => m.status === 'DISPUTED' || m.status === 'ADMIN_RESOLUTION');
  }, [matches]);

  // Filtered tournament cards based on status
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTIVE') {
        return t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
      }
      return t.status === statusFilter;
    });
  }, [tournaments, statusFilter]);

  // Status transition handler (Requirement 2)
  const handleTransitionStatus = async (newStatus: TournamentStatus) => {
    if (!selectedTournament) return;
    try {
      await tournamentService.updateTournamentStatus(
        selectedTournament.id,
        newStatus,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success(`Tournament transitioned to ${newStatus}`);
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to update status.');
    }
  };

  // Lock registration handler (Requirement 8)
  const handleLockRegistration = async () => {
    if (!selectedTournament) return;
    try {
      await tournamentService.lockRegistration(
        selectedTournament.id,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success('Registration locked! Ready for verification & bracket generation.');
      setConfirmLockReg(false);
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to lock registration.');
    }
  };

  // Generate bracket handler (Requirement 9)
  const handleGenerateBracket = async () => {
    if (!selectedTournament) return;
    setGeneratingBracket(true);
    try {
      const res = await bracketEngine.generateKnockoutBracket(
        selectedTournament.id,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success(
        `Knockout bracket generated: ${res.bracketSize} size, ${res.matchCount} matches, ${res.byesCount} BYEs.`
      );
      setShowPreviewBracketModal(false);
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to generate bracket.');
    } finally {
      setGeneratingBracket(false);
    }
  };

  // Lock / Publish bracket handler (Requirement 9)
  const handleLockBracket = async () => {
    if (!selectedTournament) return;
    try {
      await tournamentService.lockBracket(
        selectedTournament.id,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success('Bracket published and locked against accidental regeneration!');
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to lock bracket.');
    }
  };

  // Reset bracket handler (Requirement 9)
  const handleResetBracket = async () => {
    if (!selectedTournament) return;
    try {
      await tournamentService.resetKnockoutBracket(
        selectedTournament.id,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com',
        forceResetBracket
      );
      success('Knockout bracket and match tree reset successfully.');
      setConfirmResetBracket(false);
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to reset bracket.');
    }
  };

  // Advance round handler (Requirement 11)
  const handleAdvanceRound = async () => {
    if (!selectedTournament) return;
    try {
      const res = await tournamentService.advanceRound(
        selectedTournament.id,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success(`Advanced to ${res.nextRoundName}!`);
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to advance round.');
    }
  };

  // Complete tournament handler (Requirement 19 & 20)
  const handleCompleteTournament = async () => {
    if (!selectedTournament) return;
    try {
      const res = await tournamentService.completeTournament(
        selectedTournament.id,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success('Tournament officially completed! Champion crowned and prize record created.');
      setConfirmCompleteTourn(false);
      await refreshTournaments();
      await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to complete tournament.');
    }
  };

  // Payment Verification Actions (Requirement 6)
  const handleVerifyPayment = async (paymentId: string) => {
    try {
      await registrationService.verifyPayment(
        paymentId,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success('Payment manually verified. Player is now officially VERIFIED for tournament bracket.');
      if (selectedTournament) await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Verification failed.');
    }
  };

  const handleRejectPayment = async (paymentId: string, reason: string) => {
    try {
      await registrationService.rejectPayment(
        paymentId,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com',
        reason
      );
      success('Payment rejected.');
      if (selectedTournament) await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Rejection failed.');
    }
  };

  const handleFlagDuplicatePayment = async (paymentId: string) => {
    try {
      await registrationService.flagDuplicatePayment(
        paymentId,
        currentUser?.uid || 'admin',
        currentUser?.email || 'wayongohlaurence@gmail.com'
      );
      success('Payment flagged for manual review.');
      if (selectedTournament) await loadTournamentContext(selectedTournament.id);
    } catch (err: any) {
      toastError(err.message || 'Failed to flag payment.');
    }
  };

  // If not admin
  if (!isAdmin) {
    return (
      <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center max-w-xl mx-auto my-12">
        <Shield className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="font-heading font-black text-xl text-white uppercase tracking-wide">
          Access Restricted
        </h2>
        <p className="text-xs text-white/70 mt-2">
          The TOURNAMENT COMMAND CENTER is strictly reserved for the designated administrator:
          <br />
          <strong className="text-rose-400 font-mono">wayongohlaurence@gmail.com</strong>
        </p>
      </div>
    );
  }

  return (
    <div id="tournament-command-center" className="space-y-8 animate-in fade-in duration-300">
      {/* 1. TOP COMMAND BAR */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0d2215] via-[#09160e] to-[#040806] border border-emerald-500/30 shadow-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400">
              OPERATIONAL CONTROL CENTER
            </span>
          </div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-white uppercase tracking-wider">
            Tournament Command Center
          </h1>
          <p className="text-xs text-white/50 font-mono">
            Authoritative Administrator: <span className="text-emerald-400 font-bold">wayongohlaurence@gmail.com</span>
          </p>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Google Sheets Live Status (Requirement 24 & 25) */}
          <div
            id="google-sheets-status-badge"
            className={`px-3 py-2 rounded-2xl border text-xs font-mono flex items-center gap-2.5 ${
              sheetsOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                sheetsOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="font-bold">
              GOOGLE SHEETS: {sheetsOnline ? 'ONLINE' : 'SYNC ERROR'}
            </span>
            <button
              onClick={handleManualSheetsSync}
              disabled={syncingSheets}
              title="Trigger Instant Google Sheets Sync"
              className="p-1 rounded-lg bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingSheets ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Quick Tournament Switcher (Requirement 3) */}
          <div className="flex items-center gap-2 bg-black/50 border border-white/10 p-1 rounded-2xl">
            <select
              value={selectedTournId}
              onChange={(e) => setSelectedTournId(e.target.value)}
              className="bg-transparent text-white font-mono text-xs px-3 py-1.5 focus:outline-none font-bold"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#09110d] text-white">
                  Week {String(t.weekNumber).padStart(2, '0')} • {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>

          {/* Create Tournament Button (Requirement 4) */}
          <button
            id="btn-open-create-tournament"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ CREATE TOURNAMENT</span>
          </button>
        </div>
      </div>

      {/* 2. DASHBOARD SUMMARY CARDS (Requirement 1) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">
            Tournament Fleet Metrics
          </span>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {(['ALL', 'ACTIVE', 'REGISTRATION_OPEN', 'VERIFICATION', 'BRACKET_READY', 'LIVE', 'COMPLETED', 'CANCELLED'] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                    statusFilter === f
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        </div>

        {/* Dashboard Cards Grid (Requirement 1) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            {
              label: 'ACTIVE',
              count: tournaments.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
              color: 'emerald',
            },
            {
              label: 'REG. OPEN',
              count: tournaments.filter((t) => t.status === 'REGISTRATION_OPEN').length,
              color: 'orange',
            },
            {
              label: 'VERIFICATION',
              count: tournaments.filter((t) => t.status === 'VERIFICATION').length,
              color: 'amber',
            },
            {
              label: 'BRACKET READY',
              count: tournaments.filter((t) => t.status === 'BRACKET_READY').length,
              color: 'teal',
            },
            {
              label: 'LIVE NOW',
              count: tournaments.filter((t) => t.status === 'LIVE').length,
              color: 'emerald',
            },
            {
              label: 'COMPLETED',
              count: tournaments.filter((t) => t.status === 'COMPLETED').length,
              color: 'blue',
            },
            {
              label: 'CANCELLED',
              count: tournaments.filter((t) => t.status === 'CANCELLED').length,
              color: 'rose',
            },
          ].map((c) => (
            <div
              key={c.label}
              className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center"
            >
              <div className="text-[10px] font-mono font-bold uppercase text-white/40">
                {c.label}
              </div>
              <div className="font-heading font-black text-xl text-white mt-1">
                {c.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. TOURNAMENT CATALOG CARDS (Requirement 1) */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">
          Managed Tournaments ({filteredTournaments.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTournaments.map((tourn) => {
            const isSelected = tourn.id === selectedTournId;
            return (
              <div
                key={tourn.id}
                onClick={() => setSelectedTournId(tourn.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#112417] to-[#0a150e] border-emerald-400 shadow-xl shadow-emerald-950/40'
                    : 'bg-[#09110d] border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      WEEK {String(tourn.weekNumber).padStart(2, '0')}
                    </span>
                    <TournamentStatusHeader status={tourn.status} size="sm" />
                  </div>

                  <h3 className="font-heading font-black text-lg text-white uppercase">
                    {tourn.name}
                  </h3>

                  {/* Metrics row */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5 text-xs font-mono">
                    <div>
                      <span className="text-white/40 block text-[10px]">ENTRY / PRIZE</span>
                      <span className="text-amber-400 font-bold">KSh {tourn.entryFee}</span> /{' '}
                      <span className="text-emerald-400 font-bold">KSh {tourn.prizePool || 1000}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px]">VERIFIED PLAYERS</span>
                      <span className="text-white font-bold">{tourn.verifiedCount || 0}</span> / {tourn.maxPlayers || 1024}
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px]">CURRENT ROUND</span>
                      <span className="text-teal-300 font-bold">{tourn.currentRound || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px]">BRACKET STATE</span>
                      <span className={tourn.bracketLocked ? 'text-emerald-400' : 'text-amber-400'}>
                        {tourn.bracketLocked ? 'LOCKED' : tourn.bracketVersion ? 'GENERATED' : 'UNSEEDED'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-white/40 font-mono">
                    Deadline: {new Date(tourn.endDate).toLocaleDateString()}
                  </span>
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-emerald-400' : 'text-white/60'}`}>
                    {isSelected ? '● ACTIVE IN WORKSPACE' : 'SELECT TO MANAGE →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ACTIVE TOURNAMENT WORKSPACE */}
      {selectedTournament ? (
        <div className="p-6 rounded-3xl bg-[#070e0a] border border-emerald-500/30 space-y-6 shadow-2xl">
          {/* Workspace Title & Navigation */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  ACTIVE MANAGEMENT CONTEXT: WEEK {String(selectedTournament.weekNumber).padStart(2, '0')}
                </span>
                <TournamentStatusHeader status={selectedTournament.status} size="sm" />
              </div>
              <h2 className="font-heading font-black text-2xl text-white uppercase tracking-wide">
                {selectedTournament.name}
              </h2>
            </div>

            {/* Workspace Subtabs */}
            <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10 text-xs">
              {[
                { id: 'LIFECYCLE', label: 'Lifecycle' },
                { id: 'REGISTRATION', label: `Entrants (${entries.length})` },
                { id: 'BRACKET', label: 'Bracket Control' },
                { id: 'LIVE_MONITOR', label: 'Live Monitor' },
                { id: 'MATCHES', label: `Matches (${matches.length})` },
                { id: 'DISPUTES', label: `Disputes (${disputes.length})` },
                { id: 'COMPLETION', label: 'Champion / Prize' },
                { id: 'FINANCES', label: 'Revenue' },
                { id: 'AUDIT', label: 'Audit Logs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveWorkspaceTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    activeWorkspaceTab === tab.id
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: LIFECYCLE MANAGEMENT (Requirement 2) */}
          {activeWorkspaceTab === 'LIFECYCLE' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Strict Tournament Lifecycle Progression State Machine
                </div>
                <p className="text-xs text-white/70">
                  Transitions must follow the strict authoritative order:
                  <br />
                  <strong className="text-white font-mono">
                    REGISTRATION_OPEN → VERIFICATION → REGISTRATION_LOCKED → BRACKET_READY → LIVE → COMPLETED
                  </strong>
                </p>

                {/* Transition Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {selectedTournament.status === 'REGISTRATION_OPEN' && (
                    <>
                      <button
                        onClick={() => handleTransitionStatus('VERIFICATION')}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase"
                      >
                        Start Verification Phase
                      </button>
                      <button
                        onClick={() => setConfirmLockReg(true)}
                        className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock Registration</span>
                      </button>
                    </>
                  )}

                  {selectedTournament.status === 'VERIFICATION' && (
                    <button
                      onClick={() => setConfirmLockReg(true)}
                      className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Registration</span>
                    </button>
                  )}

                  {selectedTournament.status === 'REGISTRATION_LOCKED' && (
                    <button
                      onClick={() => handleTransitionStatus('BRACKET_READY')}
                      className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-bold text-xs uppercase"
                    >
                      Mark Bracket Ready
                    </button>
                  )}

                  {selectedTournament.status === 'BRACKET_READY' && (
                    <button
                      onClick={() => handleTransitionStatus('LIVE')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase shadow-lg shadow-emerald-500/20"
                    >
                      START TOURNAMENT (GO LIVE)
                    </button>
                  )}

                  {selectedTournament.status === 'LIVE' && (
                    <button
                      disabled={!completionCheck?.canComplete}
                      onClick={() => setConfirmCompleteTourn(true)}
                      className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Complete Tournament &amp; Crown Champion
                    </button>
                  )}

                  {selectedTournament.status !== 'COMPLETED' && selectedTournament.status !== 'CANCELLED' && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to CANCEL this tournament? This action is irreversible.')) {
                          handleTransitionStatus('CANCELLED');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs uppercase ml-auto"
                    >
                      Cancel Tournament
                    </button>
                  )}
                </div>
              </div>

              {/* Tournament Schedule Configuration Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono text-white/40 uppercase block">Registration Window</span>
                  <span className="font-mono text-xs text-white block mt-1">
                    {new Date(selectedTournament.registrationOpenDate).toLocaleString()}
                    <br />
                    to {new Date(selectedTournament.registrationCloseDate).toLocaleString()}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono text-white/40 uppercase block">Verification Window</span>
                  <span className="font-mono text-xs text-amber-300 block mt-1">
                    {new Date(selectedTournament.verificationDate).toLocaleString()}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono text-white/40 uppercase block">Competition Window</span>
                  <span className="font-mono text-xs text-emerald-300 block mt-1">
                    {new Date(selectedTournament.startDate).toLocaleString()}
                    <br />
                    to {new Date(selectedTournament.endDate).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTRATION & PAYMENT MONITOR (Requirements 5, 6, 7) */}
          {activeWorkspaceTab === 'REGISTRATION' && (
            <div className="space-y-6">
              {/* Stat blocks (Requirement 5) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Total Registrations</div>
                  <div className="font-heading font-black text-xl text-white mt-1">{entries.length}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Payment Pending</div>
                  <div className="font-heading font-black text-xl text-amber-400 mt-1">
                    {entries.filter((e) => e.status === 'PAYMENT_PENDING' || e.status === 'PENDING').length}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Verified</div>
                  <div className="font-heading font-black text-xl text-emerald-400 mt-1">
                    {verifiedEntries.length}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Rejected</div>
                  <div className="font-heading font-black text-xl text-rose-400 mt-1">
                    {entries.filter((e) => e.status === 'REJECTED' || e.status === 'PAYMENT_REJECTED').length}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Cancelled</div>
                  <div className="font-heading font-black text-xl text-white/50 mt-1">
                    {entries.filter((e) => e.status === 'CANCELLED').length}
                  </div>
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-white/70">VERIFIED PLAYERS CAPACITY PROGRESS</span>
                  <span className="text-emerald-400">
                    {verifiedEntries.length} / {selectedTournament.maxPlayers || 1024}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (verifiedEntries.length / (selectedTournament.maxPlayers || 1024)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Payment Destination & Verification Warning Banner (Requirement 6) */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 font-mono leading-relaxed">
                  <span className="font-bold text-white block uppercase">
                    Payment Destination: 0111359682 (KSh20 ENTRY)
                  </span>
                  Notice: Strictly never labeled Till or PayBill.
                  <br />
                  <strong className="text-amber-400">
                    CRITICAL: Never automatically assume that an M-Pesa transaction code proves payment.
                  </strong>{' '}
                  All submissions require manual review against real M-Pesa statements before marking VERIFIED.
                </div>
              </div>

              {/* Payment Review Table */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/60">
                  Payment Submissions ({payments.length})
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-white/5 text-white/50 uppercase border-b border-white/10">
                      <tr>
                        <th className="p-3">Player</th>
                        <th className="p-3">M-Pesa Code</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-white/40">
                            No payment submissions recorded for this tournament.
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className="hover:bg-white/[0.02]">
                            <td className="p-3">
                              <span className="font-bold text-white block">{p.playerDisplayName}</span>
                              <span className="text-[10px] text-white/40">{p.playerId}</span>
                            </td>
                            <td className="p-3 font-bold text-amber-400">
                              {p.mpesaTransactionCode}
                              {p.duplicateFlag && (
                                <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  DUPLICATE FLAG
                                </span>
                              )}
                            </td>
                            <td className="p-3">{p.mpesaPhone}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === 'VERIFIED'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : p.status === 'REJECTED'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="p-3 text-white/50">
                              {new Date(p.timestamp).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              {p.status !== 'VERIFIED' && (
                                <button
                                  onClick={() => handleVerifyPayment(p.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"
                                >
                                  Verify
                                </button>
                              )}
                              {p.status !== 'REJECTED' && (
                                <button
                                  onClick={() => {
                                    const reason = prompt('Enter rejection reason:') || 'Payment unverified.';
                                    handleRejectPayment(p.id, reason);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold"
                                >
                                  Reject
                                </button>
                              )}
                              {!p.duplicateFlag && (
                                <button
                                  onClick={() => handleFlagDuplicatePayment(p.id)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold"
                                >
                                  Flag Duplicate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Official Verified Roster (Requirement 7) */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Official Verified Roster ({verifiedEntries.length} Players Eligible for Bracket)
                  </div>
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={searchRoster}
                    onChange={(e) => setSearchRoster(e.target.value)}
                    className="px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-2 space-y-1">
                  {verifiedEntries
                    .filter(
                      (e) =>
                        !searchRoster ||
                        e.displayName.toLowerCase().includes(searchRoster.toLowerCase()) ||
                        e.playerId.toLowerCase().includes(searchRoster.toLowerCase())
                    )
                    .map((e, idx) => (
                      <div
                        key={e.id}
                        className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 w-10">#{String(idx + 1).padStart(3, '0')}</span>
                          <span className="font-bold text-emerald-400">{e.playerId}</span>
                          <span className="text-white font-bold">{e.displayName}</span>
                        </div>
                        <span className="text-[10px] text-white/40">
                          Verified: {new Date(e.verifiedAt || e.registeredAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BRACKET CONTROL (Requirement 9) */}
          {activeWorkspaceTab === 'BRACKET' && (
            <div className="space-y-6">
              {/* Bracket Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Verified Players</div>
                  <div className="font-heading font-black text-xl text-emerald-400 mt-1">
                    {verifiedEntries.length}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Bracket Size</div>
                  <div className="font-heading font-black text-xl text-white mt-1">
                    {selectedTournament.bracketSize ||
                      (verifiedEntries.length >= 2
                        ? Math.pow(2, Math.ceil(Math.log2(Math.max(8, verifiedEntries.length))))
                        : 0)}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">First Round Matches</div>
                  <div className="font-heading font-black text-xl text-amber-400 mt-1">
                    {selectedTournament.bracketSize ? selectedTournament.bracketSize / 2 : 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center">
                  <div className="text-[10px] font-mono text-white/40 uppercase">BYEs Count</div>
                  <div className="font-heading font-black text-xl text-teal-400 mt-1">
                    {selectedTournament.bracketSize
                      ? selectedTournament.bracketSize - verifiedEntries.length
                      : 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-mono text-white/40 uppercase">Current Round</div>
                  <div className="font-heading font-black text-xl text-white mt-1">
                    {selectedTournament.currentRound || 'Round 1'}
                  </div>
                </div>
              </div>

              {/* Bracket Action Control Bar (Requirement 9) */}
              <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/60">
                  Bracket Authority Controls
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* [ PREVIEW BRACKET ] */}
                  <button
                    onClick={() => setShowPreviewBracketModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <Network className="w-4 h-4 text-emerald-400" />
                    <span>Preview Bracket</span>
                  </button>

                  {/* [ GENERATE BRACKET ] */}
                  <button
                    disabled={selectedTournament.bracketLocked || verifiedEntries.length < 2 || generatingBracket}
                    onClick={() => setShowPreviewBracketModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Bracket</span>
                  </button>

                  {/* [ LOCK / PUBLISH BRACKET ] */}
                  <button
                    disabled={selectedTournament.bracketLocked || !selectedTournament.bracketVersion}
                    onClick={handleLockBracket}
                    className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {selectedTournament.bracketLocked ? 'Bracket Published & Locked' : 'Lock / Publish Bracket'}
                    </span>
                  </button>

                  {/* [ RESET BRACKET ] */}
                  <button
                    onClick={() => setConfirmResetBracket(true)}
                    className="px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs uppercase tracking-wider transition-all ml-auto flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reset Bracket</span>
                  </button>
                </div>

                {selectedTournament.bracketLocked && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Bracket version {selectedTournament.bracketVersion} is locked. Accidental regeneration is prevented.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LIVE TOURNAMENT MONITOR & ROUND PROGRESSION (Requirements 10, 11, 12) */}
          {activeWorkspaceTab === 'LIVE_MONITOR' && (
            <div className="space-y-6">
              {/* Round & Matches Stats */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0e2114] to-[#08120b] border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-xl text-white uppercase tracking-wider">
                    CURRENT ROUND: {progression?.currentRoundName || selectedTournament.currentRound || 'ROUND 1'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/40">
                    LIVE eFOOTBALL TOURNAMENT
                  </span>
                </div>

                {/* Match metrics (Requirement 10) */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Total</span>
                    <span className="font-heading font-black text-lg text-white mt-1">
                      {matches.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Completed</span>
                    <span className="font-heading font-black text-lg text-emerald-400 mt-1">
                      {matches.filter((m) => m.status === 'CONFIRMED').length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Pending</span>
                    <span className="font-heading font-black text-lg text-amber-400 mt-1">
                      {matches.filter((m) => m.status !== 'CONFIRMED' && !m.isBye).length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Disputed</span>
                    <span className="font-heading font-black text-lg text-rose-400 mt-1">
                      {disputedMatches.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Overdue</span>
                    <span className="font-heading font-black text-lg text-orange-400 mt-1">
                      {overdueMatches.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Remaining</span>
                    <span className="font-heading font-black text-lg text-teal-400 mt-1">
                      {stats?.playersRemaining || Math.max(1, verifiedEntries.length - matches.filter((m) => m.status === 'CONFIRMED' && !m.isBye).length)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Round Progression Detector (Requirement 11) */}
              <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-heading font-black text-base text-white uppercase">
                      Round Progression Engine
                    </h3>
                    <p className="text-xs text-white/60 font-mono">
                      Every playable match in {progression?.currentRoundName} must be officially CONFIRMED before round advance.
                    </p>
                  </div>

                  {/* Advance Button */}
                  {progression?.canAdvance ? (
                    <button
                      onClick={handleAdvanceRound}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                      <span>ADVANCE TO NEXT ROUND</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : progression?.isTournamentFinal ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                      FINAL ROUND REACHED
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-white/5 text-white/40 font-mono text-xs font-bold">
                      {progression?.unresolvedMatchesCount || 0} MATCHES UNRESOLVED
                    </span>
                  )}
                </div>

                {progression?.isRoundFullyResolved ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>
                      All {progression.totalMatchesInRound} playable matches in {progression.currentRoundName} are resolved.
                      Ready to advance participants to the next round.
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {progression?.resolvedMatchesCount || 0} of {progression?.totalMatchesInRound || 0} matches resolved.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MATCH CONTROL & DEADLINE MONITOR (Requirements 13 & 15) */}
          {activeWorkspaceTab === 'MATCHES' && (
            <div className="space-y-6">
              {/* Overdue Alert Banner if any (Requirement 13) */}
              {overdueMatches.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-rose-300">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>{overdueMatches.length} OVERDUE MATCHES REQUIRE IMMEDIATE ATTENTION</span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {overdueMatches.map((om) => (
                      <div
                        key={om.id}
                        className="p-3 rounded-xl bg-black/40 border border-rose-500/30 flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <span className="text-white/40">{om.matchId} • {om.roundName}</span>
                          <span className="font-bold text-white block">
                            {om.homePlayerName} vs {om.awayPlayerName}
                          </span>
                          <span className="text-[10px] text-rose-400">
                            Deadline Expired: {new Date(om.deadline || 0).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => setResolvingMatch(om)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase"
                        >
                          Resolve Match
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Matches Table with Search & Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/50">
                    All Fixtures ({matches.length})
                  </div>
                  <div className="flex items-center gap-2">
                    {(['ALL', 'PENDING', 'OVERDUE', 'CONFIRMED', 'DISPUTED'] as const).map((mf) => (
                      <button
                        key={mf}
                        onClick={() => setMatchFilter(mf)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all ${
                          matchFilter === mf
                            ? 'bg-emerald-500 text-black'
                            : 'bg-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        {mf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-white/5 text-white/50 uppercase border-b border-white/10">
                      <tr>
                        <th className="p-3">Match ID</th>
                        <th className="p-3">Round</th>
                        <th className="p-3">Home vs Away</th>
                        <th className="p-3">Score / Result</th>
                        <th className="p-3">Room Pin</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80">
                      {matches
                        .filter((m) => {
                          if (matchFilter === 'ALL') return true;
                          if (matchFilter === 'CONFIRMED') return m.status === 'CONFIRMED';
                          if (matchFilter === 'DISPUTED') return m.status === 'DISPUTED' || m.status === 'ADMIN_RESOLUTION';
                          if (matchFilter === 'OVERDUE') {
                            return (
                              m.status !== 'CONFIRMED' &&
                              !m.isBye &&
                              m.deadline &&
                              new Date(m.deadline).getTime() < Date.now()
                            );
                          }
                          if (matchFilter === 'PENDING') return m.status !== 'CONFIRMED' && !m.isBye;
                          return true;
                        })
                        .map((m) => (
                          <tr key={m.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-bold text-white">{m.matchId}</td>
                            <td className="p-3 text-white/60">{m.roundName || `R${m.roundNumber}`}</td>
                            <td className="p-3">
                              <span className="font-bold text-white block">
                                {m.homePlayerName} <span className="text-white/40 font-normal">({m.homePlayerId})</span>
                              </span>
                              <span className="text-white/60 block">
                                {m.isBye ? (
                                  <span className="text-teal-400 italic">BYE</span>
                                ) : (
                                  `${m.awayPlayerName} (${m.awayPlayerId})`
                                )}
                              </span>
                            </td>
                            <td className="p-3 font-bold">
                              {m.status === 'CONFIRMED'
                                ? `${m.homeScore ?? 0} — ${m.awayScore ?? 0}`
                                : '—'}
                            </td>
                            <td className="p-3 text-emerald-400 font-bold">
                              {m.roomNumber || '—'}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  m.status === 'CONFIRMED'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : m.status === 'DISPUTED' || m.status === 'ADMIN_RESOLUTION'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {!m.isBye && m.status !== 'CONFIRMED' && (
                                <button
                                  onClick={() => setResolvingMatch(m)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold"
                                >
                                  Resolve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DISPUTE MONITOR (Requirement 14) */}
          {activeWorkspaceTab === 'DISPUTES' && (
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4" />
                <span>Active Tournament Disputes ({disputes.length})</span>
              </div>

              {disputes.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/5 text-white/50 text-xs font-mono">
                  No disputes recorded for this tournament.
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div
                      key={d.id}
                      className="p-5 rounded-3xl bg-black/40 border border-rose-500/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-400">Match {d.matchId}</span>
                          <span className="text-white/40">• Disputed by {d.disputedByName} ({d.disputedByPlayerId})</span>
                        </div>
                        <p className="text-white/80 italic bg-black/30 p-2.5 rounded-xl border border-white/5">
                          "{d.reason}"
                        </p>
                        <span className="text-[10px] text-white/40 block">
                          Submitted scores: {d.homeScore} — {d.awayScore} • Filed at {new Date(d.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const matched = matches.find((m) => m.id === d.matchId);
                          setResolvingDispute(d);
                          if (matched) setResolvingMatch(matched);
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-heading font-black text-xs uppercase tracking-wider transition-all shrink-0 shadow-lg shadow-rose-500/20"
                      >
                        RESOLVE DISPUTE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: TOURNAMENT COMPLETION & CHAMPION / PRIZE (Requirements 19, 20, 21, 22) */}
          {activeWorkspaceTab === 'COMPLETION' && (
            <div className="space-y-6">
              {/* Pre-flight Checks (Requirement 19) */}
              <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
                <h3 className="font-heading font-black text-base text-white uppercase">
                  Tournament Completion Pre-Flight Verification
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                    <span>Unresolved Matches Remaining:</span>
                    <strong className={progression?.unresolvedMatchesCount ? 'text-rose-400' : 'text-emerald-400'}>
                      {progression?.unresolvedMatchesCount || 0}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                    <span>Open Disputes Remaining:</span>
                    <strong className={disputes.filter((d) => d.status === 'OPEN').length ? 'text-rose-400' : 'text-emerald-400'}>
                      {disputes.filter((d) => d.status === 'OPEN').length}
                    </strong>
                  </div>
                </div>

                {completionCheck?.canComplete ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div className="text-xs font-mono text-emerald-300">
                      <strong>FINAL MATCH RESOLVED:</strong> Champion {completionCheck.championName} ({completionCheck.championPlayerId}) confirmed with score {completionCheck.championScore}.
                    </div>
                    <button
                      onClick={() => setConfirmCompleteTourn(true)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                    >
                      COMPLETE TOURNAMENT
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
                    Cannot complete tournament yet: {completionCheck?.reason || 'Awaiting final match resolution.'}
                  </div>
                )}
              </div>

              {/* Champion & Prize Record Cards if Completed (Requirements 20 & 22) */}
              {selectedTournament.status === 'COMPLETED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Champion Display */}
                  <div className="p-6 rounded-3xl bg-gradient-to-b from-[#1c1608] to-[#0d0a03] border border-amber-500/40 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                          Official Champion
                        </span>
                        <h4 className="font-heading font-black text-xl text-white">
                          {selectedTournament.championName}
                        </h4>
                      </div>
                    </div>
                    <div className="text-xs font-mono space-y-1 text-white/70 pt-2 border-t border-white/5">
                      <div>Player ID: <strong className="text-white">{selectedTournament.championPlayerId}</strong></div>
                      <div>Final Match Score: <strong className="text-emerald-400">{selectedTournament.championScore}</strong></div>
                    </div>
                  </div>

                  {/* Prize Record Card */}
                  <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-white/40 font-bold">
                          Prize Obligation
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            prize?.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {prize?.status || 'PENDING'}
                        </span>
                      </div>
                      <div className="font-heading font-black text-2xl text-emerald-400 mt-1">
                        KSh {prize?.amount || 1000}
                      </div>
                      {prize?.mpesaReference && (
                        <div className="text-xs font-mono text-white/70 mt-2">
                          M-Pesa Ref: <strong className="text-amber-400">{prize.mpesaReference}</strong>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setEditingPrize(prize)}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-heading font-black text-xs uppercase tracking-wider transition-all"
                    >
                      Record Manual Prize Payout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: TOURNAMENT REVENUE SUMMARY (Requirement 23) */}
          {activeWorkspaceTab === 'FINANCES' && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-4">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Tournament Revenue &amp; Prize Obligation Summary</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Total Verified Entrants</span>
                    <span className="font-heading font-black text-2xl text-white mt-1">
                      {verifiedEntries.length} Players
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Total Gross Revenue (KSh20 × Entries)</span>
                    <span className="font-heading font-black text-2xl text-emerald-400 mt-1">
                      KSh {(verifiedEntries.length * 20).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">First Prize Obligation</span>
                    <span className="font-heading font-black text-2xl text-amber-400 mt-1">
                      KSh {selectedTournament.prizePool || 1000}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs font-mono text-white/50 leading-relaxed">
                  Financial calculations reflect verified registrations only. Pending and rejected payments do not constitute tournament revenue.
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: AUDIT LOGS (Requirement 26) */}
          {activeWorkspaceTab === 'AUDIT' && (
            <div className="space-y-3">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">
                Authoritative Audit Trail ({auditLogs.length} Events)
              </div>
              <div className="max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-2 space-y-1.5 font-mono text-xs">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-white/40">No audit logs recorded for this tournament.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-3 text-white/80"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-emerald-400">{log.action}</span>
                        <div className="text-[11px] text-white/50">{log.adminEmail || log.adminUid}</div>
                      </div>
                      <span className="text-[10px] text-white/40 shrink-0">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* MODALS */}
      {/* 1. Create Tournament Modal */}
      <CreateTournamentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        existingTournaments={tournaments}
        onCreated={async (newTourn) => {
          await refreshTournaments();
          setSelectedTournId(newTourn.id);
        }}
      />

      {/* 2. Preview Bracket Modal */}
      {selectedTournament && (
        <PreviewBracketModal
          isOpen={showPreviewBracketModal}
          onClose={() => setShowPreviewBracketModal(false)}
          tournament={selectedTournament}
          verifiedEntries={verifiedEntries}
          generating={generatingBracket}
          onConfirmGenerate={handleGenerateBracket}
        />
      )}

      {/* 3. Resolve Overdue / Match Modal */}
      <ResolveMatchModal
        isOpen={!!resolvingMatch}
        onClose={() => setResolvingMatch(null)}
        match={resolvingMatch}
        onResolved={async () => {
          if (selectedTournament) await loadTournamentContext(selectedTournament.id);
        }}
      />

      {/* 4. Resolve Dispute Modal */}
      <ResolveDisputeModal
        isOpen={!!resolvingDispute}
        onClose={() => setResolvingDispute(null)}
        dispute={resolvingDispute}
        match={resolvingMatch}
        onResolved={async () => {
          if (selectedTournament) await loadTournamentContext(selectedTournament.id);
        }}
      />

      {/* 5. Manual Payout Modal */}
      <ManualPayoutModal
        isOpen={!!editingPrize}
        onClose={() => setEditingPrize(null)}
        prize={editingPrize}
        onRecorded={async () => {
          if (selectedTournament) await loadTournamentContext(selectedTournament.id);
        }}
      />

      {/* 6. Lock Registration Confirmation Modal (Requirement 8) */}
      {confirmLockReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#09110d] border border-orange-500/40 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-orange-400">
              <Lock className="w-6 h-6" />
              <h3 className="font-heading font-black text-lg text-white uppercase">
                Lock Tournament Registration?
              </h3>
            </div>
            <p className="text-xs text-white/70 font-mono leading-relaxed">
              This will stop new registrations and prepare the tournament for verification and bracket generation.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmLockReg(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleLockRegistration}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-heading font-black text-xs uppercase shadow-md shadow-orange-500/20"
              >
                CONFIRM LOCK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reset Bracket Confirmation Modal (Requirement 9) */}
      {confirmResetBracket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#09110d] border border-rose-500/40 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-heading font-black text-lg text-white uppercase">
                Reset Knockout Bracket?
              </h3>
            </div>
            <p className="text-xs text-white/70 font-mono leading-relaxed">
              Resetting will clear all generated match fixtures and rounds for this tournament.
            </p>
            <label className="flex items-center gap-2 text-xs text-rose-300 font-mono cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={forceResetBracket}
                onChange={(e) => setForceResetBracket(e.target.checked)}
                className="rounded text-rose-500"
              />
              <span>Force reset even if matches have started</span>
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmResetBracket(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleResetBracket}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-heading font-black text-xs uppercase shadow-md shadow-rose-500/20"
              >
                EXECUTE BRACKET RESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Complete Tournament Confirmation Modal (Requirement 19) */}
      {confirmCompleteTourn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#09110d] border border-blue-500/40 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-400">
              <Trophy className="w-6 h-6" />
              <h3 className="font-heading font-black text-lg text-white uppercase">
                Complete Tournament &amp; Crown Champion?
              </h3>
            </div>
            <p className="text-xs text-white/70 font-mono leading-relaxed">
              This will officially close the tournament, crown{' '}
              <strong className="text-white">{completionCheck?.championName}</strong> as champion, and
              initialize the prize disbursement record.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmCompleteTourn(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteTournament}
                className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-heading font-black text-xs uppercase shadow-md shadow-blue-500/20"
              >
                OFFICIALLY COMPLETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
