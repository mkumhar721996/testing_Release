import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectReportsPage } from "./DirectReportsPage";
import * as client from "./employeesClient";

vi.mock("./employeesClient");

afterEach(() => vi.resetAllMocks());

const priya: client.DirectReport = {
  id: "e1",
  displayName: "Priya Natarajan",
  jobTitle: "Senior Analyst",
  department: "Finance",
  managerName: "Daniel Okafor",
  contactEmail: "priya.natarajan@example.com",
  phone: "+44 20 7946 0113",
};
const tom: client.DirectReport = {
  ...priya,
  id: "e2",
  displayName: "Tom Brennan",
  jobTitle: null,
  department: null,
  contactEmail: null,
  phone: null,
};

describe("DirectReportsPage", () => {
  it("lists each direct report with work details and contact (AC1, AC2)", async () => {
    vi.mocked(client.getDirectReports).mockResolvedValue([priya, tom]);
    render(<DirectReportsPage />);
    expect(await screen.findByText("Priya Natarajan")).toBeInTheDocument();
    expect(screen.getByText("Tom Brennan")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 direct reports");
    expect(screen.getByText("Senior Analyst, Finance")).toBeInTheDocument();
    expect(screen.getAllByText("Daniel Okafor", { selector: "b" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "priya.natarajan@example.com" })).toHaveAttribute(
      "href",
      "mailto:priya.natarajan@example.com",
    );
    expect(screen.getByText("+44 20 7946 0113")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says leavers and second-level reports are not listed (AC3, AC5)", async () => {
    vi.mocked(client.getDirectReports).mockResolvedValue([priya]);
    render(<DirectReportsPage />);
    expect(await screen.findByText(/employees who have left, are not listed/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 direct report");
  });

  it("offers no edit or open control (AC4)", async () => {
    vi.mocked(client.getDirectReports).mockResolvedValue([priya]);
    render(<DirectReportsPage />);
    await screen.findByText("Priya Natarajan");
    // The layout's own menu button is outside the list.
    expect(within(screen.getByRole("list", { name: "Direct reports" })).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /edit|open/i })).toBeNull();
  });

  it("states that a manager with no reports has none (AC6)", async () => {
    vi.mocked(client.getDirectReports).mockResolvedValue([]);
    render(<DirectReportsPage />);
    expect(await screen.findByText("You have no direct reports.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Direct reports" })).toBeNull();
  });

  it("shows a busy state while loading", () => {
    vi.mocked(client.getDirectReports).mockReturnValue(new Promise(() => {}));
    const { container } = render(<DirectReportsPage />);
    expect(screen.getByText("Loading your direct reports…")).toBeInTheDocument();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("shows an error and retries", async () => {
    vi.mocked(client.getDirectReports).mockRejectedValueOnce(new Error("x")).mockResolvedValue([priya]);
    render(<DirectReportsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your direct reports could not be loaded");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Priya Natarajan")).toBeInTheDocument();
    expect(client.getDirectReports).toHaveBeenCalledTimes(2);
  });
});
