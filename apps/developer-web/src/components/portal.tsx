"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePortalLocale, tx } from "@/components/locale";
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
    canRevoke: boolean;
  }>;
};

function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const { locale, setLocale } = usePortalLocale();
  return (
    <div className="portal">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="logo" href="/">
            <span className="logo-mark">G</span>
            <span>Globe Play <span style={{ color: "#8793a8", fontWeight: 500 }}>Developers</span></span>
          </Link>
          <nav className="top-nav" aria-label="Main navigation">
            <Link href="/">{tx(locale, "Organizations", "组织")}</Link>
            <Link href="/organizations/new">{tx(locale, "Create organization", "创建组织")}</Link>
          </nav>
          <div className="top-actions">
            <button className="btn secondary small" type="button" onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>{locale === "en" ? "简体中文" : "English"}</button>
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
                  <DeveloperAppsPanel developerId={developerId} role={role ?? ""} />
                  <section className="card">
                    <div className="card-head"><div><h2>Team members</h2><p className="muted">{workspace.members.length} active member(s)</p></div></div>
                    <div className="list">{workspace.members.map((member) => <div className="list-item" key={member.canonicalUserId}><div><div className="item-title">{member.displayName}</div><div className="item-meta">Joined {new Date(member.createdAt).toLocaleDateString()}</div></div><span className="pill">{member.role.replace(/_/g, " ")}</span></div>)}</div>
                  </section>
                  {canManage ? <section className="card">
                    <div className="card-head"><div><h2>Pending invitations</h2><p className="muted">Only organization Owners and Admins can see invitee email addresses.</p></div></div>
                    {workspace.invitations.length ? <div className="list">{workspace.invitations.map((invitation) => <div className="list-item" key={invitation.id}><div><div className="item-title">{invitation.email}</div><div className="item-meta">{invitation.role.replace(/_/g, " ")} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</div></div>{invitation.canRevoke ? <button className="btn danger small" disabled={busy} onClick={() => void revokeInvitation(invitation.id)}>Revoke</button> : <span className="pill gray">Awaiting recipient</span>}</div>)}</div> : <div className="empty">There are no pending invitations.</div>}
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


type AppPlatform = "android" | "ios" | "web" | "windows" | "macos" | "linux";
type AppCategory = { id: string; slug: string; parentId: string | null; name: string | null; sortOrder: number };
type AppListItem = {
  id: string; slug: string; appType: "app" | "game"; status: string;
  createdAt: string; updatedAt: string;
  localizations: Array<{ locale: string; name: string; status: string; revisionNumber: number }>;
};
type AppLocalization = {
  id: string; revisionNumber: number; locale: string; name: string; tagline: string | null;
  description: string; websiteUrl: string | null; privacyPolicyUrl: string | null; supportUrl: string | null;
  status: string; categories: Array<{ id: string; slug: string }>; platforms: AppPlatform[];
};
type AppDetail = {
  id: string; developerId: string; slug: string; appType: "app" | "game"; status: string;
  slugLockedAt: string | null; createdAt: string; updatedAt: string; localizations: AppLocalization[];
};
const appPlatforms: AppPlatform[] = ["android", "ios", "web", "windows", "macos", "linux"];

async function loadCategories(developerId: string, locale: string) {
  return developerApi<AppCategory[]>("/developers/" + encodeURIComponent(developerId) + "/categories?locale=" + encodeURIComponent(locale));
}

function CategoryPicker({ categories, selected, onChange, disabled = false }: {
  categories: AppCategory[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const { locale } = usePortalLocale();
  const label = (category: AppCategory) => category.name || category.slug;
  return (
    <div className="choice-grid">
      {categories.length ? categories.map((category) => {
        const checked = selected.includes(category.id);
        return <label className="choice" key={category.id}>
          <input type="checkbox" checked={checked} disabled={disabled || (!checked && selected.length >= 3)} onChange={() => onChange(checked ? selected.filter((id) => id !== category.id) : [...selected, category.id])} />
          <span>{label(category)}</span>
        </label>;
      }) : <p className="muted">{tx(locale, "The platform category catalogue is not configured yet. You can save this draft and select categories later.", "平台分类目录尚未配置。你可以先保存草稿，之后再选择分类。")}</p>}
    </div>
  );
}

function PlatformPicker({ selected, onChange, disabled = false }: {
  selected: AppPlatform[]; onChange: (platforms: AppPlatform[]) => void; disabled?: boolean;
}) {
  const { locale } = usePortalLocale();
  const names: Record<AppPlatform, string> = {
    android: "Android", ios: "iOS / iPadOS", web: "Web", windows: "Windows", macos: "macOS", linux: "Linux"
  };
  return <div className="choice-grid">
    {appPlatforms.map((platform) => <label className="choice" key={platform}>
      <input type="checkbox" checked={selected.includes(platform)} disabled={disabled} onChange={() => onChange(selected.includes(platform) ? selected.filter((item) => item !== platform) : [...selected, platform])} />
      <span>{names[platform]}</span>
    </label>)}
    <span className="muted full-row">{tx(locale, "Platform selection describes compatibility. It does not authorize Globe-hosted binary distribution.", "平台选择仅表示兼容性，不代表 Globe 获准托管该平台的安装包。")}</span>
  </div>;
}

export function DeveloperAppsPanel({ developerId, role }: { developerId: string; role: string }) {
  const { locale } = usePortalLocale();
  const [apps, setApps] = useState<AppListItem[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canCreate = ["owner", "admin", "release_manager"].includes(role);
  async function load() {
    setLoading(true); setError("");
    try { setApps(await developerApi<AppListItem[]>("/developers/" + encodeURIComponent(developerId) + "/apps")); }
    catch (caught) { setError(friendlyError(caught)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [developerId]);
  return <section className="card">
    <div className="card-head">
      <div><h2>{tx(locale, "Apps & games", "应用与游戏")}</h2><p className="muted">{tx(locale, "Manage app identity and localized store listings.", "管理应用身份和多语言商店资料。")}</p></div>
      <div className="inline-actions">
        <button className="btn secondary small" onClick={() => void load()} disabled={loading}>{tx(locale, "Refresh", "刷新")}</button>
        {canCreate ? <Link className="btn small" href={"/organizations/" + developerId + "/apps/new"}>{tx(locale, "Create app", "创建应用")}</Link> : null}
      </div>
    </div>
    {error ? <div className="error" role="alert">{error}</div> : null}
    {loading && apps === null ? <p className="muted">{tx(locale, "Loading apps…", "正在加载应用…")}</p> : apps?.length ? <div className="list">
      {apps.map((app) => <Link className="list-item" href={"/organizations/" + developerId + "/apps/" + app.id} key={app.id}>
        <div><div className="item-title">{app.localizations.find((item) => item.locale === locale)?.name || app.localizations[0]?.name || app.slug}</div>
          <div className="item-meta">{app.slug} · {app.appType.toUpperCase()} · {app.localizations.map((item) => item.locale).join(", ")}</div></div>
        <div className="inline-actions"><span className="pill gray">{app.status}</span><span aria-hidden="true">→</span></div>
      </Link>)}
    </div> : !loading ? <div className="empty">{tx(locale, "No apps or games yet.", "还没有应用或游戏。")}{canCreate ? <div style={{ marginTop: 14 }}><Link className="btn" href={"/organizations/" + developerId + "/apps/new"}>{tx(locale, "Create your first app", "创建第一个应用")}</Link></div> : null}</div> : null}
  </section>;
}

export function CreateAppForm({ developerId }: { developerId: string }) {
  const { data: session, isPending } = authClient.useSession();
  const { locale } = usePortalLocale();
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [appType, setAppType] = useState<"app" | "game">("app");
  const [platforms, setPlatforms] = useState<AppPlatform[]>(["android", "ios"]);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [enName, setEnName] = useState(""); const [enTagline, setEnTagline] = useState(""); const [enDescription, setEnDescription] = useState("");
  const [zhName, setZhName] = useState(""); const [zhTagline, setZhTagline] = useState(""); const [zhDescription, setZhDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(""); const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(""); const [supportUrl, setSupportUrl] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (session?.user?.id) void loadCategories(developerId, locale).then(setCategories).catch((caught) => setError(friendlyError(caught))); }, [session?.user?.id, developerId, locale]);
  function togglePlatform(platform: AppPlatform) { setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const localizations = [
      ...(enName.trim() && enDescription.trim() ? [{ locale: "en", name: enName, tagline: enTagline || null, description: enDescription, websiteUrl: websiteUrl || null, privacyPolicyUrl: privacyPolicyUrl || null, supportUrl: supportUrl || null }] : []),
      ...(zhName.trim() && zhDescription.trim() ? [{ locale: "zh-CN", name: zhName, tagline: zhTagline || null, description: zhDescription, websiteUrl: websiteUrl || null, privacyPolicyUrl: privacyPolicyUrl || null, supportUrl: supportUrl || null }] : [])
    ];
    if (!localizations.length) { setError(tx(locale, "Complete at least one language listing with a name and description.", "至少填写一种语言的应用名称和介绍。")); setBusy(false); return; }
    if (!platforms.length) { setError(tx(locale, "Select at least one platform.", "至少选择一个平台。")); setBusy(false); return; }
    try {
      const created = await developerApi<{ id: string }>("/developers/" + encodeURIComponent(developerId) + "/apps", {
        method: "POST", body: JSON.stringify({ slug, appType, platforms, categoryIds, localizations })
      });
      router.push("/organizations/" + developerId + "/apps/" + created.id); router.refresh();
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setBusy(false); }
  }
  return <PortalShell><main className="container narrow">
    <div className="breadcrumb"><Link href={"/organizations/" + developerId}>Organization</Link><span>/</span><span>{tx(locale, "Create app", "创建应用")}</span></div>
    <div className="page-head"><div><div className="eyebrow">Globe Play · Publisher</div><h1>{tx(locale, "Create an app or game", "创建应用或游戏")}</h1><p className="lead">{tx(locale, "Start with a private draft. Nothing is published until a later review and release workflow.", "先创建私有草稿。后续完成审核和发布流程前，内容不会公开。")}</p></div></div>
    {!isPending && !session ? <div className="card"><p className="lead">{tx(locale, "Sign in to create an app.", "登录后才能创建应用。")}</p><Link className="btn" href="/login">{tx(locale, "Sign in", "登录")}</Link></div> : <form className="stack" onSubmit={submit}>
      <section className="card form">
        <h2>{tx(locale, "App identity", "应用基本信息")}</h2>
        <div className="form-row">
          <div className="field"><label htmlFor="app-type">{tx(locale, "Type", "类型")}</label><select id="app-type" value={appType} onChange={(event) => setAppType(event.target.value as "app" | "game")}><option value="app">{tx(locale, "App", "应用")}</option><option value="game">{tx(locale, "Game", "游戏")}</option></select></div>
          <div className="field"><label htmlFor="app-slug">Slug</label><input id="app-slug" required minLength={3} maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} placeholder="example-game" /><span className="muted">{tx(locale, "Unique public identifier; locked after first publication.", "全局唯一标识；首次发布后不可修改。")}</span></div>
        </div>
        <div className="field"><label>{tx(locale, "Supported platforms", "支持的平台")}</label><PlatformPicker selected={platforms} onChange={setPlatforms} /></div>
        <div className="field"><label>{tx(locale, "Categories (up to 3)", "分类（最多 3 个）")}</label><CategoryPicker categories={categories} selected={categoryIds} onChange={setCategoryIds} /></div>
      </section>
      <section className="card form">
        <h2>{tx(locale, "English listing", "英文资料")}</h2>
        <div className="field"><label htmlFor="en-name">{tx(locale, "App name", "应用名称")}</label><input id="en-name" maxLength={160} value={enName} onChange={(event) => setEnName(event.target.value)} /></div>
        <div className="field"><label htmlFor="en-tagline">{tx(locale, "Short description", "简短介绍")}</label><input id="en-tagline" maxLength={240} value={enTagline} onChange={(event) => setEnTagline(event.target.value)} /></div>
        <div className="field"><label htmlFor="en-description">{tx(locale, "Full description", "完整介绍")}</label><textarea id="en-description" required={!(zhName.trim() && zhDescription.trim())} maxLength={20000} value={enDescription} onChange={(event) => setEnDescription(event.target.value)} /></div>
      </section>
      <section className="card form">
        <h2>{tx(locale, "简体中文资料", "简体中文资料")}</h2>
        <div className="field"><label htmlFor="zh-name">{tx(locale, "App name", "应用名称")}</label><input id="zh-name" maxLength={160} value={zhName} onChange={(event) => setZhName(event.target.value)} /></div>
        <div className="field"><label htmlFor="zh-tagline">{tx(locale, "Short description", "简短介绍")}</label><input id="zh-tagline" maxLength={240} value={zhTagline} onChange={(event) => setZhTagline(event.target.value)} /></div>
        <div className="field"><label htmlFor="zh-description">{tx(locale, "Full description", "完整介绍")}</label><textarea id="zh-description" required={!(enName.trim() && enDescription.trim())} maxLength={20000} value={zhDescription} onChange={(event) => setZhDescription(event.target.value)} /></div>
      </section>
      <section className="card form">
        <h2>{tx(locale, "Publisher links", "发布者链接")}</h2>
        <div className="field"><label htmlFor="app-website">{tx(locale, "Official website (HTTPS)", "官方网站（HTTPS）")}</label><input id="app-website" type="url" placeholder="https://example.com" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} /></div>
        <div className="form-row">
          <div className="field"><label htmlFor="app-privacy">{tx(locale, "Privacy policy URL", "隐私政策链接")}</label><input id="app-privacy" type="url" placeholder="https://example.com/privacy" value={privacyPolicyUrl} onChange={(event) => setPrivacyPolicyUrl(event.target.value)} /></div>
          <div className="field"><label htmlFor="app-support">{tx(locale, "Support URL", "支持链接")}</label><input id="app-support" type="url" placeholder="https://example.com/support" value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} /></div>
        </div>
        {error ? <div className="error" role="alert">{error}</div> : null}
        <div className="inline-actions end"><Link className="btn secondary" href={"/organizations/" + developerId}>{tx(locale, "Cancel", "取消")}</Link><button className="btn" disabled={busy || isPending || !session}>{busy ? tx(locale, "Creating…", "正在创建…") : tx(locale, "Save draft", "保存草稿")}</button></div>
      </section>
    </form>}
  </main></PortalShell>;
}

export function EditAppForm({ developerId, appId }: { developerId: string; appId: string }) {
  const { data: session, isPending } = authClient.useSession();
  const { locale } = usePortalLocale();
  const router = useRouter();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [selectedLocale, setSelectedLocale] = useState("en");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState(""); const [tagline, setTagline] = useState(""); const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(""); const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(""); const [supportUrl, setSupportUrl] = useState("");
  const [platforms, setPlatforms] = useState<AppPlatform[]>([]); const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const detail = await developerApi<AppDetail>("/developers/" + encodeURIComponent(developerId) + "/apps/" + encodeURIComponent(appId));
      setApp(detail); setSlug(detail.slug);
      const chosen = detail.localizations.find((item) => item.locale === selectedLocale) ?? detail.localizations[0];
      if (chosen) {
        setSelectedLocale(chosen.locale); setName(chosen.name); setTagline(chosen.tagline ?? ""); setDescription(chosen.description);
        setWebsiteUrl(chosen.websiteUrl ?? ""); setPrivacyPolicyUrl(chosen.privacyPolicyUrl ?? ""); setSupportUrl(chosen.supportUrl ?? "");
        setPlatforms(chosen.platforms); setCategoryIds(chosen.categories.map((item) => item.id));
      }
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (session?.user?.id) void load(); }, [session?.user?.id, developerId, appId]);
  useEffect(() => { if (session?.user?.id) void loadCategories(developerId, locale).then(setCategories).catch((caught) => setError(friendlyError(caught))); }, [session?.user?.id, developerId, locale]);
  function chooseLocale(next: string) {
    const selected = app?.localizations.find((item) => item.locale === next);
    if (!selected) return;
    setSelectedLocale(next); setName(selected.name); setTagline(selected.tagline ?? ""); setDescription(selected.description);
    setWebsiteUrl(selected.websiteUrl ?? ""); setPrivacyPolicyUrl(selected.privacyPolicyUrl ?? ""); setSupportUrl(selected.supportUrl ?? "");
    setPlatforms(selected.platforms); setCategoryIds(selected.categories.map((item) => item.id));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await developerApi("/developers/" + encodeURIComponent(developerId) + "/apps/" + encodeURIComponent(appId) + "/localizations/" + encodeURIComponent(selectedLocale), {
        method: "PATCH", body: JSON.stringify({
          slug, name, tagline: tagline || null, description, websiteUrl: websiteUrl || null,
          privacyPolicyUrl: privacyPolicyUrl || null, supportUrl: supportUrl || null, platforms, categoryIds
        })
      });
      setNotice(tx(locale, "Draft saved.", "草稿已保存。")); await load();
    } catch (caught) { setError(friendlyError(caught)); }
    finally { setBusy(false); }
  }
  const revision = app?.localizations.find((item) => item.locale === selectedLocale);
  const editable = app?.status === "draft" && revision?.status === "draft";
  return <PortalShell><main className="container narrow">
    <div className="breadcrumb"><Link href={"/organizations/" + developerId}>{tx(locale, "Organization", "组织")}</Link><span>/</span><span>{tx(locale, "App details", "应用详情")}</span></div>
    {loading ? <div className="card muted">{tx(locale, "Loading app…", "正在加载应用…")}</div> : !session ? <div className="card"><p>{tx(locale, "Sign in to manage this app.", "登录后才能管理此应用。")}</p><Link className="btn" href="/login">{tx(locale, "Sign in", "登录")}</Link></div> : error && !app ? <div className="error" role="alert">{error}</div> : app ? <>
      <div className="page-head"><div><div className="eyebrow">Globe Play · {app.appType}</div><h1>{name || app.slug}</h1><p className="lead">{app.slug} · {tx(locale, "Draft status", "草稿状态")}: {app.status}</p></div><span className="pill gray">{revision?.status ?? "—"}</span></div>
      {!editable ? <div className="security-note">{tx(locale, "This app or locale is not an editable draft. Submitted and published content is kept immutable in this workflow.", "此应用或语言版本不是可编辑草稿。已提交或已发布内容在此流程中保持不可变。")}</div> : <form className="stack" onSubmit={save}>
        <section className="card form">
          <h2>{tx(locale, "Listing language", "资料语言")}</h2>
          <div className="field"><label htmlFor="listing-locale">{tx(locale, "Locale", "语言")}</label><select id="listing-locale" value={selectedLocale} onChange={(event) => chooseLocale(event.target.value)}>{app.localizations.map((item) => <option value={item.locale} key={item.locale}>{item.locale} · {item.status}</option>)}</select></div>
          <div className="field"><label htmlFor="edit-slug">Slug</label><input id="edit-slug" value={slug} disabled={Boolean(app.slugLockedAt)} onChange={(event) => setSlug(event.target.value.toLowerCase())} /></div>
        </section>
        <section className="card form">
          <h2>{tx(locale, "Localized listing", "多语言资料")}</h2>
          <div className="field"><label htmlFor="edit-name">{tx(locale, "App name", "应用名称")}</label><input id="edit-name" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="field"><label htmlFor="edit-tagline">{tx(locale, "Short description", "简短介绍")}</label><input id="edit-tagline" maxLength={240} value={tagline} onChange={(event) => setTagline(event.target.value)} /></div>
          <div className="field"><label htmlFor="edit-description">{tx(locale, "Full description", "完整介绍")}</label><textarea id="edit-description" required maxLength={20000} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className="field"><label htmlFor="edit-website">{tx(locale, "Official website (HTTPS)", "官方网站（HTTPS）")}</label><input id="edit-website" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} /></div>
          <div className="form-row"><div className="field"><label htmlFor="edit-privacy">{tx(locale, "Privacy policy URL", "隐私政策链接")}</label><input id="edit-privacy" type="url" value={privacyPolicyUrl} onChange={(event) => setPrivacyPolicyUrl(event.target.value)} /></div><div className="field"><label htmlFor="edit-support">{tx(locale, "Support URL", "支持链接")}</label><input id="edit-support" type="url" value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} /></div></div>
        </section>
        <section className="card form"><h2>{tx(locale, "Platforms and categories for this locale", "此语言版本的平台和分类")}</h2>
          <div className="field"><label>{tx(locale, "Supported platforms", "支持的平台")}</label><PlatformPicker selected={platforms} onChange={setPlatforms} /></div>
          <div className="field"><label>{tx(locale, "Categories (up to 3)", "分类（最多 3 个）")}</label><CategoryPicker categories={categories} selected={categoryIds} onChange={setCategoryIds} /></div>
          {error ? <div className="error" role="alert">{error}</div> : null}{notice ? <div className="notice" role="status">{notice}</div> : null}
          <div className="inline-actions end"><Link className="btn secondary" href={"/organizations/" + developerId}>{tx(locale, "Back", "返回")}</Link><button className="btn" disabled={busy}>{busy ? tx(locale, "Saving…", "正在保存…") : tx(locale, "Save draft", "保存草稿")}</button></div>
        </section>
      </form>}
    </> : null}
  </main></PortalShell>;
}
