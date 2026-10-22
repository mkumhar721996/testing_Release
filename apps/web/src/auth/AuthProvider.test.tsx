import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, IDLE_TIMEOUT_MS, KEEPALIVE_MS, useAuth } from "./AuthProvider";
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

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

async function renderSignedIn() {
  vi.useFakeTimers();
  vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
  vi.mocked(client.signOut).mockResolvedValue();
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByText("in:ada@example.com")).toBeInTheDocument();
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

  it("signs out after 30 minutes without activity (AC3)", async () => {
    await renderSignedIn();
    await act(() => vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS));
    expect(client.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("out")).toBeInTheDocument();
  });

  it("resets the idle timer on activity (AC3)", async () => {
    await renderSignedIn();
    await act(() => vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1000));
    fireEvent.keyDown(document, { key: "a" });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText("in:ada@example.com")).toBeInTheDocument();
  });

  it("shows signed out when the tab returns after the server expired the session (AC3)", async () => {
    await renderSignedIn();
    vi.mocked(client.getSession).mockResolvedValue(null);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => {
      fireEvent(document, new Event("visibilitychange"));
    });
    expect(screen.getByText("out")).toBeInTheDocument();
  });

  it("does not poll the session while idle (AC3)", async () => {
    await renderSignedIn();
    await act(() => vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1000));
    expect(client.getSession).toHaveBeenCalledTimes(1);
  });

  it("touches the server at most once per keep-alive period on activity (AC3)", async () => {
    await renderSignedIn();
    fireEvent.keyDown(document, { key: "a" });
    expect(client.getSession).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(KEEPALIVE_MS + 1000));
    fireEvent.keyDown(document, { key: "a" });
    fireEvent.pointerDown(document);
    expect(client.getSession).toHaveBeenCalledTimes(2);
  });
});
