import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeesPage } from "./EmployeesPage";
import * as client from "./employeesClient";
import { navigate } from "./navigate";

vi.mock("./employeesClient");
vi.mock("./navigate");

beforeEach(() =>
  vi.mocked(client.getEmployeeOptions).mockResolvedValue({
    departments: ["Finance"],
    managers: [{ id: "m1", displayName: "Tom Okafor", isExecutive: false }],
  }),
);
afterEach(() => vi.resetAllMocks());

const priya: client.Employee = {
  id: "e1",
  displayName: "Priya Raman",
  managerId: "m1",
  jobTitle: "Senior Analyst",
  department: "Finance",
  payAnnualMinor: 6100000,
  payCurrency: "GBP",
  contactEmail: "priya.raman@acme.example",
  phone: null,
};
const tom = { ...priya, id: "m1", displayName: "Tom Okafor", managerId: null };

async function search(text: string) {
  await userEvent.type(screen.getByLabelText("Search by name"), text);
  await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
}

describe("EmployeesPage", () => {
  it("lists employees matching the typed name (AC1)", async () => {
    vi.mocked(client.searchEmployees).mockResolvedValue([priya, tom]);
    render(<EmployeesPage />);
    await search("Priya");
    expect(await screen.findByText("Priya Raman")).toBeInTheDocument();
    expect(client.searchEmployees).toHaveBeenLastCalledWith("Priya");
    expect(screen.getByRole("status")).toHaveTextContent("2 employees match");
    expect(screen.getByText("Tom Okafor", { selector: "b" })).toBeInTheDocument();
  });

  it("opens the selected employee's record (AC2)", async () => {
    vi.mocked(client.searchEmployees).mockResolvedValue([priya, tom]);
    render(<EmployeesPage />);
    await search("Priya");
    await userEvent.click(
      await screen.findByRole("button", { name: /open record for priya raman/i }),
    );
    expect(navigate).toHaveBeenCalledWith("/employees/e1");
  });

  it("shows a busy state while searching", async () => {
    vi.mocked(client.searchEmployees).mockReturnValue(new Promise(() => {}));
    render(<EmployeesPage />);
    await search("Priya");
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("shows the empty state and clears the search", async () => {
    vi.mocked(client.searchEmployees).mockResolvedValue([]);
    render(<EmployeesPage />);
    await search("Zara");
    expect(
      await screen.findByText(/no employee records match this name/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getByLabelText("Search by name")).toHaveValue("");
  });

  it("shows an alert and retries when the search fails", async () => {
    vi.mocked(client.searchEmployees).mockRejectedValueOnce(new Error("down"));
    render(<EmployeesPage />);
    await search("Priya");
    expect(await screen.findByRole("alert")).toHaveTextContent(/search did not complete/i);
    vi.mocked(client.searchEmployees).mockResolvedValue([priya]);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Priya Raman")).toBeInTheDocument();
  });

  it("goes to the create form", async () => {
    render(<EmployeesPage />);
    await userEvent.click(screen.getByRole("button", { name: /create employee/i }));
    expect(navigate).toHaveBeenCalledWith("/employees/new");
  });
});
