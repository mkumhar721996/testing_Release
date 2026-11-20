import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HrAdminDashboardPage } from "./HrAdminDashboardPage";
import * as client from "./dashboardsClient";

vi.mock("./dashboardsClient");
afterEach(() => vi.resetAllMocks());

const data: client.HrAdminDashboard = {
  asOf: "2026-11-20",
  leaversSince: "2025-11-20",
  headcount: 184,
  leavers12m: 9,
  leaveDays: 412,
  headcountByDepartment: [
    { department: "Engineering", count: 120 },
    { department: "Finance", count: 64 },
  ],
  leaveByType: [
    { kind: "Annual leave", days: 260 },
    { kind: "Sick leave", days: 152 },
  ],
};
const empty: client.HrAdminDashboard = {
  ...data,
  headcount: 0,
  leavers12m: 0,
  leaveDays: 0,
  headcountByDepartment: [],
  leaveByType: [],
};

const ok = (d: client.HrAdminDashboard) => ({ kind: "ok", data: d }) as const;

describe("HrAdminDashboardPage", () => {
  it("shows headcount, leavers and leave figures (AC1, AC3, AC6)", async () => {
    vi.mocked(client.getHrAdminDashboard).mockResolvedValue(ok(data));
    render(<HrAdminDashboardPage role="hr_admin" />);
    expect(await screen.findByText("Current headcount")).toBeInTheDocument();
    expect(screen.getByText("Current headcount").parentElement).toHaveTextContent("184");
    expect(screen.getByText("All 2 departments")).toBeInTheDocument();
    expect(screen.getByText("Leavers, last 12 months")).toBeInTheDocument();
    expect(screen.getByText("Termination date on or after 20 Nov 2025")).toBeInTheDocument();
    expect(screen.getByText("Total leave taken, company-wide").parentElement).toHaveTextContent(
      "412 days",
    );
  });

  it("lists every department with a total (AC2)", async () => {
    vi.mocked(client.getHrAdminDashboard).mockResolvedValue(ok(data));
    render(<HrAdminDashboardPage role="hr_admin" />);
    const region = await screen.findByRole("region", { name: "Headcount by department" });
    expect(within(region).getByText("Engineering")).toBeInTheDocument();
    expect(within(region).getByText("Finance")).toBeInTheDocument();
    expect(within(region).getByText("Total").parentElement).toHaveTextContent("184");
  });

  it("breaks leave down by type with a matching total (AC8)", async () => {
    vi.mocked(client.getHrAdminDashboard).mockResolvedValue(ok(data));
    render(<HrAdminDashboardPage role="hr_admin" />);
    const region = await screen.findByRole("region", { name: "Leave taken by leave type" });
    expect(within(region).getByText("260 days")).toBeInTheDocument();
    expect(within(region).getByText("Total").parentElement).toHaveTextContent("412 days");
  });

  it("renders no pay or salary text (AC5)", async () => {
    vi.mocked(client.getHrAdminDashboard).mockResolvedValue(ok(data));
    render(<HrAdminDashboardPage role="hr_admin" />);
    await screen.findByText("Current headcount");
    expect(document.body.textContent).not.toMatch(/\bpay\b|salary/i);
  });

  it("shows no figures to a non-HR role and makes no request (AC4)", () => {
    render(<HrAdminDashboardPage role="manager" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You do not have access to the HR admin dashboard.",
    );
    expect(client.getHrAdminDashboard).not.toHaveBeenCalled();
    expect(screen.queryByText("Current headcount")).not.toBeInTheDocument();
  });

  it("shows the same message when the API answers forbidden (AC4)", async () => {
    vi.mocked(client.getHrAdminDashboard).mockResolvedValue({ kind: "forbidden" });
    render(<HrAdminDashboardPage role="hr_admin" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not have access to the HR admin dashboard.",
    );
    expect(screen.queryByText("Current headcount")).not.toBeInTheDocument();
  });

  it("shows an empty state, and Refresh reloads the figures (AC9)", async () => {
    vi.mocked(client.getHrAdminDashboard)
      .mockResolvedValueOnce(ok(empty))
      .mockResolvedValueOnce(ok(data));
    render(<HrAdminDashboardPage role="hr_admin" />);
    expect(
      await screen.findByText("No headcount or leave data matches this dashboard yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Current headcount")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Current headcount")).toBeInTheDocument();
    expect(client.getHrAdminDashboard).toHaveBeenCalledTimes(2);
  });

  it("shows a busy status while loading", () => {
    vi.mocked(client.getHrAdminDashboard).mockReturnValue(new Promise(() => {}));
    render(<HrAdminDashboardPage role="hr_admin" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading headcount and leave figures…");
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it.each([
    ["an error result", () => vi.mocked(client.getHrAdminDashboard).mockResolvedValue({ kind: "error" })],
    ["a rejection", () => vi.mocked(client.getHrAdminDashboard).mockRejectedValue(new Error("x"))],
  ])("shows an error with Try again after %s", async (_name, arrange) => {
    arrange();
    render(<HrAdminDashboardPage role="hr_admin" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The dashboard did not load, so no figures are shown.",
    );
    vi.mocked(client.getHrAdminDashboard).mockResolvedValue(ok(data));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Current headcount")).toBeInTheDocument();
  });
});
