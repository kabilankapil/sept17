/**
 * fileLogs.js
 * ───────────
 * Client for the logs_file_activities chain (cause → activity → effect)
 * that tracks which stage a file's activity is currently at.
 * Endpoint: /api/file-logs   (PHP backend)
 */

import { authHeaders, mutationFetch } from "./_auth";
import { BASE_URL } from "./_base";

async function readError(res, fallback) {
  const text = await res.text().catch(() => "");
  try { return JSON.parse(text).error || JSON.parse(text).message || fallback; } catch { return text || fallback; }
}

// yyyy-mm-dd → dd-mm-yyyy
function toDDMMYYYY(val) {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return val;
}

/** Full chain history for a file (all statuses), oldest first. */
export async function getFileLogs(fileRefId) {
  const res = await fetch(`${BASE_URL}/api/file-logs?fileRefId=${encodeURIComponent(fileRefId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to fetch file logs"));
  return res.json();
}

/** Only the currently OPEN branches for a file — used to populate the
 *  Cause ID / Effect ID dropdowns on the New Activity form. */
export async function getOpenFileLogs(fileRefId) {
  const res = await fetch(`${BASE_URL}/api/file-logs/by-file/${encodeURIComponent(fileRefId)}?status=open`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to fetch open file logs"));
  return res.json();
}

/**
 * Create the log entry for a newly-created activity.
 * fields: { fileRefId, currentId, causeId?, effectId?, logDate?, expireDate?, logDescription? }
 */
export async function createFileLog(fields) {
  const res = await fetch(`${BASE_URL}/api/file-logs`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      fileRefId:       fields.fileRefId,
      currentId:       fields.currentId,
      causeId:         fields.causeId || null,
      effectId:        fields.effectId || null,
      logDate:         toDDMMYYYY(fields.logDate) || "",
      expireDate:      toDDMMYYYY(fields.expireDate) || "",
      logDescription:  fields.logDescription || "",
      // Preserve the three-state value from ActivityLog.jsx.
      // YES → open (green), NO → single (yellow).
      logStatus:       fields.logStatus || "single",
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create file log"));
  return res.json();
}

/**
 * Update the editable fields of an existing log entry — currently used to
 * let the Expire Date be set/changed after the activity was created (the
 * "New Activity" form is the only other place expireDate can be entered).
 * fields: { expireDate?, logDate?, logDescription? } — omit a key to leave
 * it unchanged; pass "" to clear expireDate.
 */
export async function updateFileLog(id, fields = {}) {
  const body = {};
  if (fields.expireDate !== undefined)     body.expireDate     = toDDMMYYYY(fields.expireDate);
  if (fields.logDate !== undefined)        body.logDate        = toDDMMYYYY(fields.logDate);
  if (fields.logDescription !== undefined) body.logDescription = fields.logDescription;

  const res = await mutationFetch(`${BASE_URL}/api/file-logs/${id}`, "PUT", {
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update file log"));
  return res.json();
}

/** Terminal close — no password required, closes the log immediately. */
export async function closeFileLog(id, { logDate, logDescription } = {}) {
  const res = await fetch(`${BASE_URL}/api/file-logs/${id}/close`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      logDate:        logDate ? toDDMMYYYY(logDate) : undefined,
      logDescription,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to close activity"));
  return res.json();
}

/**
 * Deletes/unlinks a log entry. Two different things can happen server-side
 * (see backend/api/file-logs/{id} DELETE) — the response tells you which:
 *
 *  - chainBroken: false → this was a plain standalone entry. It's been
 *    soft-deleted (hidden from history and every picker) exactly as before.
 *  - chainBroken: true  → this entry was part of a chain. NOTHING was
 *    deleted — only the chain links (cause_id/effect_id) were removed.
 *    Every log in that chain (`affectedIds`, including this one) is kept
 *    and reset to a plain standalone 'open' entry. Callers must NOT treat
 *    this as "the activity is gone" — the underlying activity/file must be
 *    left alone when chainBroken is true.
 */
export async function deleteFileLog(id) {
  const res = await mutationFetch(`${BASE_URL}/api/file-logs/${id}`, "DELETE");
  if (!res.ok) throw new Error(await readError(res, "Failed to delete file log"));
  return res.json();
}