import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { apiRequest } from "@/services/api";
import { authClient, isAuthConfigured } from "./client";
import {
  clearWalletSession,
  getWalletSession,
  revokeWalletSession,
  walletSessionRequest,
  WalletAuthError,
  type WalletSession
} from "@/wallet/auth";

export type UserProfile = {
  displayName: string;
  locale: string;
  timeZone: string | null;
  countryCode: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserIdentity = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
};

export type AuthSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export type ProfileUpdateInput = Partial<Pick<
  UserProfile,
  "displayName" | "locale" | "timeZone" | "countryCode" | "avatarUrl" | "bio"
>>;

type CanonicalIdentityResponse = {
  user: { id: string; email: string | null };
  profile: UserProfile;
  wallets: Array<{ network: string; address: string; verifiedAt: string }>;
};

export type AuthStatus =
  | "unconfigured"
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "preview";

type AuthContextValue = {
  status: AuthStatus;
  authMethod: "email" | "wallet" | "preview" | null;
  hasWalletSession: boolean;
  linkEmailIdentity: () => Promise<void>;
  isAuthenticated: boolean;
  isPreviewAccount: boolean;
  previewEnabled: boolean;
  user: UserIdentity | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  acceptWalletSession: (session: WalletSession) => Promise<void>;
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  verifyPhoneOtp: (phoneNumber: string, code: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  sendVerificationEmail: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  loadSessions: () => Promise<AuthSession[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  revokeOtherSessions: () => Promise<number>;
  signOut: () => Promise<void>;
  enterPreviewAccount: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const previewEnabled =
  !isAuthConfigured && process.env.EXPO_PUBLIC_ENABLE_PREVIEW_AUTH === "true";

function mapCanonicalIdentity(response: CanonicalIdentityResponse): {
  user: UserIdentity;
  profile: UserProfile;
} {
  return {
    user: {
      id: response.user.id,
      name: response.profile.displayName,
      email: response.user.email,
      phoneNumber: null,
      phoneNumberVerified: false
    },
    profile: response.profile
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isAuthConfigured) {
    return <UnconfiguredAuthProvider>{children}</UnconfiguredAuthProvider>;
  }
  return <ConnectedAuthProvider>{children}</ConnectedAuthProvider>;
}

function UnconfiguredAuthProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState(false);
  const unavailable = async (): Promise<never> => {
    throw new Error("The BrightGlobe API is not configured.");
  };
  const value = useMemo<AuthContextValue>(() => ({
    status: preview ? "preview" : "unconfigured",
    authMethod: preview ? "preview" : null,
    hasWalletSession: false,
    linkEmailIdentity: unavailable,
    isAuthenticated: preview,
    isPreviewAccount: preview,
    previewEnabled,
    user: null,
    profile: null,
    profileLoading: false,
    profileError: null,
    acceptWalletSession: unavailable,
    sendPhoneOtp: unavailable,
    verifyPhoneOtp: unavailable,
    signUpEmail: unavailable,
    signInEmail: unavailable,
    sendVerificationEmail: unavailable,
    requestPasswordReset: unavailable,
    resetPassword: unavailable,
    refreshProfile: async () => undefined,
    updateProfile: unavailable,
    loadSessions: async () => [],
    revokeSession: unavailable,
    revokeOtherSessions: async () => 0,
    signOut: async () => setPreview(false),
    enterPreviewAccount: () => {
      if (previewEnabled) setPreview(true);
    }
  }), [preview]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ConnectedAuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);
  const [walletSessionLoading, setWalletSessionLoading] = useState(true);
  const [account, setAccount] = useState<{ user: UserIdentity; profile: UserProfile } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const sessionUserId = session?.user?.id;

  useEffect(() => {
    let active = true;
    getWalletSession()
      .then((stored) => {
        if (active) setWalletSession(stored);
      })
      .catch(() => {
        if (active) setWalletSession(null);
      })
      .finally(() => {
        if (active) setWalletSessionLoading(false);
      });
    return () => { active = false; };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!sessionUserId && !walletSession) {
      setAccount(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const response = sessionUserId
        ? await apiRequest<CanonicalIdentityResponse>("/api/v1/identity/me")
        : await walletSessionRequest<CanonicalIdentityResponse>(
            "/api/v1/identity/me",
            {},
            walletSession!.token
          );
      setAccount(mapCanonicalIdentity(response));
    } catch (error) {
      if (!sessionUserId && error instanceof WalletAuthError && error.status === 401) {
        await clearWalletSession();
        setWalletSession(null);
      }
      setProfileError(error instanceof Error ? error.message : "Unable to load your profile.");
      throw error;
    } finally {
      setProfileLoading(false);
    }
  }, [sessionUserId, walletSession]);

  useEffect(() => {
    let active = true;
    if (!sessionUserId && !walletSession) {
      setAccount(null);
      setProfileError(null);
      setProfileLoading(false);
      return () => { active = false; };
    }

    setProfileLoading(true);
    setProfileError(null);
    const load = sessionUserId
      ? apiRequest<CanonicalIdentityResponse>("/api/v1/identity/me")
      : walletSessionRequest<CanonicalIdentityResponse>(
          "/api/v1/identity/me",
          {},
          walletSession!.token
        );
    load
      .then((response) => {
        if (active) setAccount(mapCanonicalIdentity(response));
      })
      .catch(async (error: unknown) => {
        if (!active) return;
        if (!sessionUserId && error instanceof WalletAuthError && error.status === 401) {
          await clearWalletSession();
          if (active) setWalletSession(null);
        }
        if (active) setProfileError(error instanceof Error ? error.message : "Unable to load your profile.");
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => { active = false; };
  }, [sessionUserId, walletSession]);

  const acceptWalletSession = useCallback(async (next: WalletSession) => {
    setWalletSession(next);
    const response = await walletSessionRequest<CanonicalIdentityResponse>(
      "/api/v1/identity/me",
      {},
      next.token
    );
    setAccount(mapCanonicalIdentity(response));
  }, []);

  const linkEmailIdentity = useCallback(async () => {
    if (!session || !walletSession) {
      throw new Error("Both a verified email session and an active wallet session are required.");
    }
    const cookie = await authClient.getCookie();
    if (!cookie) throw new Error("The verified email session cookie is unavailable.");
    await walletSessionRequest<{ linked: boolean }>(
      "/api/v1/identity/link/email",
      { method: "POST", headers: { Cookie: cookie } },
      walletSession.token
    );
    await refreshProfile();
  }, [session, walletSession, refreshProfile]);

  const sendPhoneOtp = useCallback(async (phoneNumber: string) => {
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber });
    if (result.error) throw new Error(result.error.message || "Unable to send the verification code.");
  }, []);

  const verifyPhoneOtp = useCallback(async (phoneNumber: string, code: string) => {
    const result = await authClient.phoneNumber.verify({ phoneNumber, code });
    if (result.error) throw new Error(result.error.message || "The verification code is invalid.");
    await refetch();
  }, [refetch]);

  const signUpEmail = useCallback(async (email: string, password: string, name: string) => {
    const result = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: "https://test.globeapps.com/auth/verified"
    });
    if (result.error) throw new Error(result.error.message || "Unable to create your account.");
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password, rememberMe: true });
    if (result.error) throw new Error(result.error.message || "Unable to sign in.");
    await refetch();
  }, [refetch]);

  const sendVerificationEmail = useCallback(async (email: string) => {
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL: "https://test.globeapps.com/auth/verified"
    });
    if (result.error) throw new Error(result.error.message || "Unable to send the verification email.");
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "brightglobe://auth/reset-password"
    });
    if (result.error) throw new Error(result.error.message || "Unable to request a password reset.");
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    const result = await authClient.resetPassword({ token, newPassword });
    if (result.error) throw new Error(result.error.message || "Unable to reset your password.");
  }, []);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    const response = sessionUserId
      ? await apiRequest<{ profile: UserProfile }>("/api/v1/identity/profile", {
          method: "PATCH",
          body: JSON.stringify(input)
        })
      : await walletSessionRequest<{ profile: UserProfile }>(
          "/api/v1/identity/profile",
          { method: "PATCH", body: JSON.stringify(input) },
          walletSession!.token
        );
    setAccount((current) => current ? {
      ...current,
      user: { ...current.user, ...(input.displayName !== undefined ? { name: input.displayName } : {}) },
      profile: response.profile
    } : current);
  }, [sessionUserId, walletSession]);

  const loadSessions = useCallback(async () => {
    if (!sessionUserId) return [];
    const response = await apiRequest<{ sessions: AuthSession[] }>("/api/v1/me/sessions");
    return response.sessions;
  }, [sessionUserId]);

  const revokeSession = useCallback(async (sessionId: string) => {
    if (!sessionUserId) throw new Error("Wallet sessions are managed separately.");
    await apiRequest<void>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  }, [sessionUserId]);

  const revokeOtherSessions = useCallback(async () => {
    if (!sessionUserId) return 0;
    const response = await apiRequest<{ revokedCount: number }>("/api/v1/me/sessions/revoke-others", {
      method: "POST"
    });
    return response.revokedCount;
  }, [sessionUserId]);

  const signOut = useCallback(async () => {
    if (walletSession) {
      await revokeWalletSession(walletSession.token);
      await clearWalletSession();
      setWalletSession(null);
    }
    if (session) {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Unable to sign out.");
      await refetch();
    }
    setAccount(null);
  }, [walletSession, session, refetch]);

  const user = account?.user ?? (session?.user ? {
    id: session.user.id,
    name: session.user.name,
    email: null,
    phoneNumber: null,
    phoneNumberVerified: false
  } : null);

  const status: AuthStatus = isPending || walletSessionLoading
    ? "loading"
    : session || walletSession
      ? "authenticated"
      : "unauthenticated";

  const value = useMemo<AuthContextValue>(() => ({
    status,
    authMethod: session ? "email" : walletSession ? "wallet" : null,
    hasWalletSession: Boolean(walletSession),
    linkEmailIdentity,
    isAuthenticated: status === "authenticated",
    isPreviewAccount: false,
    previewEnabled: false,
    user,
    profile: account?.profile ?? null,
    profileLoading,
    profileError,
    acceptWalletSession,
    sendPhoneOtp,
    verifyPhoneOtp,
    signUpEmail,
    signInEmail,
    sendVerificationEmail,
    requestPasswordReset,
    resetPassword,
    refreshProfile,
    updateProfile,
    loadSessions,
    revokeSession,
    revokeOtherSessions,
    signOut,
    enterPreviewAccount: () => undefined
  }), [
    status, session, walletSession, user, account, profileLoading, profileError,
    linkEmailIdentity, acceptWalletSession, sendPhoneOtp, verifyPhoneOtp, signUpEmail, signInEmail,
    sendVerificationEmail, requestPasswordReset, resetPassword, refreshProfile,
    updateProfile, loadSessions, revokeSession, revokeOtherSessions, signOut
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
