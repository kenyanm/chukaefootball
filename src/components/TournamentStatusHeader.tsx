import React from 'react';
import { TournamentStatus } from '../types';

interface TournamentStatusHeaderProps {
  status: TournamentStatus | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TournamentStatusHeader: React.FC<TournamentStatusHeaderProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  let label = '📝 REGISTRATION OPEN';
  let style = 'bg-orange-500/20 text-orange-400 border-orange-500/40';

  switch (status) {
    case 'REGISTRATION_OPEN':
      label = '📝 REGISTRATION OPEN';
      style = 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      break;
    case 'VERIFICATION':
      label = '🔍 VERIFICATION';
      style = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      break;
    case 'REGISTRATION_LOCKED':
      label = '🔒 REGISTRATION LOCKED';
      style = 'bg-zinc-800 text-zinc-300 border-zinc-700';
      break;
    case 'BRACKET_READY':
      label = '🎲 BRACKET READY';
      style = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      break;
    case 'LIVE':
      label = '🔥 LIVE';
      style = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse';
      break;
    case 'COMPLETED':
      label = '🏆 COMPLETED';
      style = 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-400/40 shadow-sm shadow-amber-500/10';
      break;
    default:
      label = status.replace('_', ' ');
      style = 'bg-white/10 text-white/70 border-white/20';
      break;
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[10px]'
      : size === 'lg'
      ? 'px-4 py-1.5 text-sm'
      : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-heading font-black tracking-wider uppercase rounded-full border ${sizeClasses} ${style} ${className}`}
    >
      {label}
    </span>
  );
};
