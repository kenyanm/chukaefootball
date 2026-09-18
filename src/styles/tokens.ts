/**
 * CHUKA eFOOTBALL - Production Design Tokens
 * Master visual styling system for competitive mobile esports.
 */

export const ESPORTS_THEME = {
  colors: {
    // Dark Gaming Surfaces
    pitchBlack: '#060907',
    arenaDark: '#080e0a',
    cardSurface: '#0d1510',
    cardSurfaceElevated: '#121c16',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    cardBorderSubtle: 'rgba(255, 255, 255, 0.04)',

    // Primary Accents
    chukaGreen: '#10b981', // Emerald 500
    chukaGreenLight: '#34d399',
    chukaGreenDark: '#059669',
    chukaGreenGlow: 'rgba(16, 185, 129, 0.25)',

    // Energy Orange
    energyOrange: '#f97316',
    energyOrangeLight: '#fb923c',
    energyOrangeDark: '#c2410c',
    energyOrangeGlow: 'rgba(249, 115, 22, 0.25)',

    // Championship Gold
    trophyGold: '#f59e0b',
    trophyGoldLight: '#fbbf24',
    trophyGoldDark: '#b45309',
    trophyGoldGlow: 'rgba(245, 158, 11, 0.25)',

    // Status Signals
    livePulse: '#ef4444',
    liveGlow: 'rgba(239, 68, 68, 0.3)',
    verifiedBlue: '#38bdf8',

    // Text Hierarchy
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.72)',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    textFaint: 'rgba(255, 255, 255, 0.25)',
  },

  // Touch minimums for mobile
  touch: {
    minHeight: '44px',
    minWidth: '44px',
    paddingY: '12px',
    paddingX: '18px',
  },

  // Border Radius hierarchy
  radius: {
    badge: '9999px',
    button: '14px',
    card: '20px',
    cardLg: '24px',
    modal: '28px',
  },
} as const;
