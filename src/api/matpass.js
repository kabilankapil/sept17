/**
 * matpass.js
 * ──────────
 * MAT Pass CRUD
 * Talks to Java backend on port 8080
 *
 * Endpoint: /api/matpass
 *
 * Backend DTO fields (from MatpassMapper.java):
 *   id, inOrOut, party, date, contactPerson, discription, fileRef, quantity, status
 *
 * Note: "discription" is the backend's spelling — kept intentionally to match the DTO.
 */

import { authHeaders, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

async function handleResponse(res) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    switch (res.status) {
      case 401: throw new Error("Session expired. Please log in again.");
      case 403: throw new Error("You do not have permission to perform this action.");
      case 404: throw new Error("Record not found. It may have been deleted.");
      case 409: throw new Error("This record conflicts with an existing entry.");
      case 500: throw new Error("Server error. Please try again later.");
      default:  throw new Error(data.message || "Something went wrong. Please try again.");
    }
  }
  return data;
}

// ── Local date formatter (dd-mm-yyyy → dd-mm-yyyy or passthrough) ────────────

function fmtDate(val) {
  if (!val) return "—";
  return val; // backend already stores as dd-mm-yyyy
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getMatpasses() {
  const res = await fetch(`${BASE_URL}/api/matpass`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getMatpassById(id) {
  const res = await fetch(`${BASE_URL}/api/matpass/${id}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createMatpass(data) {
  const res = await fetch(`${BASE_URL}/api/matpass`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateMatpass(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/matpass/${id}`, "PUT", {
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteMatpass(id) {
  const res = await mutationFetch(`${BASE_URL}/api/matpass/${id}`, "DELETE");
  return handleResponse(res);
}

// ── PDF generation (shared between Matpass.jsx and ActivityLog.jsx) ──────────
//
// Re-exported from PDFTemplates so both Matpass.jsx and ActivityLog.jsx get
// the same teal-themed layout as Purchase / Sales. The old _buildMatpassHTML
// builder below has been removed — PDFTemplates is the single source of truth.

export { printMatpassPDF, buildMatpassBlobUrl } from "../components/admin/PDFTemplates";
