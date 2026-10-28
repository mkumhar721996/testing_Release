import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "./authClient";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await requestPasswordReset(email);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      {sent ? (
        <div className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
          <p className="text-sm text-slate-700">
            If an account exists for that email, a password reset link has been sent.
          </p>
          <a href="/" className="text-sm text-slate-900 underline">
            Back to sign in
          </a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Forgot password</h1>
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
