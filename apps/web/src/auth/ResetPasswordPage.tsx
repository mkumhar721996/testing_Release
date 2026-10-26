import { useState, type FormEvent } from "react";
import { resetPassword } from "./authClient";

export function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await resetPassword(token, password);
    if (result.ok) setDone(true);
    else setError(result.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      {done ? (
        <div className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Password reset</h1>
          <a href="/" className="text-sm text-slate-900 underline">
            Go to sign in
          </a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <label className="block text-sm">
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border p-2"
              required
            />
          </label>
          <button type="submit" className="w-full rounded bg-slate-900 p-2 text-white">
            Reset password
          </button>
        </form>
      )}
    </main>
  );
}
