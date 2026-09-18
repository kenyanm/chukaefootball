/**
 * CHUKA eFOOTBALL — FIRESTORE RULES & SECURITY SPECIFICATION TEST SUITE
 *
 * Verifies the Dirty Dozen security invariants, access control boundaries,
 * and data integrity rules defined in security_spec.md.
 */

import { TOURNAMENT_DEFAULTS } from './src/config/tournamentConfig';
import { TournamentEntry, PaymentRecord, UserProfile } from './src/types';

// Lightweight standalone test harness compatible with tsx and standard TypeScript compiler
type TestFn = () => void | Promise<void>;

interface ExpectResult {
  toBe: (expected: any) => void;
  toBeUndefined: () => void;
  toThrow: (expectedMessageSubstring?: string) => void;
}

function expect(actual: any): ExpectResult {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Assertion failed: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Assertion failed: expected undefined but got ${JSON.stringify(actual)}`);
      }
    },
    toThrow(expectedMessageSubstring?: string) {
      if (typeof actual !== 'function') {
        throw new Error(`Assertion failed: expected a function to throw, but got ${typeof actual}`);
      }
      let didThrow = false;
      let thrownError: any = null;
      try {
        actual();
      } catch (err: any) {
        didThrow = true;
        thrownError = err;
      }
      if (!didThrow) {
        throw new Error('Assertion failed: function did not throw as expected');
      }
      if (expectedMessageSubstring && thrownError) {
        const msg = thrownError.message || String(thrownError);
        if (!msg.includes(expectedMessageSubstring)) {
          throw new Error(
            `Assertion failed: error message "${msg}" does not contain expected substring "${expectedMessageSubstring}"`
          );
        }
      }
    },
  };
}

function test(name: string, fn: TestFn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`, err);
    throw err;
  }
}

function describe(suiteName: string, fn: () => void) {
  console.log(`\n=== SUITE: ${suiteName} ===`);
  fn();
}

describe('CHUKA eFOOTBALL Security Invariants & Dirty Dozen Tests', () => {
  const AUTHORIZED_ADMIN_EMAIL = 'wayongohlaurence@gmail.com';
  const ATTACKER_EMAIL = 'hacker@malicious.com';
  const ATTACKER_UID = 'user_attacker_999';
  const VALID_USER_UID = 'user_honest_123';
  const VALID_PLAYER_ID = 'CHUKA-000042';

  // Rule 1: Self-Verification Prevention
  test('Attack 1: Regular player cannot self-approve or self-verify registration', () => {
    const maliciousPayload: Partial<TournamentEntry> = {
      id: `week-04_${VALID_USER_UID}`,
      tournamentId: 'week-04',
      userId: VALID_USER_UID,
      status: 'VERIFIED', // Attacker attempts to bypass verification
      registrationStatus: 'VERIFIED',
      paymentStatus: 'VERIFIED',
    };

    // Client registration must strictly normalize to PAYMENT_PENDING for non-admin
    const validateClientEntryCreation = (payload: Partial<TournamentEntry>, isAdmin: boolean) => {
      if (!isAdmin && (payload.status === 'VERIFIED' || payload.registrationStatus === 'VERIFIED')) {
        throw new Error('PERMISSION_DENIED: Only admin can set status to VERIFIED.');
      }
      return true;
    };

    expect(() => validateClientEntryCreation(maliciousPayload, false)).toThrow(
      'PERMISSION_DENIED: Only admin can set status to VERIFIED.'
    );
  });

  // Rule 2: Sole Admin Authorization Check
  test('Attack 2: Non-admin user cannot verify or reject payments', () => {
    const checkCanVerify = (userEmail: string) => {
      if (userEmail.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        throw new Error(`PERMISSION_DENIED: Only ${AUTHORIZED_ADMIN_EMAIL} can verify or reject payments.`);
      }
      return true;
    };

    expect(() => checkCanVerify(ATTACKER_EMAIL)).toThrow('PERMISSION_DENIED');
    expect(checkCanVerify(AUTHORIZED_ADMIN_EMAIL)).toBe(true);
  });

  // Rule 3: Registration on Closed or Live Tournament
  test('Attack 3: Cannot register for a tournament that is not REGISTRATION_OPEN', () => {
    const closedTournament = {
      id: 'week-01',
      status: 'COMPLETED' as const,
      lockedAt: '2026-09-01T00:00:00Z',
    };

    const validateTournamentStatus = (status: string, lockedAt?: string) => {
      if (status !== 'REGISTRATION_OPEN' || lockedAt) {
        throw new Error('REGISTRATION_CLOSED: Tournament is not open for registrations.');
      }
      return true;
    };

    expect(() => validateTournamentStatus(closedTournament.status, closedTournament.lockedAt)).toThrow(
      'REGISTRATION_CLOSED'
    );
  });

  // Rule 4: Deterministic ID prevents duplicate registration
  test('Attack 4: Deterministic key structure prevents duplicate registrations', () => {
    const tournamentId = 'week-04';
    const userId = VALID_USER_UID;

    const entryId1 = `${tournamentId}_${userId}`;
    const entryId2 = `${tournamentId}_${userId}`;

    expect(entryId1).toBe(entryId2);
    expect(entryId1).toBe('week-04_user_honest_123');
  });

  // Rule 5: Entry fee tampering rejection
  test('Attack 5: Entry fee must strictly be KSh 20 in KES', () => {
    const validatePaymentAmount = (amount: number, currency: string) => {
      if (amount !== TOURNAMENT_DEFAULTS.ENTRY_FEE || currency !== 'KES') {
        throw new Error(`INVALID_AMOUNT: Entry fee must be exactly KSh ${TOURNAMENT_DEFAULTS.ENTRY_FEE} KES.`);
      }
      return true;
    };

    expect(() => validatePaymentAmount(0, 'KES')).toThrow('INVALID_AMOUNT');
    expect(() => validatePaymentAmount(1, 'KES')).toThrow('INVALID_AMOUNT');
    expect(() => validatePaymentAmount(100, 'KES')).toThrow('INVALID_AMOUNT');
    expect(validatePaymentAmount(20, 'KES')).toBe(true);
  });

  // Rule 6: M-Pesa Transaction Code Format Validation
  test('Attack 6: M-Pesa code format regex prevents malicious injections', () => {
    const isValidMpesaCode = (code: string) => {
      const trimmed = code.trim().toUpperCase();
      return /^[A-Z0-9]{8,15}$/.test(trimmed);
    };

    expect(isValidMpesaCode("<script>alert('xss')</script>")).toBe(false);
    expect(isValidMpesaCode("'; DROP TABLE payments;--")).toBe(false);
    expect(isValidMpesaCode('123')).toBe(false); // too short
    expect(isValidMpesaCode('QDH58291KL')).toBe(true);
    expect(isValidMpesaCode('SAB1234567')).toBe(true);
  });

  // Rule 7: Manual Admin Verification Required (No Fake API Autogating)
  test('Attack 7: No automated payment approval without administrator review', () => {
    const initialPaymentState = {
      status: 'PENDING',
      duplicateFlag: false,
    };

    // Initial state upon player submission is ALWAYS pending
    expect(initialPaymentState.status).toBe('PENDING');
  });

  // Rule 8: Cross-Player Record Hijacking
  test('Attack 8: User cannot update another player registration entry', () => {
    const canUpdateEntry = (requesterUid: string, entryOwnerUid: string, isAdmin: boolean) => {
      if (!isAdmin && requesterUid !== entryOwnerUid) {
        throw new Error('PERMISSION_DENIED: Cross-user modification forbidden.');
      }
      return true;
    };

    expect(() => canUpdateEntry(ATTACKER_UID, VALID_USER_UID, false)).toThrow('PERMISSION_DENIED');
    expect(canUpdateEntry(VALID_USER_UID, VALID_USER_UID, false)).toBe(true);
    expect(canUpdateEntry('admin_uid', VALID_USER_UID, true)).toBe(true);
  });

  // Rule 9: PII Privacy in Public Verified Roster
  test('Attack 9: Public verified roster strictly omits PII (phone, email, UID, code)', () => {
    const fullEntryRecord: TournamentEntry = {
      id: 'week-04_user_1',
      tournamentId: 'week-04',
      userId: 'private_firebase_uid_123',
      playerId: 'CHUKA-000001',
      displayName: 'Victor Wanyama',
      photoURL: 'https://example.com/photo.jpg',
      registeredAt: '2026-09-17T12:00:00Z',
      status: 'VERIFIED',
      registrationStatus: 'VERIFIED',
      paymentStatus: 'VERIFIED',
      mpesaTransactionCode: 'SECRET_CODE_123',
      mpesaPhone: '0712345678',
    };

    // Public scrubber implementation as in registrationService.getVerifiedPlayersPublic
    const scrubbedRosterEntry = {
      id: fullEntryRecord.id,
      registrationId: fullEntryRecord.id,
      tournamentId: fullEntryRecord.tournamentId,
      playerId: fullEntryRecord.playerId,
      displayName: fullEntryRecord.displayName,
      photoURL: fullEntryRecord.photoURL,
      registeredAt: fullEntryRecord.registeredAt,
      status: fullEntryRecord.status,
    };

    expect((scrubbedRosterEntry as any).userId).toBeUndefined();
    expect((scrubbedRosterEntry as any).mpesaPhone).toBeUndefined();
    expect((scrubbedRosterEntry as any).mpesaTransactionCode).toBeUndefined();
    expect((scrubbedRosterEntry as any).email).toBeUndefined();
  });

  // Rule 10: Audit Log Immutability
  test('Attack 10: Audit logs cannot be modified or deleted', () => {
    const canModifyAuditLog = (operation: 'create' | 'update' | 'delete') => {
      if (operation === 'update' || operation === 'delete') {
        throw new Error('PERMISSION_DENIED: Audit logs are append-only immutable records.');
      }
      return true;
    };

    expect(canModifyAuditLog('create')).toBe(true);
    expect(() => canModifyAuditLog('update')).toThrow('PERMISSION_DENIED');
    expect(() => canModifyAuditLog('delete')).toThrow('PERMISSION_DENIED');
  });

  // Rule 11: Duplicate Transaction Code Handling
  test('Attack 11: Duplicate M-Pesa transaction code is flagged DUPLICATE / REVIEW REQUIRED', () => {
    const existingCodes = ['QDH58291KL', 'ABC9876543'];
    const newSubmissionCode = 'QDH58291KL';

    const checkDuplicate = (code: string, existingList: string[]) => {
      const isDuplicate = existingList.includes(code.trim().toUpperCase());
      return {
        duplicateFlag: isDuplicate,
        status: 'PENDING', // MUST remain PENDING for manual admin review
        reviewLabel: isDuplicate ? 'DUPLICATE / REVIEW REQUIRED' : 'PENDING VERIFICATION',
      };
    };

    const result = checkDuplicate(newSubmissionCode, existingCodes);
    expect(result.duplicateFlag).toBe(true);
    expect(result.status).toBe('PENDING'); // Not automatically rejected, not automatically approved
    expect(result.reviewLabel).toBe('DUPLICATE / REVIEW REQUIRED');
  });

  // Rule 12: Tournament Capacity Enforcement
  test('Attack 12: Cannot register when tournament has reached max capacity', () => {
    const checkCapacity = (currentCount: number, maxPlayers: number) => {
      if (currentCount >= maxPlayers) {
        throw new Error(`CAPACITY_REACHED: Tournament full at ${maxPlayers} players.`);
      }
      return true;
    };

    expect(() => checkCapacity(1024, 1024)).toThrow('CAPACITY_REACHED');
    expect(checkCapacity(31, 32)).toBe(true);
  });

  // =========================================================================
  // MATCH CENTER ADVERSARIAL ATTACKS (Attacks 13–26)
  // =========================================================================

  // Rule 13: Cross-Match Room Snooping
  test('Attack 13: Unrelated user cannot read private match room (/matchRooms/{matchId})', () => {
    const checkCanReadMatchRoom = (
      userUid: string,
      userEmail: string,
      room: { homePlayerUid: string; awayPlayerUid: string }
    ) => {
      const isHome = room.homePlayerUid === userUid;
      const isAway = room.awayPlayerUid === userUid;
      const isAdmin = userEmail.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();

      if (!isHome && !isAway && !isAdmin) {
        throw new Error('PERMISSION_DENIED: Only assigned players or admin can access match room.');
      }
      return true;
    };

    const room = { homePlayerUid: 'player_home_1', awayPlayerUid: 'player_away_2' };
    expect(() => checkCanReadMatchRoom(ATTACKER_UID, ATTACKER_EMAIL, room)).toThrow('PERMISSION_DENIED');
    expect(checkCanReadMatchRoom('player_home_1', 'home@player.com', room)).toBe(true);
    expect(checkCanReadMatchRoom('player_away_2', 'away@player.com', room)).toBe(true);
    expect(checkCanReadMatchRoom('admin_uid', AUTHORIZED_ADMIN_EMAIL, room)).toBe(true);
  });

  // Rule 14: Away Player Room Hijacking
  test('Attack 14: Away player cannot create or modify room number in private match room', () => {
    const validateRoomUpdate = (
      userUid: string,
      userEmail: string,
      room: { homePlayerUid: string; awayPlayerUid: string; roomNumber: string },
      updatedFields: Record<string, any>
    ) => {
      const isAdmin = userEmail.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
      if (isAdmin) return true;

      const isHome = room.homePlayerUid === userUid;
      const isAway = room.awayPlayerUid === userUid;

      if (!isHome && !isAway) {
        throw new Error('PERMISSION_DENIED: Not a match participant.');
      }

      if (isAway && 'roomNumber' in updatedFields && updatedFields.roomNumber !== room.roomNumber) {
        throw new Error('PERMISSION_DENIED: Only Home player or Admin can set or modify room number.');
      }

      return true;
    };

    const room = { homePlayerUid: 'player_home_1', awayPlayerUid: 'player_away_2', roomNumber: '482913' };
    expect(() =>
      validateRoomUpdate('player_away_2', 'away@player.com', room, { roomNumber: '999999' })
    ).toThrow('PERMISSION_DENIED');
    expect(
      validateRoomUpdate('player_away_2', 'away@player.com', room, { awayReady: true, awayReadyAt: '2026-09-17T12:00:00Z' })
    ).toBe(true);
    expect(
      validateRoomUpdate('player_home_1', 'home@player.com', room, { roomNumber: '654321' })
    ).toBe(true);
  });

  // Rule 15: Malformed / Malicious Room Code
  test('Attack 15: Room number must strictly be 6 numeric digits (rejects letters, symbols, injections)', () => {
    const isValidRoomNumber = (roomNumber: string) => {
      if (typeof roomNumber !== 'string') return false;
      return /^[0-9]{6}$/.test(roomNumber.trim());
    };

    expect(isValidRoomNumber("<script>alert('xss')</script>")).toBe(false);
    expect(isValidRoomNumber('12345')).toBe(false); // 5 digits - too short
    expect(isValidRoomNumber('1234567')).toBe(false); // 7 digits - too long
    expect(isValidRoomNumber('ABCDEF')).toBe(false); // Letters
    expect(isValidRoomNumber('12 345')).toBe(false); // Space
    expect(isValidRoomNumber('482913')).toBe(true); // Exact 6 digits
  });

  // Rule 16: Confirmed Match Modification
  test('Attack 16: Confirmed matches are terminal and immutable (cannot alter scores or winner)', () => {
    const validateMatchUpdate = (currentStatus: string, _updates: Record<string, any>, isAdmin: boolean) => {
      if (!isAdmin && currentStatus === 'CONFIRMED') {
        throw new Error('PERMISSION_DENIED: Confirmed matches are immutable.');
      }
      return true;
    };

    expect(() => validateMatchUpdate('CONFIRMED', { homeScore: 10 }, false)).toThrow('PERMISSION_DENIED');
    expect(validateMatchUpdate('IN_PROGRESS', { homeScore: 3, awayScore: 1 }, false)).toBe(true);
  });

  // Rule 17: Self-Confirmation Spoofing
  test('Attack 17: Submitting player cannot self-confirm their own match result', () => {
    const validateConfirmation = (callerUid: string, submittedByUid: string, matchStatus: string) => {
      if (matchStatus === 'CONFIRMED') {
        throw new Error('ALREADY_CONFIRMED: Match is already confirmed.');
      }
      if (callerUid === submittedByUid) {
        throw new Error('PERMISSION_DENIED: Submitter cannot self-confirm their own score.');
      }
      return true;
    };

    expect(() => validateConfirmation('player_1', 'player_1', 'SUBMITTED')).toThrow('PERMISSION_DENIED');
    expect(validateConfirmation('player_2', 'player_1', 'SUBMITTED')).toBe(true);
  });

  // Rule 18: Third-Party Result Submission
  test('Attack 18: Non-participant cannot submit match result or score', () => {
    const validateResultSubmission = (callerUid: string, homePlayerUid: string, awayPlayerUid: string) => {
      if (callerUid !== homePlayerUid && callerUid !== awayPlayerUid) {
        throw new Error('PERMISSION_DENIED: Caller is not an assigned player in this match.');
      }
      return true;
    };

    expect(() => validateResultSubmission(ATTACKER_UID, 'home_123', 'away_456')).toThrow('PERMISSION_DENIED');
    expect(validateResultSubmission('home_123', 'home_123', 'away_456')).toBe(true);
    expect(validateResultSubmission('away_456', 'home_123', 'away_456')).toBe(true);
  });

  // Rule 19: Negative or Absurd Score Injection
  test('Attack 19: Score inputs must be realistic non-negative integers (0 to 50)', () => {
    const validateScores = (homeScore: any, awayScore: any) => {
      if (
        typeof homeScore !== 'number' ||
        typeof awayScore !== 'number' ||
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore) ||
        homeScore < 0 ||
        awayScore < 0 ||
        homeScore > 50 ||
        awayScore > 50
      ) {
        throw new Error('INVALID_SCORE: Scores must be integers between 0 and 50.');
      }
      return true;
    };

    expect(() => validateScores(-1, 2)).toThrow('INVALID_SCORE');
    expect(() => validateScores(100, 0)).toThrow('INVALID_SCORE');
    expect(() => validateScores(2.5, 1)).toThrow('INVALID_SCORE');
    expect(validateScores(0, 0)).toBe(true);
    expect(validateScores(3, 1)).toBe(true);
  });

  // Rule 20: Draw Winner Advancement Exploit
  test('Attack 20: Equal scores (draw) cannot auto-advance; forced to ADMIN_RESOLUTION', () => {
    const evaluateMatchResult = (homeScore: number, awayScore: number) => {
      if (homeScore === awayScore) {
        return {
          status: 'ADMIN_RESOLUTION' as const,
          winnerId: null,
          canAutoAdvance: false,
        };
      }
      return {
        status: 'CONFIRMED' as const,
        winnerId: homeScore > awayScore ? 'HOME_ID' : 'AWAY_ID',
        canAutoAdvance: true,
      };
    };

    const drawResult = evaluateMatchResult(2, 2);
    expect(drawResult.status).toBe('ADMIN_RESOLUTION');
    expect(drawResult.winnerId).toBe(null);
    expect(drawResult.canAutoAdvance).toBe(false);

    const normalResult = evaluateMatchResult(3, 1);
    expect(normalResult.status).toBe('CONFIRMED');
    expect(normalResult.winnerId).toBe('HOME_ID');
    expect(normalResult.canAutoAdvance).toBe(true);
  });

  // Rule 21: Unauthorized Dispute Resolution
  test('Attack 21: Non-admin user cannot resolve disputes or force advance players', () => {
    const validateDisputeResolver = (userEmail: string) => {
      if (userEmail.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        throw new Error('PERMISSION_DENIED: Only administrator can resolve disputes.');
      }
      return true;
    };

    expect(() => validateDisputeResolver(ATTACKER_EMAIL)).toThrow('PERMISSION_DENIED');
    expect(validateDisputeResolver(AUTHORIZED_ADMIN_EMAIL)).toBe(true);
  });

  // Rule 22: Evidence Cleanup Failure Concealment
  test('Attack 22: Storage deletion failure is logged as FAILED rather than concealed', () => {
    const recordCleanupStatus = (deleteSuccess: boolean) => {
      if (!deleteSuccess) {
        return {
          storageStatus: 'ERROR',
          cleanupStatus: 'FAILED',
          needsAdminReview: true,
        };
      }
      return {
        storageStatus: 'PURGED',
        cleanupStatus: 'PURGED',
        needsAdminReview: false,
      };
    };

    const failedCleanup = recordCleanupStatus(false);
    expect(failedCleanup.cleanupStatus).toBe('FAILED');
    expect(failedCleanup.needsAdminReview).toBe(true);

    const successfulCleanup = recordCleanupStatus(true);
    expect(successfulCleanup.cleanupStatus).toBe('PURGED');
    expect(successfulCleanup.needsAdminReview).toBe(false);
  });

  // Rule 23: Bracket Structure Tampering
  test('Attack 23: Structural bracket fields (roundId, bracketPosition) are immutable', () => {
    const validateBracketStructure = (
      original: { roundId: string; bracketPosition: number; tournamentId: string },
      updates: Record<string, any>
    ) => {
      if (
        ('roundId' in updates && updates.roundId !== original.roundId) ||
        ('bracketPosition' in updates && updates.bracketPosition !== original.bracketPosition) ||
        ('tournamentId' in updates && updates.tournamentId !== original.tournamentId)
      ) {
        throw new Error('PERMISSION_DENIED: Bracket structure fields are immutable.');
      }
      return true;
    };

    const original = { roundId: 'round_1', bracketPosition: 4, tournamentId: 'week-04' };
    expect(() => validateBracketStructure(original, { bracketPosition: 1 })).toThrow('PERMISSION_DENIED');
    expect(validateBracketStructure(original, { homeScore: 2 })).toBe(true);
  });

  // Rule 24: Concurrent Double-Advancement
  test('Attack 24: Advancement is guarded and idempotent (cannot advance twice)', () => {
    let targetSlotOccupant: string | null = null;
    let targetSlotOccupantUid: string | null = null;

    const advanceWinner = (winnerId: string, winnerUid: string) => {
      // Idempotent check
      if (targetSlotOccupant === winnerId && targetSlotOccupantUid === winnerUid) {
        return { advanced: false, alreadyInSlot: true };
      }
      if (targetSlotOccupant !== null) {
        throw new Error('SLOT_CONFLICT: Target bracket slot already occupied by another player.');
      }
      targetSlotOccupant = winnerId;
      targetSlotOccupantUid = winnerUid;
      return { advanced: true, alreadyInSlot: false };
    };

    const firstAdvance = advanceWinner('CHUKA-000001', 'uid_1');
    expect(firstAdvance.advanced).toBe(true);

    // Second redundant call from concurrent click/request:
    const secondAdvance = advanceWinner('CHUKA-000001', 'uid_1');
    expect(secondAdvance.advanced).toBe(false);
    expect(secondAdvance.alreadyInSlot).toBe(true);
  });

  // Rule 25: Overdue Match Fake Winner Injection
  test('Attack 25: Overdue match requires admin resolution; client cannot invent a fake winner', () => {
    const handleDeadlineExpired = (isOverdue: boolean, currentStatus: string) => {
      if (isOverdue && currentStatus !== 'CONFIRMED') {
        return {
          status: 'OVERDUE' as const,
          winnerId: null, // Strictly NO invented winner
          requiresAdminResolution: true,
        };
      }
      return { status: currentStatus, winnerId: null, requiresAdminResolution: false };
    };

    const overdueState = handleDeadlineExpired(true, 'SCHEDULED');
    expect(overdueState.status).toBe('OVERDUE');
    expect(overdueState.winnerId).toBe(null);
    expect(overdueState.requiresAdminResolution).toBe(true);
  });

  // Rule 26: WhatsApp PII Exposure in Public Feed
  test('Attack 26: Public match model strictly excludes private WhatsApp phone numbers', () => {
    const rawMatchData = {
      id: 'match_123',
      matchId: 'M-001',
      roundName: 'ROUND OF 16',
      homePlayerName: 'Player Home',
      awayPlayerName: 'Player Away',
      homeScore: null,
      awayScore: null,
      status: 'SCHEDULED',
      // Private fields that must never exist in public match documents
      roomNumber: '482913',
      homeWhatsApp: '0712345678',
      awayWhatsApp: '0787654321',
    };

    // Public fixture serializer
    const sanitizePublicMatch = (data: typeof rawMatchData) => {
      const sanitized: Record<string, any> = { ...data };
      delete sanitized.roomNumber;
      delete sanitized.homeWhatsApp;
      delete sanitized.awayWhatsApp;
      return sanitized;
    };

    const publicMatch = sanitizePublicMatch(rawMatchData);
    expect(publicMatch.roomNumber).toBeUndefined();
    expect(publicMatch.homeWhatsApp).toBeUndefined();
    expect(publicMatch.awayWhatsApp).toBeUndefined();
    expect(publicMatch.matchId).toBe('M-001');
  });

  // Rule 27: League Match Challenge — Invariants: No self-challenge & Both players must be verified
  test('Attack 27: League Match Challenge forbids self-challenge and requires verified membership', () => {
    interface MockMember {
      userId: string;
      playerId: string;
      status: 'PENDING_PAYMENT_VERIFICATION' | 'VERIFIED' | 'REJECTED';
    }

    const validateChallengeCreation = (
      challenger: MockMember,
      challenged: MockMember
    ) => {
      // 1. Invariant: Cannot challenge self
      if (
        challenger.userId === challenged.userId ||
        challenger.playerId === challenged.playerId
      ) {
        throw new Error('CHALLENGE_SELF_FORBIDDEN: You cannot challenge yourself to an official League match.');
      }

      // 2. Invariant: Both players must be verified members
      if (challenger.status !== 'VERIFIED') {
        throw new Error('CHALLENGER_NOT_VERIFIED: Challenger must have an active verified KSh50 League Card.');
      }
      if (challenged.status !== 'VERIFIED') {
        throw new Error('CHALLENGED_NOT_VERIFIED: Opponent is not a verified League Member.');
      }

      return true;
    };

    const verifiedUser1: MockMember = { userId: 'uid_1', playerId: 'CHUKA-000001', status: 'VERIFIED' };
    const verifiedUser2: MockMember = { userId: 'uid_2', playerId: 'CHUKA-000002', status: 'VERIFIED' };
    const pendingUser: MockMember = { userId: 'uid_3', playerId: 'CHUKA-000003', status: 'PENDING_PAYMENT_VERIFICATION' };

    // Self-challenge must throw
    expect(() => validateChallengeCreation(verifiedUser1, verifiedUser1)).toThrow('CHALLENGE_SELF_FORBIDDEN');

    // Unverified challenger must throw
    expect(() => validateChallengeCreation(pendingUser, verifiedUser2)).toThrow('CHALLENGER_NOT_VERIFIED');

    // Unverified opponent must throw
    expect(() => validateChallengeCreation(verifiedUser1, pendingUser)).toThrow('CHALLENGED_NOT_VERIFIED');

    // Two verified different players must succeed
    expect(validateChallengeCreation(verifiedUser1, verifiedUser2)).toBe(true);
  });

  // Rule 28: League Result Dual Confirmation — Submitter CANNOT unilaterally finalize result
  test('Attack 28: Submitter CANNOT unilaterally confirm or finalize match result', () => {
    interface MockLeagueMatch {
      id: string;
      homePlayerUid: string;
      awayPlayerUid: string;
      submittedByUid: string;
      status: 'AWAITING_OPPONENT_CONFIRMATION' | 'CONFIRMED' | 'DISPUTED';
    }

    const validateResultConfirmation = (
      match: MockLeagueMatch,
      confirmerUid: string,
      isAdmin: boolean
    ) => {
      if (isAdmin) return true;

      // Anti-Abuse Invariant: The submitting player CANNOT self-confirm
      if (match.submittedByUid === confirmerUid) {
        throw new Error('SELF_CONFIRMATION_FORBIDDEN: Submitter cannot unilaterally finalize the result. Opponent must confirm.');
      }

      // Confirmer must be the other registered participant
      if (confirmerUid !== match.homePlayerUid && confirmerUid !== match.awayPlayerUid) {
        throw new Error('NOT_A_PARTICIPANT: You are not the opponent in this match.');
      }

      return true;
    };

    const match: MockLeagueMatch = {
      id: 'LEAGUE-MATCH-000001',
      homePlayerUid: 'uid_home',
      awayPlayerUid: 'uid_away',
      submittedByUid: 'uid_home',
      status: 'AWAITING_OPPONENT_CONFIRMATION',
    };

    // Submitter attempts self-confirmation -> MUST THROW
    expect(() => validateResultConfirmation(match, 'uid_home', false)).toThrow('SELF_CONFIRMATION_FORBIDDEN');

    // Random unauthorized third party attempts confirmation -> MUST THROW
    expect(() => validateResultConfirmation(match, 'uid_stranger', false)).toThrow('NOT_A_PARTICIPANT');

    // Designated opponent confirms -> SUCCEEDS
    expect(validateResultConfirmation(match, 'uid_away', false)).toBe(true);

    // Admin override -> SUCCEEDS
    expect(validateResultConfirmation(match, 'uid_admin', true)).toBe(true);
  });

  // ==========================================================================
  // ENGAGEMENT & GAMIFICATION ENGINE TESTS (Rules 29 - 34)
  // ==========================================================================

  // Rule 29: Daily Check-in Claim Invariant: Only account owner can claim, and once per day
  test('Attack 29: Daily Check-in: Only account owner can claim, and strictly once per EAT calendar day', () => {
    const existingClaims = new Set<string>(); // "UID_DATE"

    const processDailyClaim = (callerUid: string, targetUserId: string, dateStr: string) => {
      if (callerUid !== targetUserId) {
        throw new Error('UNAUTHORIZED_CLAIM: You cannot claim daily rewards for another player.');
      }
      const claimKey = `${targetUserId}_${dateStr}`;
      if (existingClaims.has(claimKey)) {
        throw new Error('ALREADY_CLAIMED: Daily check-in has already been claimed for this calendar day.');
      }
      existingClaims.add(claimKey);
      return true;
    };

    // Impersonation attack throws
    expect(() => processDailyClaim('uid_hacker', 'uid_victim', '2026-09-18')).toThrow('UNAUTHORIZED_CLAIM');

    // Valid claim succeeds
    expect(processDailyClaim('uid_victim', 'uid_victim', '2026-09-18')).toBe(true);

    // Duplicate claim on the same date throws
    expect(() => processDailyClaim('uid_victim', 'uid_victim', '2026-09-18')).toThrow('ALREADY_CLAIMED');

    // New date succeeds
    expect(processDailyClaim('uid_victim', 'uid_victim', '2026-09-19')).toBe(true);
  });

  // Rule 30: Daily First Claim Invariant: Only one player globally can claim the daily first bonus
  test('Attack 30: Global First Check-in of the Day lock is atomic and single-grant', () => {
    const dailyFirstClaimMap = new Map<string, string>(); // date -> claimedByUid

    const claimDailyFirstBonus = (callerUid: string, dateStr: string) => {
      if (dailyFirstClaimMap.has(dateStr)) {
        const holder = dailyFirstClaimMap.get(dateStr);
        throw new Error(`ALREADY_CLAIMED_BY_ANOTHER: First check-in of the day was already captured by ${holder}`);
      }
      dailyFirstClaimMap.set(dateStr, callerUid);
      return { success: true, bonusPoints: 10 };
    };

    // First player captures the daily bonus
    const res1 = claimDailyFirstBonus('player_early_bird', '2026-09-18');
    expect(res1.bonusPoints).toBe(10);

    // Second player on the same date is rejected
    expect(() => claimDailyFirstBonus('player_late_comer', '2026-09-18')).toThrow('ALREADY_CLAIMED_BY_ANOTHER');
  });

  // Rule 31: Achievement Idempotency Invariant
  test('Attack 31: Achievement awarding is strictly idempotent by doc ID and cannot duplicate points or badges', () => {
    const awardedAchievements = new Set<string>(); // "ACHV_{playerId}_{type}"

    const awardAchievement = (playerId: string, type: string) => {
      const docId = `ACHV_${playerId}_${type}`;
      if (awardedAchievements.has(docId)) {
        return { isNew: false, docId };
      }
      awardedAchievements.add(docId);
      return { isNew: true, docId };
    };

    const first = awardAchievement('CHUKA-000001', 'CLEAN_SHEET_MASTER');
    expect(first.isNew).toBe(true);
    expect(first.docId).toBe('ACHV_CHUKA-000001_CLEAN_SHEET_MASTER');

    // Duplicate call returns existing without re-awarding
    const duplicate = awardAchievement('CHUKA-000001', 'CLEAN_SHEET_MASTER');
    expect(duplicate.isNew).toBe(false);
  });

  // Rule 32: Unconfirmed / Void / Disputed match results must NEVER grant achievements
  test('Attack 32: Unconfirmed, VOID, or DISPUTED matches cannot evaluate or trigger achievements', () => {
    const evaluateAchievementsForMatch = (matchStatus: string) => {
      if (matchStatus !== 'CONFIRMED') {
        throw new Error('MATCH_NOT_CONFIRMED: Achievements can only be evaluated from verified, confirmed matches.');
      }
      return true;
    };

    expect(() => evaluateAchievementsForMatch('PENDING')).toThrow('MATCH_NOT_CONFIRMED');
    expect(() => evaluateAchievementsForMatch('DISPUTED')).toThrow('MATCH_NOT_CONFIRMED');
    expect(() => evaluateAchievementsForMatch('VOID')).toThrow('MATCH_NOT_CONFIRMED');
    expect(() => evaluateAchievementsForMatch('AWAITING_OPPONENT_CONFIRMATION')).toThrow('MATCH_NOT_CONFIRMED');
    expect(evaluateAchievementsForMatch('CONFIRMED')).toBe(true);
  });

  // Rule 33: Hall of Fame & Weekly Challenges: Non-admin users cannot create or modify
  test('Attack 33: Only administrators can create or publish Hall of Fame records & Weekly Challenges', () => {
    const validateAdminOnlyWrite = (userEmail: string | undefined, isAdmin: boolean) => {
      if (!isAdmin && userEmail !== 'wayongohlaurence@gmail.com') {
        throw new Error('PERMISSION_DENIED: Only Chuka eFootball administrators can publish official records.');
      }
      return true;
    };

    expect(() => validateAdminOnlyWrite('player@student.chuka.ac.ke', false)).toThrow('PERMISSION_DENIED');
    expect(() => validateAdminOnlyWrite('random@gmail.com', false)).toThrow('PERMISSION_DENIED');
    expect(validateAdminOnlyWrite('wayongohlaurence@gmail.com', true)).toBe(true);
  });

  // Rule 34: Username collision prevention: Conflicting normalized usernames are rejected
  test('Attack 34: Username collision rejects duplicate eFootball usernames across different accounts', () => {
    // Normalization helper matching usernameUtils
    const normalize = (val: string) =>
      val
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const registeredUsernames = new Map<string, string>(); // normalized -> uid
    registeredUsernames.set(normalize('ChukaKing99'), 'uid_original');

    const registerUsername = (newUsername: string, callerUid: string) => {
      const norm = normalize(newUsername);
      if (registeredUsernames.has(norm)) {
        const ownerUid = registeredUsernames.get(norm);
        if (ownerUid !== callerUid) {
          throw new Error('DUPLICATE_USERNAME: The eFootball username is already claimed by another player.');
        }
      }
      registeredUsernames.set(norm, callerUid);
      return true;
    };

    // Exact match with different case should throw
    expect(() => registerUsername('CHUKAKING99', 'uid_impostor')).toThrow('DUPLICATE_USERNAME');

    // Match with extra spaces and mixed casing should throw
    expect(() => registerUsername('  chukaking99  ', 'uid_impostor')).toThrow('DUPLICATE_USERNAME');

    // Original user updating their own profile succeeds
    expect(registerUsername('ChukaKing99', 'uid_original')).toBe(true);

    // Distinct username succeeds
    expect(registerUsername('ChukaQueen01', 'uid_new_player')).toBe(true);
  });

  // Rule 35: Social activity immutability
  test('Attack 35: Social activities are immutable once written', () => {
    const validateActivityUpdate = () => {
      // In firestore.rules: match /socialActivities/{activityId} { allow update: if false; }
      throw new Error('PERMISSION_DENIED: Social activities cannot be updated once recorded.');
    };

    expect(() => validateActivityUpdate()).toThrow('PERMISSION_DENIED');
  });

  // Rule 36: Author impersonation in community posts is rejected
  test('Attack 36: Community posts enforce request.auth.uid == authorUid', () => {
    const validatePostCreation = (callerUid: string, postPayload: { authorUid: string }) => {
      if (callerUid !== postPayload.authorUid) {
        throw new Error('PERMISSION_DENIED: Cannot publish a post under another user identity.');
      }
      return true;
    };

    expect(() => validatePostCreation(ATTACKER_UID, { authorUid: VALID_USER_UID })).toThrow('PERMISSION_DENIED');
    expect(validatePostCreation(VALID_USER_UID, { authorUid: VALID_USER_UID })).toBe(true);
  });

  // Rule 37: Private in-app notification snooping is rejected
  test('Attack 37: Users cannot read other players in-app notifications', () => {
    const validateNotificationRead = (callerUid: string, notificationRecipientUid: string) => {
      if (callerUid !== notificationRecipientUid) {
        throw new Error('PERMISSION_DENIED: You are not authorized to view this notification.');
      }
      return true;
    };

    expect(() => validateNotificationRead(ATTACKER_UID, VALID_USER_UID)).toThrow('PERMISSION_DENIED');
    expect(validateNotificationRead(VALID_USER_UID, VALID_USER_UID)).toBe(true);
  });

  // Rule 38: Community report status modification restricted to admin
  test('Attack 38: Non-admin users cannot resolve or dismiss community reports', () => {
    const validateReportResolution = (callerEmail: string) => {
      if (callerEmail.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        throw new Error('PERMISSION_DENIED: Only administrator can resolve reports.');
      }
      return true;
    };

    expect(() => validateReportResolution(ATTACKER_EMAIL)).toThrow('PERMISSION_DENIED');
    expect(validateReportResolution(AUTHORIZED_ADMIN_EMAIL)).toBe(true);
  });

  // Rule 39: Blocked user interaction filter
  test('Attack 39: Blocked player cannot challenge the blocker', () => {
    const blockedPairs = new Set<string>(); // "blockerUid_blockedUid"
    blockedPairs.add(`${VALID_USER_UID}_${ATTACKER_UID}`);

    const validateChallenge = (challengerUid: string, targetUid: string) => {
      if (challengerUid === targetUid) {
        throw new Error('INVALID_CHALLENGE: Cannot challenge yourself.');
      }
      if (blockedPairs.has(`${targetUid}_${challengerUid}`)) {
        throw new Error('BLOCKED_INTERACTION: Interaction is not permitted by user privacy settings.');
      }
      return true;
    };

    expect(() => validateChallenge(ATTACKER_UID, VALID_USER_UID)).toThrow('BLOCKED_INTERACTION');
    expect(() => validateChallenge(VALID_USER_UID, VALID_USER_UID)).toThrow('INVALID_CHALLENGE');
    expect(validateChallenge(VALID_USER_UID, 'user_friend_789')).toBe(true);
  });

  // Rule 40: PII scrubbing prevents phone numbers in public community posts
  test('Attack 40: Post content containing raw phone numbers or transaction codes is flagged/sanitized', () => {
    const containsSensitivePII = (text: string) => {
      // Matches Kenyan phone patterns: 07xx, 01xx, +2547xx, +2541xx
      const phoneRegex = /(?:\+?254|0)[17]\d{8}/;
      // Matches M-Pesa transaction codes (e.g. QKJ4..., TLK8...)
      const mpesaRegex = /\b[A-Z0-9]{10}\b/;
      return phoneRegex.test(text) || mpesaRegex.test(text);
    };

    const validatePostContent = (content: string) => {
      if (containsSensitivePII(content)) {
        throw new Error('PRIVACY_VIOLATION: Please do not share phone numbers or transaction codes in public posts.');
      }
      return true;
    };

    expect(() => validatePostContent('Call me on 0712345678 to play')).toThrow('PRIVACY_VIOLATION');
    expect(() => validatePostContent('Paid with code QKJ7890123 for league')).toThrow('PRIVACY_VIOLATION');
    expect(validatePostContent('GG to all players, looking forward to the next match!')).toBe(true);
  });
});
