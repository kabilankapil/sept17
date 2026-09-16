// ── Employee.jsx ──────────────────────────────────────────────────────────────
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getPayslipsByEmployee, createPayslip,
} from "../../api/employee";
import { getEmpPositionsByEmpId } from "../../api/empPosition";
import {
  PAGE_SIZE, canEdit, canDelete, canAdd,
  thStyle, tdBase, tdNowrap,
} from "./shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";
import {
  validateEmployeeForm, FIELD_LABELS,
  EMPTY_EMP, currentYear,
} from "./employee/employeeConstants";
import EmployeeForm             from "./employee/EmployeeForm";
import EmployeeDetail           from "./employee/EmployeeDetail";
import CreateLinkModal          from "./employee/CreateLinkModal";

export default function Employee({ role = "COMMON" }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading: loading, isError: employeesError } = useQuery({
    queryKey: ["employees"],
    queryFn: () => getEmployees().then(data => [...data].sort((a, b) => b.id - a.id)),
  });

  const [page, setPage]                   = useState(1);
  const [confirmKey, setConfirmKey]       = useState(null);
  const [view, setView]                   = useState(null);
  const [editEmp, setEditEmp]             = useState(null);
  const [form, setForm]                   = useState(EMPTY_EMP);
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState({});
  const [selMonth, setSelMonth]           = useState("");
  const [selYear, setSelYear]             = useState(String(currentYear));
  const [generating, setGenerating]       = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);

  // ── Derive empId for detail-view queries ─────────────────────────────────────
  const empId = view?.employee?.id ?? null;

  // ── Payslips — shared RQ cache key ["payslips", empId] keeps HR in sync ──────
  const { data: rawPayslips = [], isLoading: psLoading } = useQuery({
    queryKey: ["payslips", String(empId ?? "")],
    queryFn:  () => getPayslipsByEmployee(empId),
    enabled:  !!empId,
  });
  const payslips = rawPayslips.filter((p) => Number(p.status) === 1);

  // ── Positions — needed to pull salary data for payslip generation ─────────────
  const { data: empPositions = [] } = useQuery({
    queryKey: ["empPositions", String(empId ?? "")],
    queryFn:  () => getEmpPositionsByEmpId(empId),
    enabled:  !!empId,
  });
  const currentPosition = [...empPositions]
    .filter((p) => p.status === "1")
    .sort((a, b) => (b.epEfficientDate > a.epEfficientDate ? 1 : -1))[0] ?? null;

  // ── Field setter ─────────────────────────────────────────────────────────────
  const f = (k) => (eOrVal) => {
    let val = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    if (k === "empPan" || k === "empIfscCode") val = val.toUpperCase();
    setForm((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((prev) => { const next = { ...prev }; delete next[k]; return next; });
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  function runValidation() {
    const { errors: errs, isValid } = validateEmployeeForm(form);
    setErrors(errs);
    if (!isValid) {
      const names = Object.keys(errs).map((k) => FIELD_LABELS[k] || k).join(", ");
      toast.error(`Please fix: ${names}.`);
    }
    return isValid;
  }

  // ── CRUD handlers ────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!runValidation()) return;
    setSaving(true);
    try {
      const created = await createEmployee(form);
      queryClient.setQueryData(["employees"], (prev = []) =>
        [...prev, created].sort((a, b) => b.id - a.id)
      );
      setView(null); setForm(EMPTY_EMP); setErrors({});
    } catch (e) { toast.error(e.message || "Failed to add employee."); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!runValidation()) return;
    setSaving(true);
    try {
      const updated = await updateEmployee(editEmp.id, form);
      queryClient.setQueryData(["employees"], (prev = []) =>
        prev.map((e) => e.id === editEmp.id ? updated : e)
      );
      if (view?.employee?.id === editEmp.id) setView({ employee: updated });
      setEditEmp(null); setForm(EMPTY_EMP); setErrors({});
    } catch (e) { toast.error(e.message || "Failed to update employee."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEmployee(id);
      queryClient.setQueryData(["employees"], (prev = []) =>
        prev.filter((e) => e.id !== id)
      );
    } catch (e) { toast.error(e.message || "Failed to delete."); }
  };

  const startEdit = (emp) => {
    setEditEmp(emp); setForm({ ...EMPTY_EMP, ...emp }); setErrors({});
  };

  const openDetail = (emp) => {
    setView({ employee: emp });
    setSelMonth("");
    setSelYear(String(currentYear));
    // payslips + positions fetched automatically by React Query when empId changes
  };

  const handleGenerate = async () => {
    if (!view?.employee) return;
    if (!selMonth) { toast.error("Select a month first."); return; }
    if (!currentPosition) {
      toast.error("No active position found — assign a position in the HR tab first.");
      return;
    }
    const grossCheck =
      parseFloat(currentPosition.empBasic     || 0) +
      parseFloat(currentPosition.empHra       || 0) +
      parseFloat(currentPosition.empAllowance || 0);
    if (grossCheck === 0) {
      toast.error("Salary is ₹0 — update position salary details in the HR tab first.");
      return;
    }
    const dup = payslips.find(
      (p) => String(p.empMonth) === String(selMonth) && String(p.empYear) === String(selYear),
    );
    if (dup) { toast.error("Payslip for this month/year already exists."); return; }

    setGenerating(true);
    try {
      // Use the active position's salary data — same source HR uses
      const payData = {
        empMonth:    selMonth,
        empYear:     selYear,
        basic:       currentPosition.empBasic     || "0",
        hra:         currentPosition.empHra       || "0",
        allowancess: currentPosition.empAllowance || "0",
        tds:         currentPosition.empTds       || "0",
        pt:          currentPosition.empPt        || "0",
        loan:        currentPosition.empLoans     || "0",
      };
      const generated = await createPayslip(view.employee.id, payData);

      // Update the shared RQ cache — ["payslips", empId] — keeps HR tab in sync
      queryClient.setQueryData(
        ["payslips", String(view.employee.id)],
        (prev = []) =>
          [generated, ...(prev || [])].sort((a, b) => {
            const ya = Number(a.empYear), yb = Number(b.empYear);
            const ma = Number(a.empMonth), mb = Number(b.empMonth);
            return yb !== ya ? yb - ya : mb - ma;
          }),
      );
    } catch (e) { toast.error(e.message || "Failed to generate payslip."); }
    finally { setGenerating(false); }
  };

  // ── Views ─────────────────────────────────────────────────────────────────────
  if (view === "add" || editEmp) {
    return (
      <EmployeeForm
        form={form} f={f} errors={errors} saving={saving} editEmp={editEmp}
        onSave={editEmp ? handleEdit : handleAdd}
        onBack={() => { setEditEmp(null); setForm(EMPTY_EMP); setErrors({}); if (!editEmp) setView(null); }}
      />
    );
  }

  if (view?.employee) {
    return (
      <EmployeeDetail
        view={view}
        payslips={payslips} psLoading={psLoading}
        selMonth={selMonth} setSelMonth={setSelMonth}
        selYear={selYear}   setSelYear={setSelYear}
        currentPosition={currentPosition}
        generating={generating} handleGenerate={handleGenerate}
        onBack={() => setView(null)}
        onEdit={startEdit}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  const paged = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const colSpan = canEdit(role) ? 6 : 5;
  return (
    <div className="content-section">
      <div className="activity-header" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Employees</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {role === "SUPER" && (
            <Btn variant="default" icon="🔗"
              onClick={() => setShowCreateLink(true)}>
              + Create Link
            </Btn>
          )}
          {canAdd(role) && (
            <Btn variant="teal" icon="＋"
              onClick={() => { setView("add"); setForm(EMPTY_EMP); setErrors({}); }}>
              + Add Employee
            </Btn>
          )}
        </div>
      </div>

      {showCreateLink && (
        <CreateLinkModal onClose={() => setShowCreateLink(false)} />
      )}

      {loading ? <p className="loading">Loading…</p> : (
        <>
          <TableScroller>
            <table style={{ width: "100%", minWidth: 620, tableLayout: "auto", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44 }}>ID</th>
                  <th style={{ ...thStyle, minWidth: 150 }}>NAME</th>
                  <th style={{ ...thStyle, width: 130 }}>PHONE</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>EMAIL</th>
                  <th style={{ ...thStyle, width: 90 }}>STATUS</th>
                  {canEdit(role) && <th style={{ ...thStyle, width: 88, textAlign: "center" }}>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={colSpan} className="activity-empty">
                    {employeesError
                      ? "Failed to load employees. Please try again."
                      : canEdit(role) ? 'No employees. Click "+ Add Employee" to create one.' : "No employees found."}
                  </td></tr>
                ) : paged.map((emp, idx) => (
                  <tr key={emp.id}
                    style={{ cursor: "pointer", transition: "background 0.12s", background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--a-teal-10, rgba(20,184,166,0.10))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))"; }}
                    onClick={() => openDetail(emp)}>
                    <td style={tdNowrap}>{emp.id}</td>
                    <td style={tdBase}><strong style={{ color: "var(--a-teal)", fontWeight: 600 }}>{emp.empName} {emp.empLastName}</strong></td>
                    <td style={tdNowrap}>{emp.empPh   || "—"}</td>
                    <td style={{ ...tdBase, wordBreak: "break-all" }}>{emp.empMail || "—"}</td>
                    <td style={tdBase}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, display: "inline-block", background: emp.status === "Active" ? "#22c55e" : "var(--a-text-faint)" }} />
                        <span style={{ color: emp.status === "Active" ? "#22c55e" : "var(--a-text-muted)", fontSize: "0.82rem" }}>{emp.status}</span>
                      </span>
                    </td>
                    {canEdit(role) && (
                      <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <button title="Edit" className="act-btn act-edit" style={{ marginRight: 4 }}
                          onClick={(e) => { e.stopPropagation(); startEdit(emp); }}>✏️</button>
                        {canDelete(role) && (
                          confirmKey === `emp-${emp.id}` ? (
                            <ConfirmDelete
                              onConfirm={() => { setConfirmKey(null); handleDelete(emp.id); }}
                              onCancel={() => setConfirmKey(null)} />
                          ) : (
                            <button title="Delete" className="act-btn act-delete"
                              onClick={(e) => { e.stopPropagation(); setConfirmKey(`emp-${emp.id}`); }}>🗑️</button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroller>
          <Pagination total={employees.length} page={page} onChange={setPage} />
          <p className="table-hint">💡 Click any row to view details and manage payslip</p>
        </>
      )}
    </div>
  );
}