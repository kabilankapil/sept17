/**
 * sessionWatcher.js
 * ─────────────────
 * Auto-logout when the session expires.
 *
 * The backend returns HTTP 401 whenever a JWT is missing, expired, or
 * invalid (see helpers/response.php's require_auth()). Previously nothing
 * was listening for that — each screen just showed its own error toast and
 * the user stayed stuck on a dead page until they manually logged out or
 * refreshed.
 *
 * This patches the browser's global `fetch` exactly once, at app startup.
 * Every API call in the app already goes through fetch() (directly, or via
 * mutationFetch() in _auth.js, which itself calls fetch()) — so patching it
 * here covers every request without needing to touch any of the ~20
 * api/*.js files individually.
 *
 * Behaviour:
 *   1. Let the request go through as normal.
 *   2. If the response comes back 401 AND the user currently believes
 *      they're logged in (a token exists), treat it as "session expired":
 *        - clear the stored token + user
 *        - redirect to /login
 *        - show a one-time toast-free message via a query param, so the
 *          login page can explain why they were sent back
 *   3. The login endpoint itself (POST /api/auth/login) is excluded —
 *      a wrong password also returns 401, and that must NOT trigger a
 *      forced logout/redirect loop.
 */

import { getToken } from "../api/_auth";
import { clearSession } from "../api/auth";
import { clearCurrentUser } from "./userStore";

let installed = false;

export function installSessionWatcher() {
  if (installed) return; // guard against double-install (e.g. React StrictMode)
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 401) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const isLoginCall = url.includes("/api/auth/login");
      const wasLoggedIn = !!getToken();

      if (!isLoginCall && wasLoggedIn) {
        clearSession();
        clearCurrentUser();

        // Avoid redirect loops if we're already on /login.
        if (window.location.pathname !== "/login") {
          window.location.replace("/login?reason=expired");
        }
      }
    }

    return response;
  };
}