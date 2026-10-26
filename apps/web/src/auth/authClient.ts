const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type SignInResult = { ok: true } | { ok: false; message: string };
export type ActivateResult = { ok: true } | { ok: false; code: string; message: string };

const post = (path: string, body?: unknown) =>
  fetch(`${base()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const res = await post("/auth/sign-in", { email, password });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, message: data.message ?? "Incorrect email or password." };
}

export async function signOut(): Promise<void> {
  await post("/auth/sign-out");
}

export async function activate(token: string, password: string): Promise<ActivateResult> {
  const res = await post("/auth/activate", { token, password });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return {
    ok: false,
    code: data.code ?? "activation_failed",
    message: data.message ?? "Activation failed.",
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  // The API answers the same whether or not the email is registered.
  await post("/auth/password-reset/request", { email });
}

export async function resetPassword(token: string, password: string): Promise<ActivateResult> {
  const res = await post("/auth/password-reset/confirm", { token, password });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return {
    ok: false,
    code: data.code ?? "password_reset_failed",
    message: data.message ?? "Password reset failed.",
  };
}

export async function getSession(): Promise<{ email: string } | null> {
  const res = await fetch(`${base()}/auth/session`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return { email: data.user.email };
}
