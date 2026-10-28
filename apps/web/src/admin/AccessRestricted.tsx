export function AccessRestricted() {
  return (
    <div className="mx-auto mt-s5 flex max-w-5xl flex-col items-center gap-s2 rounded-md border border-border bg-bg px-s4 py-s6 text-center text-fg-muted">
      <strong className="text-fg">This page is available to HR admins only.</strong>
      <div>Your role does not include user administration. Ask an HR admin if you need a change.</div>
      <a
        href="/"
        className="mt-s2 inline-flex min-h-11 items-center rounded-md border border-border-strong px-s3 py-s2 text-sm font-medium text-fg no-underline"
      >
        Back to my profile
      </a>
    </div>
  );
}
