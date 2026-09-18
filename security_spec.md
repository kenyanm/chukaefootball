# CHUKA eFOOTBALL — SECURITY SPECIFICATION (Phase 0: Security TDD)

## 1. System Invariants & Architecture
* **Authoritative Source of Truth:** Firebase Firestore is authoritative.
* **Secondary Integration:** Google Sheets receives an operational reporting copy via Google Apps Script Web App. Failures or latencies in Google Sheets synchronization never block or crash user registration or match play.
* **Prohibited Components:** Strictly no Cloud Functions, no Cloud Run, no Firebase Blaze upgrade, no custom Node backend, no Google Sheets API, and no fake payment gateway APIs.
* **Sole Authorized Administrator:** `wayongohlaurence@gmail.com`
* **Entry Fee Invariant:** Exactly KSh 20 (`amount == 20`, `currency == 'KES'`).
* **Payment Destination Invariant:** `0111359682` (Neutral display: "Payment destination: 0111359682", never labeled as Till/PayBill).
* **Champion Prize:** KSh 1,000.
* **Deterministic Registration Key:** `entryId = "${tournamentId}_${userId}"` guaranteeing single registration per player per tournament at the database key level.

---

## 2. Status Lifecycle & State Machine
1. **Initial Registration Submission:**
   - Registration created with `status: 'PAYMENT_PENDING'`, `registrationStatus: 'PAYMENT_PENDING'`, `paymentStatus: 'PAYMENT_PENDING'`.
   - Payment created with `status: 'PENDING'`.
   - Under no circumstances is payment or registration automatically approved upon client submission.
2. **Admin Verification Flow:**
   - On Verification Day, administrator (`wayongohlaurence@gmail.com`) reviews submissions.
   - **Approve:** Updates Payment to `status: 'VERIFIED'`, Entry to `status: 'VERIFIED'`, and increments `tournament.verifiedCount`.
   - **Reject:** Updates Payment to `status: 'REJECTED'`, Entry to `status: 'PAYMENT_REJECTED'`, with mandatory `rejectionReason`.
3. **Duplicate Detection Invariant:**
   - If an M-Pesa transaction code matches an existing payment record:
     `duplicateFlag = true` (or `isSuspectedDuplicate = true`).
   - The payment is marked for review: `DUPLICATE / REVIEW REQUIRED`.
   - The system NEVER automatically rejects or approves duplicates.

---

## 3. Privacy & Data Protection Boundaries
* **Public Tournament Roster:**
  - Displays ONLY:
    - Player Number (e.g. `#001`)
    - Permanent Player ID (e.g. `CHUKA-000001`)
    - Player Display Name
  - Strictly scrubbed / never exposed in public queries:
    - Email address
    - Personal phone number
    - M-Pesa phone number
    - M-Pesa transaction code
    - Firebase Auth UID
* **Payments Collection Security:**
  - Read access is restricted strictly to the owning user (`request.auth.uid == resource.data.userId`) or the sole administrator.
  - Public listing or cross-user payment snooping is blocked by Firestore security rules.

---

## 4. The "Dirty Dozen" Adversarial Attack Payloads & Test Scenarios

| # | Attack Scenario | Threat Vector / Payload | Expected Invariant & Enforcement |
|---|---|---|---|
| **1** | Self-Verification Injection | Client submits `{ status: 'VERIFIED', paymentStatus: 'VERIFIED' }` during registration. | **REJECTED (HTTP 403 / Rule Rejection):** Only admin can set `status == 'VERIFIED'`. Initial status must be `PENDING` / `PAYMENT_PENDING`. |
| **2** | Unauthorized Admin Elevation | Attacker with UID `attacker_uid` (email `hacker@test.com`) attempts to write to `/payments/{id}` or update registration to `VERIFIED`. | **REJECTED:** Rule checks `request.auth.token.email.lower() == 'wayongohlaurence@gmail.com'`. |
| **3** | Stale / Closed Tournament Registration | Attacker submits registration entry to a tournament where `status != 'REGISTRATION_OPEN'` or `lockedAt != null`. | **REJECTED:** Service validates tournament state and rules prevent unauthorized batch commits. |
| **4** | Duplicate User Registration Spoofing | Attacker attempts to register two distinct entries for the same tournament (`tournamentId_attackerId`). | **REJECTED:** Deterministic document ID collides on `setDoc`. Existing active/verified registration halts write. |
| **5** | Tampered Entry Fee Underpayment | Attacker sends `{ amount: 1 }` or `{ amount: 0 }` to claim free entry. | **REJECTED:** Invariant requires `amount == 20` and `currency == 'KES'`. |
| **6** | Malformed Transaction Code Injection | Attacker submits script/SQL or malformed string `"<script>alert(1)</script>"` as M-Pesa code. | **REJECTED:** Regex validation `^[A-Z0-9]{8,15}$` sanitizes and blocks invalid payloads. |
| **7** | Fabricated Gateway Callback | Attacker calls unauthorized endpoint pretending to be Safaricom M-Pesa Daraja callback. | **REJECTED:** No public webhook endpoint exists. Verification is strictly manual and admin-authenticated. |
| **8** | Cross-Player Entry Hijacking | User `A` attempts to modify `/tournamentEntries/{tournamentId_userB}`. | **REJECTED:** Security rule enforces `request.auth.uid == resource.data.userId`. |
| **9** | Snooping Other Players' Payments | Attacker queries `/payments` collection without admin role. | **REJECTED:** Firestore rule denies cross-user reads; only own payments or admin reads allowed. |
| **10** | Audit Log Tampering | Attacker attempts to update or delete records in `/auditLogs/{logId}`. | **REJECTED:** Audit logs are strictly append-only (no `update` or `delete` permission granted to anyone). |
| **11** | Duplicate Transaction Replay Attack | Player copies a transaction code already submitted by another player. | **FLAGGED:** Query detects existing transaction code, sets `duplicateFlag = true`, and notifies admin with `DUPLICATE / REVIEW REQUIRED`. |
| **12** | Tournament Capacity Overflow | Registrations attempted after `registeredCount >= maxPlayers`. | **REJECTED:** Capacity threshold checks prevent entry creation when tournament is full. |

---

## 5. Match Center Security Invariants & State Machine
1. **Match Room Privacy:**
   - Room number stored exclusively in `/matchRooms/{matchId}`.
   - Strictly restricted to `homePlayerUid`, `awayPlayerUid`, and sole admin `wayongohlaurence@gmail.com`.
   - Never exposed in public match fixtures (`/matches/{matchId}`), brackets, standings, or Google Sheets sync.
2. **Room Creation and Number Format:**
   - Only assigned HOME player (or admin) can create or update `roomNumber`.
   - AWAY player cannot create or modify room number.
   - Format must strictly be 6 numeric digits (`/^[0-9]{6}$/`).
3. **Score & Result Integrity:**
   - Only assigned HOME or AWAY player can submit scores.
   - Scores must be integers >= 0 and <= 50.
   - Opponent must confirm result; submitter CANNOT self-confirm.
   - Winner is mathematically derived from scores (`homeScore > awayScore ? homePlayerId : awayPlayerId`).
   - If scores are tied (`homeScore == awayScore`), match enters `ADMIN_RESOLUTION`; no automatic winner selection or advancement.
4. **Idempotent Winner Advancement:**
   - Advancement to next bracket fixture is guarded and idempotent.
   - Confirmed matches are terminal and immutable (`status == 'CONFIRMED'`).
5. **Evidence Isolation & Physical Deletion:**
   - Screenshots stored in `match_evidence/{tournamentId}/{matchId}/{evidenceId}`.
   - Readable only by HOME, AWAY, or ADMIN.
   - Once confirmed, screenshot is physically deleted from Firebase Storage with status tracked.

---

## 6. The Match Center Adversarial Attack Payloads & Test Scenarios (Attacks 13–26)

| # | Attack Scenario | Threat Vector / Payload | Expected Invariant & Enforcement |
|---|---|---|---|
| **13** | Cross-Match Room Snooping | Unrelated user `user_intruder` requests `/matchRooms/{matchId}`. | **REJECTED (HTTP 403):** Firestore rule requires caller to be `homePlayerUid`, `awayPlayerUid`, or admin. |
| **14** | Away Player Room Hijacking | AWAY player submits `{ roomNumber: '112233' }` to `/matchRooms/{matchId}`. | **REJECTED:** Only HOME player or admin is authorized to create/edit `roomNumber`. Away may only toggle `awayReady`. |
| **15** | Malformed / Malicious Room Code | Attacker attempts `{ roomNumber: '12345' }` (too short), `'ABCDEF'` (letters), or `"<script>"` | **REJECTED:** Validation rejects any room number that is not exactly 6 digits numeric (`^[0-9]{6}$`). |
| **16** | Confirmed Match Modification | User attempts to update scores or status of a match that is already `CONFIRMED`. | **REJECTED:** Security rule enforces `resource.data.status != 'CONFIRMED'`. Terminal state is immutable. |
| **17** | Self-Confirmation Spoofing | Submitter attempts to call `confirmResult` on their own submitted score. | **REJECTED:** Confirmation requires `resource.data.submittedByUid != request.auth.uid`. |
| **18** | Third-Party Result Submission | User not assigned to the match attempts to submit scores or screenshot. | **REJECTED:** Submitter UID must match `resource.data.homePlayerUid` or `resource.data.awayPlayerUid`. |
| **19** | Negative or Absurd Score Injection | Attacker submits `{ homeScore: -2, awayScore: 500 }`. | **REJECTED:** Scores must be non-negative integers within realistic bounds (0 <= score <= 50). |
| **20** | Draw Winner Advancement Exploit | Client attempts to advance HOME on a 2 - 2 draw without Extra Time / PKs. | **BLOCKED:** Equal scores force `status = 'ADMIN_RESOLUTION'`. Automatic winner advancement is strictly blocked. |
| **21** | Unauthorized Dispute Resolution | Non-admin user attempts to resolve a disputed match via `/disputes/{id}/resolve`. | **REJECTED:** Only sole admin `wayongohlaurence@gmail.com` can resolve disputes. |
| **22** | Evidence Cleanup Failure Concealment | System silently fails Storage delete and reports success. | **ENFORCED:** Physical deletion result is verified; if deletion fails, `cleanupStatus = 'FAILED'` is logged for admin retry. |
| **23** | Bracket Structure Tampering | Player attempts to alter `roundNumber`, `bracketPosition`, or `homePlayerId`. | **REJECTED:** Structural bracket fields are enforced as immutable in Firestore rules. |
| **24** | Concurrent Double-Advancement | Two simultaneous confirmation requests attempt to double-advance winner. | **MITIGATED:** Transactional read-before-write check ensures advancement executes once and only once. |
| **25** | Overdue Match Fake Winner Injection | Player attempts to advance themselves when a match deadline expires. | **REJECTED:** Overdue matches transition to `OVERDUE`. Scores and winners cannot be invented; requires Admin Resolution. |
| **26** | WhatsApp PII Exposure in Public Feed | Public match feed or Google Sheets query attempts to pull private phone numbers. | **SCRUBBED:** Private WhatsApp numbers are isolated in user subdocuments and never serialized in public match models. |
| **27** | League Match Self-Challenge & Unverified Play | User attempts to challenge themselves or an unverified player to an official match. | **REJECTED:** Invariant forbids `challengerUid == challengedUid`. Both players must have verified KSh50 League Cards. |
| **28** | League Result Unilateral Self-Confirmation | Submitter attempts to self-confirm their own submitted League match result. | **REJECTED:** The submitter cannot unilaterally finalize the result. Opponent confirmation or admin resolution is strictly required. |

---

## 7. Social Hub & Community Layer Security Invariants (Phase 0: Social Hub Invariants)
1. **Competitive Fact Origin Invariant:**
   - Every competitive event (`MATCH_RESULT`, `NEW_CHAMPION`, `ACHIEVEMENT_UNLOCKED`, `RANK_CHANGE`, `HOT_STREAK`, `DAILY_FIRST_CLAIM`) must strictly originate from authoritative verified data in Firestore (confirmed matches or system achievements).
   - Direct client insertion of competitive activities claiming fake wins or unearned badges is prohibited.
2. **Activity Immutability Invariant:**
   - Activities once recorded in `socialActivities` cannot be modified (`allow update: if false;`). Only authorized admins can delete or soft-delete abusive entries.
3. **Private PII Isolation Invariant:**
   - Private WhatsApp numbers, M-Pesa phone numbers, and transaction codes MUST NEVER be included in public social activities, community posts, or notifications.
4. **Author Integrity & Non-Impersonation:**
   - Community posts and comments enforce `request.auth.uid == request.resource.data.authorUid`. A user cannot post under another player's name or ID.
5. **Private Notification Isolation:**
   - In-app notifications in `inAppNotifications` can only be read and updated (`isRead`) by the designated recipient (`request.auth.uid == resource.data.recipientUid`).
6. **Blocklist Enforcement:**
   - When user A blocks user B, user B's challenges, comments, and direct interactions with user A are silenced and prevented.
7. **Report Abuse Integrity:**
   - Any signed-in user can submit a community report (`communityReports`). Only admin (`wayongohlaurence@gmail.com`) can update, resolve, or dismiss reports.

---

## 8. The Social Hub Adversarial Attack Payloads & Test Scenarios (Attacks 29–40)

| # | Attack Scenario | Threat Vector / Payload | Expected Invariant & Enforcement |
|---|---|---|---|
| **29** | Fabricated Match Win Activity | Attacker inserts `{ type: 'MATCH_RESULT', title: 'Hacker won 10-0', verified: true }` directly into `/socialActivities`. | **REJECTED:** Client cannot arbitrarily invent official competitive facts. Only authoritative confirmed matches trigger verified activities. |
| **30** | Social Activity Tampering / Rewriting | Attacker attempts to update an existing activity to alter the winner or score. | **REJECTED:** `allow update: if false;` enforces strict immutability on social activity logs. |
| **31** | WhatsApp PII Leakage in Community Post | Attacker posts a message containing raw phone numbers or M-Pesa details. | **PREVENTED & SANITIZED:** UI and service sanitizers block phone numbers/M-Pesa strings; reporting mechanism flags violations. |
| **32** | User Impersonation in Social Post | Attacker with UID `user_attacker` submits post with `authorUid: 'user_victim'` and victim's `authorName`. | **REJECTED:** Security rule checks `request.auth.uid == request.resource.data.authorUid`. |
| **33** | Notification Snooping | Attacker queries `/inAppNotifications` for messages sent to another player. | **REJECTED:** Firestore rule restricts reads to `request.auth.uid == resource.data.recipientUid`. |
| **34** | Fake Challenge / Verification Notification Injection | Attacker tries to inject a fake notification `{ recipientUid: 'target_uid', type: 'CHALLENGE_RECEIVED' }`. | **REJECTED:** Non-admin client cannot forge arbitrary system-wide notifications; challenge notifications require valid match context. |
| **35** | Harassment / Block Bypass | Blocked user attempts to issue challenges or comment on blocker's posts. | **REJECTED:** `socialService` checks `userBlocks` collection before allowing challenge issuance; UI filters blocked content. |
| **36** | Report Resolution Hijacking | Regular user tries to mark `/communityReports/{id}` as `RESOLVED`. | **REJECTED:** Only sole admin `wayongohlaurence@gmail.com` can update or resolve community reports. |
| **37** | Faked Daily First Claim | Attacker submits a daily claim with timestamp set to `00:00:01` or claims multiple times in 24 hours. | **REJECTED:** Server/Firestore rule enforces unique daily document key `DAILY_CLAIM_${date}_${userId}` and timestamp validation. |
| **38** | Faked Achievement Badge Unlock | Attacker creates an achievement unlock activity for "UNBEATEN_STREAK" without having won 5 consecutive matches. | **REJECTED:** Gamification service calculates streaks from verified matches before recording achievements; activity requires valid achievement ID. |
| **39** | Malicious Script (XSS) in Post Content | Attacker submits `"<script>stealTokens()</script>"` in `content`. | **SANITIZED & ESCAPED:** React and DOMPurify prevent raw HTML execution; inputs are treated strictly as text nodes. |
| **40** | Post Deletion by Non-Author | User `A` attempts to delete a post created by User `B`. | **REJECTED:** Delete permission requires `request.auth.uid == resource.data.authorUid` or `request.auth.token.email == 'wayongohlaurence@gmail.com'`. |

---

## 9. Security Test Implementation
The accompanying test file `firestore.rules.test.ts` asserts these exact invariants against mock and authenticated states.

