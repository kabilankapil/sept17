/**
 * health.js
 * ─────────
 * Checks whether the backend + database are reachable.
 * Used by the Login page to decide whether to show the login form
 * or a "can't connect" message — BEFORE the user tries to sign in.
 */

import { BASE_URL } from "./_base";

/**
 * Returns true if the backend responded and the database is connected.
 * Never throws — network errors, timeouts, and non-2xx responses all
 * resolve to `false` so the caller doesn't need its own try/catch.
 */
export async function checkDbConnection(timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => ({}));
    return data.status === "ok" && data.db === "connected";
  } catch {
    // Network error, CORS failure, timeout, server down, etc.
    return false;
  } finally {
    clearTimeout(timer);
  }
}