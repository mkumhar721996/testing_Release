import { AccessRestricted } from "./admin/AccessRestricted";
import { UsersAdminPage } from "./admin/UsersAdminPage";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ActivatePage } from "./auth/ActivatePage";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { SignInPage } from "./auth/SignInPage";
import { Navigation } from "./nav/Navigation";
import { ShoppingPage } from "./shop/ShoppingPage";

function Shell() {
  const { user, loading, signOut } = useAuth();
  if (loading) return null;
  if (!user) return <SignInPage />;
  if (window.location.pathname === "/shop") return <ShoppingPage />;
  if (window.location.pathname === "/admin/users") {
    return user.role === "hr_admin" ? <UsersAdminPage /> : <AccessRestricted />;
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-900">Web App</h1>
      <Navigation role={user.role} />
      <p className="text-slate-700">Signed in as {user.email}</p>
      <a href="/shop" className="text-slate-900 underline">
        Shop
      </a>
      {user.role === "hr_admin" && (
        <a href="/admin/users" className="text-slate-900 underline">
          Users
        </a>
      )}
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
  if (window.location.pathname === "/reset-password") {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    return <ResetPasswordPage token={token} />;
  }
  if (window.location.pathname === "/forgot-password") return <ForgotPasswordPage />;
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

export default App;
