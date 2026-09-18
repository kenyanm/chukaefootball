import React, { useState } from 'react';
import { Flame, Shield, Award, Crown, TrendingUp, Trophy, Sparkles } from 'lucide-react';

export type AchievementType =
  | 'HOT_STREAK'
  | 'SHARPSHOOTER'
  | 'THE_WALL'
  | 'GIANT_KILLER'
  | 'RISING_STAR'
  | 'VETERAN';

export interface AchievementMeta {
  type: AchievementType;
  title: string;
  icon: string;
  description: string;
  criterion: string;
  color: 'orange' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gold';
}

export const ACHIEVEMENTS_CATALOG: Record<AchievementType, AchievementMeta> = {
  HOT_STREAK: {
    type: 'HOT_STREAK',
    title: 'Hot Streak',
    icon: '🔥',
    description: 'Won 5 consecutive competitive matches without defeat.',
    criterion: '5 match winning streak',
    color: 'orange',
  },
  SHARPSHOOTER: {
    type: 'SHARPSHOOTER',
    title: 'Sharpshooter',
    icon: '⚽',
    description: 'High goal scoring precision and offensive dominance.',
    criterion: '25+ official league goals',
    color: 'emerald',
  },
  THE_WALL: {
    type: 'THE_WALL',
    title: 'The Wall',
    icon: '🧤',
    description: 'Ironclad defense with repeated match clean sheets.',
    criterion: '5+ clean sheets recorded',
    color: 'blue',
  },
  GIANT_KILLER: {
    type: 'GIANT_KILLER',
    title: 'Giant Killer',
    icon: '👑',
    description: 'Defeated a top-5 ranked contender in official competition.',
    criterion: 'Victory over #1–#5 player',
    color: 'gold',
  },
  RISING_STAR: {
    type: 'RISING_STAR',
    title: 'Rising Star',
    icon: '📈',
    description: 'Achieved the most dramatic climb up the league table in a single week.',
    criterion: '+5 ranking positions gained',
    color: 'purple',
  },
  VETERAN: {
    type: 'VETERAN',
    title: 'Veteran',
    icon: '🏆',
    description: 'Consistent tournament attendance and verified competitive activity.',
    criterion: '15+ competitive fixtures completed',
    color: 'amber',
  },
};

interface AchievementBadgeProps {
  type: AchievementType;
  unlocked?: boolean;
  unlockedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onClick?: () => void;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  type,
  unlocked = false,
  unlockedAt,
  size = 'md',
  showDetails = false,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const meta = ACHIEVEMENTS_CATALOG[type];

  const sizeClasses = {
    sm: 'w-8 h-8 text-base',
    md: 'w-11 h-11 text-xl',
    lg: 'w-14 h-14 text-2xl',
  }[size];

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      <div
        className={`rounded-2xl border flex items-center justify-center cursor-pointer transition-all duration-200 select-none ${sizeClasses} ${
          unlocked
            ? 'bg-gradient-to-br from-amber-500/20 via-black to-emerald-950/40 border-amber-400/50 shadow-md shadow-amber-950/40 hover:scale-105 hover:border-amber-400'
            : 'bg-white/[0.02] border-white/10 opacity-40 grayscale hover:opacity-70'
        }`}
      >
        <span>{meta.icon}</span>
      </div>

      {showDetails && (
        <div className="mt-1 text-center">
          <div className="text-[10px] font-mono font-bold text-white truncate max-w-[80px]">
            {meta.title}
          </div>
        </div>
      )}

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-xl bg-[#0b140e] border border-emerald-500/30 shadow-2xl text-left pointer-events-none animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-1.5 font-heading font-black text-xs text-white">
            <span>{meta.icon}</span>
            <span>{meta.title}</span>
          </div>
          <p className="text-[10px] text-white/70 mt-1 leading-relaxed">{meta.description}</p>
          <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono">
            <span className="text-white/40">Requirement:</span>
            <span className="text-emerald-400 font-semibold">{meta.criterion}</span>
          </div>
          {unlocked && (
            <div className="text-[9px] font-mono text-amber-300 font-bold mt-0.5">
              ✓ UNLOCKED
            </div>
          )}
        </div>
      )}
    </div>
  );
};
