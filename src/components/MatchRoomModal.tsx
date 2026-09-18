import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Upload,
  AlertOctagon,
  Shield,
  Smartphone,
  Trophy,
  Swords,
  Info,
  Clock,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Sparkles,
  UserX,
  ArrowDown,
  Edit3,
  RotateCcw,
  AlertTriangle,
  Play,
  Phone,
} from 'lucide-react';
import { MatchFixture, MatchRoomPrivate } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { matchService } from '../services/matchService';
import { contactService, validateKenyanPhone, getWhatsAppClickToChatUrl } from '../services/contactService';
import { TOURNAMENT_DEFAULTS } from '../config/tournamentConfig';

interface MatchRoomModalProps {
  match: MatchFixture;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onViewBracket?: () => void;
}

export const MatchRoomModal: React.FC<MatchRoomModalProps> = ({
  match,
  isOpen,
  onClose,
  onUpdated,
  onViewBracket,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { success, error, info } = useToast();

  const [copied, setCopied] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [submittingRoom, setSubmittingRoom] = useState(false);
  const [roomInputError, setRoomInputError] = useState<string | null>(null);

  // Private room state synced via real-time listener
  const [privateRoom, setPrivateRoom] = useState<MatchRoomPrivate | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);

  // Edit room state (Home player typo correction before match starts)
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [submittingEditRoom, setSubmittingEditRoom] = useState(false);

  // Away Ready declaration state
  const [submittingReady, setSubmittingReady] = useState(false);

  // Game Started declaration state
  const [submittingGameStarted, setSubmittingGameStarted] = useState(false);

  // Switching assistant modal / notice
  const [showSwitchNotice, setShowSwitchNotice] = useState(false);

  // Result submission state
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [screenshotBase64, setScreenshotBase64] = useState<string>('');
  const [submittingResult, setSubmittingResult] = useState(false);

  // Dispute state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState<
    'WRONG_SCORE' | 'OPPONENT_NO_SHOW' | 'CONNECTION_ISSUE' | 'FAKE_SCREENSHOT' | 'INCORRECT_ROOM' | 'OTHER'
  >('WRONG_SCORE');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Overall Match Deadline countdown
  const [deadlineTimeLeft, setDeadlineTimeLeft] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState(false);

  // Away Join Window countdown
  const [joinWindowTimeLeft, setJoinWindowTimeLeft] = useState<string>('');
  const [isJoinWindowElapsed, setIsJoinWindowElapsed] = useState(false);

  // WhatsApp communication state
  const [myWhatsApp, setMyWhatsApp] = useState<string>('');
  const [isEditingMyWhatsApp, setIsEditingMyWhatsApp] = useState(false);
  const [whatsAppInput, setWhatsAppInput] = useState('');
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);

  const currentUid = currentUser?.uid;
  const isHomePlayer = Boolean(currentUid && match.homePlayerUid === currentUid);
  const isAwayPlayer = Boolean(currentUid && match.awayPlayerUid === currentUid);
  const isParticipant = isHomePlayer || isAwayPlayer;
  const isAuthorized = isParticipant || isAdmin;

  // Load and auto-sync private WhatsApp contact
  useEffect(() => {
    if (!currentUid || !isOpen) return;
    contactService.getPrivateContact(currentUid).then((contact) => {
      if (contact?.whatsappPhone) {
        setMyWhatsApp(contact.whatsappPhone);
        setWhatsAppInput(contact.whatsappPhone);
        if (isHomePlayer && !privateRoom?.homeWhatsApp) {
          contactService.syncMatchRoomWhatsApp(match.id, true, contact.whatsappPhone).catch(console.warn);
        } else if (isAwayPlayer && !privateRoom?.awayWhatsApp) {
          contactService.syncMatchRoomWhatsApp(match.id, false, contact.whatsappPhone).catch(console.warn);
        }
      }
    });
  }, [currentUid, isOpen, isHomePlayer, isAwayPlayer, match.id, privateRoom?.homeWhatsApp, privateRoom?.awayWhatsApp]);

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid) return;
    setSavingWhatsApp(true);
    setWhatsAppError(null);
    try {
      const res = await contactService.savePrivateContact(currentUid, whatsAppInput);
      setMyWhatsApp(res.cleanDigits);
      if (isHomePlayer) {
        await contactService.syncMatchRoomWhatsApp(match.id, true, res.cleanDigits);
      } else if (isAwayPlayer) {
        await contactService.syncMatchRoomWhatsApp(match.id, false, res.cleanDigits);
      }
      setIsEditingMyWhatsApp(false);
      success('WHATSAPP NUMBER SAVED ✅', `Saved ${res.formatted} for this match coordination.`);
      onUpdated();
    } catch (err: any) {
      setWhatsAppError(err.message || 'Invalid Kenyan phone number');
      error('WhatsApp Error', err.message);
    } finally {
      setSavingWhatsApp(false);
    }
  };

  const handleOpenWhatsAppChat = (opponentPhoneClean: string, opponentName: string) => {
    const isHome = isHomePlayer;
    const greeting = isHome
      ? `Hello ${opponentName}, I am ${match.homePlayerName} (Home) for our Chuka eFootball match (${match.roundName}, Match ID: ${match.matchId}). Are you ready to play?`
      : `Hello ${opponentName}, I am ${match.awayPlayerName} (Away) for our Chuka eFootball match (${match.roundName}, Match ID: ${match.matchId}). I am ready for the room code!`;

    const url = getWhatsAppClickToChatUrl(opponentPhoneClean, greeting);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAdminWhatsAppChat = (playerPhoneClean: string, playerName: string, isHomeRole: boolean) => {
    const greeting = `Hello ${playerName}, this is Chuka eFootball Tournament Administration regarding match ${match.matchId} (${match.roundName}, ${isHomeRole ? 'Home' : 'Away'}).`;
    const url = getWhatsAppClickToChatUrl(playerPhoneClean, greeting);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Active room number (from private room doc or fallback)
  const effectiveRoomNumber = privateRoom?.roomNumber || match.roomNumber;
  const effectiveAwayReady = Boolean(privateRoom?.awayReady ?? match.awayReady);
  const effectiveRoomCreatedAt = privateRoom?.roomCreatedAt || match.roomCreatedAt;
  const joinWindowMinutes = privateRoom?.roomJoinWindowMinutes ?? match.roomJoinWindowMinutes ?? 5;

  // 1. Real-time private room listener
  useEffect(() => {
    if (!isOpen || !match.id) return;
    setLoadingRoom(true);

    const unsubscribe = matchService.listenToMatchRoom(
      match.id,
      (room) => {
        setPrivateRoom(room);
        setLoadingRoom(false);
      },
      () => {
        setLoadingRoom(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, match.id]);

  // 2. Overall Match Deadline Countdown
  useEffect(() => {
    if (!match.deadline) return;

    const checkDeadline = () => {
      const diff = new Date(match.deadline!).getTime() - Date.now();
      if (diff <= 0) {
        setDeadlineTimeLeft('MATCH OVERDUE');
        setIsOverdue(true);
        if (
          !['CONFIRMED', 'SUBMITTED', 'RESULT_SUBMITTED', 'AWAITING_CONFIRMATION', 'OVERDUE'].includes(
            match.status
          ) &&
          currentUid
        ) {
          matchService.markMatchOverdue(match.id, currentUid).catch(console.error);
        }
        return;
      }
      setIsOverdue(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setDeadlineTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    checkDeadline();
    const timer = setInterval(checkDeadline, 1000);
    return () => clearInterval(timer);
  }, [match.deadline, match.id, match.status, currentUid]);

  // 3. Away Preparation / Join Window Countdown (Server-authoritative based on roomCreatedAt)
  useEffect(() => {
    if (!effectiveRoomCreatedAt || effectiveAwayReady) {
      setJoinWindowTimeLeft('');
      setIsJoinWindowElapsed(false);
      return;
    }

    const checkJoinWindow = () => {
      const windowExpiry =
        new Date(effectiveRoomCreatedAt).getTime() + joinWindowMinutes * 60 * 1000;
      const diff = windowExpiry - Date.now();

      if (diff <= 0) {
        setJoinWindowTimeLeft('WINDOW ELAPSED ⚠️');
        setIsJoinWindowElapsed(true);
        return;
      }

      setIsJoinWindowElapsed(false);
      const mins = Math.floor(diff / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setJoinWindowTimeLeft(
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    checkJoinWindow();
    const interval = setInterval(checkJoinWindow, 1000);
    return () => clearInterval(interval);
  }, [effectiveRoomCreatedAt, joinWindowMinutes, effectiveAwayReady]);

  if (!isOpen) return null;

  // Handle Copy Room Number
  const handleCopyRoom = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!effectiveRoomNumber) return;

    navigator.clipboard.writeText(effectiveRoomNumber);
    setCopied(true);
    info('Room Number Copied', `Room ${effectiveRoomNumber} copied to clipboard.`);
    setTimeout(() => setCopied(false), 3000);
  };

  // Open eFootball Mobile Switching Assistant (Android Intent + Guidance)
  const handleOpenEFootball = () => {
    if (effectiveRoomNumber) {
      navigator.clipboard.writeText(effectiveRoomNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
    setShowSwitchNotice(true);

    // Attempt Android deep link launch via user gesture
    try {
      window.location.href = 'intent://#Intent;package=jp.konami.pesam;end';
    } catch {
      // Ignored if unsupported
    }
  };

  // Home Player Save Room Number (Strict 6 digits validation)
  const handleSaveRoomNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomInputError(null);
    if (!currentUid) return;

    const trimmed = newRoomNumber.trim().replace(/\D/g, '');
    if (!/^\d{6}$/.test(trimmed)) {
      setRoomInputError('Room number must be exactly 6 digits (e.g. 482913).');
      return;
    }

    setSubmittingRoom(true);
    try {
      await matchService.saveRoomNumber(match.id, trimmed, currentUid, isAdmin, joinWindowMinutes);
      success('ROOM READY ✅', `Room ${trimmed} is now visible to your opponent.`);
      setNewRoomNumber('');
      onUpdated();
    } catch (err: any) {
      setRoomInputError(err.message || 'Failed to save room number. Please retry.');
      error('Failed to save room number', err.message);
    } finally {
      setSubmittingRoom(false);
    }
  };

  // Home Player Correct / Edit Room Number
  const handleEditRoomNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid) return;

    const trimmed = editRoomNumber.trim().replace(/\D/g, '');
    if (!/^\d{6}$/.test(trimmed)) {
      error('Invalid Room Number', 'Room number must be exactly 6 digits.');
      return;
    }

    setSubmittingEditRoom(true);
    try {
      await matchService.saveRoomNumber(match.id, trimmed, currentUid, isAdmin, joinWindowMinutes);
      success('ROOM NUMBER UPDATED ✅', `Updated room number to ${trimmed}.`);
      setIsEditingRoom(false);
      setEditRoomNumber('');
      onUpdated();
    } catch (err: any) {
      error('Edit Failed', err.message);
    } finally {
      setSubmittingEditRoom(false);
    }
  };

  // Away Player "I'M READY" Declaration
  const handleAwayReady = async () => {
    if (!currentUid) return;
    setSubmittingReady(true);
    try {
      await matchService.setAwayReady(match.id, currentUid, isAdmin);
      success('READY TO PLAY 🟢', 'You declared readiness to your opponent.');
      onUpdated();
    } catch (err: any) {
      error('Ready Declaration Failed', err.message);
    } finally {
      setSubmittingReady(false);
    }
  };

  // Participant "GAME IN PROGRESS" Declaration (Requirement 9)
  const handleSetGameStarted = async () => {
    if (!currentUid) return;
    setSubmittingGameStarted(true);
    try {
      await matchService.setGameStarted(match.id, currentUid, isAdmin);
      success('GAME IN PROGRESS 🎮', 'Match marked in progress. Good luck in eFootball Mobile!');
      onUpdated();
    } catch (err: any) {
      error('Could not start game', err.message);
    } finally {
      setSubmittingGameStarted(false);
    }
  };

  // Handle Screenshot Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error('Unsupported File', 'Please upload a JPG, PNG, or WEBP match screenshot.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      error('File Too Large', 'Screenshot must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Result
  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid || !userProfile) return;

    if (!screenshotBase64) {
      error('Evidence Required', 'Please upload the final score screenshot from eFootball Mobile.');
      return;
    }

    if (homeScore === awayScore) {
      error('No Draws Allowed', 'Knockout rules require Extra Time / Penalties in eFootball Mobile.');
      return;
    }

    setSubmittingResult(true);
    try {
      await matchService.submitResult(
        match.id,
        Number(homeScore),
        Number(awayScore),
        screenshotBase64,
        currentUid,
        userProfile.playerId
      );
      success('RESULT SUBMITTED', 'Waiting for your opponent to confirm the score.');
      onUpdated();
    } catch (err: any) {
      error('Submission Error', err.message);
    } finally {
      setSubmittingResult(false);
    }
  };

  // Confirm Result
  const handleConfirmResult = async () => {
    if (!currentUid) return;
    try {
      await matchService.confirmResult(match.id, currentUid);
      success('MATCH CONFIRMED ✅', 'Winner advanced automatically. Screenshot evidence has been purged.');
      onUpdated();
    } catch (err: any) {
      error('Confirmation Failed', err.message);
    }
  };

  // Submit Dispute
  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid || !userProfile) return;

    setSubmittingDispute(true);
    try {
      await matchService.reportDispute(
        match.id,
        currentUid,
        userProfile.displayName,
        userProfile.playerId,
        disputeReason,
        disputeNotes
      );
      success('MATCH DISPUTED ⚠️', 'An administrator will review this match.');
      setShowDisputeForm(false);
      onUpdated();
    } catch (err: any) {
      error('Dispute Failed', err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const getNextRoundName = (currentRound: string) => {
    if (currentRound.includes('128')) return 'ROUND OF 64';
    if (currentRound.includes('64')) return 'ROUND OF 32';
    if (currentRound.includes('32')) return 'ROUND OF 16';
    if (currentRound.includes('16')) return 'QUARTERFINAL';
    if (currentRound.toLowerCase().includes('quarter')) return 'SEMIFINAL';
    if (currentRound.toLowerCase().includes('semi')) return 'FINAL';
    return 'NEXT ROUND';
  };

  const isConfirmed = match.status === 'CONFIRMED';
  const isWinner = isConfirmed && currentUid && match.winnerUid === currentUid;
  const isEliminated =
    isConfirmed && currentUid && match.loserId && isParticipant && !isWinner;
  const isMatchLocked = [
    'SUBMITTED',
    'RESULT_SUBMITTED',
    'AWAITING_CONFIRMATION',
    'CONFIRMED',
    'DISPUTED',
  ].includes(match.status);

  return (
    <div
      id="modal-match-room"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-[#08110b] border border-emerald-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-emerald-950/80 my-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close match modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER: MATCH CENTER */}
        <div className="mb-5 pb-4 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider uppercase">
              CHUKA eFOOTBALL
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/20 text-[10px] font-mono font-bold tracking-wider uppercase">
              {match.roundName.toUpperCase()}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold tracking-wider uppercase">
              MATCH {match.matchId}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block mb-0.5">
                MATCH CENTER
              </span>
              <h2 className="font-heading font-black text-xl sm:text-2xl text-white uppercase tracking-wide flex items-center gap-2">
                <Swords className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  {match.homePlayerName} vs {match.awayPlayerName}
                </span>
              </h2>
            </div>

            {/* Overall Match Deadline Countdown */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-black/60 border border-white/10 shrink-0">
              <Clock
                className={`w-4 h-4 ${
                  isOverdue ? 'text-red-400 animate-pulse' : 'text-amber-400'
                }`}
              />
              <div>
                <span className="text-[9px] uppercase font-bold text-white/40 block">
                  {isOverdue ? 'STATUS' : 'MATCH DEADLINE'}
                </span>
                <span
                  className={`font-mono text-xs sm:text-sm font-bold tracking-wider ${
                    isOverdue ? 'text-red-400 font-extrabold animate-pulse' : 'text-amber-300'
                  }`}
                >
                  {deadlineTimeLeft || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BRACKET ADVANCEMENT / ELIMINATION BANNERS */}
        {isWinner && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border border-emerald-400/50 shadow-lg text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-heading font-black uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>🎉 YOU ADVANCED!</span>
            </div>
            <div className="flex items-center justify-center gap-3 font-heading font-black text-sm sm:text-base text-white uppercase tracking-wide">
              <span>{match.roundName}</span>
              <ArrowDown className="w-4 h-4 text-emerald-400 rotate-[-90deg]" />
              <span className="text-amber-400">{getNextRoundName(match.roundName)}</span>
            </div>
          </div>
        )}

        {isEliminated && (
          <div className="mb-5 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700 text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-600 text-xs font-heading font-black uppercase tracking-wider">
              <UserX className="w-4 h-4 text-zinc-400" />
              <span>TOURNAMENT ENDED</span>
            </div>
            <p className="text-xs text-white/80">
              You were eliminated in: <strong className="text-white">{match.roundName}</strong>.
            </p>
            {onViewBracket && (
              <button
                onClick={() => {
                  onClose();
                  onViewBracket();
                }}
                className="mt-1 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-all"
              >
                [ VIEW BRACKET ]
              </button>
            )}
          </div>
        )}

        {/* MATCHUP DUEL CARD */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-black to-emerald-950/40 border border-white/10 mb-5">
          <div className="grid grid-cols-7 items-center text-center">
            {/* HOME PLAYER */}
            <div className="col-span-3 text-left">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-1">
                🏠 HOME
              </span>
              <div className="font-heading font-black text-base sm:text-lg text-white truncate">
                {match.homePlayerName}
              </div>
              <div className="text-xs text-emerald-400 font-mono font-medium">{match.homePlayerId}</div>
              {match.winnerId === match.homePlayerId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 mt-1">
                  <Trophy className="w-3 h-3" /> Winner
                </span>
              )}
            </div>

            {/* SCORE OR VS */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              {match.status === 'CONFIRMED' ||
              match.status === 'SUBMITTED' ||
              match.status === 'AWAITING_CONFIRMATION' ? (
                <div className="font-heading font-black text-2xl sm:text-3xl text-amber-400 flex items-center gap-1">
                  <span>{match.homeScore ?? '-'}</span>
                  <span className="text-white/40 text-lg">:</span>
                  <span>{match.awayScore ?? '-'}</span>
                </div>
              ) : (
                <div className="font-heading font-extrabold text-lg text-white/40 italic">VS</div>
              )}
            </div>

            {/* AWAY PLAYER */}
            <div className="col-span-3 text-right">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30 mb-1">
                ✈️ AWAY
              </span>
              <div className="font-heading font-black text-base sm:text-lg text-white truncate">
                {match.awayPlayerName}
              </div>
              <div className="text-xs text-orange-400 font-mono font-medium">{match.awayPlayerId}</div>
              {match.winnerId === match.awayPlayerId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 mt-1">
                  <Trophy className="w-3 h-3" /> Winner
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/50">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
              <Smartphone className="w-3.5 h-3.5" /> eFootball Mobile Match Room
            </span>
            <span className="font-mono">Room Owner: HOME ({match.homePlayerName})</span>
          </div>
        </div>

        {/* ACTIVE IN-PROGRESS STATUS BANNER (Requirement 9) */}
        {match.status === 'IN_PROGRESS' && (
          <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-[#072416] to-emerald-950/80 border border-emerald-400/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-emerald-950/60">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <div>
                <span className="text-xs font-heading font-black text-white uppercase tracking-wider block">
                  🎮 MATCH IN PROGRESS
                </span>
                <span className="text-[11px] text-emerald-300/80">
                  Players are currently playing in eFootball Mobile. Submit final score below once finished.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenEFootball}
              className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-500/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>[ SWITCH TO eFOOTBALL ]</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MATCH PLAYER COMMUNICATION / WHATSAPP                                    */}
        {/* ========================================================================= */}
        {isAuthorized && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#071d12]/90 border border-emerald-500/40 mb-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-heading font-black text-white uppercase tracking-wider">
                    MATCH PLAYER COMMUNICATION
                  </h3>
                  <p className="text-[11px] text-emerald-300/70">
                    Direct WhatsApp channel for match coordination & room code exchange
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase w-fit">
                <Shield className="w-3 h-3" /> PRIVATE & SECURE
              </span>
            </div>

            {/* IF USER IS HOME PLAYER: Chat with Away Player */}
            {isHomePlayer && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Opponent (Away):</span>
                    <span className="font-heading font-bold text-white uppercase">{match.awayPlayerName}</span>
                  </div>

                  {privateRoom?.awayWhatsApp ? (
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppChat(privateRoom.awayWhatsApp!, match.awayPlayerName)}
                        className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#051a0e] font-heading font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#25D366]/20 active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>[ 💬 CHAT ON WHATSAPP ]</span>
                      </button>
                      <p className="text-[11px] text-emerald-300/80 text-center">
                        Tap to open WhatsApp conversation with <strong>{match.awayPlayerName}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Opponent's WhatsApp Not Added Yet</span>
                      </div>
                      <p className="text-[11px] text-amber-200/80">
                        {match.awayPlayerName} has not saved their WhatsApp number yet. They will see your WhatsApp once you save yours below.
                      </p>
                    </div>
                  )}
                </div>

                {/* Home Player's Own WhatsApp Card */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-bold tracking-wider">
                      YOUR WHATSAPP NUMBER (Visible to {match.awayPlayerName})
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {myWhatsApp ? validateKenyanPhone(myWhatsApp).formatted : 'Not set yet'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMyWhatsApp(!isEditingMyWhatsApp);
                      setWhatsAppInput(myWhatsApp);
                      setWhatsAppError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider transition-all w-fit"
                  >
                    {isEditingMyWhatsApp ? 'Cancel' : myWhatsApp ? '[ Edit Phone ]' : '[ + Set WhatsApp ]'}
                  </button>
                </div>
              </div>
            )}

            {/* IF USER IS AWAY PLAYER: Chat with Home Player */}
            {isAwayPlayer && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Opponent (Home & Room Owner):</span>
                    <span className="font-heading font-bold text-white uppercase">{match.homePlayerName}</span>
                  </div>

                  {privateRoom?.homeWhatsApp ? (
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppChat(privateRoom.homeWhatsApp!, match.homePlayerName)}
                        className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#051a0e] font-heading font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#25D366]/20 active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>[ 💬 CHAT ON WHATSAPP ]</span>
                      </button>
                      <p className="text-[11px] text-emerald-300/80 text-center">
                        Tap to open WhatsApp conversation with room owner <strong>{match.homePlayerName}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Room Owner's WhatsApp Not Added Yet</span>
                      </div>
                      <p className="text-[11px] text-amber-200/80">
                        {match.homePlayerName} has not saved their WhatsApp number yet. Make sure your WhatsApp is saved below so they can contact you.
                      </p>
                    </div>
                  )}
                </div>

                {/* Away Player's Own WhatsApp Card */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-white/50 block text-[10px] uppercase font-bold tracking-wider">
                      YOUR WHATSAPP NUMBER (Visible to {match.homePlayerName})
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {myWhatsApp ? validateKenyanPhone(myWhatsApp).formatted : 'Not set yet'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMyWhatsApp(!isEditingMyWhatsApp);
                      setWhatsAppInput(myWhatsApp);
                      setWhatsAppError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider transition-all w-fit"
                  >
                    {isEditingMyWhatsApp ? 'Cancel' : myWhatsApp ? '[ Edit Phone ]' : '[ + Set WhatsApp ]'}
                  </button>
                </div>
              </div>
            )}

            {/* IF USER IS ADMIN: Can coordinate with either participant */}
            {isAdmin && !isParticipant && (
              <div className="space-y-3">
                <div className="text-[11px] text-emerald-300/80 uppercase font-bold tracking-wider">
                  Admin Player Mediation Contacts:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Home WhatsApp */}
                  <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-2">
                    <div className="text-xs">
                      <span className="text-white/50 block text-[10px]">HOME PLAYER:</span>
                      <strong className="text-white">{match.homePlayerName}</strong>
                    </div>
                    {privateRoom?.homeWhatsApp ? (
                      <button
                        type="button"
                        onClick={() => handleAdminWhatsAppChat(privateRoom.homeWhatsApp!, match.homePlayerName, true)}
                        className="w-full py-2 px-3 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-[#051a0e] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>[ 💬 WhatsApp Home ]</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-white/40 italic block">No WhatsApp provided</span>
                    )}
                  </div>

                  {/* Away WhatsApp */}
                  <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-2">
                    <div className="text-xs">
                      <span className="text-white/50 block text-[10px]">AWAY PLAYER:</span>
                      <strong className="text-white">{match.awayPlayerName}</strong>
                    </div>
                    {privateRoom?.awayWhatsApp ? (
                      <button
                        type="button"
                        onClick={() => handleAdminWhatsAppChat(privateRoom.awayWhatsApp!, match.awayPlayerName, false)}
                        className="w-full py-2 px-3 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-[#051a0e] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>[ 💬 WhatsApp Away ]</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-white/40 italic block">No WhatsApp provided</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Set/Edit WhatsApp Form */}
            {isEditingMyWhatsApp && (
              <form onSubmit={handleSaveWhatsApp} className="p-3.5 rounded-xl bg-black/80 border border-emerald-500/40 space-y-2.5">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide block">
                  Update Your Official Match WhatsApp Number (Kenyan Format)
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="e.g. 0712345678 or 0112345678"
                      value={whatsAppInput}
                      onChange={(e) => {
                        setWhatsAppInput(e.target.value);
                        setWhatsAppError(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-emerald-400 placeholder:text-white/30"
                    />
                    {whatsAppError && (
                      <p className="text-[11px] text-red-400 mt-1">{whatsAppError}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={savingWhatsApp || !whatsAppInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider disabled:opacity-50 shrink-0"
                  >
                    {savingWhatsApp ? 'Saving...' : 'Save & Share'}
                  </button>
                </div>
                <p className="text-[10px] text-white/50">
                  Visible strictly to your assigned opponent ({isHomePlayer ? match.awayPlayerName : match.homePlayerName}) and tournament admins. Never public.
                </p>
              </form>
            )}

            <div className="text-[10px] text-white/40 border-t border-white/5 pt-2 flex items-center justify-between">
              <span>🔒 End-to-end match coordination</span>
              <span>Only assigned players & admin can view</span>
            </div>
          </div>
        )}

        {/* OVERDUE NOTICE */}
        {isOverdue && match.status !== 'CONFIRMED' && (
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 mb-4 text-xs text-red-300 flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-heading font-black uppercase text-red-300">
                MATCH OVERDUE ⚠️
              </strong>
              <span>
                The official match deadline has passed. Outcome is moved into administrator resolution. No winner is automatically invented.
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MATCH ROOM HANDOFF SECTION                                               */}
        {/* ========================================================================= */}
        {match.status !== 'CONFIRMED' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-emerald-500/40 mb-5 space-y-4 shadow-inner">
            {/* PRIVACY CHECK: Non-participant & non-admin */}
            {!isAuthorized ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-white/60 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>🔒 PRIVATE MATCH ROOM</span>
                </div>
                <p>
                  Room details are confidential and restricted strictly to <strong>{match.homePlayerName}</strong> (Home), <strong>{match.awayPlayerName}</strong> (Away), and tournament coordinators.
                </p>
              </div>
            ) : !myWhatsApp && !isAdmin ? (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-black to-amber-950/50 border-2 border-amber-400/60 text-center space-y-4 shadow-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-mono font-bold uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>KNOCKOUT READINESS GATE</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-heading font-black text-lg text-white uppercase">
                    WhatsApp Number Required Before Match Play
                  </h3>
                  <p className="text-xs text-white/70 max-w-md mx-auto leading-relaxed">
                    Tournament rules require a valid WhatsApp number so you and your opponent (<strong>{isHomePlayer ? match.awayPlayerName : match.homePlayerName}</strong>) can coordinate eFootball Mobile room codes and connection status.
                  </p>
                </div>
                <form onSubmit={handleSaveWhatsApp} className="max-w-md mx-auto space-y-2.5 text-left">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="e.g. 0712345678 or 0112345678"
                      value={whatsAppInput}
                      onChange={(e) => {
                        setWhatsAppInput(e.target.value);
                        setWhatsAppError(null);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-black border border-white/30 text-white font-mono text-sm focus:outline-none focus:border-emerald-400 placeholder:text-white/30"
                    />
                    <button
                      type="submit"
                      disabled={savingWhatsApp || !whatsAppInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider disabled:opacity-50 transition-all shadow-lg active:scale-95 shrink-0"
                    >
                      {savingWhatsApp ? 'Saving...' : 'Save & Unlock'}
                    </button>
                  </div>
                  {whatsAppError && <p className="text-xs text-red-400">{whatsAppError}</p>}
                  <div className="flex items-center gap-1.5 text-[10px] text-white/50 pt-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Privacy Guarantee: Stored privately, never published on public rosters or Google Sheets.</span>
                  </div>
                </form>
              </div>
            ) : isHomePlayer ? (
              /* ===================================================================== */
              /* 1. HOME PLAYER EXPERIENCE (Room Owner)                                 */
              /* ===================================================================== */
              !effectiveRoomNumber ? (
                /* STATE 1A: Home Player Creates Room */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-heading font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <span>YOU ARE THE HOME PLAYER 🏠</span>
                      </span>
                      <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase tracking-wide mt-0.5">
                        CREATE MATCH ROOM
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold uppercase">
                      ROOM OWNER
                    </span>
                  </div>

                  {/* Numbered Home Instructions */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-xs text-white/80">
                    <div className="font-bold text-emerald-400 uppercase text-[11px] mb-1">
                      Instructions for Home Player:
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold text-emerald-400">1.</span>
                      <span>Open eFootball Mobile on your phone</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold text-emerald-400">2.</span>
                      <span>Create the appropriate match room (Friend Match → Match Room)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold text-emerald-400">3.</span>
                      <span>Copy or note down the generated 6-digit room number</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold text-emerald-400">4.</span>
                      <span>Return to CHUKA eFOOTBALL</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold text-emerald-400">5.</span>
                      <span>Enter the 6-digit room number below and tap Save</span>
                    </div>
                  </div>

                  <form onSubmit={handleSaveRoomNumber} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1.5">
                        ROOM NUMBER (Exactly 6 Digits) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        required
                        placeholder="______ (e.g. 482913)"
                        value={newRoomNumber}
                        onChange={(e) => {
                          setNewRoomNumber(e.target.value.replace(/\D/g, ''));
                          setRoomInputError(null);
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/20 text-white font-mono text-xl tracking-widest text-center focus:outline-none focus:border-emerald-500 placeholder:text-white/20 shadow-inner"
                      />
                      {roomInputError && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{roomInputError}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submittingRoom || newRoomNumber.trim().length !== 6}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {submittingRoom ? (
                        <>
                          <RotateCcw className="w-4 h-4 animate-spin" />
                          <span>Saving Room Number...</span>
                        </>
                      ) : (
                        <span>[ SAVE ROOM NUMBER ]</span>
                      )}
                    </button>
                  </form>

                  <p className="text-[11px] text-white/40 text-center italic">
                    The Home player is the room owner. The Away player does NOT create a room.
                  </p>
                </div>
              ) : (
                /* STATE 1B: Home Player Room Ready */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-mono font-bold uppercase shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>ROOM READY ✅</span>
                    </span>
                    {!isMatchLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingRoom(!isEditingRoom);
                          setEditRoomNumber(effectiveRoomNumber);
                        }}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isEditingRoom ? 'Cancel Edit' : '[ Edit Room Number ]'}</span>
                      </button>
                    )}
                  </div>

                  {/* Optional Edit Form for Typo Correction */}
                  {isEditingRoom ? (
                    <form
                      onSubmit={handleEditRoomNumber}
                      className="p-3.5 rounded-xl bg-white/[0.03] border border-amber-500/40 space-y-2"
                    >
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wide block">
                        Correct Room Number (Pre-match only)
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          required
                          value={editRoomNumber}
                          onChange={(e) => setEditRoomNumber(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 px-3 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-center text-lg focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="submit"
                          disabled={submittingEditRoom || editRoomNumber.trim().length !== 6}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                        >
                          {submittingEditRoom ? 'Updating...' : 'Update'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Large Room Number Display */
                    <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-2">
                      <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest block">
                        ROOM NUMBER
                      </span>
                      <div className="font-heading font-black text-4xl sm:text-5xl text-amber-400 font-mono tracking-widest select-all">
                        {effectiveRoomNumber}
                      </div>
                      <p className="text-xs text-white/60">
                        Your opponent can now join your room.
                      </p>
                    </div>
                  )}

                  {/* Away Player Status Card */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-white/40 block mb-0.5">
                        OPPONENT STATUS (AWAY PLAYER)
                      </span>
                      {effectiveAwayReady ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>AWAY PLAYER: 🟢 READY</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>AWAY PLAYER: 🟡 WAITING TO JOIN...</span>
                        </div>
                      )}
                    </div>

                    {!effectiveAwayReady && joinWindowTimeLeft && (
                      <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
                        <span className="text-[10px] uppercase font-bold text-white/40 block">
                          JOIN WINDOW
                        </span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            isJoinWindowElapsed ? 'text-red-400 font-extrabold' : 'text-amber-300'
                          }`}
                        >
                          {joinWindowTimeLeft}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Home Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      id="btn-copy-room-home"
                      type="button"
                      onClick={handleCopyRoom}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-white/10"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'COPIED ✅' : '[ COPY ROOM NUMBER ]'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenEFootball}
                      className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>[ OPEN eFOOTBALL MOBILE ]</span>
                    </button>

                    {effectiveAwayReady && match.status !== 'IN_PROGRESS' && !isMatchLocked && (
                      <button
                        id="btn-start-game-home"
                        type="button"
                        onClick={handleSetGameStarted}
                        disabled={submittingGameStarted}
                        className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 sm:col-span-2 active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{submittingGameStarted ? 'Starting Game...' : '[ GAME IN PROGRESS ]'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : isAwayPlayer ? (
              /* ===================================================================== */
              /* 2. AWAY PLAYER EXPERIENCE (Join Room)                                 */
              /* ===================================================================== */
              !effectiveRoomNumber ? (
                /* STATE 2A: Waiting for Home Player */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-heading font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                        <span>YOU ARE THE AWAY PLAYER ✈️</span>
                      </span>
                      <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase tracking-wide mt-0.5">
                        WAITING FOR HOME PLAYER
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/70 text-[10px] font-mono font-bold uppercase">
                      STANDBY
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 text-xs text-white/70">
                    <p>
                      The Home player (<strong>{match.homePlayerName}</strong>) is the room owner and must create the room in eFootball Mobile.
                    </p>
                    <p className="text-amber-300/90 font-medium">
                      The Away player does NOT create a room.
                    </p>
                    <div className="flex items-center gap-2 pt-2 text-emerald-400 font-mono text-[11px]">
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Listening for room creation in real-time...</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* STATE 2B: Home Player Created Room - Away Joins */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-heading font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                        <span>YOU ARE THE AWAY PLAYER ✈️</span>
                      </span>
                      <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase tracking-wide mt-0.5">
                        HOME PLAYER HAS CREATED THE MATCH ROOM
                      </h3>
                    </div>
                    {effectiveAwayReady && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold uppercase">
                        READY 🟢
                      </span>
                    )}
                  </div>

                  {/* Preparation / Join Window Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-heading font-black uppercase tracking-wider text-emerald-400">
                        GET READY TO JOIN
                      </span>
                      {joinWindowTimeLeft && !effectiveAwayReady && (
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isJoinWindowElapsed
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          JOIN WINDOW: {joinWindowTimeLeft}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white/80">
                      Your opponent has created the room.
                      {!effectiveAwayReady && joinWindowTimeLeft && (
                        <span>
                          {' '}You have <strong>{joinWindowTimeLeft}</strong> to open eFootball Mobile and join the room.
                        </span>
                      )}
                    </p>

                    <div className="text-center py-2 bg-black/50 rounded-xl border border-white/10">
                      <span className="text-[10px] uppercase font-bold text-white/40 block mb-0.5">
                        ROOM NUMBER
                      </span>
                      <div className="font-heading font-black text-4xl sm:text-5xl text-amber-400 font-mono tracking-widest select-all">
                        {effectiveRoomNumber}
                      </div>
                    </div>

                    {/* Away Player Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        id="btn-copy-room-away"
                        type="button"
                        onClick={handleCopyRoom}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-white/10"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'COPIED ✅' : '[ COPY ROOM ]'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenEFootball}
                        className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>[ OPEN eFOOTBALL ]</span>
                      </button>

                      <button
                        id="btn-away-ready"
                        type="button"
                        onClick={handleAwayReady}
                        disabled={submittingReady || effectiveAwayReady}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          effectiveAwayReady
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                            : 'bg-orange-500 hover:bg-orange-400 text-black shadow-md shadow-orange-500/20 active:scale-95'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{effectiveAwayReady ? 'READY 🟢' : submittingReady ? 'Updating...' : "[ I'M READY ]"}</span>
                      </button>

                      {effectiveAwayReady && match.status !== 'IN_PROGRESS' && !isMatchLocked && (
                        <button
                          id="btn-start-game-away"
                          type="button"
                          onClick={handleSetGameStarted}
                          disabled={submittingGameStarted}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 sm:col-span-3 active:scale-95"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>{submittingGameStarted ? 'Starting...' : '[ GAME IN PROGRESS ]'}</span>
                        </button>
                      )}
                    </div>

                    {effectiveAwayReady && (
                      <p className="text-[11px] text-emerald-400/90 text-center font-medium pt-1">
                        ✓ You declared readiness in CHUKA eFOOTBALL. Play your match in eFootball Mobile now!
                      </p>
                    )}
                  </div>

                  {/* Compact Mobile Instructions Card */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-white/80 space-y-1.5">
                    <div className="font-bold text-orange-400 uppercase text-[11px]">
                      HOW TO JOIN
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">1️⃣</span>
                      <span>Tap [ COPY ROOM NUMBER ]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">2️⃣</span>
                      <span>Open eFootball Mobile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">3️⃣</span>
                      <span>Go to Friend Match → Match Room (Search Room)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">4️⃣</span>
                      <span>Enter/paste the 6-digit room number ({effectiveRoomNumber})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">5️⃣</span>
                      <span>Join the room</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">6️⃣</span>
                      <span>Return here when ready and tap [ I'M READY ]</span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* ===================================================================== */
              /* 3. ADMIN VIEW OF PRIVATE ROOM                                         */
              /* ===================================================================== */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-black uppercase text-amber-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    <span>ADMINISTRATOR ROOM DESK</span>
                  </span>
                  <span className="text-[10px] text-white/50 font-mono">
                    Authorized Inspection
                  </span>
                </div>

                {effectiveRoomNumber ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-white/40 block">
                        PRIVATE ROOM NUMBER
                      </span>
                      <div className="font-heading font-black text-3xl text-amber-400 font-mono tracking-widest">
                        {effectiveRoomNumber}
                      </div>
                      <div className="text-[10px] text-white/60 mt-1">
                        Away Ready: {effectiveAwayReady ? '🟢 READY' : '🟡 WAITING'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyRoom}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase flex items-center gap-1.5 border border-white/10"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied' : 'Copy Room'}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-white/50 italic">
                    Room number not yet submitted by Home player ({match.homePlayerName}).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* RESULT SUBMISSION & CONFIRMATION                                         */}
        {/* ========================================================================= */}
        {isParticipant && match.status !== 'CONFIRMED' && (
          <div className="space-y-4">
            {match.status === 'SUBMITTED' || match.status === 'AWAITING_CONFIRMATION' ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  <span>RESULT SUBMITTED</span>
                </div>

                <div className="font-heading font-black text-lg text-white">
                  HOME {match.homeScore} — AWAY {match.awayScore}
                </div>

                <p className="text-[11px] text-white/60">
                  Screenshot evidence has been recorded. Once confirmed, screenshot evidence is purged immediately.
                </p>

                {match.submittedByUid !== currentUid ? (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      id="btn-confirm-score"
                      onClick={handleConfirmResult}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>[ CONFIRM RESULT ]</span>
                    </button>
                    <button
                      id="btn-open-dispute"
                      onClick={() => setShowDisputeForm(true)}
                      className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <AlertOctagon className="w-4 h-4" />
                      <span>[ DISPUTE RESULT ]</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-300/80 italic">
                    You submitted this result. Waiting for your opponent to confirm or administrators to review.
                  </p>
                )}
              </div>
            ) : match.status === 'DISPUTED' ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-400">
                  <AlertOctagon className="w-4 h-4" />
                  <span>MATCH DISPUTED ⚠️</span>
                </div>
                <p className="leading-relaxed">
                  Automatic progression halted. <strong>An administrator will review this match.</strong> Submitted evidence is locked until an official score is finalized.
                </p>
              </div>
            ) : match.status === 'ADMIN_RESOLUTION' ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-400">
                  <AlertOctagon className="w-4 h-4" />
                  <span>ADMIN RESOLUTION REQUIRED ⚠️</span>
                </div>
                <div className="font-heading font-black text-lg text-white">
                  SCORE: {match.homeScore ?? 0} — {match.awayScore ?? 0}
                </div>
                <p className="leading-relaxed text-[11px] text-white/70">
                  Knockout tournament matches cannot conclude with an unverified draw. The administrator (<strong>wayongohlaurence@gmail.com</strong>) has been alerted to review the match evidence, check Extra Time / Penalties verification, and advance the legitimate winner.
                </p>
              </div>
            ) : (
              /* RESULT SUBMISSION FORM */
              <form
                onSubmit={handleSubmitResult}
                className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>SUBMIT FINAL SCORE</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(!showDisputeForm)}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Report match dispute?
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                      Home Score ({match.homePlayerName})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      required
                      value={homeScore}
                      onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-center font-bold text-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                      Away Score ({match.awayPlayerName})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      required
                      value={awayScore}
                      onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-center font-bold text-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Screenshot evidence upload */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    [ UPLOAD SCREENSHOT ] (eFootball Final Score Screen) *
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={handleFileChange}
                    className="w-full text-xs text-white/70 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30 cursor-pointer"
                  />
                  <p className="text-[10px] text-amber-300/80 mt-1">
                    Your screenshot is temporary evidence and will be deleted after the result is confirmed/resolved.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingResult}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {submittingResult ? 'Submitting Result...' : 'Submit Score & Evidence'}
                </button>
              </form>
            )}

            {/* DISPUTE FORM DRAWER */}
            {showDisputeForm && (
              <form
                onSubmit={handleSubmitDispute}
                className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" />
                    <span>Report Match Dispute</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(false)}
                    className="text-white/40 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                    Dispute Reason
                  </label>
                  <select
                    value={disputeReason}
                    onChange={(e: any) => setDisputeReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs focus:outline-none focus:border-red-500"
                  >
                    <option value="WRONG_SCORE">Wrong Score Submitted</option>
                    <option value="OPPONENT_NO_SHOW">Opponent Did Not Show</option>
                    <option value="CONNECTION_ISSUE">Network / Disconnection Issue</option>
                    <option value="FAKE_SCREENSHOT">Fake or Manipulated Screenshot</option>
                    <option value="INCORRECT_ROOM">Incorrect Room / Account</option>
                    <option value="OTHER">Other Violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                    Detailed Explanation
                  </label>
                  <textarea
                    required
                    rows={2}
                    maxLength={400}
                    placeholder="Provide details for tournament coordinators..."
                    value={disputeNotes}
                    onChange={(e) => setDisputeNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {submittingDispute ? 'Reporting Dispute...' : 'Submit to Admin Desk'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* CONCLUDED MATCH NOTIFICATION */}
        {match.status === 'CONFIRMED' && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 mb-4 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                MATCH CONFIRMED ✅ • Winner:{' '}
                <strong className="text-white">
                  {match.winnerId === match.homePlayerId
                    ? match.homePlayerName
                    : match.awayPlayerName}
                </strong>
              </span>
            </div>
            {onViewBracket && (
              <button
                onClick={() => {
                  onClose();
                  onViewBracket();
                }}
                className="text-[11px] text-emerald-400 hover:underline font-bold uppercase"
              >
                [ VIEW BRACKET ]
              </button>
            )}
          </div>
        )}

        {/* SWITCHING NOTICE MODAL */}
        {showSwitchNotice && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#0a140f] border border-emerald-500/50 rounded-2xl p-5 text-center space-y-3 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="font-heading font-black text-sm uppercase text-white tracking-wider">
                Switching to eFootball Mobile
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                Room number <strong className="text-amber-400 font-mono text-sm">{effectiveRoomNumber}</strong> has been copied to your clipboard.
              </p>
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-[11px] text-white/60 text-left space-y-1">
                <div>• Switch to eFootball Mobile on your phone</div>
                <div>• Go to Friend Match → Match Room</div>
                <div>• Paste or enter the 6-digit room code</div>
                <div>• When the match ends, return to CHUKA eFOOTBALL to submit your score</div>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchNotice(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* Community & Match Rules Summary */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/50">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Standard: 1v1 Mobile • 10 Mins • Extra Time &amp; Penalties ON</span>
          </div>
          <a
            href="https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chuka WhatsApp Help Desk</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
