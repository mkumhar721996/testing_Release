const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export const PATH_STATUSES = ["New", "Triaged", "In Progress", "Fixed", "Verified", "Closed"] as const;
export type DefectStatus = (typeof PATH_STATUSES)[number] | "Rejected" | "Duplicate";

export type DefectMove =
  | "triage"
  | "start"
  | "fix"
  | "verify"
  | "close"
  | "reject"
  | "duplicate"
  | "fail_verification"
  | "reopen";

export type Defect = {
  key: string;
  title: string;
  severity: string;
  component: string;
  reporterName: string;
  ownerName: string | null;
  environment: string;
  description: string;
  stepsToReproduce: string[];
  status: DefectStatus;
  createdAt: string;
  allowedMoves: DefectMove[];
};

export type MoveInput = { reason?: string; originalKey?: string };
export type MoveResult = { ok: true; defect: Defect } | { ok: false; code: string };

export async function getDefect(key: string): Promise<Defect> {
  const res = await fetch(`${base()}/defects/${encodeURIComponent(key)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load the defect.");
  return res.json();
}

export async function moveDefect(
  key: string,
  move: DefectMove,
  input: MoveInput,
): Promise<MoveResult> {
  const res = await fetch(`${base()}/defects/${encodeURIComponent(key)}/moves`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ move, ...input }),
  });
  if (res.ok) return { ok: true, defect: await res.json() };
  const data = await res.json().catch(() => ({}));
  return { ok: false, code: typeof data.code === "string" ? data.code : "unknown" };
}
