import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ActivatePage } from "./auth/ActivatePage";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { SignInPage } from "./auth/SignInPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LeavePage } from "./leave/LeavePage";
import { PeoplePage } from "./people/PeoplePage";
import { AppShell } from "./shell/AppShell";
import { ShoppingPage } from "./shop/ShoppingPage";

function Shell() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <SignInPage />;
  if (window.location.pathname === "/shop") return <ShoppingPage />;
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="*" element={<Navigate to="/people" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
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
