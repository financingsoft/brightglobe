# Marketplace SQL drafts

Files in this directory are non-executable design candidates. They are not part of Drizzle's normal migration journal and must not be applied to Neon.

The current candidate expects public.canonical_users(id UUID) from the existing BrightGlobe identity foundation. It creates only the isolated marketplace schema and does not create roles or grants.

The matching .assertions.sql file checks catalog-level structure. The .behavior.sql file exercises key state transitions and rejection paths against disposable PostgreSQL, including published slug immutability, locale publication uniqueness, review uniqueness/edit pointers, category limits, Android-only APK eligibility, distribution revocation safety, append-only audit and outbox tag validation.

The candidate is named 0022 because PR #9 independently reserves 0021 for the BG reward foundation. Before promoting this file into backend/drizzle:
1. Integrate and review the migration ordering with the BG reward branch.
2. Regenerate the Drizzle journal on the final integration branch.
3. Run the SQL against a disposable PostgreSQL database with the canonical identity prerequisite.
4. Run the SQL assertions and concurrency/state-transition tests.
5. Review all constraints, triggers, grants and rollback/forward-recovery behavior.

Never use this folder as a migration target in a deployment workflow.
