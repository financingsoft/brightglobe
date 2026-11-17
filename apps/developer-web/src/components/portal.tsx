"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { developerApi } from "@/lib/api";

type Organization = {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  verificationStatus: string;
  createdAt: string;
  role: string;
};

type Workspace = {
  organization: Organization & {
    description: string | null;
    websiteUrl: string | null;
    supportEmail: string | null;
  };
  members: Array<{
    canonicalUserId: string;
    displayName: string;
    role: string;
    status: string;
    createdAt: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    createdAt: string;
  }>;
};

function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  return (
    <div className="portal">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="logo" href="/">
            <span className="logo-mark">G</span>
            <span>Globe Play <span style={{ color: "#8793a8", fontWeight: 500 }}>Developers</span></span>
          </Link>
          <nav className="top-nav" aria-label="Main navigation">
            <Link href="/">Organizations</Link>
            <Link href="/organizations/new">Create organization</Link>
          </nav>
          <div className="top-actions">
            {session?.user?.email ? <span className="user-email">{session.user.email}</span> : null}
            {!isPending && session ? (
              <button className="btn secondary small" onClick={() => void authClient.signOut()}>Sign out</button>
            ) : !isPending ? (
              <Link className="btn secondary small" href="/login">Sign in</Link>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export function AuthForm({ mode = "login", embedded = false }: { mode?: "login" | "register"; embedded?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isRegister) {
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
        if (result.error) throw new Error(result.error.message ?? "Registration could not be completed.");
        setNotice("Your account was created. Check your email and complete verification before signing in.");
      } else {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error(result.error.message ?? "Sign-in failed.");
        if (embedded) {
          setNotice("Signed in. You can now accept the invitation.");
        } else {
          router.replace("/");
          router.refresh();
        }
      }
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form className="form" onSubmit={submit}>
      {isRegister ? <div className="field"><label htmlFor="name">Full name</label><input id="name" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></div> : null}
      <div className="field"><label htmlFor={embedded ? "invite-email" : "email"}>Email</label><input id={embedded ? "invite-email" : "email"} type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="field"><label htmlFor={embedded ? "invite-password" : "password"}>Password</label><input id={embedded ? "invite-password" : "password"} type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {notice ? <div className="notice" role="status">{notice}</div> : null}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}</button>
    </form>
  );

  if (embedded) return form;
  return (
    <PortalShell>
      <main className="auth-wrap">
        <section className="auth-card">
          <div className="eyebrow">Globe Play Developer Console</div>
          <h1>{isRegister ? "Create your developer account" : "Welcome back"}</h1>
          <p className="lead">{isRegister ? "Create a BrightGlobe account to manage your publisher organization." : "Sign in to manage your publisher organizations and team."}</p>
          <div style={{ height: 22 }} />
          {form}
          <div className="auth-foot">
            {isRegister ? <>Already registered? <Link className="text-link" href="/login">Sign in</Link></> : <>New to Globe Play? <Link className="text-link" href="/register">Create an account</Link></>}
          </div>
          <p className="muted" style={{ marginTop: 18, textAlign: "center" }}>Email verification is required for sensitive ownership actions.</p>
        </section>
      </main>
    </PortalShell>
  );
}

export function Dashboard() {
  const { data: session, isPending } = authClient.useSession();
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadOrganizations() {
    setLoading(true);
    setError("");
    try {
      const result = await developerApi<Organization[]>("/developers");
      setOrganizations(result);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.id) void loadOrganizations();
    else setOrganizations(null);
  }, [session?.user?.id]);

  return (
    <PortalShell>
      <main className="container">
        <div className="page-head">
          <div><div className="eyebrow">Publisher workspace</div><h1>Organizations</h1><p className="lead">Manage your publisher teams, invitations and ownership.</p></div>
          {session ? <Link className="btn" href="/organizations/new">Create organization</Link> : null}
        </div>
        {isPending ? <div className="card muted">Checking your BrightGlobe session…</div> : !session ? (
          <div className="card" style={{ maxWidth: 620 }}>
            <h2>Sign in to continue</h2>
            <p className="lead">Your developer organizations and team information are private to your account.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <Link className="btn" href="/login">Sign in</Link><Link className="btn secondary" href="/register">Create account</Link>
            </div>
          </div>
        ) : (
          <section className="card">
            <div className="card-head"><div><h2>Your organizations</h2><p className="muted">Only organizations where you have an active membership are shown.</p></div><button className="btn secondary small" onClick={() => void loadOrganizations()} disabled={loading}>Refresh</button></div>
            {error ? <div className="error" role="alert">{error}</div> : null}
            {loading && organizations === null ? <p className="muted">Loading organizations…</p> : organizations?.length ? (
              <div className="list">{organizations.map((organization) => (
                <Link className="list-item" href={"/organizations/" + organization.id} key={organization.id}>
                  <div><div className="item-title">{organization.displayName}</div><div className="item-meta">{organization.slug} · {organization.role.replace(/_/g, " ")}</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="pill gray">{organization.status}</span><span aria-hidden="true">→</span></div>
                </Link>
              ))}</div>
            ) : !loading ? <div className="empty">You have not joined a developer organization yet.<br />Create one to start managing your publisher profile and team.<div style={{ marginTop: 16 }}><Link className="btn" href="/organizations/new">Create your organization</Link></div></div> : null}
          </section>
        )}
      </main>
    </PortalShell>
  );
}

export function CreateOrganizationForm() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await developerApi<{ id: string }>("/developers", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          slug,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
          ...(supportEmail.trim() ? { supportEmail: supportEmail.trim() } : {})
        })
      });
      router.push("/organizations/" + result.id);
      router.refresh();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell>
      <main className="container" style={{ maxWidth: 820 }}>
        <div className="breadcrumb"><Link href="/">Organizations</Link><span>/</span><span>Create organization</span></div>
        <div className="page-head"><div><div className="eyebrow">Publisher onboarding</div><h1>Create an organization</h1><p className="lead">Create your publisher workspace. You will become its first Owner.</p></div></div>
        {!isPending && !session ? <div className="card"><p className="lead">Sign in before creating an organization.</p><Link className="btn" href="/login" style={{ marginTop: 16 }}>Sign in</Link></div> : (
          <form className="card form" onSubmit={submit}>
            <div className="field"><label htmlFor="displayName">Organization name</label><input id="displayName" required minLength={1} maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Example Studio" /></div>
            <div className="field"><label htmlFor="slug">Public organization slug</label><input id="slug" required minLength={3} maxLength={100} pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="example-studio" /><span className="muted">3–100 letters, numbers or single hyphens. The slug is reserved for your publisher profile.</span></div>
            <div className="field"><label htmlFor="description">Description <span className="muted">(optional)</span></label><textarea id="description" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div className="form-row">
              <div className="field"><label htmlFor="websiteUrl">Website <span className="muted">(HTTPS)</span></label><input id="websiteUrl" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com" /></div>
              <div className="field"><label htmlFor="supportEmail">Support email</label><input id="supportEmail" type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="support@example.com" /></div>
            </div>
            {error ? <div className="error" role="alert">{error}</div> : null}
            <div className="security-note">Your organization starts in Pending status. Publisher verification and app ownership checks are separate review steps.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Link className="btn secondary" href="/">Cancel</Link><button className="btn" disabled={busy || isPending || !session}>{busy ? "Creating…" : "Create organization"}</button></div>
          </form>
        )}
      </main>
    </PortalShell>
  );
}

export function OrganizationWorkspace({ developerId }: { developerId: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("release_manager");
  const [ownerEmail, setOwnerEmail] = useState("");

  async function load() {
    setError("");
    try {
      const result = await developerApi<Workspace>("/developers/" + encodeURIComponent(developerId));
      setWorkspace(result);
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }

  useEffect(() => {
    if (session?.user?.id) void load();
  }, [session?.user?.id, developerId]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await developerApi("/developers/" + encodeURIComponent(developerId) + "/invitations", {
        method: "POST", body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      setInviteEmail("");
      setNotice("Invitation email sent.");
      await load();
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setBusy(false); }
  }

  async function transferOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await developerApi("/developers/" + encodeURIComponent(developerId) + "/owner-transfer", {
        method: "POST", body: JSON.stringify({ email: ownerEmail })
      });
      setOwnerEmail("");
      setNotice("Ownership transfer invitation sent. Ownership changes only after the recipient accepts.");
      await load();
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setBusy(false); }
  }

  async function revokeInvitation(invitationId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await developerApi("/developers/" + encodeURIComponent(developerId) + "/invitations/" + encodeURIComponent(invitationId), { method: "DELETE" });
      setNotice("Invitation revoked.");
      await load();
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setBusy(false); }
  }

  const role = workspace?.organization.role;
  const canManage = role === "owner" || role === "admin";

  return (
    <PortalShell>
      <main className="container">
        <div className="breadcrumb"><Link href="/">Organizations</Link><span>/</span><span>Workspace</span></div>
        {isPending ? <div className="card muted">Checking your session…</div> : !session ? <div className="card"><p className="lead">Sign in to open this organization workspace.</p><Link className="btn" href="/login" style={{ marginTop: 16 }}>Sign in</Link></div> : (
          <>
            {error ? <div className="error" role="alert" style={{ marginBottom: 18 }}>{error}</div> : null}
            {notice ? <div className="notice" role="status" style={{ marginBottom: 18 }}>{notice}</div> : null}
            {workspace ? <>
              <div className="page-head"><div><div className="eyebrow">Developer organization</div><h1>{workspace.organization.displayName}</h1><p className="lead">{workspace.organization.slug} · {workspace.organization.websiteUrl ?? "No website added"}</p></div><div style={{ display: "grid", gap: 8, justifyItems: "end" }}><span className="pill gray">{workspace.organization.status}</span><span className="muted">Your role: <strong>{role?.replace(/_/g, " ")}</strong></span></div></div>
              <div className="grid">
                <div className="stack">
                  <section className="card">
                    <div className="card-head"><div><h2>Team members</h2><p className="muted">{workspace.members.length} active member(s)</p></div></div>
                    <div className="list">{workspace.members.map((member) => <div className="list-item" key={member.canonicalUserId}><div><div className="item-title">{member.displayName}</div><div className="item-meta">Joined {new Date(member.createdAt).toLocaleDateString()}</div></div><span className="pill">{member.role.replace(/_/g, " ")}</span></div>)}</div>
                  </section>
                  {canManage ? <section className="card">
                    <div className="card-head"><div><h2>Pending invitations</h2><p className="muted">Only organization Owners and Admins can see invitee email addresses.</p></div></div>
                    {workspace.invitations.length ? <div className="list">{workspace.invitations.map((invitation) => <div className="list-item" key={invitation.id}><div><div className="item-title">{invitation.email}</div><div className="item-meta">{invitation.role.replace(/_/g, " ")} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</div></div><button className="btn danger small" disabled={busy} onClick={() => void revokeInvitation(invitation.id)}>Revoke</button></div>)}</div> : <div className="empty">There are no pending invitations.</div>}
                  </section> : null}
                  {role === "owner" ? <section className="card">
                    <h2>Transfer ownership</h2><p className="muted">The recipient must sign in with the invited verified email and explicitly accept. You remain Owner until that happens.</p>
                    <form className="form" onSubmit={transferOwner} style={{ marginTop: 16 }}><div className="field"><label htmlFor="ownerEmail">New Owner email</label><input id="ownerEmail" type="email" required value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} /></div><button className="btn secondary" disabled={busy || !session.user.emailVerified}>Send ownership transfer</button>{!session.user.emailVerified ? <span className="muted">Verify your account email before initiating an ownership transfer.</span> : null}</form>
                  </section> : null}
                </div>
                <aside className="stack">
                  {canManage ? <section className="card">
                    <h2>Invite a team member</h2><p className="muted">Invitations expire after seven days. Owner is assigned only through the separate transfer process.</p>
                    <form className="form" onSubmit={createInvitation} style={{ marginTop: 16 }}>
                      <div className="field"><label htmlFor="inviteEmail">Email address</label><input id="inviteEmail" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></div>
                      <div className="field"><label htmlFor="inviteRole">Organization role</label><select id="inviteRole" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="admin">Admin</option><option value="release_manager">Release Manager</option><option value="analyst">Analyst</option><option value="support_readonly">Support (read-only)</option></select></div>
                      <button className="btn" disabled={busy}>Send invitation</button>
                    </form>
                  </section> : null}
                  <section className="card"><h2>Publisher status</h2><p className="muted">Organization: <strong>{workspace.organization.status}</strong><br />Verification: <strong>{workspace.organization.verificationStatus}</strong></p><div className="security-note" style={{ marginTop: 14 }}>Organization creation does not automatically verify publisher identity or app ownership. Those checks are handled separately.</div></section>
                </aside>
              </div>
            </> : <div className="card muted">Loading organization workspace…</div>}
          </>
        )}
      </main>
    </PortalShell>
  );
}

export function InvitationAcceptance() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const tokenRef = useRef(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokenRef.current) return;
    tokenRef.current = true;
    const fragment = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const found = new URLSearchParams(fragment).get("token") ?? "";
    // Remove the raw invitation token from the visible URL and browser history immediately.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (/^[a-f0-9]{64}$/i.test(found)) setToken(found);
    else setError("This invitation link is invalid or incomplete.");
  }, []);

  async function accept() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await developerApi<{ developerId: string; role: string; ownerTransferred: boolean }>("/invitations/accept", {
        method: "POST", body: JSON.stringify({ token })
      });
      setToken("");
      setNotice(result.ownerTransferred ? "Ownership transfer accepted." : "You joined the developer organization.");
      router.replace("/organizations/" + result.developerId);
      router.refresh();
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setBusy(false); }
  }

  return (
    <PortalShell>
      <main className="auth-wrap">
        <section className="auth-card">
          <div className="eyebrow">Developer invitation</div>
          <h1>Join an organization</h1>
          <p className="lead">Accepting an invitation requires a verified BrightGlobe email session matching the address the invitation was sent to.</p>
          <div style={{ height: 20 }} />
          {error ? <div className="error" role="alert">{error}</div> : null}
          {notice ? <div className="notice" role="status">{notice}</div> : null}
          {isPending ? <p className="muted">Checking your sign-in…</p> : !session ? <>
            <h2>Sign in to accept</h2>
            <AuthForm mode="login" embedded />
            <p className="muted" style={{ marginTop: 14 }}>If you do not have a verified account yet, register and verify your email first, then reopen the invitation from the original email.</p>
          </> : token ? <>
            <div className="security-note">Signed in as <strong>{session.user.email}</strong>. The server will verify that this email matches the invitation.</div>
            <button className="btn" style={{ width: "100%", marginTop: 18 }} onClick={() => void accept()} disabled={busy}>{busy ? "Accepting…" : "Accept invitation"}</button>
          </> : <p className="muted">No invitation token is available. Reopen the original invitation email link.</p>}
        </section>
      </main>
    </PortalShell>
  );
}
