import QRCode from 'qrcode';

/**
 * Generates a public profile QR code Data URL for a player.
 * Strictly encodes ONLY the public profile URL (no private info, no phone, no UID, no payment).
 */
export async function generateLeagueProfileQrDataUrl(playerId: string): Promise<string> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.web.app';
  // Safe URL format that resolves directly to the player's public profile in the app
  const safeProfileUrl = `${origin}/?tab=LEAGUE&profile=${encodeURIComponent(playerId)}`;

  try {
    const dataUrl = await QRCode.toDataURL(safeProfileUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code Data URL:', err);
    // Fallback simple SVG data URI
    return '';
  }
}

/**
 * Returns the public profile URL for a player.
 */
export function getPublicLeagueProfileUrl(playerId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chuka-efootball.web.app';
  return `${origin}/?tab=LEAGUE&profile=${encodeURIComponent(playerId)}`;
}
