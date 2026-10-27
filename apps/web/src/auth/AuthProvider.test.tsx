import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthProvider";
import * as client from "./authClient";

vi.mock("./authClient");

function Probe() {
  const { user, loading, signIn, signOut } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <>
      <p>{user ? `in:${user.email}` : "out"}</p>
      <button onClick={() => signIn("ada@example.com", "test-password")}>sign in</button>
      <button onClick={signOut}>sign out</button>
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

  it("sets the user after a successful sign-in (AC1)", async () => {
    vi.mocked(client.getSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ email: "ada@example.com" });
    vi.mocked(client.signIn).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("out")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sign in" }));
    expect(await screen.findByText("in:ada@example.com")).toBeInTheDocument();
  });

  it("leaves the user signed out when sign-in is refused", async () => {
    vi.mocked(client.getSession).mockResolvedValue(null);
    vi.mocked(client.signIn).mockResolvedValue({ ok: false, message: "Incorrect email or password." });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("out")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sign in" }));
    expect(client.signIn).toHaveBeenCalled();
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
