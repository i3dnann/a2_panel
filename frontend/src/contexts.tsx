import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, api, getToken, setToken, type LoginResponse } from "./lib/api";
import type { AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const saved = getToken();
    if (!saved) {
      setLoading(false);
      return;
    }
    try {
      const response = await api<{ user: AuthUser }>("/auth/me");
      setUser(response.user);
      setTokenState(saved);
    } catch {
      setToken(null);
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
    const onExpired = () => {
      setToken(null);
      setUser(null);
      setTokenState(null);
    };
    window.addEventListener("a2-session-expired", onExpired);
    return () => window.removeEventListener("a2-session-expired", onExpired);
  }, [refreshMe]);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const response = await api<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ username, password, remember })
    });
    setToken(response.token);
    setTokenState(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      hasPermission: (permission) => Boolean(user?.permissions.includes(permission as never))
    }),
    [user, token, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

type ToastLevel = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  level: ToastLevel;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [{ ...toast, id }, ...current].slice(0, 5));
      window.setTimeout(() => removeToast(id), 5200);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ toasts, pushToast, removeToast }), [toasts, pushToast, removeToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function useA2Socket(): Socket | null {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return undefined;
    }
    const nextSocket = io(API_URL, { auth: { token } });
    setSocket(nextSocket);
    nextSocket.on("notification.created", (payload: { title?: string; message?: string; level?: ToastLevel }) => {
      pushToast({ level: payload.level ?? "info", title: payload.title ?? "A2 Panel", message: payload.message });
    });
    return () => {
      nextSocket.disconnect();
    };
  }, [token, pushToast]);

  return socket;
}
