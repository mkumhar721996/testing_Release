import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import * as client from "./authClient";

vi.mock("./authClient");

describe("ForgotPasswordPage", () => {
  it.each([[true], [false]])(
    "shows the same neutral confirmation when the request ok is %s",
    async (ok) => {
      vi.mocked(client.requestPasswordReset).mockResolvedValue(undefined);
      if (!ok) vi.mocked(client.requestPasswordReset).mockRejectedValue(new Error("boom"));
      const user = userEvent.setup();
      render(<ForgotPasswordPage />);
      await user.type(screen.getByLabelText(/email/i), "a@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));
      expect(await screen.findByText(/if that email is registered/i)).toBeInTheDocument();
      expect(client.requestPasswordReset).toHaveBeenCalledWith("a@example.com");
    },
  );
});
