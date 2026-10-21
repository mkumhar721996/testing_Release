import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivatePage } from "./ActivatePage";
import * as client from "./authClient";

vi.mock("./authClient");

const EXPIRED_MSG = "This activation link has expired. Request a new activation email.";

describe("ActivatePage", () => {
  it("asks for a new activation email when the link has expired (AC10)", async () => {
    vi.mocked(client.activate).mockResolvedValue({
      ok: false,
      code: "activation_link_expired",
      message: EXPIRED_MSG,
    });
    const user = userEvent.setup();
    render(<ActivatePage token="t" />);
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /activate/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/request a new activation email/i);
  });

  it("confirms activation (AC1, AC2)", async () => {
    vi.mocked(client.activate).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ActivatePage token="t" />);
    await user.type(screen.getByLabelText(/password/i), "test-password");
    await user.click(screen.getByRole("button", { name: /activate/i }));
    expect(await screen.findByText(/account activated/i)).toBeInTheDocument();
    expect(client.activate).toHaveBeenCalledWith("t", "test-password");
  });
});
