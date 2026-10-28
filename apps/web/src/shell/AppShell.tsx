import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { MainNav } from "./MainNav";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-bg font-ui">
      <aside className="flex w-48 flex-col gap-space-4 border-r border-border bg-bg-subtle p-space-4">
        <span className="text-token-lg font-semibold text-fg">Comp Console</span>
        <MainNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="p-space-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
