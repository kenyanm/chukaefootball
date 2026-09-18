import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { GOOGLE_SHEETS_WEB_APP_URL, SHEET_NAMES, SheetName } from '../config/googleSheets';
import { TOURNAMENT_DEFAULTS } from '../config/tournamentConfig';
import { SheetsConfig, SheetsSyncLog } from '../types';

export interface GoogleSheetsResponse<T = any> {
  success: boolean;
  service?: string;
  status?: string;
  sheet?: string;
  records?: T[];
  message?: string;
  error?: string;
  timestamp?: string;
}

let cachedSheetsConfig: { config: SheetsConfig; expiry: number } | null = null;

export const googleSheetsService = {
  /**
   * Retrieves the current Google Sheets synchronization configuration from Firestore
   * or the default central configuration endpoint.
   */
  async getConfig(): Promise<SheetsConfig> {
    if (cachedSheetsConfig && Date.now() < cachedSheetsConfig.expiry) {
      return cachedSheetsConfig.config;
    }

    let config: SheetsConfig = {
      webhookUrl: GOOGLE_SHEETS_WEB_APP_URL,
      autoSyncEnabled: true,
      pendingCount: 0,
      failedCount: 0,
      hasEnvWebhook: true,
    };

    try {
      let timer: any;
      const getDocPromise = getDoc(doc(db, 'settings', 'googleSheets'));
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Firestore read timeout')), 1500);
      });
      const snap = await Promise.race([getDocPromise, timeoutPromise]);
      clearTimeout(timer);
      if (snap && snap.exists()) {
        const data = snap.data() as SheetsConfig;
        const storedUrl = (data.webhookUrl || data.appsScriptUrl || '').trim();
        const activeUrl = storedUrl === GOOGLE_SHEETS_WEB_APP_URL ? storedUrl : GOOGLE_SHEETS_WEB_APP_URL;
        config = {
          ...config,
          ...data,
          webhookUrl: activeUrl,
        };
      }
    } catch {
      // Graceful fallback to central GOOGLE_SHEETS_WEB_APP_URL
    }

    cachedSheetsConfig = { config, expiry: Date.now() + 60000 };
    return config;
  },

  /**
   * Updates Google Sheets configuration in Firestore (Admin only).
   */
  async saveConfig(updates: Partial<SheetsConfig>): Promise<void> {
    cachedSheetsConfig = null;
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        cleanUpdates[k] = v;
      }
    }
    if (cleanUpdates.webhookUrl) {
      cleanUpdates.appsScriptUrl = cleanUpdates.webhookUrl;
    }
    try {
      await setDoc(doc(db, 'settings', 'googleSheets'), cleanUpdates, { merge: true });
    } catch (err) {
      console.warn('[GoogleSheets] saveConfig skipped or unauthorized:', err);
    }
  },

  /**
   * Tests the connection to the Google Apps Script Web App.
   * Calls: GET <WEB_APP_URL>
   *
   * Expected response from Apps Script:
   * {
   *   "success": true,
   *   "service": "CHUKA eFOOTBALL",
   *   "status": "online"
   * }
   */
  async testConnection(urlOverride?: string): Promise<{
    success: boolean;
    service?: string;
    status: 'online' | 'offline';
    message: string;
    latencyMs?: number;
    error?: string;
  }> {
    const config = await this.getConfig();
    const endpoint = (urlOverride || config.webhookUrl || GOOGLE_SHEETS_WEB_APP_URL).trim();

    if (!endpoint) {
      return {
        success: false,
        status: 'offline',
        message: 'No Google Apps Script Web App URL configured.',
        error: 'Please verify the central configuration or endpoint in Admin Settings.',
      };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // GET request to /exec
      // Append cache-buster to prevent stale browser responses
      const getUrl = new URL(endpoint);
      getUrl.searchParams.set('_t', Date.now().toString());

      const res = await fetch(getUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const text = await res.text();
      let data: GoogleSheetsResponse;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON returned: ${text.slice(0, 100)}`);
      }

      // Check if service is online and verified
      const isOnline = Boolean(data.success && (data.status === 'online' || data.service?.includes('CHUKA eFOOTBALL')));

      if (isOnline) {
        const now = new Date().toISOString();
        await this.saveConfig({
          lastSuccessfulSync: now,
          lastError: undefined,
          failedCount: 0,
        });

        return {
          success: true,
          service: data.service || 'CHUKA eFOOTBALL',
          status: 'online',
          message: 'Google Sheets: CONNECTED',
          latencyMs,
        };
      } else {
        const errMsg = data.error || data.message || 'Service reported non-online status.';
        await this.saveConfig({ lastError: errMsg });
        return {
          success: false,
          service: data.service,
          status: 'offline',
          message: 'Google Sheets: OFFLINE',
          latencyMs,
          error: errMsg,
        };
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      const isTimeout = err.name === 'AbortError';
      const errMsg = isTimeout
        ? 'Connection timed out (12s). Google Apps Script may be waking up or unreachable.'
        : (err.message || 'Network error reaching Google Apps Script Web App.');

      await this.saveConfig({ lastError: errMsg });
      return {
        success: false,
        status: 'offline',
        message: 'Google Sheets: OFFLINE',
        latencyMs,
        error: errMsg,
      };
    }
  },

  /**
   * Reads all records from a specified sheet.
   * Action: "get"
   */
  async getRecords<T = any>(
    sheet: SheetName | string,
    adminEmail: string = TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL
  ): Promise<T[]> {
    const config = await this.getConfig();
    const endpoint = (config.webhookUrl || GOOGLE_SHEETS_WEB_APP_URL).trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // We send as text/plain;charset=utf-8 to eliminate CORS preflight rejection in browsers
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'get',
          sheet,
          adminEmail: adminEmail || TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
        }),
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[GoogleSheets] HTTP error fetching sheet ${sheet}: ${res.status}`);
        return [];
      }

      const text = await res.text();
      let data: GoogleSheetsResponse<T>;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.warn(`[GoogleSheets] Invalid JSON from sheet ${sheet}:`, text.slice(0, 100));
        return [];
      }

      if (data.success && Array.isArray(data.records)) {
        return data.records;
      }

      if (data.error) {
        console.warn(`[GoogleSheets] Error reading sheet ${sheet}:`, data.error);
      }

      return [];
    } catch (err: any) {
      console.warn(`[GoogleSheets] Error in getRecords(${sheet}):`, err.message || err);
      return [];
    }
  },

  /**
   * Adds a new record to a sheet.
   * Action: "add"
   */
  async addRecord(
    sheet: SheetName | string,
    record: Record<string, any>,
    adminEmail: string = TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const config = await this.getConfig();
    const endpoint = (config.webhookUrl || GOOGLE_SHEETS_WEB_APP_URL).trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'add',
          sheet,
          record,
          adminEmail: adminEmail || TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
        }),
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const text = await res.text();
      let data: GoogleSheetsResponse;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          success: false,
          error: `Invalid JSON response: ${text.slice(0, 80)}`,
        };
      }

      return {
        success: Boolean(data.success),
        message: data.message,
        error: data.error,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error'),
      };
    }
  },

  /**
   * Updates an existing record in a sheet matched by idField = idValue.
   * Action: "update"
   */
  async updateRecord(
    sheet: SheetName | string,
    idField: string,
    idValue: any,
    updates: Record<string, any>,
    adminEmail: string = TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const config = await this.getConfig();
    const endpoint = (config.webhookUrl || GOOGLE_SHEETS_WEB_APP_URL).trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'update',
          sheet,
          idField,
          idValue: String(idValue),
          updates,
          adminEmail: adminEmail || TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
        }),
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const text = await res.text();
      let data: GoogleSheetsResponse;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          success: false,
          error: `Invalid JSON response: ${text.slice(0, 80)}`,
        };
      }

      return {
        success: Boolean(data.success),
        message: data.message,
        error: data.error,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error'),
      };
    }
  },

  /**
   * Deletes a record from a sheet matched by idField = idValue.
   * Action: "delete"
   */
  async deleteRecord(
    sheet: SheetName | string,
    idField: string,
    idValue: any,
    adminEmail: string = TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const config = await this.getConfig();
    const endpoint = (config.webhookUrl || GOOGLE_SHEETS_WEB_APP_URL).trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'delete',
          sheet,
          idField,
          idValue: String(idValue),
          adminEmail: adminEmail || TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
        }),
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const text = await res.text();
      let data: GoogleSheetsResponse;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          success: false,
          error: `Invalid JSON response: ${text.slice(0, 80)}`,
        };
      }

      return {
        success: Boolean(data.success),
        message: data.message,
        error: data.error,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error'),
      };
    }
  },

  /**
   * Idempotent Upsert Helper:
   * Attempts to update an existing row by primary ID.
   * If the record does not exist or fails update, adds it as a new row.
   */
  async upsertRecord(
    sheet: SheetName | string,
    idField: string,
    idValue: any,
    record: Record<string, any>,
    adminEmail: string = TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL
  ): Promise<{ success: boolean; action: 'updated' | 'added'; error?: string }> {
    // Attempt update first
    const updateResult = await this.updateRecord(sheet, idField, idValue, record, adminEmail);
    if (updateResult.success) {
      return { success: true, action: 'updated' };
    }

    // If update failed (e.g. not found), add it
    const addResult = await this.addRecord(sheet, {
      ...record,
      [idField]: idValue,
    }, adminEmail);

    if (addResult.success) {
      return { success: true, action: 'added' };
    }

    return {
      success: false,
      action: 'added',
      error: addResult.error || updateResult.error,
    };
  },

  /**
   * Appends custom report payload (e.g. League system bulk export) to the synchronization service
   */
  async appendCustomReport(payload: Record<string, any>, adminEmail: string = TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL): Promise<{ success: boolean; message?: string; error?: string }> {
    const config = await this.getConfig();
    const endpoint = (config.webhookUrl || GOOGLE_SHEETS_WEB_APP_URL).trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'add',
          sheet: 'LeagueSyncLog',
          record: {
            timestamp: new Date().toISOString(),
            sheetType: payload.sheetType || 'LEAGUE_SYNC',
            seasonId: payload.seasonId || 'SEASON_01',
            summary: `Synced ${payload.members?.length || 0} members, ${payload.matches?.length || 0} matches`,
            adminEmail: adminEmail || TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
          },
          adminEmail: adminEmail || TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
        }),
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      return { success: true, message: 'League data synchronized to Google Sheets successfully.' };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error'),
      };
    }
  },

  /**
   * Loads recent sync audit logs from Firestore for the admin dashboard.
   */
  async getRecentSyncLogs(limitCount: number = 20): Promise<SheetsSyncLog[]> {
    try {
      const q = query(
        collection(db, 'sheetsSyncLogs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as SheetsSyncLog);
    } catch (e) {
      console.warn('Could not load sheetsSyncLogs', e);
      return [];
    }
  },

  /**
   * Generates the Google Apps Script Web App Code.gs for the administrator.
   */
  getAppsScriptTemplate(): string {
    return `/**
 * ============================================================================
 * CHUKA eFOOTBALL — Official Google Sheets Web App Synchronization Script
 * ============================================================================
 * 
 * Deployment Instructions for Admin (wayongohlaurence@gmail.com):
 * 1. Open your official Google Spreadsheet.
 * 2. Go to: Extensions > Apps Script.
 * 3. Replace all code in Code.gs with this file and save (Ctrl+S).
 * 4. Run "setupChukaEFootballSheets" from the function dropdown to initialize all sheets with frozen headers.
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app".
 * 7. Execute as: "Me" (your Google account).
 * 8. Who has access: "Anyone" (required for static GitHub Pages frontend).
 * 9. Click "Deploy" and copy the Web App URL (ends with "/exec").
 */

function setupChukaEFootballSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDefinitions = [
    { name: "Users", headers: ["userId", "firebaseUid", "displayName", "email", "photoUrl", "whatsappRequired", "role", "status", "createdAt", "updatedAt", "lastLoginAt"] },
    { name: "WhatsAppContacts", headers: ["contactId", "contactType", "label", "contactHandle", "status", "updatedAt"] },
    { name: "Tournaments", headers: ["tournamentId", "weekNumber", "name", "game", "platform", "entryFee", "prizePool", "maxPlayers", "registrationOpenAt", "registrationCloseAt", "verificationStartAt", "verificationEndAt", "competitionStartAt", "competitionEndAt", "status", "roomJoinWindowMinutes", "createdAt", "updatedAt"] },
    { name: "Registrations", headers: ["registrationId", "tournamentId", "playerId", "displayName", "status", "registeredAt", "verifiedAt"] },
    { name: "Payments", headers: ["paymentId", "tournamentId", "playerId", "playerName", "mpesaCode", "amount", "status", "timestamp", "reviewedBy"] },
    { name: "Matches", headers: ["matchId", "tournamentId", "roundName", "roundNumber", "homePlayerId", "homePlayerName", "awayPlayerId", "awayPlayerName", "homeScore", "awayScore", "status", "winnerId", "deadline", "updatedAt"] },
    { name: "MatchResults", headers: ["resultId", "matchId", "tournamentId", "roundName", "homePlayerName", "awayPlayerName", "finalScore", "winnerId", "winnerName", "confirmedAt"] },
    { name: "Champions", headers: ["championId", "tournamentId", "tournamentName", "playerId", "playerName", "crownedAt", "prizeAmount"] },
    { name: "Prizes", headers: ["prizeId", "tournamentId", "playerId", "playerName", "placement", "amount", "status", "disbursedAt", "mpesaReceipt"] },
    { name: "AdminLogs", headers: ["logId", "adminEmail", "action", "targetId", "details", "timestamp"] },
    { name: "SheetsSyncLogs", headers: ["syncId", "entityType", "entityId", "action", "status", "attempt", "errorMessage", "startedAt", "completedAt", "createdAt"] },
    { name: "Configuration", headers: ["key", "value", "description", "updatedAt"] },
    { name: "Brackets", headers: ["bracketId", "tournamentId", "roundName", "totalMatches", "completedMatches", "updatedAt"] },
    { name: "Disputes", headers: ["disputeId", "matchId", "tournamentId", "raisedByPlayerId", "reason", "status", "resolvedBy", "createdAt"] },
    { name: "Evidence", headers: ["evidenceId", "matchId", "playerId", "fileType", "storageRef", "status", "uploadedAt"] },
    { name: "TournamentStats", headers: ["statId", "tournamentId", "totalPlayers", "totalMatches", "totalGoals", "averageGoalsPerMatch", "updatedAt"] },
    { name: "SecurityLogs", headers: ["securityLogId", "eventType", "actorId", "severity", "description", "timestamp"] },
    { name: "DATABASE_INFO", headers: ["Key", "Value"] }
  ];

  sheetDefinitions.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight("bold").setBackground("#e6f4ea");
    }
  });
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    service: "CHUKA eFOOTBALL",
    status: "online",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || "{}");
    var action = payload.action;
    var sheetName = payload.sheet;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet && action !== "ping") {
      sheet = ss.insertSheet(sheetName);
    }

    if (action === "get" || action === "getRecords") {
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, sheet: sheetName, records: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      var headers = data[0];
      var records = [];
      for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        records.push(row);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheet: sheetName, records: records })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "add") {
      var rec = payload.record || {};
      var data = sheet.getDataRange().getValues();
      var headers = data.length > 0 ? data[0] : Object.keys(rec);
      if (data.length === 0) {
        sheet.appendRow(headers);
        sheet.setFrozenRows(1);
      }
      var newRow = headers.map(function(h) { return rec[h] !== undefined ? rec[h] : ""; });
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "add", sheet: sheetName, message: "Record added" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "update") {
      var idField = payload.idField;
      var idValue = String(payload.idValue);
      var updates = payload.updates || {};
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Record not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      var headers = data[0];
      var idColIdx = headers.indexOf(idField);
      if (idColIdx === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "idField not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idColIdx]) === idValue) {
          headers.forEach(function(h, colIdx) {
            if (updates[h] !== undefined) {
              sheet.getRange(i + 1, colIdx + 1).setValue(updates[h]);
            }
          });
          return ContentService.createTextOutput(JSON.stringify({ success: true, action: "update", message: "Record updated" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Record not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "delete") {
      var idField = payload.idField;
      var idValue = String(payload.idValue);
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Record not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      var headers = data[0];
      var idColIdx = headers.indexOf(idField);
      if (idColIdx === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "idField not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idColIdx]) === idValue) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ success: true, action: "delete", message: "Record deleted" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Record not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
  },
};
