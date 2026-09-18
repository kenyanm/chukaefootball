import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Swords,
  Trophy,
  ShieldCheck,
  User,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { leagueService } from '../../services/leagueService';
import { LeagueMember, UserProfile } from '../../types';
import { ChukaCrestLogo } from '../ChukaCrestLogo';

interface FindOpponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile;
  currentMember: LeagueMember | null;
  seasonId: string;
  onChallengeCreated: () => void;
}

export const FindOpponentModal: React.FC<FindOpponentModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  currentMember,
  seasonId,
  onChallengeCreated,
}) => {
  const [opponents, setOpponents] = useState<LeagueMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [challengingPlayerId, setChallengingPlayerId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setFeedback(null);

    leagueService
      .getEligibleOpponents(currentUserProfile.id, seasonId)
      .then((list) => {
        if (isMounted) {
          setOpponents(list);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load opponents' });
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUserProfile.id, seasonId]);

  if (!isOpen) return null;

  const isCurrentMemberVerified = currentMember?.status === 'VERIFIED';

  const filteredOpponents = opponents.filter((m) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      m.playerId.toLowerCase().includes(term) ||
      m.displayName.toLowerCase().includes(term) ||
      (m.efootballUsername && m.efootballUsername.toLowerCase().includes(term))
    );
  });

  const handleChallenge = async (opponent: LeagueMember) => {
    if (!isCurrentMemberVerified) {
      setFeedback({
        type: 'error',
        message: 'You must activate your KSh50 League Card to challenge other members.',
      });
      return;
    }

    if (opponent.userId === currentUserProfile.id || opponent.playerId === currentUserProfile.playerId) {
      setFeedback({
        type: 'error',
        message: 'You cannot challenge yourself.',
      });
      return;
    }

    setChallengingPlayerId(opponent.playerId);
    setFeedback(null);

    try {
      await leagueService.createChallenge({
        challengerUid: currentUserProfile.id,
        challengerPlayerId: currentUserProfile.playerId,
        challengerName: currentUserProfile.displayName,
        challengerEfootball: currentUserProfile.efootballUsername || '',
        challengedUid: opponent.userId,
        challengedPlayerId: opponent.playerId,
        challengedName: opponent.displayName,
        challengedEfootball: opponent.efootballUsername || '',
        seasonId,
      });

      setFeedback({
        type: 'success',
        message: `Challenge sent to ${opponent.displayName} (${opponent.playerId})!`,
      });
      onChallengeCreated();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to issue challenge.',
      });
    } finally {
      setChallengingPlayerId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#080C09] border border-white/10 shadow-2xl p-6 sm:p-8 space-y-6 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <ChukaCrestLogo size="sm" />
            <div>
              <div className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>FIND A</span>
                <span className="text-emerald-400">LEAGUE OPPONENT</span>
              </div>
              <div className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
                CHALLENGE REGISTERED LEAGUE MEMBERS
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

        {/* Member Status Notice if not verified */}
        {!isCurrentMemberVerified && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <strong>Active KSh50 League Card Required:</strong> Your League membership is pending
              verification. Only verified members can challenge opponents and enter official results.
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by CHUKA ID, Player Name, or eFootball Username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white font-mono text-xs placeholder:text-white/40 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Opponents List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {isLoading ? (
            <div className="py-12 text-center text-xs font-mono text-white/40">
              Loading registered League members...
            </div>
          ) : filteredOpponents.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-white/40 space-y-1">
              <p>No verified opponents found matching "{searchTerm}".</p>
              <p className="text-[10px] text-white/30">
                Only verified League Members with active KSh50 cards appear in the directory.
              </p>
            </div>
          ) : (
            filteredOpponents.map((opp) => (
              <div
                key={opp.id}
                className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 flex items-center justify-between gap-3 transition-all"
              >
                {/* Opponent Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {opp.squadImageUrl || opp.photoURL ? (
                      <img
                        src={opp.squadImageUrl || opp.photoURL}
                        alt={opp.displayName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-5 h-5 text-white/30" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-emerald-400 font-bold">
                        {opp.playerId}
                      </span>
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="font-heading font-black text-sm text-white truncate">
                      {opp.displayName}
                    </div>
                    <div className="text-[10px] font-mono text-white/50 truncate">
                      eFootball: <span className="text-amber-300">{opp.efootballUsername || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Statistics & Challenge Action */}
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block font-mono text-xs">
                    <div className="text-[10px] text-white/40 uppercase">
                      POS: #{opp.currentPosition || '—'}
                    </div>
                    <div className="text-white font-bold">
                      {opp.matchesPlayed || 0} MP · {opp.wins || 0} W
                    </div>
                    <div className="text-emerald-400 font-bold">{opp.points || 0} PTS</div>
                  </div>

                  <button
                    onClick={() => handleChallenge(opp)}
                    disabled={!isCurrentMemberVerified || challengingPlayerId === opp.playerId}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>
                      {challengingPlayerId === opp.playerId ? 'SENDING...' : 'CHALLENGE'}
                    </span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
