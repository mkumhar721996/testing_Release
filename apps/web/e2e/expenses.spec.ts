import { test, expect } from "@playwright/test";

test("an employee records an expense with a receipt and saves it as a draft", async ({ page }) => {
  let posted = false;
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: { user: { id: "u1", email: "ana@example.com", role: "employee" } } }),
  );
  await page.route("**/expenses/options", (r) =>
    r.fulfill({
      status: 200,
      json: { categories: ["Meals", "Travel"], currency: "USD", maxReceiptBytes: 10 * 1024 * 1024, windowDays: 60 },
    }),
  );
  await page.route("**/expenses", (r) => {
    posted = r.request().method() === "POST";
    return r.fulfill({ status: 201, json: { id: "x1", status: "draft" } });
  });

  await page.goto("/expenses");
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  await page.getByLabel(/amount/i).fill("38.00");
  await page.getByLabel("Date", { exact: true }).fill(`${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`);
  await page.getByLabel("Category").selectOption("Travel");
  await page.getByLabel("Receipt file").setInputFiles({
    name: "taxi.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByText("Attached: taxi.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  expect(posted).toBe(true);
});
