/**
 * auditLog.js
 * ───────────
 * Read-only client for GET /api/audit-log.
 * SUPER/ADMIN only — matches the backend's require_role() check.
 */

import { authHeaders } from "./_auth";
import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

/**
 * @param {Object} filters
 * @param {string} [filters.table]     e.g. "sales_register"
 * @param {string} [filters.action]    "create" | "update" | "delete"
 * @param {string} [filters.actor]     partial email match
 * @param {string} [filters.from]      "YYYY-MM-DD"
 * @param {string} [filters.to]        "YYYY-MM-DD"
 * @param {number} [filters.recordId]
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 */
export async function getAuditLog(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const qs = params.toString();
  const res = await fetch(`${BASE_URL}/api/audit-log${qs ? `?${qs}` : ""}`, {
    headers: authHeaders(),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || "Failed to load audit log");
  return data;
}
