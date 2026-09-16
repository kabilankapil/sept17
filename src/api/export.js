/**
 * export.js
 * ─────────
 * Full / per-file data export — talks to PHP backend.
 * Endpoints: GET /api/export           (all files)
 *            GET /api/export/{fileId}  (one file)
 *
 * exportAll() returns a ZIP: file.pdf (all files, linked to per-file activity
 * lists) + file{id}/activitylist.pdf + file{id}/activity{id}.{ext} (original documents).
 *
 * exportFile(fileId) returns a ZIP scoped to just that file:
 * file{id}_export/activitylist.pdf + file{id}_export/activity{id}.{ext}.
 *
 * Both are restricted to SUPER / ADMIN on the backend (require_role).
 */

import { getToken } from "./_auth";
import { BASE_URL } from "./_base";

// Shared: fetch a ZIP-returning endpoint and trigger the browser download.
async function downloadZip(url, filename) {
  const token = getToken();

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let message = "Export failed";
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch {
      // response wasn't JSON (e.g. a raw 500) — keep the default message
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

// GET /api/export → downloads the ZIP for all files via the browser
export async function exportAll() {
  const dateStr = new Date().toISOString().slice(0, 10);
  await downloadZip(`${BASE_URL}/api/export`, `export_${dateStr}.zip`);
}

// GET /api/export/{fileId} → downloads the ZIP for a single file via the browser
export async function exportFile(fileId) {
  const dateStr = new Date().toISOString().slice(0, 10);
  await downloadZip(
    `${BASE_URL}/api/export/${fileId}`,
    `file${fileId}_export_${dateStr}.zip`,
  );
}
