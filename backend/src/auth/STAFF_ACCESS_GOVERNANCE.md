# Staff Access Governance

## Security model

Staff principals are separate from ordinary BrightGlobe member identities. A Better Auth user becomes staff only after a controlled, auditable provisioning request or the one-time out-of-band bootstrap described below.

No staff principals or role assignments are created by migrations. Migration 0032 creates only permission definitions, role templates, and the access-change request table.

The access governance templates are least privilege:

- `staff_access_proposer`: `bg.staff.access.read`, `bg.staff.access.propose`
- `staff_access_approver`: `bg.staff.access.read`, `bg.staff.access.approve`, `bg.staff.access.execute`

There is no role-creation API. Access changes can only use active, seeded role templates. All writes require fresh TOTP or one-time Better Auth backup-code step-up, a distinct proposer and approver, and execution by the same approver who approved the request.

## One-time bootstrap requirement

The first access proposer and access approver must be established out-of-band because no staff user exists to authorize the first request. This bootstrap has deliberately not been executed.

Before bootstrap:

1. Obtain the exact Better Auth `user.id` values for two separate, verified operators. Do not identify them by email alone.
2. Obtain independent authorization from the project owners and record the approval reference.
3. Confirm neither auth user already has a row in `staff_principals`.
4. Review the target role templates in `staff_roles`.
5. Execute a reviewed SQL transaction against the intended environment. Use one identity for `staff_access_proposer` and the other for `staff_access_approver`; never assign both roles to the same bootstrap identity.
6. Append bootstrap audit events in the same transaction and verify the resulting principals and assignments.
7. Require both operators to enroll and verify TOTP, generate backup codes, and store those codes securely before using any access-management route.

Illustrative SQL only; placeholders must be replaced with the two exact Better Auth user IDs and the recorded approval reference. Do not execute this example as-is:

```sql
BEGIN;

-- Verify both Better Auth users exist and neither is already a staff principal.
SELECT id
FROM public."user"
WHERE id IN (:'first_auth_user_id', :'second_auth_user_id')
ORDER BY id
FOR UPDATE;

-- Stop and do not continue unless the preceding query returns exactly
-- two rows and this query returns zero rows.
SELECT id
FROM public.staff_principals
WHERE auth_user_id IN (:'first_auth_user_id', :'second_auth_user_id');

-- Insert two distinct principals and grant exactly one bootstrap role to each.
WITH principals AS (
  INSERT INTO public.staff_principals
    (id, auth_user_id, status, display_label)
  VALUES
    (gen_random_uuid(), :'first_auth_user_id', 'active', 'Initial Staff Access Proposer'),
    (gen_random_uuid(), :'second_auth_user_id', 'active', 'Initial Staff Access Approver')
  RETURNING id, auth_user_id
)
INSERT INTO public.staff_role_assignments
  (id, staff_principal_id, role_id, granted_by_staff_id, status, valid_from)
SELECT
  gen_random_uuid(),
  principals.id,
  roles.id,
  NULL,
  'active',
  now()
FROM principals
JOIN public.staff_roles roles
  ON roles.role_key = CASE
    WHEN principals.auth_user_id = :'first_auth_user_id' THEN 'staff_access_proposer'
    ELSE 'staff_access_approver'
  END;

-- Bootstrap actor is external to the initial staff system; preserve the
-- approval reference in immutable audit metadata.
INSERT INTO public.staff_audit_events
  (id, actor_staff_id, subject_staff_id, action, reason, metadata, request_id)
SELECT
  gen_random_uuid(),
  NULL,
  principals.id,
  'bg.staff.bootstrap.provisioned',
  'Initial staff access bootstrap; independently approved out-of-band.',
  jsonb_build_object(
    'approvalReference', :'approval_reference',
    'authUserId', principals.auth_user_id
  ),
  :'approval_reference'
FROM public.staff_principals principals
WHERE principals.auth_user_id IN (:'first_auth_user_id', :'second_auth_user_id');

COMMIT;
```

The SQL above is a template, not a deployment instruction. Review the exact IDs, target database, and approval record before any real bootstrap. No bootstrap has been performed by this implementation.

## Access change lifecycle

Available actions:

- `provision_principal`: link an existing Better Auth user to a new active staff principal and one initial role.
- `assign_role`: assign an active role template to an existing active staff principal, optionally with an expiry.
- `revoke_role`: revoke an existing role assignment.
- `suspend_principal`: suspend an active staff principal.
- `activate_principal`: reactivate a suspended (but not revoked) staff principal.

Each change follows:

1. A staff access proposer creates a request with a reason and idempotency key.
2. A different active staff access approver reviews and approves the exact request.
3. The same approver re-authenticates with a fresh TOTP or one-time backup code and executes the approved change. Backup-code verification does not trust the device or change the session; Better Auth consumes the code once.
4. The principal/assignment mutation, request consumption, and append-only audit event commit in one transaction.

Requests expire after five minutes. Approval is executable for five minutes. Self-targeting and self-approval are rejected. The system prevents revoking or suspending an access approver if fewer than two active access approvers would remain.

## API surface

All routes are under `/api/v1/staff/access`:

- `GET /roles`: active role templates; requires `bg.staff.access.read`.
- `GET /principals`: staff principal directory; requires `bg.staff.access.read`.
- `GET /requests` and `GET /requests/:requestId`: access requests; requires `bg.staff.access.read`.
- `GET /audit`: staff access audit history with bounded filters; requires `bg.staff.access.read`.
- `POST /requests`: propose a change; requires `bg.staff.access.propose` and TOTP or backup-code step-up.
- `POST /requests/:requestId/approve`: approve a change; requires `bg.staff.access.approve` and TOTP step-up.
- `POST /requests/:requestId/execute`: execute the approved change; requires `bg.staff.access.execute`, TOTP or backup-code step-up, and the same approver identity.

The API never accepts a caller-supplied staff principal or permission claim. The acting principal is derived from the Better Auth session and database grants.

## Audit and release boundaries

Audit events include proposal, approval, expiry, execution, provisioning, role assignment/revocation, and principal suspension/reactivation. All access-change transactions serialize through a dedicated database mutex so concurrent revocations cannot race the minimum-two-approver invariant. Audit history is append-only.

Migration 0032 is committed but has not been applied to any shared environment. No staff principals or assignments have been provisioned. No Staging/Production migration or deployment, Mainnet activity, signing, or BG transfer is authorized by this work.
