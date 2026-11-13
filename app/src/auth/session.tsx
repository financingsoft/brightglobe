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

type UserCenterResponse = {
  user: UserIdentity;
  profile: UserProfile;
};

export type AuthStatus =
  | "unconfigured"
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "preview";

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  isPreviewAccount: boolean;
  previewEnabled: boolean;
  user: UserIdentity | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  verifyPhoneOtp: (phoneNumber: string, code: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isAuthConfigured) {
    return <UnconfiguredAuthProvider>{children}</UnconfiguredAuthProvider>;
  }
  return <ConnectedAuthProvider>{children}</ConnectedAuthProvider>;
}

function UnconfiguredAuthProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState(false);
  const value = useMemo<AuthContextValue>(() => ({
    status: preview ? "preview" : "unconfigured",
    isAuthenticated: preview,
    isPreviewAccount: preview,
    previewEnabled,
    user: null,
    profile: null,
    profileLoading: false,
    profileError: null,
    sendPhoneOtp: async () => {
      throw new Error("The BrightGlobe API is not configured.");
    },
    verifyPhoneOtp: async () => {
      throw new Error("The BrightGlobe API is not configured.");
    },
    refreshProfile: async () => undefined,
    updateProfile: async () => {
      throw new Error("The BrightGlobe API is not configured.");
    },
    loadSessions: async () => [],
    revokeSession: async () => {
      throw new Error("Device sessions require a live account.");
    },
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
  const [account, setAccount] = useState<UserCenterResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const sessionUserId = session?.user?.id;

  const refreshProfile = useCallback(async () => {
    if (!sessionUserId) {
      setAccount(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const response = await apiRequest<UserCenterResponse>("/api/v1/me");
      setAccount(response);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to load your profile.");
      throw error;
    } finally {
      setProfileLoading(false);
    }
  }, [sessionUserId]);

  useEffect(() => {
    let active = true;
    if (!sessionUserId) {
      setAccount(null);
      setProfileError(null);
      setProfileLoading(false);
      return () => { active = false; };
    }

    setProfileLoading(true);
    setProfileError(null);
    apiRequest<UserCenterResponse>("/api/v1/me")
      .then((response) => {
        if (active) setAccount(response);
      })
      .catch((error: unknown) => {
        if (active) {
          setProfileError(error instanceof Error ? error.message : "Unable to load your profile.");
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => { active = false; };
  }, [sessionUserId]);

  const sendPhoneOtp = useCallback(async (phoneNumber: string) => {
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber });
    if (result.error) throw new Error(result.error.message || "Unable to send the verification code.");
  }, []);

  const verifyPhoneOtp = useCallback(async (phoneNumber: string, code: string) => {
    const result = await authClient.phoneNumber.verify({ phoneNumber, code });
    if (result.error) throw new Error(result.error.message || "The verification code is invalid.");
    await refetch();
  }, [refetch]);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    const response = await apiRequest<{ profile: UserProfile }>("/api/v1/me/profile", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
    setAccount((current) => current ? {
      ...current,
      user: {
        ...current.user,
        ...(input.displayName !== undefined ? { name: input.displayName } : {})
      },
      profile: response.profile
    } : current);
  }, []);

  const loadSessions = useCallback(async () => {
    const response = await apiRequest<{ sessions: AuthSession[] }>("/api/v1/me/sessions");
    return response.sessions;
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    await apiRequest<void>(\`/api/v1/me/sessions/\${encodeURIComponent(sessionId)}\`, {
      method: "DELETE"
    });
  }, []);

  const revokeOtherSessions = useCallback(async () => {
    const response = await apiRequest<{ revokedCount: number }>("/api/v1/me/sessions/revoke-others", {
      method: "POST"
    });
    return response.revokedCount;
  }, []);

  const signOut = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message || "Unable to sign out.");
    setAccount(null);
    await refetch();
  }, [refetch]);

  const user: UserIdentity | null = account?.user ?? (session?.user ? {
    id: session.user.id,
    name: session.user.name,
    email: null,
    phoneNumber: null,
    phoneNumberVerified: false
  } : null);

  const status: AuthStatus = isPending
    ? "loading"
    : session
      ? "authenticated"
      : "unauthenticated";

  const value = useMemo<AuthContextValue>(() => ({
    status,
    isAuthenticated: status === "authenticated",
    isPreviewAccount: false,
    previewEnabled: false,
    user,
    profile: account?.profile ?? null,
    profileLoading,
    profileError,
    sendPhoneOtp,
    verifyPhoneOtp,
    refreshProfile,
    updateProfile,
    loadSessions,
    revokeSession,
    revokeOtherSessions,
    signOut,
    enterPreviewAccount: () => undefined
  }), [
    status, user, account, profileLoading, profileError,
    sendPhoneOtp, verifyPhoneOtp, refreshProfile, updateProfile,
    loadSessions, revokeSession, revokeOtherSessions, signOut
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
