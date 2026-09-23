import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/useTheme";
import {
  getCurrentUser,
  clearCurrentUser,
} from "../utils/userStore";
import ActivityLog    from "../components/admin/ActivityLog";
import UserManagement from "../components/admin/UserManagement";
import AuditLog       from "../components/admin/AuditLog";
import Sales          from "../components/admin/Sales";
import Party          from "../components/admin/Party";
import Purchase       from "../components/admin/Purchase";
import Stocks         from "../components/admin/Stocks";
import Matpass        from "../components/admin/Matpass";
import { ToastProvider } from "../components/admin/shared/ToastContext";
import ErrorBoundary  from "../components/admin/shared/ErrorBoundary";
import Employee       from "../components/admin/Employee";
import OnboardingReview from "../components/admin/OnboardingReview";
import HR             from "../components/admin/HR";
import Dashboard      from "../components/admin/Dashboard";
import "./admin.css";

const BASE_MENU = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "files",     label: "Files",     icon: "🗂️" },
  { id: "sales",     label: "Sales",     icon: "💰" },
  { id: "purchase",  label: "Purchase",  icon: "📈" },
  { id: "stocks",    label: "Stocks",    icon: "📦" },
  { id: "matpass",   label: "MAT Pass",  icon: "🪪" },
  { id: "party",     label: "Party",     icon: "📋" },
];

// HR and Employee contain sensitive personal/salary data — SUPER and ADMIN only.
const HR_MENU = [
  { id: "hr",        label: "HR",        icon: "👥" },
  { id: "employee",  label: "Employee",  icon: "⚙️" },
];

const SUPER_MENU = [
  { id: "users",      label: "Users",      icon: "👤" },
  { id: "onboarding", label: "Onboarding", icon: "🔗" },
  { id: "audit-log",  label: "Audit Log",  icon: "🕵️" },
];


/* ── Sun icon ── */
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
               M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

/* ── Moon icon ── */
function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export default function Admin() {
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen]           = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu]             = useState("dashboard");

  const currentUser = getCurrentUser();
  const role        = currentUser?.role || "COMMON";
  const menuItems   = [
    ...BASE_MENU,
    ...(role === "SUPER" || role === "ADMIN" ? HR_MENU : []),
    ...(role === "SUPER" ? SUPER_MENU : []),
  ];

  useEffect(() => {
    if (!currentUser) nav("/login", { replace: true });
  }, [currentUser, nav]);

  if (!currentUser) return null;

  const handleLogout = () => {
    clearCurrentUser();
    nav("/login", { replace: true });
  };

  const handleNavClick = (id) => {
    setActiveMenu(id);
    setMobileSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard": return <Dashboard currentUser={currentUser} />;
      case "files":     return <ActivityLog    role={role} />;
      case "party":     return <Party          role={role} />;
      case "sales":     return <Sales          role={role} />;
      case "purchase":  return <Purchase       role={role} />;
      case "stocks":    return <Stocks         role={role} />;
      case "matpass":   return <Matpass        role={role} />;
      case "hr":        return (role === "SUPER" || role === "ADMIN")
        ? <HR             role={role} />
        : <div className="content-section"><p>Access denied.</p></div>;
      case "employee":  return (role === "SUPER" || role === "ADMIN")
        ? <Employee       role={role} />
        : <div className="content-section"><p>Access denied.</p></div>;
      case "users":
        return role === "SUPER"
          ? <UserManagement />
          : <div className="content-section"><p>Access denied.</p></div>;
      case "onboarding":
        return role === "SUPER"
          ? <OnboardingReview role={role} />
          : <div className="content-section"><p>Access denied.</p></div>;
      case "audit-log":
        return role === "SUPER"
          ? <AuditLog />
          : <div className="content-section"><p>Access denied.</p></div>;
      default: return null;
    }
  };

  return (
    <ToastProvider>
      <div className="admin-container">

        {/* ══════════════════════════════════════════════
            MOBILE TOP BAR — visible only on mobile via CSS
            Contains: hamburger | title | theme toggle
            ══════════════════════════════════════════════ */}
        <header className="mobile-topbar">
          <button
            className="mobile-hamburger"
            onClick={() => setMobileSidebarOpen((o) => !o)}
            aria-label={mobileSidebarOpen ? "Close menu" : "Open menu"}
          >
            {mobileSidebarOpen ? "✕" : "☰"}
          </button>

          <span className="mobile-topbar-title"> Mosic Solutions</span>

          <button
            className="mobile-theme-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        {/* ══════════════════════════════════════════════
            SIDEBAR
            ══════════════════════════════════════════════ */}
        <aside className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}${mobileSidebarOpen ? " mobile-open" : ""}`}>
          <div className="sidebar-header">
            <h2 className={sidebarOpen ? "show" : "hide"}> Mosic Solutions</h2>

            {/* Desktop collapse toggle — hidden on mobile via CSS */}
            <button
              className="toggle-btn"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>

          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeMenu === item.id ? "active" : ""}`}
                onClick={() => handleNavClick(item.id)}
                title={item.label}
                aria-current={activeMenu === item.id ? "page" : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className={`nav-label ${sidebarOpen ? "show" : "hide"}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <span className="nav-icon">🚪</span>
              <span className={`nav-label ${sidebarOpen ? "show" : "hide"}`}>Logout</span>
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════
            MOBILE OVERLAY BACKDROP
            ══════════════════════════════════════════════ */}
        {mobileSidebarOpen && (
          <div
            className="sidebar-overlay visible"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ══════════════════════════════════════════════
            DESKTOP THEME TOGGLE — hidden on mobile via CSS
            ══════════════════════════════════════════════ */}
        <button
          className="desktop-theme-btn"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* ══════════════════════════════════════════════
            MAIN CONTENT
            ══════════════════════════════════════════════ */}
        <main className="admin-content">
          <ErrorBoundary key={activeMenu}>
            {renderContent()}
          </ErrorBoundary>
        </main>

      </div>
    </ToastProvider>
  );
}
