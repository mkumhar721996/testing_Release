import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as client from "./authClient";

type AuthContextValue = {
  user: client.SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<client.SignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<client.SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .getSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

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
