/**
 * eFootball Username Utilities
 * Strict normalization, collision detection, and standard display formatting.
 */

/**
 * Normalizes an eFootball username for comparison and uniqueness checking:
 * 1. Unicode NFKC normalization
 * 2. Trims leading and trailing whitespace
 * 3. Collapses consecutive internal spaces into a single space
 * 4. Converts to lower case
 */
export function normalizeEfootballUsername(username: string): string {
  if (!username) return '';
  return username
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Alias for normalizeEfootballUsername
 */
export const normalizeUsername = normalizeEfootballUsername;

/**
 * Validates the syntax of an eFootball username:
 * - Length: 2 to 30 characters
 * - Characters: Alphanumeric, spaces, dots, dashes, underscores, hash symbols (#)
 */
export function validateEfootballUsername(username: string): {
  valid: boolean;
  error?: string;
  sanitized: string;
} {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'eFootball username is required.', sanitized: '' };
  }

  const trimmed = username.trim().replace(/\s+/g, ' ');

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: 'eFootball username must be at least 2 characters.',
      sanitized: trimmed,
    };
  }

  if (trimmed.length > 30) {
    return {
      valid: false,
      error: 'eFootball username must not exceed 30 characters.',
      sanitized: trimmed.slice(0, 30),
    };
  }

  // Check valid characters
  const validCharRegex = /^[a-zA-Z0-9\s._\-#]+$/;
  if (!validCharRegex.test(trimmed)) {
    return {
      valid: false,
      error:
        'eFootball username can only contain letters, numbers, spaces, dots, dashes, underscores, and #.',
      sanitized: trimmed.replace(/[^a-zA-Z0-9\s._\-#]/g, ''),
    };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Formats player identity according to Chuka eFootball specification:
 * CHUKA ID • eFootball Username (Display Name)
 * Example: CHUKA-000001 • GhostRider (Brian K.)
 */
export function formatPlayerIdentity(params: {
  playerId?: string;
  efootballUsername?: string;
  displayName?: string;
}): string {
  const id = params.playerId || 'CHUKA-??????';
  const username = params.efootballUsername || 'Player';
  const name = params.displayName ? ` (${params.displayName})` : '';
  return `${id} • ${username}${name}`;
}
