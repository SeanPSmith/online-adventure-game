import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../services/auth";
import type { User } from "../services/auth";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  authenticated: boolean;
  user: User | null;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await authApi.getCurrentUser();
      setUser(response.user);
      setStatus(response.authenticated ? "authenticated" : "anonymous");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await authApi.login(identifier, password);
    setUser(response.user);
    setStatus(response.authenticated ? "authenticated" : "anonymous");
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    await authApi.register(email, username, password);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setStatus("anonymous");
    window.location.assign("/");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      authenticated: status === "authenticated",
      user,
      refresh,
      login,
      register,
      logout,
    }),
    [status, user, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
