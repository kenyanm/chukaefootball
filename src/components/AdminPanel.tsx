import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Calendar,
  CreditCard,
  Trophy,
  Swords,
  AlertOctagon,
  Plus,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  Lock,
  Clock,
  History,
  AlertTriangle,
  Users,
  DollarSign,
  RefreshCw,
  Award,
  Check,
  Flag,
  FileSpreadsheet,
  Database,
  ExternalLink,
  Copy,
} from 'lucide-react';
import {
  Tournament,
  PaymentRecord,
  DisputeRecord,
  MatchFixture,
  AuditLog,
  PrizeRecord,
  MatchEvidenceRecord,
  SheetsConfig,
  SheetsSyncLog,
  UserProfile,
} from '../types';
import { playerService } from '../services/playerService';
import { tournamentService } from '../services/tournamentService';
import {
  registrationService,
  VerificationMetrics,
  FinancialMetrics,
} from '../services/registrationService';
import { matchService } from '../services/matchService';
import { auditService } from '../services/auditService';
import { championService } from '../services/championService';
import { storageService } from '../services/storageService';
import { googleSheetsService } from '../services/googleSheetsService';
import { sheetsSyncService } from '../services/sheetsSyncService';
import { TOURNAMENT_DEFAULTS } from '../config/tournamentConfig';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TournamentCommandCenter } from './TournamentCommandCenter';

type AdminTab =
  | 'COMMAND_CENTER'
  | 'OVERVIEW'
  | 'USERS'
  | 'VERIFICATION_DAY'
  | 'PRIZES_FINANCES'
  | 'TOURNAMENTS'
  | 'MATCHES'
  | 'DISPUTES'
  | 'AUDIT_LOGS'
  | 'GOOGLE_SHEETS';

export const AdminPanel: React.FC = () => {
  const { userProfile, currentUser, isAdmin } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('COMMAND_CENTER');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [matches, setMatches] = useState<MatchFixture[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [verificationMetrics, setVerificationMetrics] = useState<VerificationMetrics | null>(null);
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [prizes, setPrizes] = useState<PrizeRecord[]>([]);
  const [failedCleanups, setFailedCleanups] = useState<MatchEvidenceRecord[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'DUPLICATES'>('ALL');
  const [loading, setLoading] = useState(false);

  // Authoritative User Synchronization State
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  // Manual Payout Recording State (PART T)
  const [payoutModalPrize, setPayoutModalPrize] = useState<PrizeRecord | null>(null);
  const [payoutMpesaCode, setPayoutMpesaCode] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  // New Tournament Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWeekNumber, setNewWeekNumber] = useState(3);
  const [newEntryFee, setNewEntryFee] = useState(20);
  const [newMaxPlayers, setNewMaxPlayers] = useState<number | ''>('');
  const [newTournName, setNewTournName] = useState('CHUKA eFOOTBALL WEEK 03');

  // Google Sheets Database Synchronization State
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [sheetsSyncLogs, setSheetsSyncLogs] = useState<SheetsSyncLog[]>([]);
  const [sheetsTesting, setSheetsTesting] = useState(false);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsConnectionStatus, setSheetsConnectionStatus] = useState<'CONNECTED' | 'OFFLINE' | 'CHECKING'>('CHECKING');
  const [sheetsTestResult, setSheetsTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Load Admin Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [allTournaments, allPayments, allDisputes, allPrizes, cleanups, sConfig, sLogs] = await Promise.all([
        tournamentService.getAllTournaments(),
        registrationService.getAllPayments(),
        matchService.getAllDisputes(),
        championService.getAllPrizes(),
        storageService.getFailedCleanups(),
        googleSheetsService.getConfig(),
        googleSheetsService.getRecentSyncLogs(20),
      ]);

      setTournaments(allTournaments);
      setPayments(allPayments);
      setDisputes(allDisputes);
      setPrizes(allPrizes);
      setFailedCleanups(cleanups);
      setSheetsConfig(sConfig);
      setSheetsSyncLogs(sLogs);
      if (sConfig.webhookUrl) {
        setWebhookUrlInput(sConfig.webhookUrl);
      }
      if (sConfig.lastSuccessfulSync && !sConfig.lastError) {
        setSheetsConnectionStatus('CONNECTED');
      } else if (sConfig.lastError) {
        setSheetsConnectionStatus('OFFLINE');
      } else {
        setSheetsConnectionStatus('CHECKING');
      }

      if (allTournaments.length > 0) {
        const defaultId = selectedTournamentId || allTournaments[0].id;
        setSelectedTournamentId(defaultId);
        loadTournamentSpecificData(defaultId);
      }
      loadAdminUsers();
    } catch (err: any) {
      console.error(err);
      error('Admin Load Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSheetsConnection = async (urlOverride?: string) => {
    setSheetsTesting(true);
    setSheetsTestResult(null);
    try {
      const targetUrl = urlOverride !== undefined ? urlOverride : webhookUrlInput;
      const res = await googleSheetsService.testConnection(targetUrl);
      setSheetsTestResult(res);
      if (res.success && res.status === 'online') {
        setSheetsConnectionStatus('CONNECTED');
        success('GOOGLE SHEETS CONNECTED 🟢', `${res.message} (${res.latencyMs || 0}ms)`);
      } else {
        setSheetsConnectionStatus('OFFLINE');
        error('GOOGLE SHEETS OFFLINE 🔴', res.error || res.message);
      }
      const updatedConfig = await googleSheetsService.getConfig();
      setSheetsConfig(updatedConfig);
    } catch (e: any) {
      setSheetsConnectionStatus('OFFLINE');
      setSheetsTestResult({ success: false, message: 'Test failed', error: e.message });
      error('Test Failed', e.message);
    } finally {
      setSheetsTesting(false);
    }
  };

  const handleSyncSheetsNow = async () => {
    setSheetsSyncing(true);
    try {
      info('Synchronizing...', 'Synchronizing live operational data to Google Sheets.');
      const result = await sheetsSyncService.syncAllData(userProfile?.displayName || 'Admin');
      if (result.success) {
        setSheetsConnectionStatus('CONNECTED');
        success(
          'GOOGLE SHEETS SYNCED ✅',
          `Synchronized ${result.syncedCount} records across official operational sheets.`
        );
      } else {
        setSheetsConnectionStatus('OFFLINE');
        error('SYNC FAILED', result.errors.slice(0, 3).join('; ') || 'Check Google Sheets connection.');
      }
      const [updatedConfig, updatedLogs] = await Promise.all([
        googleSheetsService.getConfig(),
        googleSheetsService.getRecentSyncLogs(20),
      ]);
      setSheetsConfig(updatedConfig);
      setSheetsSyncLogs(updatedLogs);
    } catch (e: any) {
      setSheetsConnectionStatus('OFFLINE');
      error('Sync Failed', e.message);
    } finally {
      setSheetsSyncing(false);
    }
  };

  const handleRetryFailedSheets = async () => {
    await handleSyncSheetsNow();
  };

  const handleSaveWebhookUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWebhook(true);
    try {
      await googleSheetsService.saveConfig({ webhookUrl: webhookUrlInput.trim() });
      success('WEBHOOK URL SAVED', 'Google Sheets endpoint updated.');
      const updatedConfig = await googleSheetsService.getConfig();
      setSheetsConfig(updatedConfig);
      await handleTestSheetsConnection(webhookUrlInput.trim());
    } catch (e: any) {
      error('Save Failed', e.message);
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(googleSheetsService.getAppsScriptTemplate());
    setCopiedScript(true);
    success('COPIED TO CLIPBOARD', '1-Click Apps Script copied. Paste into Google Sheets -> Extensions -> Apps Script.');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const loadTournamentSpecificData = async (tournId: string) => {
    if (!tournId) return;
    try {
      const [m, metrics, finMetrics] = await Promise.all([
        matchService.getTournamentMatches(tournId),
        registrationService.getVerificationMetrics(tournId),
        registrationService.getFinancialMetrics(tournId),
      ]);
      setMatches(m);
      setVerificationMetrics(metrics);
      setFinancialMetrics(finMetrics);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await auditService.getRecentLogs(50);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const u = await playerService.getAllUsersAdmin();
      setAdminUsers(u);
    } catch (e) {
      console.error('Failed to load admin users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSyncIndividualUser = async (uid: string, displayName: string) => {
    setSyncingUserId(uid);
    try {
      const res = await playerService.reSyncUserToSheets(uid);
      if (res.success) {
        success('User Synchronized', `${displayName} successfully synced to Google Sheets Users sheet.`);
        await loadAdminUsers();
      } else {
        error('Sync Failed', res.error || 'Unable to sync user to Google Sheets.');
        await loadAdminUsers();
      }
    } catch (e: any) {
      error('Sync Error', e.message || 'Error communicating with Google Sheets.');
    } finally {
      setSyncingUserId(null);
    }
  };

  const handleSyncAllUsers = async () => {
    setLoadingUsers(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const u of adminUsers) {
        const res = await playerService.reSyncUserToSheets(u.id);
        if (res.success) successCount++;
        else failCount++;
      }
      if (failCount === 0) {
        success('All Users Synchronized', `Successfully synced all ${successCount} players to Google Sheets.`);
      } else {
        info('Synchronization Complete', `Synced ${successCount} users. ${failCount} failed.`);
      }
      await loadAdminUsers();
    } catch (e: any) {
      error('Bulk Sync Error', e.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedTournamentId) {
      loadTournamentSpecificData(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    if (activeTab === 'AUDIT_LOGS') {
      loadAuditLogs();
    } else if (activeTab === 'USERS' || activeTab === 'GOOGLE_SHEETS') {
      loadAdminUsers();
    }
  }, [activeTab]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center rounded-2xl bg-red-950/20 border border-red-500/30">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="font-heading font-black text-xl text-white">Administrator Access Required</h2>
        <p className="text-xs text-white/60 mt-2">
          Only authorized Chuka University eFootball coordinators can access this panel.
        </p>
      </div>
    );
  }

  const selectedTourn = tournaments.find((t) => t.id === selectedTournamentId);

  // Handle Verify Payment (Requirement 4)
  const handleVerifyPayment = async (paymentId: string) => {
    if (!currentUser) return;
    try {
      await registrationService.verifyPayment(paymentId, currentUser.uid, currentUser.email || undefined);
      success('Payment Verified', 'Player entry is now VERIFIED for the official knockout bracket.');
      loadData();
    } catch (err: any) {
      error('Verification Failed', err.message);
    }
  };

  // Handle Reject Payment (Requirement 4)
  const handleRejectPayment = async (paymentId: string) => {
    if (!currentUser) return;
    const reason = prompt('Please enter rejection reason (e.g. Invalid M-Pesa transaction reference):') || 'Invalid code';
    try {
      await registrationService.rejectPayment(paymentId, currentUser.uid, currentUser.email || undefined, reason);
      info('Payment Rejected', 'Payment and registration marked as rejected.');
      loadData();
    } catch (err: any) {
      error('Rejection Failed', err.message);
    }
  };

  // Lock Registration & Prune Unverified Registrations (Requirement 4)
  const handleLockRegistration = async (tournId: string) => {
    if (!confirm(
      'Are you sure you want to LOCK REGISTRATION for this tournament?\n\n- Registration will be closed.\n- All unpaid/unverified entries will be permanently removed.\n- The verified player pool will be finalized.'
    )) return;

    try {
      const res = await registrationService.lockRegistrationAndPruneUnverified(
        tournId,
        currentUser?.uid || 'admin',
        currentUser?.email || undefined
      );
      success(
        'Registration Locked!',
        `Confirmed ${res.verifiedCount} verified players. Removed ${res.prunedCount} unverified entries.`
      );
      loadData();
    } catch (err: any) {
      error('Lock Error', err.message);
    }
  };

  // Generate Knockout Bracket (Requirements 6 & 16)
  const handleGenerateBracket = async (tournId: string) => {
    if (!confirm('Generate the official knockout bracket now? This assigns power-of-two pairings and creates all fixtures.')) return;
    try {
      const res = await tournamentService.generateKnockoutBracket(
        tournId,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      success(
        'Knockout Bracket Generated!',
        `Created ${res.matchCount} fixtures across ${res.rounds} rounds with ${res.byesCount} byes.`
      );
      loadData();
    } catch (err: any) {
      error('Bracket Generation Error', err.message);
    }
  };

  // Reset / Rebuild Bracket (Administrative emergency or corrections)
  const handleResetBracket = async (tournId: string) => {
    if (!currentUser) return;
    if (
      !confirm(
        'RESET BRACKET WARNING:\nThis will permanently delete all generated rounds and matches for this tournament, allowing you to cleanly re-generate the bracket.\n\nMatches that have already been played will block the reset unless force is confirmed.\n\nProceed with reset?'
      )
    )
      return;
    try {
      const res = await tournamentService.resetKnockoutBracket(
        tournId,
        currentUser.uid,
        currentUser.email || undefined,
        false
      );
      success(
        'Bracket Reset Complete',
        `Successfully deleted ${res.deletedMatches} matches and ${res.deletedRounds} rounds. Tournament is restored to registration state.`
      );
      loadData();
    } catch (err: any) {
      if (err.message?.includes('already been completed') || err.message?.includes('force=true')) {
        if (
          confirm(
            `${err.message}\n\nDo you want to FORCE reset anyway? This will overwrite existing match results.`
          )
        ) {
          try {
            const forceRes = await tournamentService.resetKnockoutBracket(
              tournId,
              currentUser.uid,
              currentUser.email || undefined,
              true
            );
            success(
              'Force Bracket Reset Complete',
              `Purged ${forceRes.deletedMatches} matches and ${forceRes.deletedRounds} rounds.`
            );
            loadData();
          } catch (fErr: any) {
            error('Force Reset Failed', fErr.message);
          }
        }
      } else {
        error('Reset Error', err.message);
      }
    }
  };

  // Handle Create Tournament (Requirement 1)
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tournamentService.createTournament({
        weekNumber: Number(newWeekNumber),
        name: newTournName,
        entryFee: Number(newEntryFee),
        maxPlayers: newMaxPlayers ? Number(newMaxPlayers) : undefined,
        status: 'REGISTRATION_OPEN',
        adminUid: currentUser?.uid,
        adminEmail: currentUser?.email || '',
      });
      success('Tournament Created', `${newTournName} is now published and open for registrations.`);
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      error('Creation Failed', err.message);
    }
  };

  // Handle Resolve Dispute (Requirement 13)
  const handleResolveDispute = async (dispute: DisputeRecord) => {
    if (!currentUser) return;
    const homeScoreStr = prompt('Enter official Home score:', '3');
    if (homeScoreStr === null) return;
    const awayScoreStr = prompt('Enter official Away score:', '1');
    if (awayScoreStr === null) return;
    const resolution = prompt('Admin resolution notes:', 'Verified match evidence with both players') || 'Resolved by admin';

    try {
      await matchService.resolveDispute(
        dispute.id,
        dispute.matchId,
        Number(homeScoreStr),
        Number(awayScoreStr),
        currentUser.uid,
        resolution
      );
      success('Dispute Resolved', 'Match confirmed and winner advanced. Evidence screenshot purged.');
      loadData();
    } catch (err: any) {
      error('Failed to resolve dispute', err.message);
    }
  };

  // Admin: Flag Payment as suspected duplicate (PART AA)
  const handleFlagDuplicatePayment = async (paymentId: string) => {
    if (!currentUser) return;
    try {
      await registrationService.flagDuplicatePayment(
        paymentId,
        currentUser.uid,
        currentUser.email || undefined
      );
      success('Payment Flagged', 'Payment marked as a suspected duplicate transaction.');
      loadData();
    } catch (err: any) {
      error('Flag Error', err.message);
    }
  };

  // Open Manual Payout Modal (PART T)
  const handleOpenPayoutModal = (prize: PrizeRecord) => {
    setPayoutModalPrize(prize);
    setPayoutMpesaCode('');
    setPayoutPhone(prize.payoutPhone || '');
  };

  // Submit Manual Payout Record (PART T)
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalPrize || !currentUser) return;

    const trimmedCode = payoutMpesaCode.trim().toUpperCase();
    const trimmedPhone = payoutPhone.trim();

    if (trimmedCode.length < 8) {
      error('Invalid Code', 'Please enter a valid M-Pesa transaction reference (min 8 chars).');
      return;
    }
    if (trimmedPhone.length < 9) {
      error('Invalid Phone', 'Please enter a valid recipient phone number.');
      return;
    }

    setPayoutSubmitting(true);
    try {
      await championService.recordManualPayout({
        prizeId: payoutModalPrize.id,
        mpesaCode: trimmedCode,
        mpesaPhone: trimmedPhone,
        adminUid: currentUser.uid,
        adminEmail: currentUser.email || undefined,
      });
      success('Payout Recorded', `KSh 1,000 champion prize payout successfully confirmed via M-Pesa ${trimmedCode}.`);
      setPayoutModalPrize(null);
      loadData();
    } catch (err: any) {
      error('Payout Error', err.message);
    } finally {
      setPayoutSubmitting(false);
    }
  };

  // Admin: Retry screenshot storage cleanup (PART M & AI)
  const handleRetryCleanup = async (evidenceId: string) => {
    try {
      const res = await storageService.retryCleanup(evidenceId, currentUser?.uid || 'admin');
      if (res.success) {
        success('Storage Purged', 'Screenshot successfully purged from Firebase Storage.');
      } else {
        error('Purge Failed', res.error || 'Could not purge screenshot.');
      }
      loadData();
    } catch (err: any) {
      error('Cleanup Error', err.message);
    }
  };

  // Initialize Official Weekly Tournaments (Clean - No fake users, no fake matches)
  const handleSeedRealTournament = async () => {
    if (!confirm('Initialize official weekly tournament structures for Week 01 and Week 02?')) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);

      // Week 1
      const week1Ref = doc(db, 'tournaments', 'week-01');
      const week1Data: Tournament = {
        id: 'week-01',
        weekNumber: 1,
        name: 'CHUKA eFOOTBALL WEEK 01',
        registrationOpenDate: new Date(Date.now() - 86400000 * 7).toISOString(),
        registrationCloseDate: new Date(Date.now() - 86400000 * 3).toISOString(),
        verificationDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        startDate: new Date(Date.now() - 86400000 * 1).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 4).toISOString(),
        entryFee: 20,
        registeredCount: 0,
        verifiedCount: 0,
        status: 'REGISTRATION_OPEN',
        currentRound: 'Registration Open',
        totalRounds: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      batch.set(week1Ref, week1Data, { merge: true });

      // Week 2
      const week2Ref = doc(db, 'tournaments', 'week-02');
      batch.set(week2Ref, {
        id: 'week-02',
        weekNumber: 2,
        name: 'CHUKA eFOOTBALL WEEK 02',
        registrationOpenDate: new Date().toISOString(),
        registrationCloseDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        verificationDate: new Date(Date.now() + 86400000 * 4).toISOString(),
        startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 9).toISOString(),
        entryFee: 20,
        registeredCount: 0,
        verifiedCount: 0,
        status: 'UPCOMING',
        currentRound: 'Upcoming',
        totalRounds: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await batch.commit();
      success('Official Tournaments Initialized', 'Week 01 and Week 02 schedule published.');
      loadData();
    } catch (err: any) {
      error('Init Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingPayments = payments.filter((p) => p.status === 'PENDING');
  const openDisputes = disputes.filter((d) => d.status === 'OPEN');
  const tournamentScopedPayments = selectedTournamentId
    ? payments.filter((p) => p.tournamentId === selectedTournamentId)
    : payments;
  const filteredPayments = tournamentScopedPayments.filter((p) => {
    if (paymentFilter === 'PENDING') return p.status === 'PENDING';
    if (paymentFilter === 'VERIFIED') return p.status === 'VERIFIED';
    if (paymentFilter === 'REJECTED') return p.status === 'REJECTED';
    if (paymentFilter === 'DUPLICATES') return Boolean(p.isSuspectedDuplicate);
    return true;
  });

  return (
    <div id="admin-panel-container" className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-950/50 via-[#180d07] to-black border border-orange-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-xl text-white uppercase tracking-wide">
                Tournament Command Center
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white">
                Admin
              </span>
            </div>
            <p className="text-xs text-white/60">
              Chuka University eFootball Operations &amp; Verification Desk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            id="btn-admin-seed-database"
            onClick={handleSeedRealTournament}
            disabled={loading}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Seed Week 1 &amp; 2</span>
          </button>

          <button
            id="btn-admin-new-tournament"
            onClick={() => setShowCreateModal(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-orange-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Week</span>
          </button>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
        {[
          {
            id: 'COMMAND_CENTER',
            label: 'Command Center',
            icon: ShieldAlert,
            badge: 'LIVE',
          },
          { id: 'OVERVIEW', label: 'Legacy Overview', icon: Trophy },
          {
            id: 'USERS',
            label: 'Users & Sync',
            icon: Users,
            badge: adminUsers.length || undefined,
          },
          {
            id: 'VERIFICATION_DAY',
            label: 'Verification Day',
            icon: CreditCard,
            badge: pendingPayments.length,
          },
          {
            id: 'PRIZES_FINANCES',
            label: 'Prizes & Treasury',
            icon: DollarSign,
            badge: prizes.filter((p) => p.status !== 'PAID').length,
          },
          { id: 'TOURNAMENTS', label: 'Tournaments', icon: Calendar, badge: tournaments.length },
          { id: 'MATCHES', label: 'Match Manager', icon: Swords },
          { id: 'DISPUTES', label: 'Dispute Desk', icon: AlertOctagon, badge: openDisputes.length },
          { id: 'AUDIT_LOGS', label: 'Audit Trail', icon: History },
          {
            id: 'GOOGLE_SHEETS',
            label: 'Google Sheets',
            icon: FileSpreadsheet,
            badge: sheetsConfig?.failedCount ? `${sheetsConfig.failedCount} ERR` : undefined,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                isActive
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {Boolean(tab.badge) && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-black/30 text-white' : 'bg-orange-500/30 text-orange-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: COMMAND CENTER */}
      {activeTab === 'COMMAND_CENTER' && (
        <div id="command-center-wrapper" className="pt-2">
          <TournamentCommandCenter />
        </div>
      )}

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0d140e] border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                Weekly Tournaments
              </div>
              <div className="font-heading font-black text-3xl text-emerald-400 mt-1">
                {tournaments.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#0d140e] border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                Pending Verification
              </div>
              <div className="font-heading font-black text-3xl text-orange-400 mt-1">
                {pendingPayments.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#0d140e] border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                Open Disputes
              </div>
              <div className="font-heading font-black text-3xl text-red-400 mt-1">
                {openDisputes.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#0d140e] border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                Total Payments
              </div>
              <div className="font-heading font-black text-3xl text-amber-400 mt-1">
                {payments.length}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 9: GOOGLE SHEETS ADMIN STATUS CARD                                  */}
          {/* ========================================================================= */}
          <div id="admin-google-sheets-card" className="p-5 rounded-2xl bg-gradient-to-r from-[#071d12] via-[#09150d] to-black border border-emerald-500/40 space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-white uppercase tracking-wider">
                    Google Sheets
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className="text-white/60 font-medium">Status:</span>
                    {sheetsConnectionStatus === 'CONNECTED' ? (
                      <span className="font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        CONNECTED
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-red-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        OFFLINE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">
                    <span>Last synchronization: </span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      {sheetsConfig?.lastSuccessfulSync
                        ? new Date(sheetsConfig.lastSuccessfulSync).toLocaleString()
                        : 'Never synchronized'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-admin-overview-test-connection"
                  type="button"
                  onClick={() => handleTestSheetsConnection()}
                  disabled={sheetsTesting}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sheetsTesting ? 'animate-spin' : ''}`} />
                  <span>{sheetsTesting ? 'Testing...' : '[ TEST CONNECTION ]'}</span>
                </button>
                <button
                  id="btn-admin-overview-sync-data"
                  type="button"
                  onClick={handleSyncSheetsNow}
                  disabled={sheetsSyncing}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-heading font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sheetsSyncing ? 'animate-spin' : ''}`} />
                  <span>{sheetsSyncing ? 'Syncing...' : '[ SYNC DATA ]'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('GOOGLE_SHEETS')}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Configure →
                </button>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-white/50 text-[10px] uppercase font-bold block">LAST SYNCHRONIZATION</span>
                <span className="font-mono text-emerald-400 font-bold text-xs mt-0.5 block">
                  {sheetsConfig?.lastSuccessfulSync
                    ? new Date(sheetsConfig.lastSuccessfulSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
                      ' (' +
                      new Date(sheetsConfig.lastSuccessfulSync).toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                      ')'
                    : 'Never synced'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-white/50 text-[10px] uppercase font-bold block">PENDING SYNC COUNT</span>
                <span className="font-mono text-amber-400 font-bold text-xs mt-0.5 block">
                  {sheetsConfig?.pendingCount || 0} records
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-white/50 text-[10px] uppercase font-bold block">FAILED SYNC COUNT</span>
                <span className="font-mono text-red-400 font-bold text-xs mt-0.5 block">
                  {sheetsConfig?.failedCount || 0} failed
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-white/50 text-[10px] uppercase font-bold block">AUTHORITATIVE CORE</span>
                <span className="font-mono text-emerald-300 font-bold text-xs mt-0.5 block">
                  Firebase (Live)
                </span>
              </div>
            </div>

            {/* Error banner if last sync had an issue */}
            {sheetsConfig?.lastError && (
              <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span><strong>Last Error:</strong> {sheetsConfig.lastError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncSheetsNow}
                  className="px-2 py-0.5 rounded bg-red-500/30 hover:bg-red-500/40 text-red-200 text-[10px] font-bold uppercase shrink-0"
                >
                  Retry Now
                </button>
              </div>
            )}
          </div>

          {/* Treasury & Financial Snapshot (PART AB) */}
          {financialMetrics && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0c1810] to-[#060c08] border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-heading font-black uppercase text-emerald-400 tracking-wide">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Chuka Tournament Treasury &amp; Revenue Overview</span>
                </div>
                <button
                  onClick={() => setActiveTab('PRIZES_FINANCES')}
                  className="text-xs font-bold text-emerald-400 hover:underline"
                >
                  Manage Payouts &amp; Finances →
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/5">
                  <span className="text-white/50 text-[10px] uppercase font-mono">
                    Verified Players
                  </span>
                  <div className="font-heading font-black text-xl text-white mt-1">
                    {financialMetrics.totalVerifiedPlayers}
                  </div>
                  <span className="text-[10px] text-white/40">
                    @ KSh {financialMetrics.entryFee} / player
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-white/5">
                  <span className="text-white/50 text-[10px] uppercase font-mono">
                    Total Verified Revenue
                  </span>
                  <div className="font-heading font-black text-xl text-emerald-400 mt-1 font-mono">
                    KSh {financialMetrics.totalVerifiedRevenue}
                  </div>
                  <span className="text-[10px] text-white/40">Real M-Pesa verified</span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-white/5">
                  <span className="text-white/50 text-[10px] uppercase font-mono">
                    Weekly Prize Allocation
                  </span>
                  <div className="font-heading font-black text-xl text-amber-300 mt-1 font-mono">
                    KSh {financialMetrics.prizePoolAllocation}
                  </div>
                  <span className="text-[10px] text-white/40">Champion cash prize</span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-white/5">
                  <span className="text-white/50 text-[10px] uppercase font-mono">
                    Net Balance
                  </span>
                  <div
                    className={`font-heading font-black text-xl mt-1 font-mono ${
                      financialMetrics.universityBalance >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    KSh {financialMetrics.universityBalance}
                  </div>
                  <span className="text-[10px] text-white/40">Revenue minus Prize Pool</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action: Pending payments card */}
          {pendingPayments.length > 0 && (
            <div className="p-5 rounded-2xl bg-orange-950/20 border border-orange-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold uppercase text-orange-300">
                  <CreditCard className="w-4 h-4" />
                  <span>{pendingPayments.length} M-Pesa Payments Waiting For Verification</span>
                </div>
                <button
                  onClick={() => setActiveTab('VERIFICATION_DAY')}
                  className="text-xs font-bold text-orange-400 hover:underline"
                >
                  Open Verification Desk →
                </button>
              </div>
              <p className="text-xs text-white/60">
                Review M-Pesa transaction reference codes from registered players before locking
                brackets.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: USERS DIRECTORY & SHEETS SYNCHRONIZATION STATUS (Requirement 13) */}
      {activeTab === 'USERS' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-6 rounded-2xl bg-[#09150d] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-xl text-white uppercase tracking-wider">
                    Authoritative User Directory
                  </h3>
                  <p className="text-xs text-white/60">
                    Firebase Firestore users synchronized to the Google Sheets operational reporting copy.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAdminUsers}
                disabled={loadingUsers}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleSyncAllUsers}
                disabled={loadingUsers || adminUsers.length === 0}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] text-xs font-heading font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>Sync All to Sheets</span>
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 shadow-xl">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="bg-white/5 uppercase font-bold text-[10px] tracking-wider text-white/50 border-b border-white/10">
                <tr>
                  <th className="p-3">Player ID</th>
                  <th className="p-3">Display Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Firebase User</th>
                  <th className="p-3">Sheets Sync</th>
                  <th className="p-3">Last Login</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {adminUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/40 font-sans">
                      {loadingUsers ? 'Loading registered users...' : 'No users registered yet.'}
                    </td>
                  </tr>
                ) : (
                  adminUsers.map((u) => {
                    const isSynced = u.sheetsSyncStatus === 'SYNCED';
                    const isFailed = u.sheetsSyncStatus === 'FAILED';
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 font-bold text-orange-400">
                          {u.userId || u.playerId}
                        </td>
                        <td className="p-3 font-sans font-medium text-white flex items-center gap-2">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-6 h-6 rounded-full border border-white/20" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                              {(u.displayName || 'P').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span>{u.displayName}</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'ADMIN' || u.isAdmin
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-white/10 text-white/70 border border-white/10'
                            }`}
                          >
                            {u.role || (u.isAdmin ? 'ADMIN' : 'PLAYER')}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>EXISTS</span>
                          </span>
                        </td>
                        <td className="p-3">
                          {isSynced ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" title={u.sheetsSyncedAt ? `Synced at ${new Date(u.sheetsSyncedAt).toLocaleString()}` : 'Synchronized'}>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>SYNCED</span>
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30" title={u.sheetsSyncError || 'Sync failed'}>
                              <XCircle className="w-3 h-3 text-red-400" />
                              <span>FAILED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>PENDING</span>
                            </span>
                          )}
                          {u.sheetsSyncError && (
                            <div className="text-[9px] text-red-400/80 font-sans truncate max-w-xs mt-0.5">
                              {u.sheetsSyncError}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-white/50 text-[11px]">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSyncIndividualUser(u.id, u.displayName)}
                            disabled={syncingUserId === u.id}
                            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingUserId === u.id ? 'animate-spin' : ''}`} />
                            <span>Sync</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: VERIFICATION DAY (Requirement 4) */}
      {activeTab === 'VERIFICATION_DAY' && (
        <div className="space-y-6">
          {/* Tournament Selector for Verification */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0a110d] border border-white/10">
            <div>
              <label className="block text-[11px] font-mono uppercase text-white/50 font-bold mb-1">
                Select Weekly Tournament for Verification
              </label>
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black border border-emerald-500/30 text-white font-bold text-xs"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {selectedTourn && (
              <div className="flex items-center gap-2">
                {selectedTourn.status !== 'LIVE' && selectedTourn.status !== 'COMPLETED' && (
                  <>
                    <button
                      id="btn-admin-lock-reg"
                      onClick={() => handleLockRegistration(selectedTourn.id)}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>[ LOCK REGISTRATION ]</span>
                    </button>

                    <button
                      id="btn-admin-generate-bracket"
                      onClick={() => handleGenerateBracket(selectedTourn.id)}
                      className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>[ GENERATE KNOCKOUT BRACKET ]</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Verification Day Metrics Dashboard (Requirement 4) */}
          {verificationMetrics && selectedTourn && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-black/60 border border-white/10">
                <div className="text-[10px] uppercase font-bold text-white/50">Total Registrations</div>
                <div className="font-heading font-black text-2xl text-white mt-1">
                  {verificationMetrics.totalRegistrations}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/60 border border-amber-500/30">
                <div className="text-[10px] uppercase font-bold text-amber-300">Pending Payments</div>
                <div className="font-heading font-black text-2xl text-amber-400 mt-1">
                  {verificationMetrics.paymentsPending}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30">
                <div className="text-[10px] uppercase font-bold text-emerald-300">Verified Players</div>
                <div className="font-heading font-black text-2xl text-emerald-400 mt-1">
                  {verificationMetrics.totalVerifiedPlayers}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/60 border border-red-500/30">
                <div className="text-[10px] uppercase font-bold text-red-300">Rejected Payments</div>
                <div className="font-heading font-black text-2xl text-red-400 mt-1">
                  {verificationMetrics.paymentsRejected}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/60 border border-white/10">
                <div className="text-[10px] uppercase font-bold text-white/50">Expected Revenue</div>
                <div className="font-heading font-black text-2xl text-amber-300 font-mono mt-1">
                  KSh {verificationMetrics.totalVerifiedPlayers * selectedTourn.entryFee}
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Codes Warning */}
          {verificationMetrics && verificationMetrics.duplicateCodes.length > 0 && (
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Warning: Duplicate M-Pesa transaction codes detected:</strong>{' '}
                {verificationMetrics.duplicateCodes.join(', ')}. Ensure each code corresponds to an authentic transaction.
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: 'All Payments', count: tournamentScopedPayments.length },
              {
                id: 'PENDING',
                label: 'Pending',
                count: tournamentScopedPayments.filter((p) => p.status === 'PENDING').length,
              },
              {
                id: 'VERIFIED',
                label: 'Verified',
                count: tournamentScopedPayments.filter((p) => p.status === 'VERIFIED').length,
              },
              {
                id: 'REJECTED',
                label: 'Rejected',
                count: tournamentScopedPayments.filter((p) => p.status === 'REJECTED').length,
              },
              {
                id: 'DUPLICATES',
                label: 'Suspected Duplicates',
                count: tournamentScopedPayments.filter((p) => p.isSuspectedDuplicate).length,
              },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setPaymentFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  paymentFilter === f.id
                    ? 'bg-orange-500 text-white shadow'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    paymentFilter === f.id
                      ? 'bg-black/30 text-white'
                      : f.id === 'DUPLICATES' && f.count > 0
                      ? 'bg-red-500/30 text-red-300 font-bold'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Verification Table (Requirement 4 & Production Payment Verification) */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">
                <tr>
                  <th className="p-3">Tournament</th>
                  <th className="p-3">Registration</th>
                  <th className="p-3">Player ID</th>
                  <th className="p-3">Player Name</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">M-Pesa Code</th>
                  <th className="p-3">M-Pesa Phone</th>
                  <th className="p-3">Submission Time</th>
                  <th className="p-3">Duplicate Flag</th>
                  <th className="p-3">Current Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-xs text-white/40">
                      No registrations or payments found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const isDup = Boolean(p.duplicateFlag || p.isSuspectedDuplicate);
                    const code = p.mpesaTransactionCode || p.mpesaCode || 'N/A';
                    const regId = p.registrationId || `${p.tournamentId}_${p.userId}`;

                    return (
                      <tr key={p.id} className={`hover:bg-white/[0.02] ${isDup ? 'bg-red-950/10' : ''}`}>
                        <td className="p-3 font-mono font-bold text-white/70">
                          {p.tournamentName || p.tournamentId}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-white/50 truncate max-w-[120px]" title={regId}>
                          {regId}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {p.playerId}
                        </td>
                        <td className="p-3 font-bold text-white">
                          {p.playerDisplayName}
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-300">
                          KSh {p.amount || 20}
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-black text-amber-400 tracking-wider">
                            {code}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-white/70">
                          {p.mpesaPhone || 'N/A'}
                        </td>
                        <td className="p-3 text-white/50 font-mono text-[11px] whitespace-nowrap">
                          {new Date(p.submittedAt || p.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">
                          {isDup ? (
                            <span className="px-2 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                              <span>DUPLICATE / REVIEW REQUIRED</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/40 font-mono">No</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              p.status === 'VERIFIED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : p.status === 'REJECTED'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === 'PENDING' ? (
                              <>
                                <button
                                  onClick={() => handleVerifyPayment(p.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                  [ APPROVE PAYMENT ]
                                </button>
                                <button
                                  onClick={() => handleRejectPayment(p.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                  [ REJECT PAYMENT ]
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-white/40 mr-1 font-mono">
                                {p.status === 'VERIFIED' ? '✓ APPROVED' : '✗ REJECTED'}
                              </span>
                            )}

                            {!isDup && (
                              <button
                                onClick={() => handleFlagDuplicatePayment(p.id)}
                                title="Flag this M-Pesa code as suspected duplicate"
                                className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1"
                              >
                                <Flag className="w-2.5 h-2.5" />
                                <span>Flag Dup</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PRIZES & TREASURY (PART T & AB & AI) */}
      {activeTab === 'PRIZES_FINANCES' && (
        <div className="space-y-6">
          {/* Treasury Ledger Banner */}
          <div className="p-6 rounded-2xl bg-[#0a110d] border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Chuka eFootball Weekly Financial Ledger</span>
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Official Entry Fees (KSh {TOURNAMENT_DEFAULTS.ENTRY_FEE}), Cash Prize (KSh{' '}
                  {TOURNAMENT_DEFAULTS.CHAMPION_PRIZE.toLocaleString()}) &amp; M-Pesa Treasury:
                  <span className="font-mono text-emerald-400 ml-1 font-bold">
                    {TOURNAMENT_DEFAULTS.PAYMENT_DESTINATION}
                  </span>{' '}
                  ({TOURNAMENT_DEFAULTS.ORGANIZER_NAME})
                </p>
              </div>
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold uppercase transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Ledger</span>
              </button>
            </div>

            {/* Financial Metrics Cards */}
            {financialMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-black/60 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-white/50">Verified Entries</span>
                  <div className="font-heading font-black text-2xl text-white mt-1">
                    {financialMetrics.totalVerifiedPlayers}
                  </div>
                  <span className="text-[10px] text-white/40">
                    @ KSh {financialMetrics.entryFee} / player
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    Gross Entry Revenue
                  </span>
                  <div className="font-heading font-black text-2xl text-emerald-400 mt-1 font-mono">
                    KSh {financialMetrics.totalVerifiedRevenue}
                  </div>
                  <span className="text-[10px] text-white/40">Collected via M-Pesa</span>
                </div>

                <div className="p-4 rounded-xl bg-black/60 border border-amber-500/30">
                  <span className="text-[10px] uppercase font-bold text-amber-300">
                    Champion Prize Pool
                  </span>
                  <div className="font-heading font-black text-2xl text-amber-300 mt-1 font-mono">
                    KSh {financialMetrics.prizePoolAllocation}
                  </div>
                  <span className="text-[10px] text-white/40">Guaranteed weekly payout</span>
                </div>

                <div className="p-4 rounded-xl bg-black/60 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-white/50">Net Balance</span>
                  <div
                    className={`font-heading font-black text-2xl mt-1 font-mono ${
                      financialMetrics.universityBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    KSh {financialMetrics.universityBalance}
                  </div>
                  <span className="text-[10px] text-white/40">Revenue less Prize Pool</span>
                </div>
              </div>
            )}
          </div>

          {/* Weekly Champion Prize Awards Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-heading font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Weekly Champion Prizes (KSh 1,000 Each)</span>
                </h4>
                <p className="text-xs text-white/60">
                  Prizes awarded to official tournament champions. Use manual payout recording after sending M-Pesa.
                </p>
              </div>
              <span className="text-xs text-white/50 font-mono">{prizes.length} prize records</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">
                  <tr>
                    <th className="p-3">Tournament</th>
                    <th className="p-3">Champion Player</th>
                    <th className="p-3">Prize Amount</th>
                    <th className="p-3">Payout Phone</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">M-Pesa Reference</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {prizes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-white/40">
                        No champion prize records yet. When a weekly tournament reaches completion, the champion prize is automatically generated.
                      </td>
                    </tr>
                  ) : (
                    prizes.map((pz) => (
                      <tr key={pz.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-white">
                          <div>{pz.tournamentName || pz.tournamentId}</div>
                          <div className="text-[10px] text-white/40 font-mono">Week {pz.weekNumber}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-amber-300">{pz.championName}</div>
                          <div className="text-[10px] text-emerald-400 font-mono">{pz.championPlayerId}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                          KSh {pz.amount.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-white/70">{pz.payoutPhone || 'Pending player update'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              pz.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : pz.status === 'FAILED'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30'
                            }`}
                          >
                            {pz.status === 'PAID' ? 'PAID OUT' : 'PENDING PAYOUT'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {pz.mpesaTransactionCode ? (
                            <div>
                              <span className="font-bold text-emerald-400">{pz.mpesaTransactionCode}</span>
                              {pz.paidAt && (
                                <div className="text-[9px] text-white/40">
                                  {new Date(pz.paidAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/30 italic">Not disbursed yet</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {pz.status !== 'PAID' ? (
                            <button
                              onClick={() => handleOpenPayoutModal(pz)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 ml-auto shadow-sm"
                            >
                              <Check className="w-3 h-3" />
                              <span>Record M-Pesa Payout</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Disbursed</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Screenshot & Evidence Storage Cleanup Desk (PART M & AI) */}
          <div className="p-6 rounded-2xl bg-[#0a110d] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  <span>Evidence Screenshot Lifecycle &amp; Cleanup Desk</span>
                </h4>
                <p className="text-xs text-white/60">
                  Match evidence screenshots are automatically purged from Firebase Storage after confirmation to preserve storage limits.
                </p>
              </div>
              <span className="text-xs font-mono text-white/50">
                {failedCleanups.length} pending purge retries
              </span>
            </div>

            {failedCleanups.length === 0 ? (
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-emerald-400/80 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All match evidence screenshot storage cleanups are up-to-date. Zero orphaned files detected.</span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-red-500/20 bg-black/40">
                <table className="w-full text-left text-xs text-white/80">
                  <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">
                    <tr>
                      <th className="p-3">Evidence ID</th>
                      <th className="p-3">Match ID</th>
                      <th className="p-3">Storage Path</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {failedCleanups.map((ev) => (
                      <tr key={ev.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-mono text-white/70">{ev.id}</td>
                        <td className="p-3 font-mono text-amber-400">{ev.matchId}</td>
                        <td className="p-3 font-mono text-xs text-white/50 truncate max-w-xs">{ev.storagePath}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleRetryCleanup(ev.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 ml-auto"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry Purge</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: TOURNAMENTS */}
      {activeTab === 'TOURNAMENTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-xl bg-[#0a110d] border border-white/10 hover:border-emerald-500/30 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400 font-bold uppercase">
                    Week {t.weekNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      t.status === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                        : t.status === 'REGISTRATION_OPEN'
                        ? 'bg-orange-500/20 text-orange-400'
                        : t.status === 'VERIFICATION'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="font-heading font-black text-lg text-white">{t.name}</h3>

                <div className="grid grid-cols-2 gap-2 text-xs text-white/60 py-2 border-y border-white/5 font-mono">
                  <div>Registered: <strong className="text-white">{t.registeredCount}</strong></div>
                  <div>Verified: <strong className="text-emerald-400">{t.verifiedCount}</strong></div>
                  <div>Entry Fee: <strong className="text-amber-400">KSh {t.entryFee}</strong></div>
                  <div>Current Round: <strong className="text-white">{t.currentRound || 'N/A'}</strong></div>
                </div>

                {/* Status action buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {t.status === 'REGISTRATION_OPEN' && (
                    <button
                      onClick={() => handleLockRegistration(t.id)}
                      className="flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30"
                    >
                      Lock &amp; Prune
                    </button>
                  )}

                  {(t.status === 'REGISTRATION_OPEN' || t.status === 'VERIFICATION') && (
                    <button
                      onClick={() => handleGenerateBracket(t.id)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Generate Bracket</span>
                    </button>
                  )}

                  {t.status === 'LIVE' && (
                    <>
                      <button
                        onClick={() => handleResetBracket(t.id)}
                        className="py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider border border-red-500/30 flex items-center justify-center gap-1"
                        title="Reset bracket fixtures to allow regeneration"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Bracket</span>
                      </button>
                      <button
                        onClick={() => tournamentService.updateTournamentStatus(t.id, 'COMPLETED').then(loadData)}
                        className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider"
                      >
                        Mark Completed
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: MATCHES */}
      {activeTab === 'MATCHES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider">
              Fixtures &amp; Room Coordination
            </h3>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs font-semibold"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matches.map((m) => (
              <div key={m.id} className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                  <span className="text-emerald-400 font-bold">{m.matchId}</span>
                  <span className="text-amber-400 font-bold">{m.roundName}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white">{m.status}</span>
                </div>

                <div className="flex items-center justify-between text-sm py-1 font-semibold">
                  <span className={m.winnerId === m.homePlayerId ? 'text-emerald-400 font-bold' : 'text-white'}>
                    {m.homePlayerName}
                  </span>
                  <span className="font-mono text-base font-bold text-amber-400">
                    {m.homeScore ?? '-'} : {m.awayScore ?? '-'}
                  </span>
                  <span className={m.winnerId === m.awayPlayerId ? 'text-emerald-400 font-bold' : 'text-white'}>
                    {m.awayPlayerName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-white/50">
                  <span>Room Status: <strong className="font-mono text-amber-300">{m.roomStatus || (m.status === 'SCHEDULED' ? 'Pending' : m.status)}</strong></span>
                  {m.winnerId && <span className="text-emerald-400 text-[10px] font-bold">Winner: {m.winnerId}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: DISPUTES */}
      {activeTab === 'DISPUTES' && (
        <div className="space-y-4">
          <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider">
            Match Disputes &amp; Resolution Desk
          </h3>

          {disputes.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/10 text-white/50 text-xs">
              No reported disputes currently. All matches proceeding normally.
            </div>
          ) : (
            <div className="space-y-3">
              {disputes.map((d) => (
                <div key={d.id} className="p-5 rounded-xl bg-red-950/20 border border-red-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-red-400">Match: {d.matchId}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-300">
                      {d.status}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-white">Reason: {d.reason.replace('_', ' ')}</div>
                    <p className="text-xs text-white/70 mt-1 italic">"{d.notes}"</p>
                    <div className="text-[10px] text-white/40 mt-1">
                      Reported by {d.reportedByName} ({d.reportedPlayerId}) on {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {d.status === 'OPEN' && (
                    <button
                      onClick={() => handleResolveDispute(d)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider"
                    >
                      Resolve Dispute &amp; Advance Winner
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS (Requirement 22) */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider">
              Immutable System &amp; Administrative Audit Ledger
            </h3>
            <span className="text-xs text-white/50">{auditLogs.length} events loaded</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Tournament / Match</th>
                  <th className="p-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-white/40">
                      No audit events logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-mono text-[11px] text-white/50">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400 text-xs">
                        {log.action}
                      </td>
                      <td className="p-3 text-white/70">
                        <div>{log.actorEmail || log.actor}</div>
                      </td>
                      <td className="p-3 font-mono text-emerald-400 text-[11px]">
                        {log.tournamentId || log.matchId || '-'}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-white/50 max-w-xs truncate">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT: GOOGLE SHEETS DATABASE CONNECTION (PART 3)                    */}
      {/* ========================================================================= */}
      {activeTab === 'GOOGLE_SHEETS' && (
        <div className="space-y-6">
          {/* Header & Status Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#071d12] via-[#09150d] to-black border border-emerald-500/40 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-black text-xl text-white uppercase tracking-wider">
                      Google Sheets Database Connection
                    </h3>
                    {sheetsTestResult?.success || (sheetsConfig?.lastSuccessfulSync && !sheetsConfig?.lastError) ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-mono font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>🟢 CONNECTED</span>
                      </span>
                    ) : sheetsConfig?.lastError || (sheetsTestResult && !sheetsTestResult.success) ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/40 text-[11px] font-mono font-bold">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span>🔴 CONNECTION ERROR</span>
                      </span>
                    ) : sheetsConfig?.pendingCount && sheetsConfig.pendingCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] font-mono font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span>🟡 SYNC PENDING</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/20 text-[11px] font-mono font-bold">
                        <span>⚪ NOT CONFIGURED</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Synchronize real tournaments, verified player rosters, match outcomes, and M-Pesa disbursements to Google Sheets.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestSheetsConnection()}
                  disabled={sheetsTesting}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sheetsTesting ? 'animate-spin' : ''}`} />
                  <span>{sheetsTesting ? 'Testing...' : '[ TEST CONNECTION ]'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRetryFailedSheets}
                  disabled={sheetsSyncing}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sheetsSyncing ? 'animate-spin' : ''}`} />
                  <span>[ RETRY FAILED ]</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncSheetsNow}
                  disabled={sheetsSyncing}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] text-xs font-heading font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sheetsSyncing ? 'animate-spin' : ''}`} />
                  <span>{sheetsSyncing ? 'Syncing...' : '[ SYNC DATA ]'}</span>
                </button>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10">
                <span className="text-white/50 text-[10px] uppercase font-bold block">
                  Last Successful Sync
                </span>
                <div className="font-mono text-emerald-400 font-bold text-sm mt-1">
                  {sheetsConfig?.lastSuccessfulSync
                    ? new Date(sheetsConfig.lastSuccessfulSync).toLocaleString()
                    : 'Never synced'}
                </div>
                <span className="text-[10px] text-white/40">Idempotent record append</span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10">
                <span className="text-white/50 text-[10px] uppercase font-bold block">
                  Pending Sync Count
                </span>
                <div className="font-mono text-amber-400 font-bold text-sm mt-1">
                  {sheetsConfig?.pendingCount || 0}
                </div>
                <span className="text-[10px] text-white/40">Records queued</span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10">
                <span className="text-white/50 text-[10px] uppercase font-bold block">
                  Failed Sync Count
                </span>
                <div className="font-mono text-red-400 font-bold text-sm mt-1">
                  {sheetsConfig?.failedCount || 0}
                </div>
                <span className="text-[10px] text-white/40">Failed transmissions</span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10">
                <span className="text-white/50 text-[10px] uppercase font-bold block">
                  Live Authority Core
                </span>
                <div className="font-mono text-emerald-300 font-bold text-sm mt-1">
                  Firebase Firestore
                </div>
                <span className="text-[10px] text-white/40">Sheets offline will not halt games</span>
              </div>
            </div>

            {/* Direct Architecture & Environment Status */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-white/80 font-bold">Deployment Architecture:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  GitHub Pages → Apps Script Web App (/exec)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-white/50">
                <span>
                  ENV Web App URL:{' '}
                  <strong className={sheetsConfig?.hasEnvWebhook ? 'text-emerald-400' : 'text-white/40'}>
                    {sheetsConfig?.hasEnvWebhook ? 'DETECTED' : 'CONFIGURED IN UI'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Admin Control:{' '}
                  <strong className="text-emerald-400">
                    FIRESTORE PROTECTED (RBAC)
                  </strong>
                </span>
              </div>
            </div>

            {/* Test result message if available */}
            {sheetsTestResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  sheetsTestResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {sheetsTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>
                    <strong>{sheetsTestResult.success ? 'Success:' : 'Test Failed:'}</strong>{' '}
                    {sheetsTestResult.message}{' '}
                    {sheetsTestResult.latencyMs ? `(${sheetsTestResult.latencyMs}ms latency)` : ''}
                    {sheetsTestResult.error ? ` — ${sheetsTestResult.error}` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Web App URL Configuration Form */}
          <div className="p-6 rounded-2xl bg-black/60 border border-white/10 space-y-4">
            <h4 className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Google Apps Script Web App Endpoint Configuration</span>
            </h4>
            <p className="text-xs text-white/60">
              The static frontend communicates directly with your deployed Google Apps Script Web App (/exec) endpoint. No backend server or proxy is needed for GitHub Pages.
            </p>

            <form onSubmit={handleSaveWebhookUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Google Apps Script Web App URL (starts with https://script.google.com/macros/s/.../exec)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-white font-mono text-xs focus:border-emerald-500 outline-none placeholder:text-white/30"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-white/40 font-mono">
                  Endpoint saved in Firestore settings (admin-only RBAC access).
                </span>
                <button
                  type="submit"
                  disabled={savingWebhook || !webhookUrlInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingWebhook ? 'Saving...' : 'Save & Verify Endpoint'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Setup Guide & 1-Click Code */}
          <div className="p-6 rounded-2xl bg-black/60 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h4 className="font-heading font-black text-sm text-white uppercase tracking-wider">
                  1-Click Google Sheets Integration Setup
                </h4>
                <p className="text-xs text-white/60 mt-0.5">
                  Deploy this Google Apps Script inside your Google Spreadsheet to connect real tournament records directly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyAppsScript}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedScript ? 'Copied ✅' : 'Copy Apps Script Code'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-white/70">
              <li>Open your official Google Sheet (e.g. <strong className="text-white">CHUKA eFOOTBALL LEAGUE OFFICIAL RECORDS</strong>).</li>
              <li>Click on <strong className="text-white">Extensions</strong> → <strong className="text-white">Apps Script</strong>.</li>
              <li>Delete any existing template code in the editor and click <strong className="text-emerald-400">Copy Apps Script Code</strong> above to paste.</li>
              <li>Click <strong className="text-white">Save</strong> (disk icon).</li>
              <li>Select <strong className="text-emerald-400">setupChukaEFootballSheets</strong> from the functions dropdown and click <strong className="text-white">Run</strong>. Authorize permissions when prompted by Google. This automatically generates all 11 operational sheets with headers and frozen rows without erasing any data.</li>
              <li>Click <strong className="text-white">Deploy</strong> → <strong className="text-white">New deployment</strong>.</li>
              <li>Select type <strong className="text-white">Web app</strong>:
                <ul className="list-disc list-inside ml-4 text-white/50 text-[11px] mt-1 space-y-0.5">
                  <li>Execute as: <strong className="text-white">Me (your Google account)</strong></li>
                  <li>Who has access: <strong className="text-white">Anyone</strong> (required for static GitHub Pages frontend fetch)</li>
                </ul>
              </li>
              <li>Click <strong className="text-white">Deploy</strong>, and copy the generated <strong className="text-emerald-400">Web App URL</strong> (ending in <code className="text-emerald-300 font-mono">/exec</code>) into the configuration box above.</li>
              <li>Click <strong className="text-white">[ TEST CONNECTION ]</strong> to verify immediate end-to-end communication!</li>
            </ol>

            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-[11px] text-emerald-300/80 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy &amp; Security Guarantee:</strong> Match room private codes and player WhatsApp numbers are NEVER written to any public spreadsheet. Only official aggregate tournament standings, verified participant rosters, match scores, and financial records are synchronized.
              </span>
            </div>
          </div>

          {/* Sync History Logs Table */}
          <div className="p-6 rounded-2xl bg-black/60 border border-white/10 space-y-4">
            <h4 className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center justify-between">
              <span>Synchronization Audit Trail ({sheetsSyncLogs.length} recent runs)</span>
              <button
                type="button"
                onClick={async () => {
                  const logs = await googleSheetsService.getRecentSyncLogs(20);
                  setSheetsSyncLogs(logs);
                }}
                className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Logs
              </button>
            </h4>

            {sheetsSyncLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40 italic">
                No Google Sheets sync logs recorded yet. Tap [ SYNC ALL NOW ] to run your first synchronization.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 text-white/40 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Triggered By</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Attempt</th>
                      <th className="py-2.5 px-3">Tournaments</th>
                      <th className="py-2.5 px-3">Payments</th>
                      <th className="py-2.5 px-3">Matches</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-3">Details / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {sheetsSyncLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-white/70">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                          <span className="text-[10px] text-white/40">
                            {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white">{log.triggeredBy}</td>
                        <td className="py-2.5 px-3">
                          {log.status === 'SUCCESS' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              SUCCESS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-white/70">#{log.attemptCount || 1}</td>
                        <td className="py-2.5 px-3 text-emerald-300">{log.tournamentsSynced}</td>
                        <td className="py-2.5 px-3 text-amber-300">{log.paymentsSynced}</td>
                        <td className="py-2.5 px-3 text-sky-300">{log.matchesSynced}</td>
                        <td className="py-2.5 px-3 text-white/60">
                          {log.durationMs ? `${log.durationMs}ms` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-white/60 max-w-xs truncate">
                          {log.error || 'Idempotent sync complete'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE TOURNAMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0a110e] border border-orange-500/40 rounded-2xl p-6 space-y-4">
            <h3 className="font-heading font-black text-xl text-white uppercase tracking-wider">
              Create Weekly Tournament
            </h3>
            <form onSubmit={handleCreateTournament} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">Week Number</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newWeekNumber}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 1;
                    setNewWeekNumber(num);
                    const padded = String(num).padStart(2, '0');
                    setNewTournName(`CHUKA eFOOTBALL WEEK ${padded}`);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">Tournament Name</label>
                <input
                  type="text"
                  required
                  value={newTournName}
                  onChange={(e) => setNewTournName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">Entry Fee (KSh)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={newEntryFee}
                  onChange={(e) => setNewEntryFee(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">Player Cap (Optional)</label>
                <input
                  type="number"
                  min={2}
                  placeholder="Unlimited / Dynamic Bracket"
                  value={newMaxPlayers}
                  onChange={(e) => setNewMaxPlayers(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold uppercase"
                >
                  Publish Tournament
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD MANUAL PAYOUT MODAL (PART T & AK) */}
      {payoutModalPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0a110e] border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Official Prize Disbursement
                </span>
                <h3 className="font-heading font-black text-xl text-white uppercase tracking-wider mt-1">
                  Record M-Pesa Payout
                </h3>
              </div>
              <button
                onClick={() => setPayoutModalPrize(null)}
                className="text-white/40 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Champion Details Card */}
            <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Tournament:</span>
                <span className="font-bold text-white">
                  {payoutModalPrize.tournamentName || payoutModalPrize.tournamentId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Champion:</span>
                <span className="font-bold text-amber-300">
                  {payoutModalPrize.championName} ({payoutModalPrize.championPlayerId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Award Amount:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  KSh {payoutModalPrize.amount.toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Recipient M-Pesa Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0712345678"
                  value={payoutPhone}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-white font-mono text-sm focus:border-amber-500 outline-none"
                />
                <span className="text-[10px] text-white/40 mt-1 block">
                  Verify the phone belongs to the verified champion.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  M-Pesa Transaction Reference Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QDF8219KLM"
                  value={payoutMpesaCode}
                  onChange={(e) => setPayoutMpesaCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-amber-400 font-mono font-bold text-sm tracking-widest focus:border-amber-500 outline-none"
                />
                <span className="text-[10px] text-white/40 mt-1 block">
                  The actual transaction code generated by Safaricom when sending the KSh 1,000.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={payoutSubmitting}
                  onClick={() => setPayoutModalPrize(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payoutSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{payoutSubmitting ? 'Recording...' : 'Confirm Disbursement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
