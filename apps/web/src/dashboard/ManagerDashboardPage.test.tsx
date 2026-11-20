import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagerDashboardPage } from "./ManagerDashboardPage";
import * as client from "./dashboardClient";

vi.mock("./dashboardClient");
afterEach(() => vi.resetAllMocks());

const base: client.ManagerDashboard = {
  today: "2026-11-20",
  windowEnd: "2026-12-20",
  viewer: {
    displayName: "Vera Long",
    jobTitle: "Operations Manager",
    absent: false,
    absentFrom: null,
    absentTo: null,
  },
  directReportCount: 6,
  offTodayCount: 1,
  offDays: [
    {
      date: "2026-11-20",
      people: [{ employeeId: "r1", displayName: "Ravi Patel", kind: "annual" }],
    },
    {
      date: "2026-11-21",
      people: [{ employeeId: "r1", displayName: "Ravi Patel", kind: "sick" }],
    },
  ],
  pending: [
    {
      id: "p1",
      employeeId: "r2",
      employeeName: "Ben Carter",
      kind: "annual",
      startDate: "2026-12-14",
      endDate: "2026-12-16",
      days: 3,
      awaiting: { employeeId: "m", displayName: "Vera Long" },
      coveringFor: null,
    },
    {
      id: "p2",
      employeeId: "r3",
      employeeName: "Sam Reed",
      kind: "annual",
      startDate: "2026-12-07",
      endDate: "2026-12-08",
      days: 2,
      awaiting: { employeeId: "a", displayName: "Priya Nair" },
      coveringFor: "Priya Nair",
    },
  ],
};

describe("ManagerDashboardPage", () => {
  it("lists who is off on each day (AC1)", async () => {
    vi.mocked(client.getManagerDashboard).mockResolvedValue(base);
    render(<ManagerDashboardPage />);
    expect((await screen.findAllByText("Fri 20 Nov")).length).toBe(2);
    expect(screen.getByText("Sat 21 Nov")).toBeInTheDocument();
    expect(screen.getAllByText("Annual Leave").length).toBeGreaterThan(0);
    expect(screen.getByText("Sick Leave")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("lists pending approvals with a covering note (AC2, AC8)", async () => {
    vi.mocked(client.getManagerDashboard).mockResolvedValue(base);
    render(<ManagerDashboardPage />);
    expect(await screen.findByText("Ben Carter")).toBeInTheDocument();
    expect(screen.getByText("Sam Reed")).toBeInTheDocument();
    expect(screen.getByText(/Priya Nair is absent/)).toBeInTheDocument();
    expect(screen.getByText("1 covering an absent manager")).toBeInTheDocument();
  });

  it("shows no approve, reject or Leave Management control (AC4)", async () => {
    vi.mocked(client.getManagerDashboard).mockResolvedValue(base);
    render(<ManagerDashboardPage />);
    await screen.findByText("Ben Carter");
    expect(screen.queryByRole("button", { name: /approve|reject/i })).toBeNull();
    expect(
      screen.getByText("This list is read-only. Approve or reject requests in Leave Management."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/open leave management/i)).toBeNull();
    // The sidebar's menu toggle is layout chrome; the page content has no buttons.
    expect(within(screen.getByRole("main")).queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the viewer line and no-requests message for an absent manager (AC9)", async () => {
    vi.mocked(client.getManagerDashboard).mockResolvedValue({
      ...base,
      viewer: { ...base.viewer, absent: true, absentFrom: "2026-11-20", absentTo: "2026-12-04" },
      pending: [],
    });
    render(<ManagerDashboardPage />);
    expect(
      await screen.findByText(/Viewing as Vera Long, Operations Manager \(absent 20 Nov – 4 Dec 2026\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No requests are awaiting you\./)).toBeInTheDocument();
  });

  it("does not show a viewing line for a present manager", async () => {
    vi.mocked(client.getManagerDashboard).mockResolvedValue(base);
    render(<ManagerDashboardPage />);
    await screen.findByText("Ben Carter");
    expect(screen.queryByText(/Viewing as/)).toBeNull();
  });

  it("states that no direct report has leave recorded, and refreshes (AC10)", async () => {
    const fetchMock = vi
      .mocked(client.getManagerDashboard)
      .mockResolvedValue({ ...base, offDays: [], pending: [], offTodayCount: 0 });
    render(<ManagerDashboardPage />);
    expect(await screen.findByText("No direct report has leave recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a busy loading state", () => {
    vi.mocked(client.getManagerDashboard).mockReturnValue(new Promise(() => {}));
    const { container } = render(<ManagerDashboardPage />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows an error with a retry", async () => {
    const fetchMock = vi
      .mocked(client.getManagerDashboard)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(base);
    render(<ManagerDashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your team's leave could not be loaded. Check your connection and try again.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ben Carter")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
