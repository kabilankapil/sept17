/**
 * empPosition.js
 * ──────────────
 * Employee Position CRUD
 * Talks to PHP backend
 *
 * EmpPositionDTO fields (PHP mapper returns floats for salary fields):
 *   id, empId, epDate, epEfficientDate, position, department,
 *   role, reportingTo, empBasic, empHra, empAllowance,
 *   empMonthGross, empCtc, empTds, empPt, empLoans,
 *   activeStatus (String "1"/"0"), status (String "1"/"0")
 *
 * Endpoints:
 *   POST   /api/emp-position
 *   GET    /api/emp-position
 *   GET    /api/emp-position/{id}
 *   GET    /api/emp-position/employee/{empId}
 *   PUT    /api/emp-position/{id}
 *   DELETE /api/emp-position/{id}           ← hard delete
 *   PATCH  /api/emp-position/{id}/deactivate ← soft delete
 */

import { authHeaders, mutationFetch } from "./_auth";
import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function handleResponse(res, fallbackMsg) {
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || fallbackMsg);
  return data;
}

// ── DTO mapping ───────────────────────────────────────────────────────────────
// PHP returns salary fields as float (or null); normalise to string "0" to
// match what the rest of the frontend expects from the Java backend.

function fromEmpPositionDTO(dto) {
  if (!dto) return dto;
  return {
    id:               dto.id,
    empId:            dto.empId,
    epDate:           dto.epDate           || "",
    epEfficientDate:  dto.epEfficientDate  || "",
    position:         dto.position         || "",
    department:       dto.department       || "",
    role:             dto.role             || "",
    reportingTo:      dto.reportingTo      || "",
    // PHP returns float | null; coerce to string for consistency with Java backend
    empBasic:         dto.empBasic      != null ? String(dto.empBasic)      : "0",
    empHra:           dto.empHra        != null ? String(dto.empHra)        : "0",
    empAllowance:     dto.empAllowance  != null ? String(dto.empAllowance)  : "0",
    empMonthGross:    dto.empMonthGross != null ? String(dto.empMonthGross) : "0",
    empCtc:           dto.empCtc        != null ? String(dto.empCtc)        : "0",
    empTds:           dto.empTds        != null ? String(dto.empTds)        : "0",
    empPt:            dto.empPt         != null ? String(dto.empPt)         : "0",
    empLoans:         dto.empLoans      != null ? String(dto.empLoans)      : "0",
    activeStatus:     dto.activeStatus  ?? "1",
    status:           dto.status        ?? "1",
  };
}

function toEmpPositionDTO(empId, data) {
  const ex = data._existing || {};

  const basic     = parseFloat(data.empBasic     ?? ex.empBasic)     || 0;
  const hra       = parseFloat(data.empHra       ?? ex.empHra)       || 0;
  const allowance = parseFloat(data.empAllowance ?? ex.empAllowance) || 0;
  const tds       = parseFloat(data.empTds       ?? ex.empTds)       || 0;
  const pt        = parseFloat(data.empPt        ?? ex.empPt)        || 0;
  const loans     = parseFloat(data.empLoans     ?? ex.empLoans)     || 0;

  const monthGross = basic + hra + allowance;
  const ctc        = monthGross;

  return {
    empId:           Number(empId),
    epDate:          data.epDate          || "",
    epEfficientDate: data.epEfficientDate || "",
    position:        data.position        || "",
    department:      data.department      || "",
    role:            data.role            || "",
    reportingTo:     data.reportingTo     || "",
    empBasic:        String(basic),
    empHra:          String(hra),
    empAllowance:    String(allowance),
    empMonthGross:   String(monthGross),
    empCtc:          String(ctc),
    empTds:          String(tds),
    empPt:           String(pt),
    empLoans:        String(loans),
    activeStatus:    data.activeStatus ?? ex.activeStatus ?? "1",
    status:          data.status       ?? ex.status       ?? "1",
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getEmpPositionsByEmpId(empId) {
  const res = await fetch(`${BASE_URL}/api/emp-position/employee/${empId}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return [];
  const data = await handleResponse(res, `Failed to fetch positions for employee #${empId}`);
  return Array.isArray(data) ? data.map(fromEmpPositionDTO) : [];
}

export async function getAllEmpPositions() {
  const res = await fetch(`${BASE_URL}/api/emp-position`, { headers: authHeaders() });
  const data = await handleResponse(res, "Failed to fetch employee positions");
  return Array.isArray(data) ? data.map(fromEmpPositionDTO) : [];
}

export async function createEmpPosition(empId, data) {
  const res = await fetch(`${BASE_URL}/api/emp-position`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify(toEmpPositionDTO(empId, data)),
  });
  return fromEmpPositionDTO(
    await handleResponse(res, `Failed to create position (${res.status})`)
  );
}

export async function updateEmpPosition(id, empId, data) {
  const res = await mutationFetch(`${BASE_URL}/api/emp-position/${id}`, "PUT", {
    body: JSON.stringify(toEmpPositionDTO(empId, data)),
  });
  return fromEmpPositionDTO(
    await handleResponse(res, `Failed to update position #${id} (${res.status})`)
  );
}

export async function deleteEmpPosition(id)  {
  const res = await mutationFetch(`${BASE_URL}/api/emp-position/${id}`, "DELETE");
  return handleResponse(res, `Failed to delete position #${id}`);
}


