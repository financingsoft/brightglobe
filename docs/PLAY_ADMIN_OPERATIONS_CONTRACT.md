# Globe Play — Admin, Trust Operations & Support Contract

**Status:** Draft · V1 launch blocker

## 1. Purpose

The internal operations console is a first-class product surface, not a CMS screen. It coordinates publisher trust, app review, package security, user reports, appeals, incidents and support.

## 2. Work queues

Separate queues for:
- developer verification;
- app listing review;
- package/security review;
- release review;
- user review/report moderation;
- copyright and legal takedown;
- publisher/user appeals;
- security incidents;
- support requests.

Each queue supports priority, SLA, assignment, escalation, filters, saved views and aging indicators.

## 3. Role separation and four-eyes controls

Editorial staff cannot approve binaries. Scanner service cannot approve releases. Developer cannot review own submission. Security reviewer cannot approve own exception. High-risk exceptions, ownership transfer, emergency restore and sensitive policy changes require a second authorized approver. Break-glass access is time-limited, reason-coded and audited.

## 4. Review case record

Every case stores target, submitter, current state, risk level, evidence references, policy version, assigned reviewer, decision, reason codes, internal notes, external response, timestamps, SLA and appeal relationship. Sensitive evidence uses restricted storage and access logs.

## 5. Enforcement actions

Support warning, request changes, reject, delist, suspend, block download, quarantine artifact, suspend developer, revoke team access, restrict submissions and terminate publisher account. Actions have scope, duration, reason, notification and appeal policy. Emergency actions can be immediate but require retrospective review.

## 6. User support

Support case categories include account access, app listing correction, download issue, safety report, privacy request, copyright complaint and developer dispute. Support agents see only the minimum data required. Account/security changes are routed to authorized workflows.

## 7. Audit and reporting

Immutable append-only audit records for role changes, verification decisions, listing changes, package approval, release promotion, ranking overrides, sponsored placement, takedowns, appeals and reward-related events (future). Audit exports are permissioned and tamper-evident. Never store secrets or full private evidence in generic JSON metadata.

## 8. V1 acceptance criteria

All required queues exist; assignments and SLA aging work; reviewer permissions are isolated; decision reasons and appeals are recorded; emergency download block works; all privileged actions are audited; support access is privacy-limited.
