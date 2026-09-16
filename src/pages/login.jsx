import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { checkDbConnection } from "../api/health";
import { setCurrentUser, getCurrentUser, clearCurrentUser } from "../utils/userStore";
import "./login.css";

const VALID_ROLES = ["SUPER", "ADMIN", "COMMON"];

function EyeIcon({ show }) {
  return show ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function Login() {
  const nav = useNavigate();
  const [formData, setFormData]   = useState({ email: "", password: "" });
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPw, setShowPw]       = useState(false);

  // "checking" | "ok" | "down" — whether the backend/database is reachable.
  // The login form only renders once this is "ok".
  const [dbStatus, setDbStatus]   = useState("checking");

  const runDbCheck = useCallback(async () => {
    setDbStatus("checking");
    const connected = await checkDbConnection();
    setDbStatus(connected ? "ok" : "down");
  }, []);

  useEffect(() => {
    runDbCheck();
  }, [runDbCheck]);

  // If sessionWatcher.js redirected here because the token expired
  // mid-session, show a clear reason instead of a blank login form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "expired") {
      setError("Your session expired. Please log in again.");
      window.history.replaceState({}, "", "/login"); // clean the URL
    }
  }, []);

  useEffect(() => {
    if (dbStatus !== "ok") return;
    const user  = getCurrentUser();
    const token = sessionStorage.getItem("auth_token");
    if (user && token && VALID_ROLES.includes(user.role)) {
      nav("/admin", { replace: true });
    }
  }, [dbStatus, nav]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!formData.email || !formData.password) { setError("All fields are required!"); return; }
    if (!formData.email.includes("@"))          { setError("Please enter a valid email!"); return; }

    setLoading(true);
    try {
      const data = await login({
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      sessionStorage.setItem("auth_token", data.token);
      setCurrentUser({
        id:       data.id,
        gmail:    data.gmail,
        username: data.username,
        role:     data.role,
        profile:  data.profile,
        contact:  data.contact,
        status:   data.status,
      });

      if (!VALID_ROLES.includes(data.role)) {
        setError("Your account does not have access to this panel.");
        sessionStorage.removeItem("auth_token");
        clearCurrentUser();
        return;
      }

      nav("/admin", { replace: true });
    } catch (err) {
      if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
      } else if (err.message === "Failed to fetch") {
        setError("Cannot reach the server. Please try again later.");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Still checking the database connection ──────────────────────────────
  if (dbStatus === "checking") {
    return (
      <div className="login-page-wrapper">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-brand">
            <div className="login-brand-dot" />
            <span className="login-brand-name">MosIC Office</span>
            <div className="login-brand-dot" />
          </div>
          <h2>Connecting…</h2>
          <p className="subtitle">Checking database connection</p>
        </div>
      </div>
    );
  }

  // ── Database is unreachable — don't show the login form ─────────────────
  if (dbStatus === "down") {
    return (
      <div className="login-page-wrapper">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-brand">
            <div className="login-brand-dot" />
            <span className="login-brand-name">MosIC Office</span>
            <div className="login-brand-dot" />
          </div>
          <h2>Connection Failed</h2>
          <p className="error-message">
            Can't connect to the database right now. Please try again in a moment.
          </p>
          <button type="button" className="login-btn" onClick={runDbCheck}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Database connected — show the normal login form ──────────────────────
  return (
    <div className="login-page-wrapper">
      <div className="login-card">

        <div className="login-brand">
          <div className="login-brand-dot" />
          <span className="login-brand-name">MosIC Office</span>
          <div className="login-brand-dot" />
        </div>

        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to continue to your workspace</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="login-pw-wrap">
              <input
                type={showPw ? "text" : "password"}
                id="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-pw-eye"
                onClick={() => setShowPw((s) => !s)}
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <EyeIcon show={showPw} />
              </button>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <div className="login-footer">
          <div className="login-divider">MosIC Office</div>
        </div>

      </div>
    </div>
  );
}