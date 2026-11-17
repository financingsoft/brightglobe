# Globe Play — Developer Platform Contract

**Status:** Draft · V1 required

## 1. Goal

The developer platform at `open.globeapps.com` must be a professional publisher workspace, comparable in workflow completeness (not necessarily feature count) to Google Play Console and App Store Connect.

## 2. Organization and identity

Support both individual and organization publisher profiles. A publisher organization is the tenant boundary. Users join through invitations and hold explicit roles. One user may belong to multiple organizations.

V1 roles:
- Owner: legal ownership, organization settings, member administration, transfer initiation.
- Admin: app, release and team management; cannot transfer ownership or change payout/legal owner.
- Release Manager: upload, submit, stage and publish releases.
- Analyst: read-only analytics and export.
- Support: read-only app/release context with privacy-limited access.

Internal platform roles are separate: editorial, app reviewer, security reviewer, trust & safety, support, finance (future), super-admin. CMS roles never imply Marketplace privileges.

Required controls: invitation expiry, revocation, MFA/step-up for sensitive actions when supported, session revocation, member activity log, least privilege and organization-scoped authorization.

## 3. Publisher verification

Collect only necessary evidence. Track verification case, evidence type, submitted time, reviewer, decision, expiry/reverification and appeal. Do not expose private identity documents to ordinary team members. Store sensitive evidence in private storage with narrow access and retention policy. Verification states: unverified, pending, verified, rejected, suspended, expired.

Verification of an account does not automatically verify the ownership of every submitted app. Each app needs publisher authorization and platform identifier checks.

## 4. App workspace

A developer can:
- create draft app/game;
- reserve a globally unique slug;
- define app type, category, tags and supported platforms;
- manage localized title, subtitle, description, screenshots, videos, icon and support/privacy links;
- set content rating, ads disclosure, data safety/privacy disclosures and permissions;
- define minimum OS/device requirements and regional availability;
- manage store listings and official external distribution links;
- view validation errors before submission;
- save drafts and compare listing revisions.

Every submission freezes a reviewable snapshot. Changes after submission create a new revision and cannot silently alter the review target.

## 5. Release workspace

Provide version history by platform and release track. Upload is resumable and uses short-lived upload credentials to private quarantine. Display checksum, extracted package ID, signing identity, scan state and validation errors. Developers cannot approve their own artifacts or bypass platform review.

Release controls: internal test, closed/beta test, staged production rollout, full production, pause, halt, withdraw and rollback. Track-specific access is explicit. A release can only be promoted if its exact artifact and metadata have passed all required gates.

## 6. Developer analytics

Provide app-level and version-level dashboards: impressions, detail views, outbound clicks, download authorizations, download starts/completions where measurable, verified installs only where reliable, conversion, geography at coarse granularity, platform, version adoption, crash/quality signals when available and review sentiment summaries. Clearly label estimated, observed and verified metrics.

Support date ranges, timezone display, CSV export, privacy thresholds and delayed data notices. Do not expose individual user identities or precise location in analytics.

## 7. Support and communication

Provide submission status, reviewer requests, rejection reasons, appeal submission, incident notices, policy updates, developer support cases and service announcements. All communication is linked to an app, release or case and retained according to policy.

## 8. Developer APIs and webhooks

V1 may provide read-only API access only after authentication, scoped API keys, expiry, rotation, revocation and audit are implemented. Webhooks should support event subscriptions, HMAC signatures, timestamp/replay checks, retries, delivery logs and secret rotation. Do not expose broad unrestricted API tokens.

## 9. V1 acceptance criteria

- A user can create an individual publisher or organization.
- Organization members have scoped roles and cannot access another tenant's apps.
- Developer verification and app ownership evidence are reviewable.
- App metadata is localized and revisioned.
- Submission creates immutable review snapshot.
- Release upload, scan status, reviewer decision and release promotion are traceable.
- Analytics distinguish click, download and verified install.
- Every privileged action is auditable.
- Developer can appeal a rejection or submit a support case.
