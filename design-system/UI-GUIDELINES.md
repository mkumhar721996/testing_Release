# UI Guidelines

This product is an internal operations console for managing business records, workflows and
tasks (RBAC, search/filtering, reporting, audit logging, document metadata). These rules keep
every screen consistent with that job.

## Navigation

- Persistent left **sidebar** (collapses behind a menu button below desktop width) because
  users jump between unrelated sections (Records, Tasks, Reports, Audit Log) within a single
  session and a top bar can't hold that many destinations legibly.
- Sidebar sections, in order: **Dashboard**, **Records**, **Tasks**, **Reports**, **Audit Log**,
  **Admin** (RBAC/user management) — ordered by frequency of use, with Admin last since only
  a subset of roles reach it.
- A slim top bar holds only global, cross-section controls: search, notifications, and the
  account menu — anything section-specific belongs in the sidebar or the page itself, not here.

## Layout and density

- This is a **data-dense console**, not a spacious consumer app: default to compact spacing
  (`space-2`/`space-3`) inside tables and forms so operators can scan many records per screen.
  Reserve generous spacing (`space-5`/`space-6`) for the gaps between major page sections, not
  within them.
- Below 768px, tables degrade to stacked record cards and the sidebar hides behind the menu
  button — operators doing deep record/task work are expected on desktop, so mobile only needs
  to support a quick look-up or a single approval, not full editing workflows.

## Component usage

- Use `.card` to group a record's own fields or a dashboard summary — one subject per card.
- Use a table (native `<table>` styled with the token-based borders/spacing) for any list the
  user scans, sorts or compares across rows — records, tasks, audit entries.
- Use `.stack`/list markup only for short, unordered collections (e.g. attached documents on a
  record) where tabular comparison isn't the point.
- `.btn-primary` is reserved for the one primary action per screen (save, submit, approve);
  every other action is `.btn-secondary` or `.btn-ghost` so the primary action stays visually
  unambiguous.
- Use `.modal` for a focused action that blocks the current screen (confirm, quick-create);
  use `.drawer` for viewing or editing a record's detail without losing the list behind it —
  operators frequently need to keep their place in a filtered list.
- Use `.badge` for record/task status (neutral/success/warning/danger map to
  draft/approved/pending/rejected) since status must be scannable at a glance down a column.
- Use `.toast` only for confirmation of an action already completed (saved, exported); use
  `.alert` for anything the user must read before proceeding, since toasts auto-dismiss.

## Theme

- **Light theme only.** This is an internal, screen-sharing-heavy business tool where
  consistent screenshots (for audit and support) matter more than per-user theme preference.

## Voice and tone

- Direct and factual: describe what happened or what is needed ("3 records require approval"),
  never embellished or playful — this is a system of record, not a marketing surface.
- Error and validation copy states the fix, not just the problem ("Enter a date before the due
  date" rather than "Invalid date"), since operators need to resolve it and move on quickly.
