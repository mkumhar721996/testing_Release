import { test, expect } from "@playwright/test";

const report = (displayName: string, jobTitle: string) => ({
  id: displayName,
  displayName,
  jobTitle,
  department: "Finance",
  managerName: "Daniel Okafor",
  contactEmail: `${displayName.split(" ")[0].toLowerCase()}@example.com`,
  phone: "+44 20 7946 0113",
});

test("a manager sees only their current direct reports, with no edit controls", async ({ page }) => {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ status: 200, json: { user: { id: "u1", email: "dan@example.com", role: "manager" } } }),
  );
  // The API already leaves out second-level reports and leavers.
  await page.route("**/employees/direct-reports", (r) =>
    r.fulfill({ status: 200, json: [report("Amara Osei", "Coordinator"), report("Tom Brennan", "Engineer")] }),
  );

  await page.goto("/direct-reports");
  await expect(page.getByRole("heading", { name: "My direct reports" })).toBeVisible();
  const list = page.getByRole("list", { name: "Direct reports" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByText("Amara Osei")).toBeVisible();
  await expect(list.getByText("Second Level")).toHaveCount(0);
  await expect(list.getByText("Left Lee")).toHaveCount(0);
  await expect(list.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /edit|open/i })).toHaveCount(0);
});
