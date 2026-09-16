/**
 * auth.js
 * ───────
 * Auth + User-Management API — talks to Java backend on port 8080.
 *
 * Role mapping (keep in sync with backend):
 *   DB / backend  ──►  frontend display
 *   "SUPER"  ──►  "SUPER"
 *   "ADMIN"  ──►  "ADMIN"
 *   "USER"   ──►  "COMMON"
 *
 * Token storage: sessionStorage (NOT localStorage).
 *   sessionStorage is scoped to the browser tab and is automatically cleared
 *   when the tab or browser is closed — drastically reducing the window for
 *   token theft and the back→forward history exploit.
 */

import { authHeaders as _authHeaders, getToken } from "./_auth";

import { BASE_URL } from "./_base";

// ── helpers ──────────────────────────────────────────────────────────────────

// For unauthenticated calls (login) we still need a plain JSON header.
// For authenticated calls we delegate to the shared helper.
function jsonHeaders(withAuth = false) {
  return withAuth ? _authHeaders() : { "Content-Type": "application/json" };
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Map HTTP status codes to user-friendly messages
    switch (res.status) {
      case 401: throw new Error("Incorrect email or password. Please try again.");
      case 403: throw new Error("Your account does not have permission to access this panel.");
      case 404: throw new Error("Account not found. Please check your email.");
      case 423: throw new Error("Your account has been locked. Please contact your administrator.");
      case 500: throw new Error("Server error. Please try again later or contact support.");
      case 503: throw new Error("Service unavailable. Please try again in a moment.");
      default:  throw new Error(data.message || "Something went wrong. Please try again.");
    }
  }
  return data;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Returns { token, username, gmail, contact, status, profile }
 * Automatically maps `profile` → `role` for the frontend.
 */
export async function login({ email, password }) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method:  "POST",
    headers: jsonHeaders(),
    body:    JSON.stringify({ gmail: email, password }),
  });
  const data = await handleResponse(res);
  return { ...data, role: profileToRole(data.profile) };
}

/**
 * Clears all client-side session state.
 * Call this from your logout handler — do NOT clear storage manually elsewhere.
 */
export function clearSession() {
  sessionStorage.removeItem("auth_token");
  // If you have other session keys, add them here.
  // Do NOT call setCurrentUser(null) here — keep auth concerns separate.
}

/**
 * Maps PHP backend profile strings → frontend role strings.
 * PHP stores profiles in lowercase: "superuser" | "admin" | "user"
 * Java stored them in uppercase:   "SUPER"     | "ADMIN" | "USER"
 * Both are handled here for backwards compatibility.
 */
export function profileToRole(profile) {
  switch ((profile ?? "").toLowerCase()) {
    case "superuser": return "SUPER";
    case "admin":     return "ADMIN";
    case "user":      return "COMMON";
    case "super":     return "SUPER";  // legacy Java uppercase
    default:          return "COMMON";
  }
}

export function roleToProfile(role) {
  switch ((role ?? "").toUpperCase()) {
    case "SUPER":  return "superuser";  // PHP expects lowercase
    case "ADMIN":  return "admin";
    case "COMMON": return "user";
    default:       return "user";
  }
}