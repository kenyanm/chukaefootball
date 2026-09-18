/**
 * Central Configuration for Google Sheets Synchronization.
 *
 * Architecture:
 * GitHub Pages React Frontend
 *       ↓
 * Google Apps Script Web App
 *       ↓
 * Google Sheets
 *
 * Firebase remains authoritative for authentication, tournament state, matches,
 * payments, private room data, and security rules.
 * Google Sheets serves for synchronization, administration, reporting, and operational backup.
 *
 * SECURITY:
 * No passwords, service account credentials, API keys, or secrets are stored in this file.
 */

export const GOOGLE_SHEETS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbw-pnttHevlcBdN7uxc_H2ps_sdulZl4PSbBfgQACP9y-YxCJ7GC6V4terJQ6uclxd4/exec';

/**
 * Exact Sheet Names in the official Google Spreadsheet.
 */
export const SHEET_NAMES = {
  USERS: 'Users',
  WHATSAPP_CONTACTS: 'WhatsAppContacts',
  TOURNAMENTS: 'Tournaments',
  REGISTRATIONS: 'Registrations',
  PAYMENTS: 'Payments',
  MATCHES: 'Matches',
  MATCH_RESULTS: 'MatchResults',
  CHAMPIONS: 'Champions',
  PRIZES: 'Prizes',
  ADMIN_LOGS: 'AdminLogs',
  SHEETS_SYNC_LOGS: 'SheetsSyncLogs',
  CONFIGURATION: 'Configuration',
  BRACKETS: 'Brackets',
  DISPUTES: 'Disputes',
  EVIDENCE: 'Evidence',
  TOURNAMENT_STATS: 'TournamentStats',
  SECURITY_LOGS: 'SecurityLogs',
  DATABASE_INFO: 'DATABASE_INFO',
  LEAGUE_STANDINGS: 'LeagueStandings',
  LEAGUE_MEMBERS: 'LeagueMembers',
  LEAGUE_MATCHES: 'LeagueMatches',
  LEAGUE_PAYMENTS: 'LeaguePayments',
  ACHIEVEMENTS: 'Achievements',
  DAILY_CLAIMS: 'DailyClaims',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

export interface SheetsConnectionStatus {
  success: boolean;
  service?: string;
  status?: 'online' | 'offline';
  timestamp?: string;
  latencyMs?: number;
  error?: string;
}
