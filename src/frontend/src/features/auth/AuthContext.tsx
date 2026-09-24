import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LoginRequest, PublicUser, RegistrationRequest } from "@surplus/shared";
import * as authApi from "../../lib/auth-api";

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegistrationRequest) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authApi.currentUser().then((current) => {
      if (active) setUser(current);
    }).catch(() => {
      if (active) setUser(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (input: LoginRequest) => setUser((await authApi.login(input)).user), []);
  const register = useCallback(async (input: RegistrationRequest) => setUser((await authApi.register(input)).user), []);
  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
