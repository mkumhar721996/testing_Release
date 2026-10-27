import { useState, type FormEvent } from "react";
import { register } from "./authClient";

export function RegistrationForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await register(email, password);
    if (result.ok) setDone(true);
    else setError(result.message);
  }

  if (done) {
    return (
      <p role="status" className="mt-4 text-sm text-green-700">
        Account created
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 w-80 space-y-4 rounded bg-white p-6 shadow">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <label className="block text-sm">
        Email
        <input
          type="email"
          autoComplete="email"
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
        Create account
      </button>
    </form>
  );
}
