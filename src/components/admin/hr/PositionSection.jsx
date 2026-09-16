// src/components/admin/hr/PositionSection.jsx
//
// Position assignment form, promotion/position history timeline,
// and the position detail modal.
//
// Owns internally: positions, posLoading, formMode, editPos, form,
//                  formErrors, saving, confirmKey, detailPos.
//
// Props:
//   selEmpId                      — string
//   selectedEmployee              — employee object
//   isEmployeeActive               — boolean (selectedEmployee.status === "Active")
//                                    Inactive employees must not be given a new
//                                    or edited position, even if their last
//                                    position record still shows active —
//                                    e.g. when status was flipped directly via
//                                    the Employee tab's Status dropdown instead
//                                    of HR's "Mark Inactive" flow.
//   isFirstEmployee               — boolean
//   isFirstEmployeeAssigned       — boolean
//   firstEmployee                 — employee object or null
//   isSelfReport                  — boolean (selfReports[selEmpId])
//   onSelfReportToggle            — (checked: boolean) => void
//   assignedEmployeesForReporting — array of employees already assigned
//   role                          — string

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getEmpPositionsByEmpId,
  createEmpPosition, updateEmpPosition, deleteEmpPosition,
} from "../../../api/empPosition";
import { canEdit, canDelete, canAdd, editCardStyle } from "../shared/adminStyles";
import { ConfirmDelete } from "../shared/AdminTable";
import { useToast } from "../shared/ToastContext";
import DatePicker from "../DatePicker";
import Btn from "../shared/Btn";
import { Field, Inp, SectionLabel } from "./hrShared";
import { EMPTY_FORM } from "./hrConstants";
import { todayStr, isoToDisplay, validatePositionForm } from "./hrHelpers";

// ── Private: position detail modal ───────────────────────────────────────────

function PositionDetailModal({ pos, selectedEmployee, currentPositionId, onClose }) {
  const isCurrent    = pos.id === currentPositionId;
  const annualCTC    = parseFloat(pos.empMonthGross || pos.empCtc || 0) * 12;
  const monthGrossV  = parseFloat(pos.empMonthGross || 0);
  const basicV       = parseFloat(pos.empBasic      || 0);
  const hraV         = parseFloat(pos.empHra        || 0);
  const allowV       = parseFloat(pos.empAllowance  || 0);
  const tdsV         = parseFloat(pos.empTds        || 0);
  const ptV          = parseFloat(pos.empPt         || 0);
  const loansV       = parseFloat(pos.empLoans      || 0);
  const dedV         = tdsV + ptV + loansV;
  const netV         = monthGrossV - dedV;
  const rupee        = (v) => `₹ ${(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const Row = ({ label, value, color }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: "1px solid var(--a-teal-08,rgba(20,184,166,0.08))",
    }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--a-text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "0.86rem", fontWeight: 700, color: color || "var(--a-text)" }}>{value || "—"}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 1001, width: "min(600px, 95vw)", maxHeight: "88vh", overflowY: "auto",
        background: "var(--a-surface)", borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.25), 0 0 0 1px var(--a-teal-20,rgba(20,184,166,0.2))",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,var(--a-teal-15,rgba(20,184,166,0.15)),var(--a-teal-08,rgba(20,184,166,0.08)))",
          borderBottom: "1px solid var(--a-teal-20,rgba(20,184,166,0.2))",
          padding: "16px 22px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--a-teal)" }}>{pos.position || "Position"}</span>
              {isCurrent && <span style={{ fontSize: "0.6rem", fontWeight: 800, background: "var(--a-teal)", color: "#fff", borderRadius: 4, padding: "2px 6px" }}>CURRENT</span>}
              <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 7px", borderRadius: 5, color: pos.status === "1" ? "#22c55e" : "var(--a-text-faint)", background: pos.status === "1" ? "rgba(34,197,94,0.1)" : "rgba(100,100,100,0.08)" }}>
                {pos.status === "1" ? "● Active" : "○ Past"}
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>
              {selectedEmployee ? `${selectedEmployee.empName} ${selectedEmployee.empLastName}` : ""} · Record #{pos.id}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "var(--a-text-faint)", padding: 4, borderRadius: 6, flexShrink: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.09em", color: "var(--a-teal)", marginBottom: 6, textTransform: "uppercase" }}>📌 Position Info</div>
            <Row label="Department"     value={pos.department} />
            <Row label="Role"           value={pos.role} />
            <Row label="Reporting To"   value={pos.reportingTo} />
            <Row label="Record Date"    value={isoToDisplay(pos.epDate)} />
            <Row label="Effective Date" value={isoToDisplay(pos.epEfficientDate)} />
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.09em", color: "var(--a-teal)", marginBottom: 6, textTransform: "uppercase" }}>💰 Monthly Salary Breakdown</div>
            <Row label="Basic"      value={rupee(basicV)} />
            <Row label="HRA"        value={rupee(hraV)} />
            <Row label="Allowances" value={rupee(allowV)} />
            <Row label="Gross"      value={rupee(monthGrossV)} color="var(--a-teal)" />
            <div style={{ height: 6 }} />
            <Row label="TDS"        value={rupee(tdsV)} />
            <Row label="Prof. Tax"  value={rupee(ptV)} />
            <Row label="Loans"      value={rupee(loansV)} />
            <Row label="Deductions" value={rupee(dedV)} color="#ef4444" />
            <div style={{ height: 6 }} />
            <Row label="Monthly Net" value={rupee(netV)} color="#22c55e" />
          </div>
          {annualCTC > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: "var(--a-teal-08,rgba(20,184,166,0.08))", border: "1px solid var(--a-teal-20,rgba(20,184,166,0.2))" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--a-text-faint)" }}>📊 Annual CTC (Gross × 12)</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--a-teal)" }}>₹ {annualCTC.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px", borderTop: "1px solid var(--a-teal-08,rgba(20,184,166,0.08))", display: "flex", justifyContent: "flex-end" }}>
          <button className="act-btn act-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

// ── PositionSection (exported) ────────────────────────────────────────────────

export default function PositionSection({
  selEmpId,
  selectedEmployee,
  isEmployeeActive,
  isFirstEmployee,
  isFirstEmployeeAssigned,
  firstEmployee,
  isSelfReport,
  assignedEmployeesForReporting,
  role,
}) {
  const toast        = useToast();
  const queryClient  = useQueryClient();

  const [positions,    setPositions]    = useState([]);
  const [posLoading,   setPosLoading]   = useState(false);
  const [posError,     setPosError]     = useState(false);
  const [formMode,     setFormMode]     = useState(null);   // null | "new" | "edit"
  const [editPos,      setEditPos]      = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [formErrors,   setFormErrors]   = useState({});
  const [saving,       setSaving]       = useState(false);
  const [confirmKey,   setConfirmKey]   = useState(null);
  const [detailPos,    setDetailPos]    = useState(null);

  // ── Fetch positions when employee changes ───────────────────────────────
  useEffect(() => {
    if (!selEmpId) { setPositions([]); setPosError(false); return; }
    const ctrl = new AbortController();
    setPosLoading(true);
    setPosError(false);
    resetForm();
    getEmpPositionsByEmpId(selEmpId)
      .then((list) => { if (!ctrl.signal.aborted) setPositions(list); })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setPositions([]);
          setPosError(true);
          toast.error("Failed to load position history.");
        }
      })
      .finally(() => { if (!ctrl.signal.aborted) setPosLoading(false); });
    return () => ctrl.abort();
  }, [selEmpId]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: typeof e === "string" ? e : e.target.value }));
  const resetForm = () => { setFormMode(null); setEditPos(null); setForm(EMPTY_FORM); setFormErrors({}); };

  const activePositions = positions
    .filter((p) => p.status === "1")
    .sort((a, b) => (b.epEfficientDate > a.epEfficientDate ? 1 : -1));
  const currentPosition = activePositions[0] ?? null;

  // Salary preview
  const basic      = parseFloat(form.empBasic)    || 0;
  const hra        = parseFloat(form.empHra)       || 0;
  const allowance  = parseFloat(form.empAllowance) || 0;
  const tds        = parseFloat(form.empTds)       || 0;
  const pt         = parseFloat(form.empPt)        || 0;
  const loans      = parseFloat(form.empLoans)     || 0;
  const monthGross = basic + hra + allowance;
  const deductions = tds + pt + loans;
  const formNetPay = monthGross - deductions;
  const annualCtc  = monthGross * 12;

  const isFormActive = formMode !== null;

  // ── CRUD ────────────────────────────────────────────────────────────────
  const handleSavePosition = async () => {
    if (!isEmployeeActive) {
      toast.error(`Cannot assign a position — employee is "${selectedEmployee?.status}".`);
      return;
    }
    const { errors: errs, isValid } = validatePositionForm(form);
    setFormErrors(errs);
    if (!isValid) { toast.error("Please fix the required fields."); return; }

    const finalReportingTo = isFirstEmployee
      ? (isSelfReport ? "Self" : "Admin")
      : form.reportingTo;

    setSaving(true);
    try {
      if (formMode === "edit" && editPos) {
        const updated = await updateEmpPosition(editPos.id, selEmpId, {
          ...form, reportingTo: finalReportingTo, _existing: editPos,
        });
        setPositions((p) => p.map((x) => x.id === editPos.id ? updated : x));
        toast.success?.("Position updated.");
      } else {
        // Deactivate current active positions before creating new one.
        // Track which ones succeed so we can roll them back if anything
        // below fails — otherwise the employee could be left with zero
        // active positions.
        const activeNow = positions.filter((p) => p.status === "1");
        const deactivated = [];
        let createSucceeded = false;
        try {
          for (const old of activeNow) {
            await updateEmpPosition(old.id, selEmpId, { ...old, status: "0", activeStatus: "0", _existing: old });
            deactivated.push(old);
          }
          await createEmpPosition(selEmpId, {
            ...form, reportingTo: finalReportingTo, status: "1", activeStatus: "1", _existing: {},
          });
          createSucceeded = true;
        } finally {
          if (!createSucceeded && deactivated.length > 0) {
            // Re-activate whatever we already deactivated so the employee
            // isn't left without an active position.
            try {
              for (const old of deactivated) {
                await updateEmpPosition(old.id, selEmpId, { ...old, status: "1", activeStatus: "1", _existing: old });
              }
            } catch {
              toast.error("Save failed and rollback also failed. Please check this employee's position history manually.");
            }
            const refreshed = await getEmpPositionsByEmpId(selEmpId);
            setPositions(refreshed);
          }
        }
        const refreshed = await getEmpPositionsByEmpId(selEmpId);
        setPositions(refreshed);
        toast.success?.("Position saved. Previous records marked inactive.");
      }
      resetForm();
      // Refresh global snapshot so HR.jsx's assignedEmpIds updates immediately
      queryClient.invalidateQueries({ queryKey: ["allEmpPositions"] });
    } catch (e) {
      toast.error(e.message || "Failed to save position.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePosition = async (id) => {
    try {
      await deleteEmpPosition(id);
      queryClient.invalidateQueries({ queryKey: ["allEmpPositions"] });
      setPositions((p) => p.filter((x) => x.id !== id));
      if (editPos?.id === id) resetForm();
    } catch (e) {
      toast.error(e.message || "Failed to delete position.");
    }
  };

  const startEdit = (pos) => {
    setFormMode("edit"); setEditPos(pos);
    setForm({
      epDate: pos.epDate || "", epEfficientDate: pos.epEfficientDate || "",
      position: pos.position || "", department: pos.department || "",
      role: pos.role || "", reportingTo: pos.reportingTo || "",
      empBasic: pos.empBasic || "", empHra: pos.empHra || "",
      empAllowance: pos.empAllowance || "", empTds: pos.empTds || "",
      empPt: pos.empPt || "", empLoans: pos.empLoans || "",
    });
    setFormErrors({});
  };

  // ── Render ───────────────────────────────────────────────────────────────
  // Timeline sorted oldest first
  const sorted = [...positions].sort((a, b) => {
    const da = a.epEfficientDate || a.epDate || "";
    const db = b.epEfficientDate || b.epDate || "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return (
    <>
      {/* ── Inactive employee guard ─────────────────────────────────────── */}
      {!isEmployeeActive && (
        <div style={{
          marginBottom: 20, padding: "14px 18px",
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10, fontSize: "0.82rem", color: "var(--a-danger,#ef4444)", fontWeight: 600,
        }}>
          ⚠ This employee is <strong>{selectedEmployee?.status}</strong>. Position assignment is disabled.
        </div>
      )}

      {/* ── First-employee guard ────────────────────────────────────────── */}
      {isEmployeeActive && !isFirstEmployee && !isFirstEmployeeAssigned && firstEmployee && (
        <div style={{
          marginBottom: 20, padding: "14px 18px",
          background: "rgba(186,117,23,0.08)", border: "1px solid rgba(186,117,23,0.35)",
          borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#BA7517", marginBottom: 4 }}>
              First employee must be assigned a position first
            </div>
            <div style={{ fontSize: "0.78rem", color: "#BA7517", lineHeight: 1.5 }}>
              <strong>{firstEmployee.empName} {firstEmployee.empLastName}</strong> (ID #{firstEmployee.id}) has no
              position yet and there is no one to report to. Assign them to <em>Admin</em> first,
              then all subsequent employees can be assigned positions with a valid reporting line.
            </div>
          </div>
        </div>
      )}

      {/* ── Assign / Edit buttons ───────────────────────────────────────── */}
      {canAdd(role) && isEmployeeActive && !isFormActive && (
        <div style={{ marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
          <Btn
            variant="teal"
            disabled={!isFirstEmployee && !isFirstEmployeeAssigned}
            title={!isFirstEmployee && !isFirstEmployeeAssigned
              ? `Assign ${firstEmployee?.empName || "the first employee"} to Admin before assigning others`
              : "Assign a new position"}
            onClick={() => {
              if (!isFirstEmployee && !isFirstEmployeeAssigned) return;
              setFormMode("new"); setEditPos(null);
              setForm({ ...EMPTY_FORM, epDate: todayStr() });
              setFormErrors({});
            }}
          >
            + Assign Position
          </Btn>
          {currentPosition && (
            <Btn variant="default" onClick={() => startEdit(currentPosition)} title="Edit current active position">
              ✏️ Edit Current Position
            </Btn>
          )}
        </div>
      )}

      {/* ── Position form ───────────────────────────────────────────────── */}
      {isFormActive && (
        <div style={{ ...editCardStyle, marginBottom: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 10, marginBottom: 20,
            paddingBottom: 14, borderBottom: "1px solid var(--a-teal-20)",
          }}>
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--a-teal)", letterSpacing: "0.04em" }}>
              {formMode === "edit" ? "✏️ EDIT POSITION" : "🏢 ASSIGN POSITION"}
              {selectedEmployee && (
                <span style={{ fontWeight: 500, color: "var(--a-text-faint)", marginLeft: 10 }}>
                  — {selectedEmployee.empName} {selectedEmployee.empLastName}
                </span>
              )}
            </span>
            {formMode === "edit" && editPos && (
              <span style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>Position ID #{editPos.id}</span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 32px", maxWidth: 780 }}>
            <SectionLabel>📌 Position Details</SectionLabel>

            <Field label="Date">
              <DatePicker label="" value={form.epDate} onChange={f("epDate")} />
            </Field>
            <Field label="Effective Date" required error={formErrors.epEfficientDate}>
              <DatePicker label="" required value={form.epEfficientDate} onChange={f("epEfficientDate")} />
            </Field>

            <Field label="Position" required error={formErrors.position}>
              <Inp value={form.position} onChange={f("position")} placeholder="e.g. Software Engineer" />
            </Field>
            <Field label="Department">
              <Inp value={form.department} onChange={f("department")} placeholder="e.g. Engineering" />
            </Field>
            <Field label="Role">
              <Inp value={form.role} onChange={f("role")} placeholder="e.g. Developer" />
            </Field>

            <Field label="Reporting To">
              {isFirstEmployee ? (
                <div style={{
                  padding: "8px 12px", borderRadius: 6, fontSize: "0.88rem", fontWeight: 600,
                  color: "var(--a-teal)", background: "var(--a-teal-08,rgba(20,184,166,0.08))",
                  border: "1px solid var(--a-teal-20,rgba(20,184,166,0.2))", cursor: "default",
                }}>
                  {isSelfReport ? "Self (auto-set)" : "Admin (auto-set)"}
                </div>
              ) : (
                <select
                  className="activity-input"
                  style={{ ...(assignedEmployeesForReporting.length === 0 ? { opacity: 0.6 } : {}) }}
                  value={form.reportingTo}
                  onChange={f("reportingTo")}
                  disabled={assignedEmployeesForReporting.length === 0}
                >
                  <option value="">— Select manager —</option>
                  {assignedEmployeesForReporting.map((emp) => (
                    <option key={emp.id} value={`${emp.empName} ${emp.empLastName}`}>
                      {emp.empName} {emp.empLastName}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <SectionLabel>💰 Salary Details (Monthly, ₹)</SectionLabel>

            <Field label="Basic">       <Inp value={form.empBasic}    onChange={f("empBasic")}    placeholder="e.g. 30000" /></Field>
            <Field label="HRA">         <Inp value={form.empHra}      onChange={f("empHra")}      placeholder="e.g. 12000" /></Field>
            <Field label="Allowances">  <Inp value={form.empAllowance} onChange={f("empAllowance")} placeholder="e.g. 5000" /></Field>

            <Field label="Monthly Gross (auto)">
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--a-teal-08,rgba(20,184,166,0.08))", border: "1px solid var(--a-teal-20)", fontSize: "0.9rem", fontWeight: 700, color: "var(--a-teal)", cursor: "default" }}>
                ₹ {monthGross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </Field>

            <Field label="TDS">              <Inp value={form.empTds}   onChange={f("empTds")}   placeholder="e.g. 3000" /></Field>
            <Field label="PT (Prof. Tax)">   <Inp value={form.empPt}    onChange={f("empPt")}    placeholder="e.g. 200" /></Field>
            <Field label="Loans / Advances"> <Inp value={form.empLoans} onChange={f("empLoans")} placeholder="e.g. 0" /></Field>

            <Field label="Monthly Net Pay (auto)">
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", fontSize: "0.9rem", fontWeight: 700, color: "#22c55e", cursor: "default" }}>
                ₹ {formNetPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </Field>

            {annualCtc > 0 && (
              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "var(--a-teal-08,rgba(20,184,166,0.08))", border: "1px solid var(--a-teal-20)", fontSize: "0.82rem", fontWeight: 600, color: "var(--a-text-faint)" }}>
                <span>📊 Annual CTC (Gross × 12):</span>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--a-teal)" }}>₹ {annualCtc.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
            {canEdit(role) && (
              <Btn variant="primary" onClick={handleSavePosition} disabled={saving}>
                {saving ? "Saving…" : formMode === "edit" ? "✔ Update Position" : "✔ Save Position"}
              </Btn>
            )}
            <Btn variant="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* ── Position / Promotion History timeline ───────────────────────── */}
      <div style={{
        background: "var(--a-surface)",
        border: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
        borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,var(--a-teal-15,rgba(20,184,166,0.15)),var(--a-teal-08,rgba(20,184,166,0.08)))",
          borderBottom: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
          padding: "12px 22px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--a-teal)" }}>📋 Promotion / Position History</span>
          {posLoading && <span style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>Loading…</span>}
          {!posLoading && positions.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>{positions.length} record{positions.length !== 1 ? "s" : ""}</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--a-text-faint)", fontStyle: "italic" }}>
            💡 Click any row to view full details
          </span>
        </div>

        {/* DB safety notice */}
        <div style={{ padding: "8px 22px", background: "rgba(34,197,94,0.05)", borderBottom: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "#15803d", fontWeight: 600 }}>
          <span>✅</span>
          <span>All position records are permanently saved in the database — no history is ever lost when a new position is assigned.</span>
        </div>

        {positions.length === 0 ? (
          <div className="activity-empty" style={{ padding: "28px 22px" }}>
            {posLoading
              ? "Loading…"
              : posError
              ? "Failed to load position history. Please try again."
              : 'No position records yet. Use "Assign Position" to add one.'}
          </div>
        ) : (
          <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 0 }}>
            {sorted.map((pos, idx) => {
              const isCurrent  = pos.id === currentPosition?.id;
              const isLast     = idx === sorted.length - 1;
              const prevPos    = sorted[idx - 1];
              const annualCTC  = parseFloat(pos.empMonthGross || pos.empCtc || 0) * 12;
              const monthNet   = parseFloat(pos.empMonthGross || 0) - (parseFloat(pos.empTds || 0) + parseFloat(pos.empPt || 0) + parseFloat(pos.empLoans || 0));

              const changedPosition = prevPos && prevPos.position !== pos.position && pos.position;
              const changedRole     = prevPos && prevPos.role !== pos.role && pos.role;
              const changedDept     = prevPos && prevPos.department !== pos.department && pos.department;
              const changedSalary   = prevPos && parseFloat(prevPos.empMonthGross || 0) !== parseFloat(pos.empMonthGross || 0);
              const salaryDelta     = prevPos ? parseFloat(pos.empMonthGross || 0) - parseFloat(prevPos.empMonthGross || 0) : 0;

              return (
                <div key={pos.id} style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
                  {/* Timeline spine */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%", flexShrink: 0, marginTop: 18,
                      background: isCurrent ? "var(--a-teal)" : "var(--a-text-faint,#888)",
                      border: isCurrent ? "3px solid var(--a-teal)" : "2px solid var(--a-text-faint,#888)",
                      boxShadow: isCurrent ? "0 0 0 4px var(--a-teal-15,rgba(20,184,166,0.15))" : "none",
                      zIndex: 1,
                    }} />
                    {!isLast && <div style={{ flex: 1, width: 2, background: "var(--a-teal-20,rgba(20,184,166,0.2))", minHeight: 24 }} />}
                  </div>

                  {/* Card */}
                  <div
                    onClick={() => setDetailPos(pos)}
                    style={{
                      flex: 1, marginLeft: 12, marginBottom: isLast ? 0 : 16,
                      padding: "14px 18px", borderRadius: 10, cursor: "pointer",
                      border: isCurrent ? "1.5px solid var(--a-teal)" : "1px solid var(--a-border-card,rgba(20,184,166,0.15))",
                      background: isCurrent ? "var(--a-teal-08,rgba(20,184,166,0.08))" : "var(--a-surface)",
                      boxShadow: isCurrent ? "0 2px 12px rgba(20,184,166,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
                      transition: "box-shadow 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(20,184,166,0.18)"; e.currentTarget.style.background = "var(--a-teal-05,rgba(20,184,166,0.05))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = isCurrent ? "0 2px 12px rgba(20,184,166,0.1)" : "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.background = isCurrent ? "var(--a-teal-08,rgba(20,184,166,0.08))" : "var(--a-surface)"; }}
                  >
                    {/* Card top row */}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--a-text-faint)", minWidth: 90 }}>
                        {isoToDisplay(pos.epEfficientDate) || isoToDisplay(pos.epDate) || "No date"}
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: isCurrent ? "var(--a-teal)" : "var(--a-text)" }}>
                        {pos.position || "—"}
                      </span>

                      {isCurrent   && <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.06em", background: "var(--a-teal)", color: "#fff", borderRadius: 4, padding: "2px 6px" }}>CURRENT</span>}
                      {idx === 0   && <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.06em", background: "rgba(186,117,23,0.15)", color: "#BA7517", borderRadius: 4, padding: "2px 6px" }}>INITIAL HIRE</span>}
                      {pos.status !== "1" && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--a-text-faint)", background: "rgba(100,100,100,0.1)", borderRadius: 4, padding: "2px 6px" }}>PAST</span>}
                      {changedPosition && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(99,102,241,0.1)", color: "#6366f1", borderRadius: 4, padding: "2px 6px" }}>🏢 POSITION CHANGE</span>}
                      {changedRole && !changedPosition && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(59,130,246,0.1)", color: "#3b82f6", borderRadius: 4, padding: "2px 6px" }}>🔄 ROLE CHANGE</span>}
                      {changedDept && !changedPosition && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(168,85,247,0.1)", color: "#a855f7", borderRadius: 4, padding: "2px 6px" }}>🏛 DEPT. CHANGE</span>}
                      {changedSalary && (
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, background: salaryDelta > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: salaryDelta > 0 ? "#16a34a" : "#ef4444", borderRadius: 4, padding: "2px 6px" }}>
                          {salaryDelta > 0 ? "📈" : "📉"} {salaryDelta > 0 ? "+" : ""}₹{Math.abs(salaryDelta).toLocaleString("en-IN")}/mo
                        </span>
                      )}

                      {/* Actions */}
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {canEdit(role) && isCurrent && (
                          <button title="Edit current position" className="act-btn act-edit" onClick={() => startEdit(pos)}>✏️</button>
                        )}
                        {canEdit(role) && !isCurrent && (
                          <span title="Historical record — read-only" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, fontSize: "0.8rem", cursor: "default", color: "var(--a-text-faint)", border: "1px solid var(--a-teal-08)", background: "var(--a-teal-04)" }}>🔒</span>
                        )}
                        {canDelete(role) && (
                          confirmKey === `pos-${pos.id}` ? (
                            <ConfirmDelete onConfirm={() => { setConfirmKey(null); handleDeletePosition(pos.id); }} onCancel={() => setConfirmKey(null)} />
                          ) : (
                            <button title="Delete" className="act-btn act-delete" onClick={() => setConfirmKey(`pos-${pos.id}`)}>🗑️</button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Card detail row */}
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.78rem", color: "var(--a-text-faint)" }}>
                      {pos.department && <span><strong style={{ color: "var(--a-text)" }}>Dept:</strong> {pos.department}</span>}
                      {pos.role       && <span><strong style={{ color: "var(--a-text)" }}>Role:</strong> {pos.role}</span>}
                      {pos.reportingTo && <span><strong style={{ color: "var(--a-text)" }}>Reports to:</strong> {pos.reportingTo}</span>}
                      {annualCTC > 0  && <span><strong style={{ color: "var(--a-teal)" }}>CTC:</strong> ₹{annualCTC.toLocaleString("en-IN")}/yr</span>}
                      {monthNet > 0   && <span><strong style={{ color: "#22c55e" }}>Net:</strong> ₹{monthNet.toLocaleString("en-IN")}/mo</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Position detail modal ────────────────────────────────────────── */}
      {detailPos && (
        <PositionDetailModal
          pos={detailPos}
          selectedEmployee={selectedEmployee}
          currentPositionId={currentPosition?.id}
          onClose={() => setDetailPos(null)}
        />
      )}
    </>
  );
}
