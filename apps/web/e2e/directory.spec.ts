import { test, expect, type Page } from "@playwright/test";

const counts = { all: 2, active: 1, on_leave: 0, inactive: 1 };
const people = [
  { id: "1", name: "Tom Reed", email: "tom.reed@example.com", role: "Account Manager", department: "Sales", status: "active" },
  { id: "2", name: "Maria Lopez", email: "m.lopez@example.com", role: "Recruiter", department: "People", status: "inactive" },
];

async function stub(page: Page, role: "hr_admin" | "manager", employees: typeof people) {
  await page.route("**/auth/session", (r) =>
    r.fulfill({ json: { user: { id: "u1", email: "ada@example.com", role } } }),
  );
  await page.route("**/employees**", (r) => {
    const url = new URL(r.request().url());
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const status = url.searchParams.get("status") ?? "all";
    const matched = employees.filter(
      (e) =>
        (!q || e.name.toLowerCase().includes(q) || e.email.includes(q)) &&
        (status === "all" || e.status === status),
    );
    return r.fulfill({ json: { employees: matched, counts, total: employees.length } });
  });
}

test("Active tab plus a search for an inactive employee shows No employees match", async ({ page }) => {
  await stub(page, "hr_admin", people);
  await page.goto("/");
  await page.getByRole("tab", { name: /^Active/ }).click();
  await page.getByRole("searchbox", { name: /search employees/i }).fill("Maria Lopez");
  await expect(page.getByText("No employees match")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(4);
});

test("a manager sees No employees yet and no action button", async ({ page }) => {
  await stub(page, "manager", []);
  await page.goto("/");
  await expect(page.getByText("No employees yet")).toBeVisible();
  await expect(page.getByRole("button", { name: /add employee/i })).toHaveCount(0);
});
