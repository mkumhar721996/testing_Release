import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "./authClient";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Whatever the API answers, the page says the same thing.
    await requestPasswordReset(email).catch(() => undefined);
    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      {done ? (
        <div className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
          <p className="text-sm text-slate-700">
            If that email is registered, we have sent a link to reset your password.
          </p>
          <a href="/" className="text-sm text-slate-900 underline">
            Back to sign in
          </a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Forgot your password?</h1>
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
          <button type="submit" className="w-full rounded bg-slate-900 p-2 text-white">
            Send reset link
          </button>
        </form>
      )}
    </main>
  );
}
