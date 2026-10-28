import { AccountMenu } from "./AccountMenu";

export function Header() {
  return (
    <header className="flex justify-end border-b border-border px-space-5 py-space-3">
      <AccountMenu />
    </header>
  );
}
