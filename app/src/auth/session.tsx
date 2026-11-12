import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AuthContextValue = {
  isAuthenticated: boolean;
  enterPreviewAccount: () => void;
  signOutPreviewAccount: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    enterPreviewAccount: () => setIsAuthenticated(true),
    signOutPreviewAccount: () => setIsAuthenticated(false)
  }), [isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
