import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ActivatePage } from "./auth/ActivatePage";
import { SignInPage } from "./auth/SignInPage";
import { Navigation } from "./nav/Navigation";

function Shell() {
  const { user, loading, signOut } = useAuth();
  if (loading) return null;
  if (!user) return <SignInPage />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-900">Web App</h1>
      <Navigation role={user.role} />
      <p className="text-slate-700">Signed in as {user.email}</p>
      <button onClick={signOut} className="rounded bg-slate-900 px-4 py-2 text-white">
        Sign out
      </button>
    </main>
  );
}

function App() {
  if (window.location.pathname === "/activate") {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    return <ActivatePage token={token} />;
  }
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

export default App;
