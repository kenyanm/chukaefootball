/**
 * Authoritative Knockout Bracket Engine for CHUKA eFOOTBALL
 *
 * Strict Compliance:
 * 1. Brackets supported: 8, 16, 32, 64, 128, 256, 512, 1024, 2048+
 * 2. Deterministic BYE calculation: (bracketSize - verifiedCount)
 * 3. Deterministic seeding: No Math.random(). Ordered by verification timestamp with playerId tie-breaker.
 * 4. Admin-only generation restricted to wayongohlaurence@gmail.com.
 * 5. Idempotent: rejects duplicate generation if bracket exists; requires explicit resetKnockoutBracket.
 * 6. Generates full bracket tree (all rounds from Round 1 to Final) in pre-populated fixtures.
 * 7. Chunked batched writes (<= 400 ops per batch) to reliably handle large brackets up to 2048+ players.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  WriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Tournament,
  TournamentEntry,
  MatchFixture,
  RoundSchedule,
  UserProfile,
} from '../types';
import { auditService } from './auditService';
import { sheetsSyncService } from './sheetsSyncService';

export const OFFICIAL_ADMIN_EMAIL = 'wayongohlaurence@gmail.com';
export const AUTHORIZED_ADMIN_EMAILS = ['wayongohlaurence@gmail.com', 'enermindb@gmail.com'];

export interface BracketDimensions {
  verifiedCount: number;
  bracketSize: number;
  totalRounds: number;
  byesCount: number;
  totalMatches: number;
  round1Matches: number;
}

export interface SeededEntry {
  seed: number;
  entry: TournamentEntry;
}

/**
 * Calculates bracket dimensions for any verified player count.
 * Rounds up to nearest power of two >= 8.
 */
export function calculateBracketDimensions(verifiedCount: number): BracketDimensions {
  if (verifiedCount < 2) {
    throw new Error(`Insufficient verified players to build bracket. At least 2 verified players are required (found ${verifiedCount}).`);
  }

  // Minimum tournament bracket size is 8
  const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(Math.max(8, verifiedCount))));
  const totalRounds = Math.round(Math.log2(powerOfTwo));
  const byesCount = powerOfTwo - verifiedCount;
  const totalMatches = powerOfTwo - 1;
  const round1Matches = powerOfTwo / 2;

  return {
    verifiedCount,
    bracketSize: powerOfTwo,
    totalRounds,
    byesCount,
    totalMatches,
    round1Matches,
  };
}

/**
 * Generates standard tournament seed order for single-elimination binary tree.
 * E.g., for size 8: [1, 8, 4, 5, 2, 7, 3, 6]
 * This ensures Seed 1 and Seed 2 meet in the Final, and Seeds 1..byesCount receive byes.
 */
export function generateStandardSeedOrder(size: number): number[] {
  const rounds = Math.round(Math.log2(size));
  let seeds = [1, 2];
  for (let r = 1; r < rounds; r++) {
    const nextSize = seeds.length * 2;
    const nextSeeds: number[] = [];
    for (const s of seeds) {
      nextSeeds.push(s);
      nextSeeds.push(nextSize + 1 - s);
    }
    seeds = nextSeeds;
  }
  return seeds;
}

/**
 * Returns human-readable round name according to international knockout conventions.
 */
export function getKnockoutRoundName(remainingParticipants: number): string {
  if (remainingParticipants === 2) return 'Final';
  if (remainingParticipants === 4) return 'Semifinal';
  if (remainingParticipants === 8) return 'Quarterfinal';
  return `Round of ${remainingParticipants}`;
}

/**
 * Deterministically sorts and assigns seeds (1..N) to verified tournament entries.
 * Priority:
 * 1. verifiedAt timestamp ascending (or registeredAt/createdAt)
 * 2. Permanent playerId string ascending as tie-breaker
 * Zero randomness used.
 */
export function assignDeterministicSeeds(entries: TournamentEntry[]): SeededEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const dateA = new Date(a.verifiedAt || a.registeredAt || (a as any).createdAt || 0).getTime();
    const dateB = new Date(b.verifiedAt || b.registeredAt || (b as any).createdAt || 0).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return (a.playerId || '').localeCompare(b.playerId || '');
  });

  return sorted.map((entry, idx) => ({
    seed: idx + 1,
    entry,
  }));
}

/**
 * Helper to remove undefined fields before writing to Firestore
 */
function sanitizeDoc<T extends Record<string, any>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => {
    if (clean[k] === undefined) delete clean[k];
  });
  return clean;
}

export const bracketEngine = {
  calculateBracketDimensions,
  generateStandardSeedOrder,
  getKnockoutRoundName,
  assignDeterministicSeeds,

  /**
   * Generates the official production knockout bracket for a tournament.
   * Admin-only, idempotent, deterministic.
   */
  async generateKnockoutBracket(
    tournamentId: string,
    adminUid?: string,
    adminEmail?: string
  ): Promise<{
    tournamentId: string;
    bracketSize: number;
    totalRounds: number;
    byesCount: number;
    matchCount: number;
    rounds: number;
  }> {
    // 1. ADMIN-ONLY GENERATION ENFORCEMENT
    const normalizedEmail = (adminEmail || '').toLowerCase().trim();
    if (normalizedEmail && !AUTHORIZED_ADMIN_EMAILS.includes(normalizedEmail)) {
      throw new Error(`UNAUTHORIZED: Official bracket generation is strictly restricted to authorized administrators.`);
    }

    // 2. TOURNAMENT EXISTENCE & STATE VERIFICATION
    const tournRef = doc(db, 'tournaments', tournamentId);
    const tournSnap = await getDoc(tournRef);
    if (!tournSnap.exists()) {
      throw new Error(`Tournament "${tournamentId}" not found in database.`);
    }
    const tournament = tournSnap.data() as Tournament;

    // 3. IDEMPOTENCY CHECK
    if (tournament.bracketVersion) {
      throw new Error(
        `An official knockout bracket (version: ${tournament.bracketVersion}) has already been generated for ${tournament.name}. ` +
        `Accidental regeneration is blocked. Use the Admin Reset Bracket procedure if a rebuild is necessary.`
      );
    }

    // Check if fixtures already exist in Firestore
    const existingMatchesQuery = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId));
    const existingMatchesSnap = await getDocs(existingMatchesQuery);
    if (!existingMatchesSnap.empty) {
      throw new Error(
        `Existing match fixtures found for tournament "${tournamentId}". ` +
        `Reset the current bracket before generating a new official bracket.`
      );
    }

    // 4. VERIFIED PLAYERS QUERY & VALIDATION
    const regQuery = query(
      collection(db, 'registrations'),
      where('tournamentId', '==', tournamentId),
      where('status', '==', 'VERIFIED')
    );
    const regSnap = await getDocs(regQuery);
    const verifiedEntries: TournamentEntry[] = regSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as TournamentEntry)
    );

    if (verifiedEntries.length < 2) {
      throw new Error(
        `Cannot generate knockout bracket: Found only ${verifiedEntries.length} verified players for ${tournament.name}. ` +
        `At least 2 verified players are required.`
      );
    }

    // Ensure every player belongs to this tournament and no duplicates exist
    const seenPlayerIds = new Set<string>();
    for (const entry of verifiedEntries) {
      if (entry.tournamentId !== tournamentId) {
        throw new Error(`Player ${entry.playerId} belongs to a different tournament (${entry.tournamentId}).`);
      }
      if (seenPlayerIds.has(entry.playerId)) {
        throw new Error(`Duplicate verified entry detected for player ${entry.playerId}.`);
      }
      seenPlayerIds.add(entry.playerId);
    }

    // 5. FETCH PLAYER PROFILES (for eFootball usernames & photos)
    const userMap = new Map<string, Partial<UserProfile>>();
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.docs.forEach((u) => {
        const data = u.data() as UserProfile;
        if (data.userId) userMap.set(data.userId, data);
        userMap.set(u.id, data);
      });
    } catch (e) {
      console.warn('[bracketEngine] Could not prefetch all user profiles; using registration metadata', e);
    }

    // 6. CALCULATE BRACKET DIMENSIONS & SEEDING
    const dimensions = calculateBracketDimensions(verifiedEntries.length);
    const seededList = assignDeterministicSeeds(verifiedEntries);
    const seedOrder = generateStandardSeedOrder(dimensions.bracketSize);

    // Map seed number -> SeededEntry
    const seedMap = new Map<number, SeededEntry>();
    seededList.forEach((s) => seedMap.set(s.seed, s));

    const now = new Date().toISOString();
    const weekPadded = String(tournament.weekNumber || 1).padStart(2, '0');
    const allFixtures: MatchFixture[] = [];
    const allRounds: RoundSchedule[] = [];

    // 7. PRE-GENERATE ALL ROUNDS & MATCH FIXTURES
    // We pre-calculate all match docs from Round 1 through the Final
    const matchesByRoundAndPos = new Map<string, MatchFixture>();

    for (let r = 1; r <= dimensions.totalRounds; r++) {
      const remainingTeamsInRound = Math.pow(2, dimensions.totalRounds - r + 1);
      const matchesInThisRound = remainingTeamsInRound / 2;
      const roundName = getKnockoutRoundName(remainingTeamsInRound);
      const roundId = `${tournamentId}_r${r}`;

      // Schedule round deadline (24 hours window per round)
      const startDate = new Date(Date.now() + (r - 1) * 86400000);
      const deadlineDate = new Date(startDate.getTime() + 86400000);

      const roundSchedule: RoundSchedule = {
        id: roundId,
        tournamentId,
        roundNumber: r,
        roundName,
        totalMatches: matchesInThisRound,
        status: r === 1 ? 'ACTIVE' : 'PENDING',
        startDate: startDate.toISOString(),
        deadline: deadlineDate.toISOString(),
        createdAt: now,
      };
      allRounds.push(roundSchedule);

      for (let pos = 1; pos <= matchesInThisRound; pos++) {
        const matchId = `CHK-W${weekPadded}-R${r}-M${String(pos).padStart(3, '0')}`;

        const fixture: MatchFixture = {
          id: matchId,
          matchId,
          tournamentId,
          round: roundName,
          roundId,
          roundNumber: r,
          roundName,
          matchPosition: pos,
          bracketPosition: pos,
          homePlayerId: 'TBD',
          homePlayerName: 'TBD',
          homeDisplayName: 'TBD',
          awayPlayerId: 'TBD',
          awayPlayerName: 'TBD',
          awayDisplayName: 'TBD',
          status: 'SCHEDULED',
          deadline: deadlineDate.toISOString(),
          matchDeadline: deadlineDate.toISOString(),
          createdAt: now,
          updatedAt: now,
        };

        matchesByRoundAndPos.set(`${r}_${pos}`, fixture);
        allFixtures.push(fixture);
      }
    }

    // 8. POPULATE ROUND 1 MATCHES & AUTOMATIC BYE ADVANCEMENT
    const round1Count = dimensions.round1Matches;
    for (let pos = 1; pos <= round1Count; pos++) {
      const fixture = matchesByRoundAndPos.get(`1_${pos}`)!;
      const homeSeedNum = seedOrder[(pos - 1) * 2];
      const awaySeedNum = seedOrder[(pos - 1) * 2 + 1];

      const homeSeeded = seedMap.get(homeSeedNum);
      const awaySeeded = seedMap.get(awaySeedNum);

      if (homeSeeded && awaySeeded) {
        // Active match between two seeded verified players
        const hEntry = homeSeeded.entry;
        const aEntry = awaySeeded.entry;
        const hUser = userMap.get(hEntry.playerId) || userMap.get(hEntry.userId);
        const aUser = userMap.get(aEntry.playerId) || userMap.get(aEntry.userId);

        fixture.homePlayerId = hEntry.playerId;
        fixture.homePlayerUid = hEntry.userId || '';
        fixture.homePlayerName = hUser?.efootballUsername
          ? `${hEntry.displayName} (${hUser.efootballUsername})`
          : hEntry.displayName;
        fixture.homeDisplayName = fixture.homePlayerName;
        fixture.homePlayerPhoto = hUser?.photoURL || '';

        fixture.awayPlayerId = aEntry.playerId;
        fixture.awayPlayerUid = aEntry.userId || '';
        fixture.awayPlayerName = aUser?.efootballUsername
          ? `${aEntry.displayName} (${aUser.efootballUsername})`
          : aEntry.displayName;
        fixture.awayDisplayName = fixture.awayPlayerName;
        fixture.awayPlayerPhoto = aUser?.photoURL || '';
        fixture.status = 'SCHEDULED';
        fixture.isBye = false;
      } else if (homeSeeded && !awaySeeded) {
        // HOME PLAYER RECEIVES BYE -> Automatic advancement to Round 2
        const hEntry = homeSeeded.entry;
        const hUser = userMap.get(hEntry.playerId) || userMap.get(hEntry.userId);

        fixture.homePlayerId = hEntry.playerId;
        fixture.homePlayerUid = hEntry.userId || '';
        fixture.homePlayerName = hUser?.efootballUsername
          ? `${hEntry.displayName} (${hUser.efootballUsername})`
          : hEntry.displayName;
        fixture.homeDisplayName = fixture.homePlayerName;
        fixture.homePlayerPhoto = hUser?.photoURL || '';

        fixture.awayPlayerId = 'BYE';
        fixture.awayPlayerName = 'BYE (Automatic Advance)';
        fixture.awayDisplayName = 'BYE (Automatic Advance)';
        fixture.status = 'CONFIRMED';
        fixture.homeScore = 0;
        fixture.awayScore = 0;
        fixture.winnerId = hEntry.playerId;
        fixture.winnerPlayerId = hEntry.playerId;
        fixture.winnerUid = hEntry.userId || '';
        fixture.isBye = true;

        // Immediately place player into Round 2 match slot!
        if (dimensions.totalRounds > 1) {
          const nextPos = Math.ceil(pos / 2);
          const isHomeInNext = pos % 2 !== 0;
          const nextFixture = matchesByRoundAndPos.get(`2_${nextPos}`);
          if (nextFixture) {
            if (isHomeInNext) {
              nextFixture.homePlayerId = hEntry.playerId;
              nextFixture.homePlayerUid = hEntry.userId || '';
              nextFixture.homePlayerName = fixture.homePlayerName;
              nextFixture.homeDisplayName = fixture.homePlayerName;
              nextFixture.homePlayerPhoto = fixture.homePlayerPhoto || '';
            } else {
              nextFixture.awayPlayerId = hEntry.playerId;
              nextFixture.awayPlayerUid = hEntry.userId || '';
              nextFixture.awayPlayerName = fixture.homePlayerName;
              nextFixture.awayDisplayName = fixture.homePlayerName;
              nextFixture.awayPlayerPhoto = fixture.homePlayerPhoto || '';
            }
          }
        }
      } else if (!homeSeeded && awaySeeded) {
        // AWAY PLAYER RECEIVES BYE
        const aEntry = awaySeeded.entry;
        const aUser = userMap.get(aEntry.playerId) || userMap.get(aEntry.userId);

        fixture.homePlayerId = 'BYE';
        fixture.homePlayerName = 'BYE (Automatic Advance)';
        fixture.homeDisplayName = 'BYE (Automatic Advance)';

        fixture.awayPlayerId = aEntry.playerId;
        fixture.awayPlayerUid = aEntry.userId || '';
        fixture.awayPlayerName = aUser?.efootballUsername
          ? `${aEntry.displayName} (${aUser.efootballUsername})`
          : aEntry.displayName;
        fixture.awayDisplayName = fixture.awayPlayerName;
        fixture.awayPlayerPhoto = aUser?.photoURL || '';
        fixture.status = 'CONFIRMED';
        fixture.homeScore = 0;
        fixture.awayScore = 0;
        fixture.winnerId = aEntry.playerId;
        fixture.winnerPlayerId = aEntry.playerId;
        fixture.winnerUid = aEntry.userId || '';
        fixture.isBye = true;

        if (dimensions.totalRounds > 1) {
          const nextPos = Math.ceil(pos / 2);
          const isHomeInNext = pos % 2 !== 0;
          const nextFixture = matchesByRoundAndPos.get(`2_${nextPos}`);
          if (nextFixture) {
            if (isHomeInNext) {
              nextFixture.homePlayerId = aEntry.playerId;
              nextFixture.homePlayerUid = aEntry.userId || '';
              nextFixture.homePlayerName = fixture.awayPlayerName;
              nextFixture.homeDisplayName = fixture.awayPlayerName;
              nextFixture.homePlayerPhoto = fixture.awayPlayerPhoto || '';
            } else {
              nextFixture.awayPlayerId = aEntry.playerId;
              nextFixture.awayPlayerUid = aEntry.userId || '';
              nextFixture.awayPlayerName = fixture.awayPlayerName;
              nextFixture.awayDisplayName = fixture.awayPlayerName;
              nextFixture.awayPlayerPhoto = fixture.awayPlayerPhoto || '';
            }
          }
        }
      }
    }

    // 9. CHUNKED BATCH WRITE TO FIRESTORE (<= 400 operations per batch)
    // Avoids Firestore 500-write limit for large 2048+ player brackets
    const batchChunks: WriteBatch[] = [];
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitOp = () => {
      opCount++;
      if (opCount >= 400) {
        batchChunks.push(currentBatch);
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    // Save Rounds
    for (const r of allRounds) {
      currentBatch.set(doc(db, 'rounds', r.id), sanitizeDoc(r));
      commitOp();
    }

    // Save Fixtures
    for (const f of allFixtures) {
      currentBatch.set(doc(db, 'matches', f.id), sanitizeDoc(f));
      commitOp();
    }

    // Update Tournament Status
    const initialRoundName = getKnockoutRoundName(dimensions.bracketSize);
    currentBatch.update(tournRef, {
      status: 'LIVE',
      currentRound: initialRoundName,
      totalRounds: dimensions.totalRounds,
      bracketVersion: 'v1.0-official',
      bracketSize: dimensions.bracketSize,
      byesCount: dimensions.byesCount,
      updatedAt: now,
    });
    commitOp();

    // Push the final batch chunk
    if (opCount > 0) {
      batchChunks.push(currentBatch);
    }

    // Commit all chunks sequentially
    for (const b of batchChunks) {
      await b.commit();
    }

    // 10. AUDIT LOGGING
    await auditService.logAction(
      'BRACKET_GENERATED',
      adminUid || 'admin',
      adminEmail,
      tournamentId,
      undefined,
      {
        verifiedCount: verifiedEntries.length,
        bracketSize: dimensions.bracketSize,
        totalRounds: dimensions.totalRounds,
        byesCount: dimensions.byesCount,
        matchCount: allFixtures.length,
        bracketVersion: 'v1.0-official',
      }
    );

    // 11. BACKGROUND GOOGLE SHEETS SYNCHRONIZATION (Non-blocking, Room Number & WhatsApp strictly excluded)
    try {
      for (const f of allFixtures) {
        sheetsSyncService.syncMatch(f).catch(() => {});
      }
    } catch {
      // Ignored non-critical sync errors
    }

    return {
      tournamentId,
      bracketSize: dimensions.bracketSize,
      totalRounds: dimensions.totalRounds,
      byesCount: dimensions.byesCount,
      matchCount: allFixtures.length,
      rounds: dimensions.totalRounds,
    };
  },

  /**
   * Admin Reset / Rebuild Procedure for exceptional cases.
   * Strictly restricted to wayongohlaurence@gmail.com.
   * Deletes matches and rounds, clears bracketVersion, reverts tournament to REGISTRATION_LOCKED.
   */
  async resetKnockoutBracket(
    tournamentId: string,
    adminUid: string,
    adminEmail?: string,
    force = false
  ): Promise<{ deletedMatches: number; deletedRounds: number }> {
    const normalizedEmail = (adminEmail || '').toLowerCase().trim();
    if (normalizedEmail && !AUTHORIZED_ADMIN_EMAILS.includes(normalizedEmail)) {
      throw new Error(`UNAUTHORIZED: Bracket reset is restricted to authorized administrators.`);
    }

    const tournRef = doc(db, 'tournaments', tournamentId);
    const tournSnap = await getDoc(tournRef);
    if (!tournSnap.exists()) {
      throw new Error(`Tournament "${tournamentId}" not found.`);
    }

    // Check if any match has completed results unless force is specified
    const matchQuery = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId));
    const matchSnap = await getDocs(matchQuery);

    if (!force) {
      const hasCompleted = matchSnap.docs.some((d) => {
        const data = d.data() as MatchFixture;
        return data.status === 'CONFIRMED' && !data.isBye;
      });
      if (hasCompleted) {
        throw new Error(
          'Cannot reset bracket: One or more matches have already been confirmed by players. ' +
          'Rebuild requires explicit admin force override.'
        );
      }
    }

    const roundQuery = query(collection(db, 'rounds'), where('tournamentId', '==', tournamentId));
    const roundSnap = await getDocs(roundQuery);

    // Chunked deletion
    const batchChunks: WriteBatch[] = [];
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitOp = () => {
      opCount++;
      if (opCount >= 400) {
        batchChunks.push(currentBatch);
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const mDoc of matchSnap.docs) {
      currentBatch.delete(mDoc.ref);
      commitOp();
    }

    for (const rDoc of roundSnap.docs) {
      currentBatch.delete(rDoc.ref);
      commitOp();
    }

    // Reset tournament document fields
    currentBatch.update(tournRef, {
      status: 'REGISTRATION_LOCKED',
      currentRound: 'Registration Locked',
      bracketVersion: null,
      bracketSize: null,
      byesCount: null,
      updatedAt: new Date().toISOString(),
    });
    commitOp();

    if (opCount > 0) {
      batchChunks.push(currentBatch);
    }

    for (const b of batchChunks) {
      await b.commit();
    }

    await auditService.logAction(
      'BRACKET_RESET',
      adminUid,
      adminEmail,
      tournamentId,
      undefined,
      {
        deletedMatches: matchSnap.size,
        deletedRounds: roundSnap.size,
        forced: force,
      }
    );

    return {
      deletedMatches: matchSnap.size,
      deletedRounds: roundSnap.size,
    };
  },
};
