import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

export function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn(email, password);
    if (!result.ok) {
      setPassword("");
      setError(result.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={onSubmit} className="w-80 space-y-4 rounded bg-white p-6 shadow">
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <label className="block text-sm">
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border p-2"
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border p-2"
            required
          />
        </label>
        <button type="submit" className="w-full rounded bg-slate-900 p-2 text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
