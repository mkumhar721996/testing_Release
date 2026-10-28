import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import * as client from "../auth/authClient";
import { LeavePage } from "../leave/LeavePage";
import { PeoplePage } from "../people/PeoplePage";
import { AppShell } from "./AppShell";

vi.mock("../auth/authClient");

afterEach(() => vi.resetAllMocks());

function renderAt(path: string) {
  vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com", role: "employee" });
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/leave" element={<LeavePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("AppShell", () => {
  it.each(["/people", "/leave"])("shows the same header and main navigation on %s (AC1)", async (path) => {
    renderAt(path);
    expect(await screen.findByRole("banner")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "People" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Leave" })).toBeInTheDocument();
  });

  it("opens People from the navigation (AC2)", async () => {
    const user = userEvent.setup();
    renderAt("/leave");
    await user.click(await screen.findByRole("link", { name: "People" }));
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
  });

  it("opens Leave from the navigation (AC3)", async () => {
    const user = userEvent.setup();
    renderAt("/people");
    await user.click(await screen.findByRole("link", { name: "Leave" }));
    expect(screen.getByRole("heading", { name: "Leave" })).toBeInTheDocument();
  });

  it("tabs through People, Leave, then Account (E8)", async () => {
    const user = userEvent.setup();
    renderAt("/people");
    await screen.findByRole("banner");
    await user.tab();
    expect(screen.getByRole("link", { name: "People" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Leave" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus();
  });
});
