# Globe Play — Security, Trust & Safety Contract

**Status:** Draft · V1 launch blocker

## 1. Threat model

Treat developers, uploads, metadata, reviews, links, scanner callbacks, analytics events and external providers as untrusted. Threats include malicious packages, account takeover, publisher impersonation, supply-chain compromise, archive bombs, path traversal, stored XSS, SSRF, phishing, fake reviews, ranking manipulation, scraping, credential abuse, insider misuse and accidental release.

## 2. Identity and tenant security

- Reuse canonical BrightGlobe identity; never trust client-supplied owner IDs.
- Enforce organization membership and object-level authorization server-side on every request.
- Separate public, developer, reviewer, security, support and administrator privileges.
- Require step-up/MFA for ownership transfer, security policy changes and privileged release actions where supported.
- Rate-limit login-sensitive, upload, review, report, search and download endpoints.
- Protect against CSRF, XSS, injection, SSRF, IDOR, replay and enumeration.
- Secrets belong in managed secret stores, never repo, DB rows or logs.

## 3. Upload and artifact supply chain

- Uploads land in private quarantine, never public R2.
- Validate size, declared MIME, magic bytes, archive nesting, decompressed size, file count, path traversal, symlinks and decompression bombs.
- Extract package metadata in isolated, resource-limited workers.
- Record immutable SHA-256, package ID, version/build, signer/certificate fingerprint and scanner engine/version/result.
- Verify signer continuity against publisher-approved identity; changes trigger manual review.
- Scan with more than one independent signal where feasible; define false-positive appeal.
- Preserve original publisher signature; Globe must not silently repackage or resign binaries.
- Promote only approved immutable object versions into distribution storage.
- Signed download URLs are short-lived, object-specific and issued only after a fresh authorization check.

## 4. Web and content security

- Sanitize user and developer HTML/Markdown; use safe rendering and strict CSP.
- Validate external links and protect server-side fetches from SSRF.
- Enforce image/video transcoding limits and strip unnecessary metadata.
- Prevent malicious filenames, polyglot files and content-type confusion.
- Use Turnstile/risk controls where appropriate, not as a substitute for authorization.
- Keep security disclosures and private moderation evidence access-restricted.

## 5. Trust, reviews and anti-abuse

- Detect duplicate, bot-generated, incentivized, coordinated and publisher-affiliated reviews.
- Label verified ownership/usage only when backed by reliable evidence; never invent verification.
- Provide report reasons, moderation queue, appeal, reviewer notes and immutable revision history.
- Separate editorial recommendations, sponsored placement, developer-provided content and user opinion.
- Sponsored placement must be clearly labeled and must not alter organic ratings.
- Do not reward external store reviews, positive sentiment, ratings, clicks, redirects or unverified installs.
- No review suppression solely because sentiment is negative.

## 6. Incident operations

Required playbooks: malicious package, compromised developer account, signing-key change, exposed private artifact, privacy incident, copyright takedown, abusive review campaign, data breach and erroneous publication. Each playbook defines severity, owner, containment, evidence preservation, communications, recovery and postmortem.

## 7. Privacy and retention

Collect minimum necessary personal/device/region data. Use coarse region analytics, short-lived security telemetry and documented retention periods. Provide privacy notice, access/deletion request workflow and legal hold process. Do not fingerprint devices for ranking or rewards. Do not expose publisher identity documents or security-report details publicly.

## 8. V1 release gates

Threat model reviewed; tenant isolation tests pass; package quarantine and scan flow tested; signer continuity enforced; signed URL expiry tested; takedown tested; audit logs protected; rate limits and abuse reporting operational; incident contacts and response playbooks assigned.
