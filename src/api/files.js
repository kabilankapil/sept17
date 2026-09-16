/**
 * files.js
 * ────────
 * File CRUD — talks to PHP backend.
 * Endpoint: /api/files
 *
 * PHP mapper returns:
 *   id, fileDate, fileActivity, fileSubject, fileDescription, fileStatus (int)
 *
 * Frontend field names: fileId, activity, subject, description, date, status
 *
 * Note: PHP returns fileStatus as an integer (1/0).
 *       The frontend stores it as a string ("1"/"0") for consistency.
 */

import { authHeaders, mutationFetch } from "./_auth";
import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

// PHP fileStatus int → frontend string
// 1 = Active ("ACTIVE"), 2 = Closed ("CLOSED"), 0 = Deleted (soft-deleted rows
// are filtered out server-side and should never reach the frontend, but we
// still guard against it below).
//
// NOTE: 0 is reserved for soft-delete (see file.php DELETE handler). It must
// never be reused for "Closed" — that collision was the bug: closing a file
// set status=0, which is the exact same value (and the exact same server-side
// filter, WHERE status != 0) used to soft-delete a file, so closed files
// silently vanished from the list just like deleted ones.
function statusFromInt(val) {
  const n = parseInt(val, 10);
  if (n === 1)  return "ACTIVE";
  if (n === 2)  return "CLOSED";
  // Already a string (e.g. "ACTIVE" / "CLOSED") — normalise
  const s = String(val || "").toUpperCase();
  if (s === "ACTIVE" || s === "CLOSED") return s;
  return "ACTIVE"; // safe default
}

function statusToInt(val) {
  const s = String(val || "").toUpperCase();
  return s === "CLOSED" ? 2 : 1; // anything that isn't CLOSED is active
}

// Backend → Frontend
function fromBackend(item) {
  if (!item) return item;
  return {
    fileId:      item.id,
    activity:    item.fileActivity    || "",
    subject:     item.fileSubject     || "",
    description: item.fileDescription || "",
    date:        item.fileDate        || "",
    // Convert PHP int status (1/0) → "ACTIVE"/"CLOSED" for StatusBadge
    status:      statusFromInt(item.fileStatus),
  };
}

// yyyy-mm-dd → dd-mm-yyyy
function toDDMMYYYY(val) {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return val; // already dd-mm-yyyy
}

// Frontend → Backend
function toBackend(data) {
  return {
    fileActivity:    data.activity    || "",
    fileSubject:     data.subject     || "",
    fileDescription: data.description || "",
    fileDate:        toDDMMYYYY(data.date) || "",
    // PHP expects integer status: 1 = active, 0 = closed
    fileStatus:      statusToInt(data.status),
  };
}

// GET /api/files
export async function getFiles() {
  const res = await fetch(`${BASE_URL}/api/files`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to fetch files");
  const list = await res.json();
  return Array.isArray(list) ? list.map(fromBackend) : list;
}

// POST /api/files
export async function createFile(data) {
  const res = await fetch(`${BASE_URL}/api/files`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(toBackend(data)),
  });
 if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to fetch files");
  return fromBackend(await res.json());
}

// PUT /api/files/{id}
export async function updateFile(fileId, data) {
  const res = await mutationFetch(`${BASE_URL}/api/files/${fileId}`, "PUT", {
    body: JSON.stringify(toBackend(data)),
  });
 if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to fetch files");
  return fromBackend(await res.json());
}

// DELETE /api/files/{id}
export async function deleteFile(fileId) {
  const res = await mutationFetch(`${BASE_URL}/api/files/${fileId}`, "DELETE");
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to delete file");
  return safeJson(res);
}