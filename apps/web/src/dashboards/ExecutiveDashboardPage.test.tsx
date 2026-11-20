import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveDashboardPage } from "./ExecutiveDashboardPage";
import * as client from "./dashboardsClient";
import { navigate } from "../employees/navigate";

vi.mock("./dashboardsClient");
vi.mock("../employees/navigate");

afterEach(() => vi.resetAllMocks());

const range = { from: "2026-01-01", to: "2026-11-20" };
const full: client.SummaryResult = {
  kind: "ok",
  summary: { headcount: 248, leaveDaysTaken: 1312, leaveYear: range, hasData: true },
};
const none: client.SummaryResult = {
  kind: "ok",
  summary: { headcount: 0, leaveDaysTaken: 0, leaveYear: range, hasData: false },
};

describe("ExecutiveDashboardPage", () => {
  it("shows the headcount and leave totals (AC1, AC2)", async () => {
    vi.mocked(client.getExecutiveSummary).mockResolvedValue(full);
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(await screen.findByText("248")).toBeInTheDocument();
    expect(screen.getByText("1,312 days")).toBeInTheDocument();
    expect(screen.getByText("Total headcount")).toBeInTheDocument();
    expect(screen.getByText("Total leave taken")).toBeInTheDocument();
  });

  it("shows no pay, controls or employee links (AC3, AC5, AC6)", async () => {
    vi.mocked(client.getExecutiveSummary).mockResolvedValue(full);
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    await screen.findByText("248");
    const main = within(screen.getByRole("main"));
    expect(main.queryByText(/£|salary|pay/i)).not.toBeInTheDocument();
    expect(main.queryByRole("button")).not.toBeInTheDocument();
    expect(main.queryByRole("link")).not.toBeInTheDocument();
    expect(main.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("opens nothing when a figure is activated (AC4)", async () => {
    vi.mocked(client.getExecutiveSummary).mockResolvedValue(full);
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    await userEvent.click(await screen.findByText("248"));
    await userEvent.click(screen.getByText("1,312 days"));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("248").closest("a,button")).toBeNull();
    expect(screen.getByText("1,312 days").closest("a,button")).toBeNull();
  });

  it("is not available to a non-executive and does not call the API (AC7)", () => {
    render(<ExecutiveDashboardPage role="manager" />);
    expect(screen.getByText("The executive dashboard is not available to your role.")).toBeInTheDocument();
    expect(client.getExecutiveSummary).not.toHaveBeenCalled();
    expect(screen.queryByText("Total headcount")).not.toBeInTheDocument();
  });

  it("shows the same message when the API refuses (AC7)", async () => {
    vi.mocked(client.getExecutiveSummary).mockResolvedValue({ kind: "forbidden" });
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(await screen.findByText("The executive dashboard is not available to your role.")).toBeInTheDocument();
    expect(screen.queryByText("Total headcount")).not.toBeInTheDocument();
  });

  it("shows only a no-data message when there is nothing (AC8, AC9)", async () => {
    vi.mocked(client.getExecutiveSummary).mockResolvedValue(none);
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(
      await screen.findByText("No headcount or leave data is available for the company yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Total headcount")).not.toBeInTheDocument();
    expect(screen.queryByText("Total leave taken")).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0\b/)).not.toBeInTheDocument();
  });

  it("shows a busy region while loading", () => {
    vi.mocked(client.getExecutiveSummary).mockReturnValue(new Promise(() => {}));
    const { container } = render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading company headcount and leave…");
  });

  it("shows an error and retries", async () => {
    vi.mocked(client.getExecutiveSummary).mockRejectedValueOnce(new Error("boom")).mockResolvedValue(full);
    render(<ExecutiveDashboardPage role="read_only_executive" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Company headcount and leave could not be loaded. Check your connection and try again.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("248")).toBeInTheDocument();
    expect(client.getExecutiveSummary).toHaveBeenCalledTimes(2);
  });
});
