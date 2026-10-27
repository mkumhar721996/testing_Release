import { useState, type FormEvent } from "react";
import { register } from "./authClient";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await register(email, password);
    if (result.ok) {
      setCreated(true);
    } else {
      setPassword("");
      setError(result.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      {created ? (
        <div className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <p role="status" className="text-sm text-slate-700">
            Account created
          </p>
          <a href="/" className="text-sm text-slate-900 underline">
            Sign in
          </a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="w-80 space-y-4 rounded bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Register</h1>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border p-2"
              required
            />
          </label>
          <button type="submit" className="w-full rounded bg-slate-900 p-2 text-white">
            Register
          </button>
        </form>
      )}
    </main>
  );
}
