import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShoppingPage } from "./ShoppingPage";
import * as client from "./shopClient";

vi.mock("./shopClient");

afterEach(() => vi.resetAllMocks());

const iphone = { id: "p1", name: "iPhone 16", priceCents: 79900 };

describe("ShoppingPage", () => {
  it("orders an iPhone from the list (AC1)", async () => {
    vi.mocked(client.listProducts).mockResolvedValue([iphone]);
    vi.mocked(client.placeOrder).mockResolvedValue({ ok: true, orderId: "o1" });
    render(<ShoppingPage />);
    await userEvent.click(await screen.findByRole("button", { name: /order iphone 16/i }));
    expect(client.placeOrder).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("status")).toHaveTextContent("Order placed");
  });

  it("shows an alert when the order fails", async () => {
    vi.mocked(client.listProducts).mockResolvedValue([iphone]);
    vi.mocked(client.placeOrder).mockResolvedValue({ ok: false, message: "Product not found." });
    render(<ShoppingPage />);
    await userEvent.click(await screen.findByRole("button", { name: /order iphone 16/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Product not found.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
