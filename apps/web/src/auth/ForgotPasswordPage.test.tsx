import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import * as client from "./authClient";

vi.mock("./authClient");

describe("ForgotPasswordPage", () => {
  it("requests a reset and shows a generic confirmation", async () => {
    vi.mocked(client.requestPasswordReset).mockResolvedValue();
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(client.requestPasswordReset).toHaveBeenCalledWith("ada@example.com");
    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
  });
});
