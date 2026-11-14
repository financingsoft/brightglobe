/**
 * A session may only be revoked through the session-management API when it
 * is not the session authenticating the current request. The current session
 * must be ended through Better Auth's sign-out endpoint.
 */
export function canRevokeSession(sessionId: string, currentSessionId: string): boolean {
  return sessionId.length > 0 && sessionId !== currentSessionId;
}
