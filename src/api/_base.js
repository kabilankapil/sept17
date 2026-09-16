/**
 * _base.js
 * ────────
 * Single source of truth for the backend base URL.
 *
 * PHP backend: set VITE_API_BASE_URL in your .env file.
 *   Development:  VITE_API_BASE_URL=http://localhost:8080
 *   Production:   VITE_API_BASE_URL=https://yourdomain.com/backend
 *
 * Note: VITE_API_BASE_URL is the env variable used by the PHP backend's
 * .env.production.example. The old Java backend used VITE_API_URL.
 * Both are supported here for backwards compatibility.
 */
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??

  "http://localhost:8080"; // Default to development URL if env variable is not set
