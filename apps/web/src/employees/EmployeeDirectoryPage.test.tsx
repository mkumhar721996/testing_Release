import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeDirectoryPage } from "./EmployeeDirectoryPage";
import { listEmployees, type Employee, type EmployeeList } from "./employeesClient";

vi.mock("./employeesClient");

const emp = (name: string, status: Employee["status"], email = `${name}@example.com`): Employee => ({
  id: name,
  name,
  email,
  role: "Analyst",
  department: "Finance",
  status,
});

const counts = { all: 3, active: 5, on_leave: 1, inactive: 1 };
const listOf = (...employees: Employee[]): EmployeeList => ({
  employees,
  counts,
  total: employees.length,
});
const three = () =>
  listOf(emp("Ava Chen", "active"), emp("Priya Shah", "on_leave"), emp("Maria Lopez", "inactive"));
const empty: EmployeeList = { employees: [], counts: { all: 0, active: 0, on_leave: 0, inactive: 0 }, total: 0 };

afterEach(() => vi.resetAllMocks());

describe.each(["hr_admin", "manager"] as const)("directory All tab as %s (AC1, AC2)", (role) => {
  it("lists every employee with name and status", async () => {
    vi.mocked(listEmployees).mockResolvedValue(three());
    render(<EmployeeDirectoryPage role={role} />);
    for (const [name, label] of [
      ["Ava Chen", "Active"],
      ["Priya Shah", "On leave"],
      ["Maria Lopez", "Inactive"],
    ]) {
      const row = await screen.findByRole("row", { name: new RegExp(name) });
      expect(within(row).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Add employee action", () => {
  it("is shown to HR admins only", async () => {
    vi.mocked(listEmployees).mockResolvedValue(three());
    const { unmount } = render(<EmployeeDirectoryPage role="hr_admin" />);
    expect(await screen.findByRole("button", { name: "Add employee" })).toBeInTheDocument();
    unmount();
    render(<EmployeeDirectoryPage role="manager" />);
    await screen.findByRole("row", { name: /Ava Chen/ });
    expect(screen.queryByRole("button", { name: /add employee/i })).not.toBeInTheDocument();
  });
});

describe("search (AC3-AC7)", () => {
  it("sends the typed text to the client", async () => {
    vi.mocked(listEmployees).mockResolvedValue(three());
    const user = userEvent.setup();
    render(<EmployeeDirectoryPage role="manager" />);
    await user.type(screen.getByRole("searchbox", { name: /search employees/i }), "Maria Lopez");
    await waitFor(() =>
      expect(listEmployees).toHaveBeenLastCalledWith(
        { q: "Maria Lopez", status: "all" },
        expect.anything(),
      ),
    );
  });

  it("shows No employees match when the Active tab has no hit, keeping search and tabs (AC7, AC12, AC13)", async () => {
    vi.mocked(listEmployees).mockResolvedValue({ employees: [], total: 2, counts });
    render(<EmployeeDirectoryPage role="manager" />);
    expect(await screen.findByText("No employees match")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /search employees/i })).toBeVisible();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("clears the search and returns to All", async () => {
    vi.mocked(listEmployees).mockResolvedValue({ employees: [], total: 2, counts });
    const user = userEvent.setup();
    render(<EmployeeDirectoryPage role="manager" />);
    await user.type(screen.getByRole("searchbox"), "zzz");
    await user.click(screen.getByRole("tab", { name: /^Active/ }));
    await user.click(await screen.findByRole("button", { name: "Clear search and show All" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("status tabs (AC8)", () => {
  it("requests the selected status and shows counts", async () => {
    vi.mocked(listEmployees).mockResolvedValue(three());
    const user = userEvent.setup();
    render(<EmployeeDirectoryPage role="manager" />);
    expect(await screen.findByRole("tab", { name: "Active 5" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^On leave/ }));
    await waitFor(() =>
      expect(listEmployees).toHaveBeenLastCalledWith({ q: "", status: "on_leave" }, expect.anything()),
    );
  });

  it("moves selection with the arrow keys", async () => {
    vi.mocked(listEmployees).mockResolvedValue(three());
    const user = userEvent.setup();
    render(<EmployeeDirectoryPage role="manager" />);
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /^Active/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^Active/ })).toHaveFocus();
  });
});

describe("no employees (AC9-AC11)", () => {
  it("offers HR admins an Add employee action and hides search", async () => {
    vi.mocked(listEmployees).mockResolvedValue(empty);
    render(<EmployeeDirectoryPage role="hr_admin" />);
    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add first employee" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("shows managers the text with no button", async () => {
    vi.mocked(listEmployees).mockResolvedValue(empty);
    render(<EmployeeDirectoryPage role="manager" />);
    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add employee/i })).not.toBeInTheDocument();
  });
});

describe("load failure", () => {
  it("states the fix", async () => {
    vi.mocked(listEmployees).mockRejectedValue(new Error("boom"));
    render(<EmployeeDirectoryPage role="manager" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load employees. Refresh the page to try again.",
    );
  });
});
