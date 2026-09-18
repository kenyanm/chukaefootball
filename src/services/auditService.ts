import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, removeUndefined } from '../firebase/config';
import { AuditAction, AuditLog } from '../types';

export const auditService = {
  // Record an audit log
  async logAction(
    action: AuditAction,
    actor: string,
    actorEmail?: string,
    tournamentId?: string,
    matchId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const logId = `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const logRef = doc(db, 'adminLogs', logId);

      // Clean metadata of undefined values for Firestore
      const cleanMeta: Record<string, any> = {};
      if (metadata) {
        Object.entries(metadata).forEach(([k, v]) => {
          if (v !== undefined) cleanMeta[k] = v;
        });
      }

      const log: AuditLog = {
        id: logId,
        action,
        actor,
        actorEmail: actorEmail || '',
        timestamp: new Date().toISOString(),
        tournamentId: tournamentId || '',
        matchId: matchId || '',
        metadata: cleanMeta,
      };

      await setDoc(logRef, removeUndefined(log));
    } catch (e) {
      console.warn('Failed to record audit log:', e);
      // Non-blocking: audit failure should not break critical user flow
    }
  },

  // Get recent audit logs
  async getRecentLogs(maxCount = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, 'adminLogs'),
        orderBy('timestamp', 'desc'),
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'adminLogs');
    }
  },

  // Get tournament specific audit logs
  async getTournamentLogs(tournamentId: string): Promise<AuditLog[]> {
    try {
      const logs = await this.getRecentLogs(150);
      return (logs || []).filter((l) => l.tournamentId === tournamentId);
    } catch (e) {
      return [];
    }
  },
};
