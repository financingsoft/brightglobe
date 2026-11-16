# Globe Play — Submission, Review & Release Lifecycle Contract

**Status:** Draft · V1 required

## 1. Lifecycle model

Separate three lifecycles: listing content, app submission and binary/artifact release. A listing can be published while a new version is under review; a package approval must never implicitly approve changed listing content or vice versa.

### Listing revision
draft → validation_failed | ready_for_submission → submitted → approved → published  
Published revisions may be superseded, suspended or withdrawn. Every revision has immutable content snapshot and reviewer decision.

### App submission
draft → submitted → triage → in_review → changes_requested | approved | rejected  
Changes requested returns to a new submission revision. Rejection includes policy code, evidence and appeal path. Reviewer actions are attributable and auditable.

### Artifact
upload_pending → uploaded_quarantined → metadata_extracted → scanning → security_review → approved | rejected | quarantined  
Only approved artifact can be attached to a release candidate.

### Release
draft → validation → submitted → review_pending → approved → scheduled → staged_rollout → active → paused | halted | withdrawn  
Rollback creates a new release event referencing a previously approved artifact; it does not rewrite history.

## 2. Release tracks

V1 supports:
- Internal preview: invited testers only; no public indexing.
- Beta: opt-in test access and explicit preview label.
- Production: public availability.
- Emergency hotfix: expedited operational path with mandatory post-incident review, never a bypass of signature/security checks.

Track and region eligibility are explicit. Test access tokens are short-lived and revocable.

## 3. Staged rollout

A release may target a percentage cohort or defined region/platform cohort. Assignment must be deterministic and privacy-minimized. Rollout controls: start, increase, pause, halt and complete. Define minimum observation window and health guardrails before increasing exposure. If crash/error/security signals breach thresholds, automatically halt where reliable telemetry exists and alert operators.

V1 may implement manual percentage rollout first; schema and events must support automated rollout later.

## 4. Compatibility and availability

Every release declares platform, package/bundle identifier, version/build number, minimum OS, supported architectures/device requirements, region availability, language availability and dependencies. Validate monotonic version/build rules per platform and prevent package identity changes without explicit ownership review.

## 5. Approval gates

- Publisher authorization and developer verification.
- Metadata/content policy checks.
- Privacy policy and data disclosure completeness.
- Package ID and signing identity verification.
- Malware scan and archive safety.
- Permissions and sensitive capability declaration.
- License/copyright and distribution rights.
- Age/content rating and region restrictions.
- Accessibility and listing asset checks where applicable.
- Manual review for risk signals or policy-required cases.

Automated scan is evidence, not the final approval. Scanner success cannot approve a release by itself.

## 6. Rollback and takedown

Rollback restores a prior approved artifact through a new release operation. Takedown immediately disables new download authorization and public distribution where required, invalidates cached metadata and signed URL issuance, preserves forensic evidence and notifies affected parties. Existing signed URLs must have short expiry. Emergency action requires reason, actor and incident ID.

## 7. V1 APIs and events

Provide operations for create submission, submit snapshot, request changes, approve/reject, upload init/complete, scan result, approve artifact, create release, schedule, start rollout, pause/halt, complete, withdraw and rollback. Each transition validates expected current state and revision. Use idempotency keys and optimistic concurrency/version columns.

## 8. Acceptance tests

- Invalid transitions are rejected.
- Duplicate submissions and scanner callbacks are idempotent.
- Submitted snapshots cannot be mutated.
- Unapproved or withdrawn artifacts cannot be downloaded.
- Rollback preserves full release history.
- Tenant ownership and reviewer separation are enforced.
- Emergency takedown disables authorization immediately and is auditable.
