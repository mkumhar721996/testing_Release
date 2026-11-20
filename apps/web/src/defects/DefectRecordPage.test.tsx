import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DefectRecordPage } from "./DefectRecordPage";
import * as client from "./defectsClient";

const css = readFileSync(`${process.cwd()}/src/defects/defects.css`, "utf8");

vi.mock("./defectsClient", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  getDefect: vi.fn(),
  moveDefect: vi.fn(),
}));

const defect: client.Defect = {
  key: "DEF-1042",
  title: "CSV export drops rows whose description contains a comma",
  severity: "High",
  component: "Records export",
  reporterName: "Sam Ito",
  ownerName: null,
  environment: "Production",
  description: "Exporting to CSV omits rows.",
  stepsToReproduce: ["Open Records", "Select Export"],
  status: "New",
  createdAt: "2026-11-12T09:00:00.000Z",
  allowedMoves: ["triage", "reject", "duplicate"],
};

const moved = (status: client.DefectStatus): client.MoveResult => ({
  ok: true,
  defect: { ...defect, status },
});

const badge = () => screen.getByRole("status", { name: /defect status/i });
const openPage = async (d: client.Defect = defect) => {
  vi.mocked(client.getDefect).mockResolvedValue(d);
  render(<DefectRecordPage defectKey={d.key} />);
  await screen.findByRole("heading", { level: 1 });
};

beforeEach(() => vi.mocked(client.getDefect).mockResolvedValue(defect));
afterEach(() => vi.resetAllMocks());

describe("DefectRecordPage header (AC17)", () => {
  it("keeps the status badge and path inside the sticky record header", async () => {
    await openPage();
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(header).toHaveClass("record-head");
    expect(within(header).getByRole("status", { name: /defect status/i })).toHaveTextContent("New");
    const path = within(header).getByRole("list", { name: "Status path" });
    expect(within(path).getByText("New").closest("li")).toHaveAttribute("aria-current", "step");
    expect(css).toMatch(/\.record-head\s*\{[^}]*position:\s*sticky/);
  });

  it("marks earlier steps done and no step current for a Rejected defect", async () => {
    await openPage({ ...defect, status: "Fixed", allowedMoves: ["verify", "fail_verification"] });
    const path = screen.getByRole("list", { name: "Status path" });
    expect(within(path).getByText("Triaged").closest("li")).toHaveClass("done");
    expect(within(path).getByText("Fixed").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("shows no current step when Rejected", async () => {
    await openPage({ ...defect, status: "Rejected", allowedMoves: [] });
    expect(badge()).toHaveTextContent("Rejected");
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });
});

describe("DefectRecordPage moves", () => {
  it("moves to the next status and shows it (AC1, AC15)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue(moved("Triaged"));
    await openPage();
    await userEvent.click(screen.getByRole("button", { name: "Move to Triaged" }));
    expect(client.moveDefect).toHaveBeenCalledWith("DEF-1042", "triage", {});
    expect(await screen.findByText(/Status is now Triaged\./)).toBeInTheDocument();
    expect(badge()).toHaveTextContent("Triaged");
  });

  it("offers a failed verification beside Move to Verified for a Fixed defect (AC4)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue(moved("In Progress"));
    await openPage({ ...defect, status: "Fixed", allowedMoves: ["verify", "fail_verification"] });
    expect(screen.getByRole("button", { name: "Move to Verified" })).toHaveClass("btn-primary");
    await userEvent.click(screen.getByRole("button", { name: "Record failed verification" }));
    expect(client.moveDefect).toHaveBeenCalledWith("DEF-1042", "fail_verification", {});
    expect(await screen.findByText(/Status is now In Progress\./)).toBeInTheDocument();
  });

  it("keeps the status and says so when the move is refused (AC2, AC3, AC11)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue({ ok: false, code: "illegal_transition" });
    await openPage();
    await userEvent.selectOptions(screen.getByLabelText("Move to"), "start");
    await userEvent.click(screen.getByRole("button", { name: "Move defect" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Move refused.");
    expect(alert).toHaveTextContent("Status stays New.");
    expect(badge()).toHaveTextContent("New");
  });

  it("explains a role refusal and keeps the status (AC12-14)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue({ ok: false, code: "forbidden" });
    await openPage({ ...defect, status: "Fixed", allowedMoves: ["verify", "fail_verification"] });
    await userEvent.click(screen.getByRole("button", { name: "Move to Verified" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Only QA can/);
    expect(badge()).toHaveTextContent("Fixed");
  });

  it("refuses a duplicate with no original defect without calling the API (AC7)", async () => {
    await openPage();
    await userEvent.selectOptions(screen.getByLabelText("Move to"), "duplicate");
    await userEvent.click(screen.getByRole("button", { name: "Move defect" }));
    expect(screen.getAllByText("Enter the ID of the original defect, such as DEF-0988.").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Original defect")).toHaveAttribute("aria-invalid", "true");
    expect(client.moveDefect).not.toHaveBeenCalled();
    expect(badge()).toHaveTextContent("New");
  });

  it("sends the original defect for a duplicate (AC6)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue(moved("Duplicate"));
    await openPage();
    await userEvent.selectOptions(screen.getByLabelText("Move to"), "duplicate");
    await userEvent.type(screen.getByLabelText("Original defect"), "DEF-0988");
    await userEvent.click(screen.getByRole("button", { name: "Move defect" }));
    expect(client.moveDefect).toHaveBeenCalledWith("DEF-1042", "duplicate", { originalKey: "DEF-0988" });
    expect(await screen.findByText(/Status is now Duplicate\./)).toBeInTheDocument();
  });

  it("requires a reason to reject (AC8) and sends it (AC5)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue(moved("Rejected"));
    await openPage({ ...defect, status: "Triaged", allowedMoves: ["start", "reject", "duplicate"] });
    await userEvent.selectOptions(screen.getByLabelText("Move to"), "reject");
    await userEvent.click(screen.getByRole("button", { name: "Move defect" }));
    expect(screen.getAllByText("Enter a reason for this move.").length).toBeGreaterThan(0);
    expect(client.moveDefect).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Reason"), "Works as designed");
    await userEvent.click(screen.getByRole("button", { name: "Move defect" }));
    expect(client.moveDefect).toHaveBeenCalledWith("DEF-1042", "reject", { reason: "Works as designed" });
    expect(await screen.findByText(/Status is now Rejected\./)).toBeInTheDocument();
  });

  it("requires a reason to reopen a Closed defect (AC9, AC10)", async () => {
    vi.mocked(client.moveDefect).mockResolvedValue(moved("In Progress"));
    await openPage({ ...defect, status: "Closed", allowedMoves: ["reopen"] });
    await userEvent.click(screen.getByRole("button", { name: "Reopen defect" }));
    expect(client.moveDefect).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Reason"), "Seen again in build 4");
    await userEvent.click(screen.getByRole("button", { name: "Move defect" }));
    expect(client.moveDefect).toHaveBeenCalledWith("DEF-1042", "reopen", { reason: "Seen again in build 4" });
    expect(await screen.findByText(/Status is now In Progress\./)).toBeInTheDocument();
  });
});

describe("DefectRecordPage load states", () => {
  it("shows a busy skeleton while loading", () => {
    vi.mocked(client.getDefect).mockReturnValue(new Promise(() => {}));
    render(<DefectRecordPage defectKey="DEF-1042" />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows an error with Try again that loads the defect again", async () => {
    vi.mocked(client.getDefect).mockRejectedValueOnce(new Error("down"));
    render(<DefectRecordPage defectKey="DEF-1042" />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    const before = vi.mocked(client.getDefect).mock.calls.length;
    await userEvent.click(retry);
    expect(client.getDefect).toHaveBeenCalledTimes(before + 1);
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
