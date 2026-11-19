# Staff Two-Factor Enrollment and Recovery

## Purpose

This runbook describes the mobile enrollment experience and the security boundaries around staff second-factor credentials.

## Enrollment

1. Sign in with the verified BrightGlobe email/password account.
2. Open **Account settings → Account security**.
3. Enter the current account password to start TOTP enrollment.
4. Scan the locally rendered QR code with a compatible authenticator app.
5. Enter the current six-digit TOTP code to verify enrollment.
6. Save the displayed backup codes in a password manager or secure offline location before leaving the screen.

The TOTP URI contains the authenticator secret. It must not be sent to third-party QR services, analytics, logs, support tickets, or chat. The mobile app renders the QR locally. The app does not persist backup codes in application storage.

The server keeps `twoFactorEnabled=false` until the TOTP code is verified. An unverified enrollment is not sufficient for staff step-up authorization.

## Backup-code handling

- Each backup code is single-use.
- A successful backup-code verification consumes that code.
- Regenerating codes invalidates every previously issued backup code immediately.
- The regenerated set is shown only in the active screen state; it is not written to local storage.
- Operators must never share backup codes with support or another staff member.
- The staff step-up endpoint uses `disableSession=true` and `trustDevice=false` for backup-code verification. A backup code does not create a trusted device or change the current session.

## Staff operation step-up

Every sensitive staff write still requires an operation-specific step-up grant. A successful TOTP or backup-code check creates a grant bound to the authenticated staff principal, Better Auth user, exact session, and exact operation. Grants expire after five minutes and can be consumed once. A successful sign-in or TOTP enrollment is not itself a step-up grant.

## Lost authenticator and lost backup codes

There is deliberately no self-service bypass or public API to clear a staff member's factor. If an operator loses both the authenticator and every unused backup code:

1. Stop sensitive staff work for that operator. Do not ask the operator to send passwords, TOTP codes, or backup codes to anyone.
2. Verify the operator's identity through an independently established channel and confirm the authorization with two separate project owners.
3. Suspend the affected staff principal through the approved access-governance process wherever the remaining authorized staff can do so.
4. Record the incident, approvals, affected Better Auth user ID, session revocation plan, and intended recovery action in the organization's external incident record.
5. Do not perform an ad hoc SQL edit, delete the `two_factor` row, set `user.two_factor_enabled` directly, or bypass Better Auth's factor lifecycle.
6. A factor reset must use a separately reviewed, code-controlled break-glass procedure that validates the exact identity and environment, revokes existing sessions, records an immutable audit event, and requires fresh TOTP enrollment plus backup-code custody before staff privileges are restored.

**Operational gap:** the code-controlled break-glass factor-reset procedure and its operator authorization mechanism have not yet been implemented. Until that work is completed and reviewed, a lost-factor incident requires the project owners to coordinate a separately reviewed recovery change; it must not be improvised against a shared database.

## Release boundary

This work adds the mobile client enrollment and sign-in challenge flows only. It does not provision staff principals, assign staff roles, execute migrations against shared databases, deploy Workers, or authorize BG signing/transfers. Migration 0029 and the staff access migrations remain unapplied to shared environments.
