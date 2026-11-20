import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeRecordPage } from "./EmployeeRecordPage";
import * as client from "./employeesClient";

vi.mock("./employeesClient");
vi.mock("./navigate");

const priya: client.Employee = {
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

const options: client.EmployeeOptions = {
  departments: ["Finance", "People"],
  managers: [
    { id: "m1", displayName: "Tom Okafor", isExecutive: false },
    { id: "x1", displayName: "Ada Lindqvist", isExecutive: true },
  ],
};

beforeEach(() => {
  vi.mocked(client.getEmployee).mockResolvedValue(priya);
  vi.mocked(client.getEmployeeOptions).mockResolvedValue(options);
});
afterEach(() => vi.resetAllMocks());

describe("EmployeeRecordPage", () => {
  it("shows the full record in four cards (AC2)", async () => {
    render(<EmployeeRecordPage id="e1" role="hr_admin" />);
    expect(await screen.findByText("Senior Analyst")).toBeInTheDocument();
    for (const heading of ["Profile", "Job", "Pay", "Contact details"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Tom Okafor")).toBeInTheDocument();
    expect(screen.getByText("£61,000")).toBeInTheDocument();
    expect(screen.getByText("priya.raman@acme.example")).toBeInTheDocument();
  });

  it("saves a changed job title and shows only the new one (AC5, AC7)", async () => {
    vi.mocked(client.updateEmployee).mockResolvedValue({
      ok: true,
      employee: { ...priya, jobTitle: "Principal Analyst" },
    });
    render(<EmployeeRecordPage id="e1" role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: /edit record/i }));
    const title = screen.getByLabelText("Job title");
    await userEvent.clear(title);
    await userEvent.type(title, "Principal Analyst");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Principal Analyst")).toBeInTheDocument();
    expect(screen.queryByText("Senior Analyst")).not.toBeInTheDocument();
    expect(client.updateEmployee).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ jobTitle: "Principal Analyst", managerId: "m1", payAnnual: 61000 }),
    );
  });

  it("replaces the manager and says so (AC6, AC11)", async () => {
    vi.mocked(client.updateEmployee).mockResolvedValue({
      ok: true,
      employee: { ...priya, managerId: "x1" },
    });
    render(<EmployeeRecordPage id="e1" role="hr_admin" />);
    await userEvent.click(await screen.findByRole("button", { name: /edit record/i }));
    expect(screen.getByText("One manager only. Saving replaces Tom Okafor.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Manager"), "Ada Lindqvist (Executive)");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Changes saved. Ada Lindqvist is now Priya Raman’s only manager.",
    );
  });

  it("shows job, manager and pay read-only to a non-HR user (AC10)", async () => {
    vi.mocked(client.getEmployeeOptions).mockRejectedValue(new Error("forbidden"));
    render(<EmployeeRecordPage id="e1" role="employee" />);
    expect(await screen.findByText("Senior Analyst")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit record/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Read-only")).toHaveLength(2);
    expect(screen.getByText(/only hr admins can change job, manager or pay/i)).toBeInTheDocument();
  });

  it("shows an alert when the record cannot be loaded", async () => {
    vi.mocked(client.getEmployee).mockRejectedValue(new Error("nope"));
    render(<EmployeeRecordPage id="e1" role="hr_admin" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
