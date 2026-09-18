import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'green' | 'amber' | 'neutral';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'green',
}) => {
  const iconColors = {
    green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    neutral: 'bg-white/5 border-white/10 text-white/50',
  }[variant];

  return (
    <div className="text-center py-10 sm:py-14 px-4 sm:px-6 rounded-3xl border border-dashed border-white/10 bg-[#080d0a]/60 space-y-3 max-w-lg mx-auto">
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${iconColors}`}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h3 className="font-heading font-black text-lg sm:text-xl text-white uppercase tracking-wider">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#051a0e] font-heading font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-95 touch-target"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
};
