import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeCreatePage } from "./EmployeeCreatePage";
import * as client from "./employeesClient";
import { navigate } from "./navigate";

vi.mock("./employeesClient");
vi.mock("./navigate");

const employee: client.Employee = {
  id: "new1",
  displayName: "Priya Shah",
  managerId: "m1",
  jobTitle: "Recruiter",
  department: "People",
  payAnnualMinor: 5200000,
  payCurrency: "GBP",
  contactEmail: "priya.shah.people@acme.example",
  phone: "+44 20 7946 0188",
};

beforeEach(() => {
  vi.mocked(client.getEmployeeOptions).mockResolvedValue({
    departments: ["People", "Finance"],
    managers: [
      { id: "m1", displayName: "Lena Brandt", isExecutive: false },
      { id: "x1", displayName: "Ada Lindqvist", isExecutive: true },
    ],
  });
  vi.mocked(client.searchEmployees).mockResolvedValue([]);
});
afterEach(() => vi.resetAllMocks());

async function fill(withManager: boolean) {
  await userEvent.type(await screen.findByLabelText("Full name"), "Priya Shah");
  await userEvent.type(screen.getByLabelText("Job title"), "Recruiter");
  await userEvent.selectOptions(screen.getByLabelText("Department"), "People");
  if (withManager) await userEvent.selectOptions(screen.getByLabelText("Manager"), "Lena Brandt");
  await userEvent.type(screen.getByLabelText(/pay \(annual/i), "52,000");
  await userEvent.type(screen.getByLabelText("Contact email"), "priya.shah.people@acme.example");
  await userEvent.type(screen.getByLabelText("Phone"), "+44 20 7946 0188");
}

const save = () => userEvent.click(screen.getByRole("button", { name: /save employee/i }));

describe("EmployeeCreatePage", () => {
  it("creates the record and confirms it (AC3)", async () => {
    vi.mocked(client.createEmployee).mockResolvedValue({ ok: true, employee });
    render(<EmployeeCreatePage />);
    await fill(true);
    await save();
    expect(client.createEmployee).toHaveBeenCalledTimes(1);
    expect(client.createEmployee).toHaveBeenCalledWith({
      displayName: "Priya Shah",
      jobTitle: "Recruiter",
      department: "People",
      managerId: "m1",
      payAnnual: 52000,
      contactEmail: "priya.shah.people@acme.example",
      phone: "+44 20 7946 0188",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Employee record created for Priya Shah.");
    await userEvent.click(screen.getByRole("button", { name: /open record/i }));
    expect(navigate).toHaveBeenCalledWith("/employees/new1");
  });

  it("does not save without a manager and marks the field required (AC4)", async () => {
    render(<EmployeeCreatePage />);
    await fill(false);
    await save();
    expect(client.createEmployee).not.toHaveBeenCalled();
    expect(screen.getAllByText(/manager is required/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/manager/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/no record was created\. choose a manager/i)).toBeInTheDocument();
  });

  it("shows the executive in the manager list", async () => {
    render(<EmployeeCreatePage />);
    expect(await screen.findByRole("option", { name: "Ada Lindqvist (Executive)" })).toBeInTheDocument();
  });

  it("explains a duplicate contact email (AC8)", async () => {
    vi.mocked(client.createEmployee).mockResolvedValue({
      ok: false,
      code: "contact_email_taken",
      message: "x",
    });
    render(<EmployeeCreatePage />);
    await fill(true);
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An employee with contact email priya.shah.people@acme.example already exists. No record was created.",
    );
    expect(screen.getByLabelText("Contact email")).toHaveAttribute("aria-invalid", "true");
  });

  it("notes a matching name but still saves (AC9)", async () => {
    vi.mocked(client.searchEmployees).mockResolvedValue([{ ...employee, id: "old1" }]);
    vi.mocked(client.createEmployee).mockResolvedValue({ ok: true, employee });
    render(<EmployeeCreatePage />);
    await userEvent.type(await screen.findByLabelText("Full name"), "Priya Shah");
    await userEvent.tab();
    expect(await screen.findByText(/another employee is also named priya shah/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Job title"), "Recruiter");
    await userEvent.selectOptions(screen.getByLabelText("Department"), "People");
    await userEvent.selectOptions(screen.getByLabelText("Manager"), "Lena Brandt");
    await userEvent.type(screen.getByLabelText(/pay \(annual/i), "52000");
    await userEvent.type(screen.getByLabelText("Contact email"), "other@acme.example");
    await userEvent.type(screen.getByLabelText("Phone"), "123");
    await save();
    expect(client.createEmployee).toHaveBeenCalledTimes(1);
  });
});
