# Better Auth 1.7.23 Wallet-Only User Compatibility Gate

**Result: BLOCKED — nullable email is not supported by the pinned Better Auth core user model.**  
**Checked:** 2026-11-15  
**Repository:** financingsoft/brightglobe  
**Pinned packages:** better-auth and @better-auth/drizzle-adapter 1.7.23

## Direct source evidence

1. Exact tagged source: [packages/core/src/db/schema/user.ts at v1.7.23](https://github.com/better-auth/better-auth/blob/v1.7.23/packages/core/src/db/schema/user.ts)
   - The core Zod schema defines `email: z.string().transform((val) => val.toLowerCase())`.
   - The adjacent TODO explicitly says widening this field to nullish is deferred to v2.
   - Therefore `email: null` fails Better Auth's core user validation; changing only the application Drizzle column to nullable does not make the pinned auth core support it.

2. Current BrightGlobe schema: [backend/src/db/schema.ts](https://github.com/financingsoft/brightglobe/blob/main/backend/src/db/schema.ts)
   - `user.email` is currently `text("email").notNull().unique()`.
   - This independently prevents storing a null email.

3. Exact tagged SIWE plugin: [packages/better-auth/src/plugins/siwe/index.ts at v1.7.23](https://github.com/better-auth/better-auth/blob/v1.7.23/packages/better-auth/src/plugins/siwe/index.ts)
   - SIWE is Ethereum/EIP-4361-specific (0x address validation and EIP-191 signature verification), not a Solana wallet plugin.
   - When no email is supplied, this plugin generates a placeholder email. That conflicts with BrightGlobe's explicit product requirement not to create synthetic emails.

4. Current BrightGlobe auth: [backend/src/auth.ts](https://github.com/financingsoft/brightglobe/blob/main/backend/src/auth.ts)
   - Email verification and password-reset callbacks access `user.email` as a required string.

## Conclusion

Do not proceed with the planned nullable-email change under Better Auth 1.7.23. Do not create a wallet user with `email: null`, do not bypass Zod validation with casts, and do not use placeholder/synthetic emails.

The current approved product requirement (wallet-only signup, no email) and the pinned Better Auth 1.7.23 core schema are incompatible as-is. The compatibility gate is therefore failed before any production code or database schema changes.

## Smallest safe architecture choices requiring product approval

**Option 1 — Keep Better Auth as the sole session issuer, but use a separate wallet-auth principal/session bridge.**
- Keep the Better Auth `user` table unchanged for email users.
- Create a BrightGlobe canonical user identity table with stable internal User ID and nullable email/contact data.
- Link existing Better Auth users to the canonical identity.
- Wallet users are created in the canonical identity and use a dedicated, cryptographically secure wallet session mechanism.
- All business routes resolve either session type to the same canonical User ID.
- This preserves the no-email requirement, but is no longer literally one Better Auth user row/session for every user. It requires careful shared middleware, revocation, CSRF/cookie, and authorization design.

**Option 2 — Change the authentication foundation to a version/framework that natively supports users without email.**
- This is a larger migration and must be separately evaluated for compatibility with the existing Expo client, Cloudflare Workers, Neon/Drizzle, and current email login.
- Do not upgrade Better Auth blindly; the v1.7.23 source itself says nullish email support is deferred to v2, and a target version must be verified first.

**Not recommended:** synthetic email addresses. The built-in SIWE plugin demonstrates that workaround, but it violates BrightGlobe's explicit requirement and does not provide Solana authentication.

## Safety

No application code, migrations, secrets, Staging resources, Production resources, or chain state were changed while performing this compatibility check.
