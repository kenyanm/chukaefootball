import React, { useState } from 'react';

export interface ChukaCrestLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  withBorder?: boolean;
  showText?: boolean;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 min-w-[24px]',
  sm: 'w-8 h-8 min-w-[32px]',
  md: 'w-10 h-10 min-w-[40px]',
  lg: 'w-14 h-14 min-w-[56px]',
  xl: 'w-20 h-20 min-w-[80px]',
  '2xl': 'w-28 h-28 min-w-[112px]',
};

/**
 * Official Chuka University Crest Logo Component.
 * Displays the authentic circular crest of Chuka University ("Sapientia Divitiae Sunt").
 * Includes an automated fallback to the vector emblem so it renders flawlessly in all environments.
 */
export const ChukaCrestLogo: React.FC<ChukaCrestLogoProps> = ({
  size = 'md',
  className = '',
  withBorder = true,
  showText = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  const borderClass = withBorder
    ? 'ring-2 ring-emerald-400/80 shadow-md shadow-emerald-950/40'
    : '';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative rounded-full overflow-hidden bg-[#004d25] flex items-center justify-center select-none ${sizeClass} ${borderClass}`}
        title="Chuka University Official Crest"
      >
        {!imgError ? (
          <img
            src="/chuka-university-crest.png"
            alt="Chuka University Crest"
            className="w-full h-full object-contain p-0.5"
            onError={() => setImgError(true)}
            loading="eager"
          />
        ) : (
          /* SVG vector fallback replicating the circular Chuka University seal */
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer green circular field */}
            <circle cx="50" cy="50" r="48" fill="#006837" stroke="#F5A623" strokeWidth="3" />
            <circle cx="50" cy="50" r="43" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 2" />

            {/* Inner shield field */}
            <circle cx="50" cy="50" r="32" fill="#004D25" stroke="#F5A623" strokeWidth="2" />

            {/* Mount Kenya peak silhouette */}
            <path
              d="M32 58 L46 36 L54 44 L60 38 L68 58 Z"
              fill="#FFFFFF"
              opacity="0.9"
            />
            <path
              d="M36 58 L50 40 L58 48 L64 58 Z"
              fill="#E5E7EB"
            />

            {/* Open Book of Knowledge */}
            <path
              d="M38 60 C44 58 48 60 50 62 C52 60 56 58 62 60 L62 70 C56 68 52 70 50 72 C48 70 44 68 38 70 Z"
              fill="#F5A623"
              stroke="#FFFFFF"
              strokeWidth="0.8"
            />
            {/* Book spine line */}
            <line x1="50" y1="62" x2="50" y2="72" stroke="#004D25" strokeWidth="1" />

            {/* University Motto ribbon banner */}
            <path
              d="M26 78 Q50 86 74 78 L72 84 Q50 91 28 84 Z"
              fill="#F5A623"
              stroke="#004D25"
              strokeWidth="0.5"
            />

            {/* Circular text simulation - top arc CHUKA UNIVERSITY */}
            <path id="crestTextArc" d="M 22 50 A 28 28 0 0 1 78 50" fill="none" />
            <text fill="#FFFFFF" fontSize="6" fontWeight="bold" letterSpacing="1">
              <textPath href="#crestTextArc" startOffset="50%" textAnchor="middle">
                CHUKA UNIVERSITY
              </textPath>
            </text>
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="font-heading font-black text-white text-sm tracking-wider uppercase leading-none">
            Chuka University
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-tight">
            Official Crest
          </span>
        </div>
      )}
    </div>
  );
};
