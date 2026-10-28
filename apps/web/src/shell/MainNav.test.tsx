import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MainNav } from "./MainNav";

describe("MainNav", () => {
  it("marks the current page and follows navigation (E1)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/people"]}>
        <MainNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leave" })).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("link", { name: "Leave" }));
    expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute("aria-current", "page");
  });
});
