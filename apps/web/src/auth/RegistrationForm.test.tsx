import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationForm } from "./RegistrationForm";
import * as client from "./authClient";

vi.mock("./authClient");

afterEach(() => vi.resetAllMocks());

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/email/i), "ada@example.com");
  await userEvent.type(screen.getByLabelText(/password/i), "correct-horse-1");
  await userEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegistrationForm", () => {
  it("submits the filled-in form and confirms the account was created (AC2)", async () => {
    vi.mocked(client.register).mockResolvedValue({ ok: true });
    render(<RegistrationForm />);
    await fillAndSubmit();
    expect(client.register).toHaveBeenCalledWith("ada@example.com", "correct-horse-1");
    expect(await screen.findByRole("status")).toHaveTextContent("Account created");
  });

  it("shows the server message when registration fails", async () => {
    vi.mocked(client.register).mockResolvedValue({
      ok: false,
      code: "email_taken",
      message: "taken",
    });
    render(<RegistrationForm />);
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("taken");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
