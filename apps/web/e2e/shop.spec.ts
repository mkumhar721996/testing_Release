import { test, expect } from "@playwright/test";

test("a signed-in user orders an iPhone from the shopping page", async ({ page }) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: { user: { id: "u1", email: "ada@example.com" } } }),
  );
  await page.route("**/products", (r) =>
    r.fulfill({ status: 200, json: [{ id: "p1", name: "iPhone 16", priceCents: 79900 }] }),
  );
  await page.route("**/orders", (r) =>
    r.fulfill({ status: 201, json: { id: "o1", productId: "p1", status: "placed" } }),
  );
  await page.goto("/shop");
  await page.getByRole("button", { name: /order iphone/i }).click();
  await expect(page.getByText("Order placed")).toBeVisible();
});
