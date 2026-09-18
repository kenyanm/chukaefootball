import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  variant?: 'green' | 'amber' | 'orange' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  variant = 'neutral',
  className = '',
}) => {
  const variantStyles = {
    green: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/20',
      text: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
    },
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-950/20',
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/10 text-amber-400',
    },
    orange: {
      border: 'border-orange-500/30',
      bg: 'bg-orange-950/20',
      text: 'text-orange-400',
      iconBg: 'bg-orange-500/10 text-orange-400',
    },
    neutral: {
      border: 'border-white/10',
      bg: 'bg-white/[0.03]',
      text: 'text-white',
      iconBg: 'bg-white/5 text-white/60',
    },
  }[variant];

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border ${variantStyles.border} ${variantStyles.bg} backdrop-blur-sm transition-all esports-card-hover ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white/60">
          {label}
        </span>
        {Icon && (
          <div className={`p-1.5 rounded-lg ${variantStyles.iconBg}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className={`font-heading font-black text-xl sm:text-2xl ${variantStyles.text} tracking-tight`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] font-mono text-white/40 mt-0.5 truncate">
          {subValue}
        </div>
      )}
    </div>
  );
};
