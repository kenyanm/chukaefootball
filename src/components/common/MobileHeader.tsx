import React from 'react';
import { Swords, User, Bell, Radio } from 'lucide-react';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { EfootballLogo } from '../EfootballLogo';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from '../Navigation';

interface MobileHeaderProps {
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  liveMatchesCount?: number;
  openChallengesCount?: number;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentTab,
  onNavigate,
  liveMatchesCount = 0,
}) => {
  const { currentUser, userProfile, loginWithGoogle } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#060907]/90 backdrop-blur-md border-b border-white/[0.08] px-3.5 py-2.5 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand Logos & App Title */}
        <button
          onClick={() => onNavigate('HOME')}
          className="flex items-center gap-2 text-left active:opacity-80 transition-opacity"
          aria-label="Go to Home"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <ChukaCrestLogo size="sm" withBorder={false} />
            <span className="w-px h-5 bg-white/15" />
            <EfootballLogo size="sm" variant="badge" />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-black text-sm sm:text-base text-white tracking-wider flex items-center gap-1">
              <span>CHUKA</span>
              <span className="text-emerald-400">eFOOTBALL</span>
            </div>
            <div className="text-[9px] font-mono text-white/50 tracking-widest uppercase hidden min-[360px]:block">
              University Esports
            </div>
          </div>
        </button>

        {/* Right: Live Matches indicator & Profile Pill */}
        <div className="flex items-center gap-2">
          {liveMatchesCount > 0 && (
            <button
              onClick={() => onNavigate('ARENA')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold tracking-wider animate-pulse touch-target sm:min-w-0"
              aria-label={`${liveMatchesCount} matches live now`}
            >
              <Radio className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="hidden min-[400px]:inline">{liveMatchesCount} LIVE</span>
            </button>
          )}

          {currentUser && userProfile ? (
            <button
              onClick={() => onNavigate('PROFILE')}
              className={`flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-full border transition-all touch-target ${
                currentTab === 'PROFILE'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-white/[0.04] border-white/10 hover:border-white/25 text-white/80'
              }`}
              aria-label="View Profile"
            >
              {userProfile.photoURL || userProfile.photoUrl ? (
                <img
                  src={userProfile.photoURL || userProfile.photoUrl}
                  alt={userProfile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-emerald-400/60"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center text-xs font-bold text-emerald-400 border border-emerald-500/40">
                  {userProfile.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <span className="text-xs font-mono font-bold text-white hidden sm:inline max-w-[100px] truncate">
                {userProfile.displayName?.split(' ')[0]}
              </span>
            </button>
          ) : (
            <button
              onClick={() => loginWithGoogle()}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-95 touch-target flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
