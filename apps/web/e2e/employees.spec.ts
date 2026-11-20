import { test, expect } from "@playwright/test";

const priya = {
  id: "e1",
  displayName: "Priya Raman",
  managerId: "m1",
  jobTitle: "Senior Analyst",
  department: "Finance",
  payAnnualMinor: 6100000,
  payCurrency: "GBP",
  contactEmail: "priya.raman@acme.example",
  phone: "+44 20 7946 0123",
};

test("an HR admin finds an employee, opens the record and changes the job title", async ({ page }) => {
  let current = { ...priya };
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: { user: { id: "u1", email: "hr@example.com", role: "hr_admin" } } }),
  );
  await page.route("**/employees/options", (r) =>
    r.fulfill({
      status: 200,
      json: {
        departments: ["Finance", "People"],
        managers: [{ id: "m1", displayName: "Tom Okafor", isExecutive: false }],
      },
    }),
  );
  await page.route("**/employees?q=*", (r) => r.fulfill({ status: 200, json: [current] }));
  await page.route("**/employees/e1", (r) => {
    if (r.request().method() === "PATCH") {
      current = { ...current, ...r.request().postDataJSON() };
      return r.fulfill({ status: 200, json: current });
    }
    return r.fulfill({ status: 200, json: current });
  });

  await page.goto("/employees");
  await page.getByLabel("Search by name").fill("Priya");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /open record for priya raman/i }).click();
  await page.getByRole("button", { name: /edit record/i }).click();
  await page.getByLabel("Job title").fill("Principal Analyst");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Principal Analyst")).toBeVisible();
});
