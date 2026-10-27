import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthProvider";
import * as client from "./authClient";

vi.mock("./authClient");

function Probe() {
  const { user, loading, signOut } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <>
      <p>{user ? `in:${user.email}` : "out"}</p>
      <button onClick={signOut}>sign out</button>
    </>
  );
}

function SignInProbe() {
  const { user, loading, signIn } = useAuth();
  const [message, setMessage] = useState("");
  if (loading) return <p>loading</p>;
  return (
    <>
      <p>{user ? `in:${user.email}` : "out"}</p>
      <p>{message}</p>
      <button
        onClick={async () => {
          const result = await signIn("ada@example.com", "test-password");
          if (!result.ok) setMessage(result.message);
        }}
      >
        sign in
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  it("is signed out when the session probe is refused (AC5)", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("out")).toBeInTheDocument();
  });

  it("exposes the user after a successful sign-in", async () => {
    vi.mocked(client.getSession).mockResolvedValueOnce(null);
    vi.mocked(client.signIn).mockResolvedValue({ ok: true });
    vi.mocked(client.getSession).mockResolvedValueOnce({ email: "ada@example.com" });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText("out")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sign in" }));
    expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
  });

  it("stays signed out and returns the message after a refused sign-in", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    const refused = { ok: false as const, message: "Incorrect email or password." };
    vi.mocked(client.signIn).mockResolvedValue(refused);
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText("out")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sign in" }));
    expect(await screen.findByText(refused.message)).toBeInTheDocument();
    expect(screen.getByText("out")).toBeInTheDocument();
  });

  it("clears the user on sign-out (AC4)", async () => {
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    vi.mocked(client.signOut).mockResolvedValue();
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sign out" }));
    expect(await screen.findByText("out")).toBeInTheDocument();
  });
});
