import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminRoute from "./components/AdminRoute";
import Login from "./pages/login";
import Admin from "./pages/Admin";
import LoginHeader from "./components/LoginHeader";
import LoginFooter from "./components/LoginFooter";
import EmployeeOnboardingForm from "./pages/EmployeeOnboardingForm";
import { useLocation } from "react-router-dom";

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname === "/admin";
  // The onboarding form is a standalone, unauthenticated page — like a Google
  // Form. It must never show the app's header/footer/nav or anything that
  // implies a logged-in session; the person filling it out has no account.
  const isOnboarding = location.pathname.startsWith("/onboard/");
  const isBare = isAdmin || isOnboarding;

  return (
    <>
      {/* Hide LoginHeader on /admin and on the public onboarding form */}
      {!isBare && <LoginHeader />}

      <Routes>
        <Route path="/"        element={<Navigate to="/login" replace />} />
        <Route path="/login"   element={<Login />} />
        <Route path="/admin"   element={<AdminRoute><Admin /></AdminRoute>} />

        {/* Public — no login, no session, no token check beyond the link itself */}
        <Route path="/onboard/:token" element={<EmployeeOnboardingForm />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {/* Hide LoginFooter on /admin and on the public onboarding form */}
      {!isBare && <LoginFooter />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;