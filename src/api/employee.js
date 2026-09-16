/**
 * employee.js
 * ────────────
 * Employee CRUD + Payslip CRUD
 * Talks to Java backend on port 8080
 *
 * EmpDTO fields:    empName, empLastName, empDob, empPh, empMail, empPan,
 *                   empAdhar, empAccNo, empBankName, empAccName, empIfscCode,
 *                   empAddress1, empAddress2, empAddress3, empDoj, status
 *
 * EmpPayslipDTO:    empId, empMonth, empYear, basic, hra, allowancess (sic),
 *                   totalGross, tds, pt, loan, totalDeduction, status (Integer)
 *
 * Payslip endpoints:
 *   POST   /api/payslips
 *   GET    /api/payslips/employee/{empId}   ← all payslips for one employee
 *   PUT    /api/payslips/{id}
 *   DELETE /api/payslips/{id}               ← soft delete
 */

import { authHeaders, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

// ── Employee field mapping ────────────────────────────────────────────────────

function fromEmployeeDTO(dto) {
  if (!dto) return dto;
  return {
    id:         dto.id,
    empName:    dto.empName    || "",
    empLastName:dto.empLastName|| "",
    empDob:     dto.empDob     || "",
    empDoj:     dto.empDoj     || "",
    empPh:      dto.empPh      || "",
    empMail:    dto.empMail    || "",
    empPan:     dto.empPan     || "",
    empAdhar:   dto.empAdhar   || "",
    empAccNo:   dto.empAccNo   || "",
    empBankName:dto.empBankName|| "",
    empAccName: dto.empAccName || "",
    empIfscCode:dto.empIfscCode|| "",
    empAddress1:dto.empAddress1|| "",
    empAddress2:dto.empAddress2|| "",
    empAddress3:dto.empAddress3|| "",
    status:     dto.status     || "Active",
  };
}

function toEmployeeDTO(data) {
  return {
    empName:    data.empName    || "",
    empLastName:data.empLastName|| "",
    empDob:     data.empDob     || "",
    empDoj:     data.empDoj     || "",
    empPh:      data.empPh      || "",
    empMail:    data.empMail    || "",
    empPan:     data.empPan     || "",
    empAdhar:   data.empAdhar   || "",
    empAccNo:   data.empAccNo   || "",
    empBankName:data.empBankName|| "",
    empAccName: data.empAccName || "",
    empIfscCode:data.empIfscCode|| "",
    empAddress1:data.empAddress1|| "",
    empAddress2:data.empAddress2|| "",
    empAddress3:data.empAddress3|| "",
    status:     data.status     || "Active",
  };
}

// ── Payslip field mapping ─────────────────────────────────────────────────────

function fromPayslipDTO(dto) {
  if (!dto) return dto;
  return {
    id:             dto.id,
    empId:          dto.empId,
    empMonth:       dto.empMonth       || "",
    empYear:        dto.empYear        || "",
    basic:          dto.basic          || "0",
    hra:            dto.hra            || "0",
    allowancess:    dto.allowancess    || "0",   // note: double-s in backend
    totalGross:     dto.totalGross     || "0",
    tds:            dto.tds            || "0",
    pt:             dto.pt             || "0",
    loan:           dto.loan           || "0",
    totalDeduction: dto.totalDeduction || "0",
    status:         dto.status,                  // Integer: 1 = active, 0 = inactive
  };
}

function toPayslipDTO(empId, data) {
  const basic       = parseFloat(data.basic)       || 0;
  const hra         = parseFloat(data.hra)         || 0;
  const allowancess = parseFloat(data.allowancess) || 0;
  const tds         = parseFloat(data.tds)         || 0;
  const pt          = parseFloat(data.pt)          || 0;
  const loan        = parseFloat(data.loan)        || 0;
  return {
    empId:          Number(empId),
    empMonth:       String(data.empMonth),
    empYear:        String(data.empYear),
    basic:          String(basic),
    hra:            String(hra),
    allowancess:    String(allowancess),
    totalGross:     String(basic + hra + allowancess),
    tds:            String(tds),
    pt:             String(pt),
    loan:           String(loan),
    totalDeduction: String(tds + pt + loan),
    status:         1,
  };
}

// ── Employee CRUD ─────────────────────────────────────────────────────────────

export async function getEmployees() {
  const res = await fetch(`${BASE_URL}/api/employees`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to fetch employees");
  const list = await res.json();
  return Array.isArray(list) ? list.map(fromEmployeeDTO) : [];
}

export async function createEmployee(data) {
  const res = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify(toEmployeeDTO(data)),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to create employee");
  return fromEmployeeDTO(await res.json());
}

export async function updateEmployee(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/employees/${id}`, "PUT", {
    body: JSON.stringify(toEmployeeDTO(data)),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to update employee");
  return fromEmployeeDTO(await res.json());
}

export async function deleteEmployee(id) {
  const res = await mutationFetch(`${BASE_URL}/api/employees/${id}`, "DELETE");
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to delete employee");
  return safeJson(res);
}

// ── Payslip CRUD ──────────────────────────────────────────────────────────────

// GET all payslips for an employee — filter by month/year client-side
export async function getPayslipsByEmployee(empId) {
  const res = await fetch(`${BASE_URL}/api/payslips/employee/${empId}`, {
    headers: authHeaders(),
  });
  // 404 means no payslips exist yet for this employee — treat as empty list
  if (res.status === 404) return [];
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to fetch payslips");
  const list = await res.json();
  return Array.isArray(list) ? list.map(fromPayslipDTO) : [];
}

export async function createPayslip(empId, data) {
  const res = await fetch(`${BASE_URL}/api/payslips`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify(toPayslipDTO(empId, data)),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to generate payslip");
  return fromPayslipDTO(await res.json());
}

export async function deletePayslip(id) {
  const res = await mutationFetch(`${BASE_URL}/api/payslips/${id}`, "DELETE");
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to delete payslip");
  return safeJson(res);
}
