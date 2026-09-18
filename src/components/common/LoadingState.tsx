import React from 'react';
import { ChukaCrestLogo } from '../ChukaCrestLogo';
import { EfootballLogo } from '../EfootballLogo';

interface LoadingStateProps {
  label?: string;
  subLabel?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading eFootball Data...',
  subLabel = 'Connecting to Chuka competitive records',
}) => {
  return (
    <div className="py-14 sm:py-20 text-center space-y-4 max-w-sm mx-auto">
      <div className="relative w-16 h-16 mx-auto">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-amber-500/20 border-b-amber-400 animate-spin animate-reverse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ChukaCrestLogo size="sm" withBorder={false} />
        </div>
      </div>
      <div>
        <div className="font-heading font-black text-sm uppercase tracking-wider text-white">
          {label}
        </div>
        <div className="text-[11px] font-mono text-white/50 mt-0.5">
          {subLabel}
        </div>
      </div>
    </div>
  );
};
