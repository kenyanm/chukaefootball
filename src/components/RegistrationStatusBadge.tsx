import React from 'react';
import {
  ShieldCheck,
  CreditCard,
  Clock,
  AlertOctagon,
  Ban,
  UserX,
  Trophy,
  HelpCircle,
} from 'lucide-react';
import { PlayerRegistrationStatus } from '../types';

interface RegistrationStatusBadgeProps {
  status: PlayerRegistrationStatus | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RegistrationStatusBadge: React.FC<RegistrationStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  // Normalize string
  const normStatus = status.toUpperCase().replace(/\s+/g, '_');

  let label = 'NOT REGISTERED';
  let badgeStyle = 'bg-white/5 text-white/60 border-white/10';
  let icon = <HelpCircle className="w-3.5 h-3.5" />;

  switch (normStatus) {
    case 'NOT_REGISTERED':
      label = 'NOT REGISTERED';
      badgeStyle = 'bg-white/5 text-white/60 border-white/15';
      icon = <HelpCircle className="w-3.5 h-3.5" />;
      break;

    case 'PAYMENT_REQUIRED':
      label = 'PAYMENT REQUIRED';
      badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      icon = <CreditCard className="w-3.5 h-3.5 text-amber-400" />;
      break;

    case 'PAYMENT_PENDING':
    case 'PENDING':
      label = 'PAYMENT PENDING';
      badgeStyle = 'bg-orange-500/15 text-orange-300 border-orange-500/40 animate-pulse';
      icon = <Clock className="w-3.5 h-3.5 text-orange-400" />;
      break;

    case 'VERIFIED':
      label = 'VERIFIED';
      badgeStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      break;

    case 'PAYMENT_REJECTED':
      label = 'PAYMENT REJECTED';
      badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      icon = <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
      break;

    case 'REJECTED':
    case 'DISQUALIFIED':
      label = 'REJECTED';
      badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      icon = <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
      break;

    case 'REGISTRATION_CLOSED':
      label = 'REGISTRATION CLOSED';
      badgeStyle = 'bg-zinc-800/80 text-zinc-400 border-zinc-700';
      icon = <Ban className="w-3.5 h-3.5 text-zinc-400" />;
      break;

    case 'CANCELLED':
      label = 'CANCELLED';
      badgeStyle = 'bg-zinc-800/80 text-zinc-400 border-zinc-700';
      icon = <UserX className="w-3.5 h-3.5 text-zinc-400" />;
      break;

    case 'SUSPENDED':
      label = 'SUSPENDED';
      badgeStyle = 'bg-red-600/20 text-red-300 border-red-500/40';
      icon = <Ban className="w-3.5 h-3.5 text-red-400" />;
      break;

    case 'ELIMINATED':
      label = 'ELIMINATED';
      badgeStyle = 'bg-zinc-800/80 text-zinc-400 border-zinc-700';
      icon = <UserX className="w-3.5 h-3.5 text-zinc-400" />;
      break;

    case 'CHAMPION':
      label = 'CHAMPION';
      badgeStyle = 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-400/50 shadow-sm shadow-amber-500/10';
      icon = <Trophy className="w-3.5 h-3.5 text-amber-400" />;
      break;

    default:
      label = status.replace('_', ' ');
      break;
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-xs gap-2'
      : 'px-2.5 py-1 text-[11px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-bold tracking-wider uppercase rounded-full border ${sizeClasses} ${badgeStyle} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};
