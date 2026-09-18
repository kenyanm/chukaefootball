import React from 'react';

interface EfootballLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'badge';
  className?: string;
}

/**
 * Authentic eFootball™ Brand Mark Component.
 * Faithfully captures the signature eFootball visual geometry:
 * Vibrant cyan-to-lime dynamic curve emblem, athletic display typography, and mobile esports insignia.
 */
export const EfootballLogo: React.FC<EfootballLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
}) => {
  const iconDimensions = {
    sm: 18,
    md: 24,
    lg: 32,
    xl: 44,
  };

  const dim = iconDimensions[size];

  // The signature eFootball curved swirl emblem
  const Emblem = () => (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="efootball-gradient-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="50%" stopColor="#00FF87" />
          <stop offset="100%" stopColor="#FFD200" />
        </linearGradient>
        <linearGradient id="efootball-glow-arc" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="70%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <filter id="efootball-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Dynamic orbital swoosh 1 */}
      <path
        d="M6 24C6 14.0589 14.0589 6 24 6C31.2 6 37.4 10.2 40.2 16.3C40.8 17.6 39.8 19 38.4 19H34.2C33.3 19 32.5 18.4 32.1 17.6C30.4 14.3 27.4 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36C28.2 36 31.8 33.8 33.8 30.5C34.3 29.7 35.2 29.2 36.1 29.2H40.2C41.7 29.2 42.6 30.7 41.9 32C38.8 38.6 32 43 24 43C13.5066 43 5 34.4934 5 24"
        fill="url(#efootball-gradient-primary)"
      />

      {/* Dynamic orbital swoosh 2 (Cross arc) */}
      <path
        d="M20 20C20 18.3431 21.3431 17 23 17H38C39.6569 17 41 18.3431 41 20C41 21.6569 39.6569 23 38 23H23C21.3431 23 20 21.6569 20 20Z"
        fill="url(#efootball-gradient-primary)"
      />

      {/* Speed dot / ball focus */}
      <circle cx="24" cy="24" r="3.5" fill="#FFFFFF" />
      <circle cx="36" cy="11" r="2.5" fill="#00E5FF" />
      <circle cx="39" cy="36" r="2.5" fill="#FFD200" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <Emblem />
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#071610]/90 border border-emerald-400/40 shadow-sm backdrop-blur-sm ${className}`}
      >
        <Emblem />
        <span className="font-heading font-black italic tracking-wider text-[11px] text-white uppercase">
          eFootball<span className="text-emerald-400">™</span>
        </span>
        <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 font-mono">
          MOBILE
        </span>
      </div>
    );
  }

  // Full variant with styled wordmark
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <Emblem />
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1">
          <span className="font-heading font-black italic tracking-tighter text-white text-base md:text-lg uppercase">
            eFootball<span className="text-[#00e5ff] text-xs align-super font-bold not-italic">™</span>
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 text-emerald-300 border border-emerald-400/40">
            2026
          </span>
        </div>
      </div>
    </div>
  );
};
