import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as client from "./authClient";

type AuthContextValue = {
  user: { email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<client.SignInResult>;
  signOut: () => Promise<void>;
};

// Mirrors INACTIVITY_TIMEOUT_MS in services/api/src/auth/auth.constants.ts.
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const KEEPALIVE_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .getSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signedIn = user !== null;
  const lastTouch = useRef(Date.now());

  useEffect(() => {
    if (!signedIn) return;
    lastTouch.current = Date.now();
    let idleTimer: ReturnType<typeof setTimeout>;

    // The server stays the authority on expiry; this only makes the UI follow it.
    const expire = () => {
      client.signOut().catch(() => undefined);
      setUser(null);
    };
    const touchServer = () => {
      lastTouch.current = Date.now();
      return client
        .getSession()
        .then((session) => {
          if (!session) setUser(null);
        })
        .catch(() => undefined);
    };
    const startTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(expire, IDLE_TIMEOUT_MS);
    };
    const onActivity = () => {
      startTimer();
      if (Date.now() - lastTouch.current > KEEPALIVE_MS) void touchServer();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void touchServer();
    };

    startTimer();
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, onActivity, true));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, onActivity, true));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await client.signIn(email, password);
    if (result.ok) setUser(await client.getSession());
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await client.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
