import React, { useState, useEffect } from 'react';
import { Sun, Crown, Flame, Zap, Clock, CheckCircle2, Trophy, Sparkles } from 'lucide-react';
import { gamificationService } from '../../services/gamificationService';
import { DailyClaim, UserProfile } from '../../types';

interface DailyFirstCardProps {
  userProfile?: UserProfile | null;
  onClaimSuccess?: (claim: DailyClaim) => void;
  onViewProfile?: (playerId: string) => void;
  className?: string;
}

export const DailyFirstCard: React.FC<DailyFirstCardProps> = ({
  userProfile,
  onClaimSuccess,
  onViewProfile,
  className = '',
}) => {
  const [todayClaim, setTodayClaim] = useState<DailyClaim | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Compute countdown to midnight Kenyan time (UTC+3)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Next midnight in UTC+3
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      const diffMs = tomorrow.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining('00:00:00');
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's claimer on load
  const loadClaim = async () => {
    try {
      const claim = await gamificationService.getTodayFirstClaim();
      setTodayClaim(claim);
    } catch (e) {
      console.warn('Daily claim fetch warning:', e);
    }
  };

  useEffect(() => {
    loadClaim();
  }, []);

  const handleClaim = async () => {
    if (!userProfile) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const result = await gamificationService.submitDailyClaim({
        userId: userProfile.id,
        playerId: userProfile.playerId || userProfile.userId || userProfile.id,
        displayName: userProfile.displayName,
        efootballUsername: userProfile.efootballUsername || userProfile.displayName,
      });

      if (result.success && result.claim) {
        setTodayClaim(result.claim);
        setClaimSuccessMsg('👑 You claimed Today\'s First! +25 XP awarded.');
        onClaimSuccess?.(result.claim);
      } else {
        setClaimError(result.message || 'Already claimed by another early bird!');
        loadClaim();
      }
    } catch (err: any) {
      setClaimError(err.message || 'Could not claim daily check-in.');
    } finally {
      setIsClaiming(false);
    }
  };

  const isClaimedByMe =
    userProfile && todayClaim && todayClaim.playerId === userProfile.playerId;

  return (
    <div
      className={`p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0c140e] via-[#09100a] to-[#040805] border border-amber-500/30 relative overflow-hidden shadow-xl ${className}`}
    >
      {/* Background glow & subtle sun ray effect */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Title & Reset Countdown */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-black text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>Today's First Claim</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h3>
            <p className="text-[10px] font-mono text-white/50">Daily check-in sprint for early risers</p>
          </div>
        </div>

        {/* Timer counting down to midnight reset */}
        <div className="text-right font-mono shrink-0">
          <div className="text-[9px] text-white/40 uppercase tracking-wider flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Next Reset</span>
          </div>
          <div className="font-bold text-xs text-amber-300 tracking-wider mt-0.5">
            {timeRemaining || '00:00:00'}
          </div>
        </div>
      </div>

      {/* Claim State */}
      {todayClaim ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-lg shrink-0 shadow-md">
                👑
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  {isClaimedByMe ? "CLAIMED BY YOU TODAY!" : "TODAY'S FIRST CLAIMED"}
                </div>
                <div
                  onClick={() => onViewProfile?.(todayClaim.playerId)}
                  className="font-heading font-black text-sm sm:text-base text-white truncate cursor-pointer hover:underline"
                >
                  @{todayClaim.efootballUsername || todayClaim.displayName}
                </div>
                <div className="text-[10px] font-mono text-white/50 flex items-center gap-2">
                  <span>{todayClaim.playerId}</span>
                  <span>•</span>
                  <span>
                    Checked in at{' '}
                    {new Date(todayClaim.claimedAt).toLocaleTimeString('en-KE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {todayClaim.streak && todayClaim.streak > 1 ? (
              <div className="text-right shrink-0 px-2.5 py-1 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 font-mono text-xs font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>{todayClaim.streak} Streak</span>
              </div>
            ) : null}
          </div>

          <div className="text-[11px] font-mono text-white/60 text-center">
            Resets at 00:00 AM EAT. Wake up early tomorrow to secure tomorrow's #1 crown!
          </div>
        </div>
      ) : (
        <div className="space-y-3.5 text-center">
          <div className="space-y-1">
            <div className="font-heading font-black text-base sm:text-lg text-white uppercase tracking-wide">
              BE TODAY'S FIRST PLAYER
            </div>
            <p className="text-xs text-white/60 max-w-sm mx-auto">
              No one has checked into Chuka eFootball yet today. Grab the daily crown and claim 25 bonus XP!
            </p>
          </div>

          {userProfile ? (
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-black font-heading font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 mx-auto active:scale-95 touch-target"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>{isClaiming ? 'Claiming Daily First...' : "⚡ CLAIM TODAY'S FIRST"}</span>
            </button>
          ) : (
            <div className="text-xs text-amber-300/80 font-mono">
              Sign in with Google to claim today's #1 crown.
            </div>
          )}

          {claimError && (
            <div className="text-xs text-rose-400 font-mono bg-rose-950/40 p-2 rounded-xl border border-rose-500/30">
              {claimError}
            </div>
          )}
        </div>
      )}

      {claimSuccessMsg && (
        <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono text-center flex items-center justify-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{claimSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};
