/**
 * HR.jsx  (updated)
 * ──────────────────
 * Employee Position management — owns ["employees"] and ["allEmpPositions"]
 * queries, the employee selector UI, and coordinates the two sub-sections.
 *
 * What moved out:
 *   • PayslipSection    → hr/PayslipSection.jsx  (owns payslip UI state + handlers)
 *   • PositionSection   → hr/PositionSection.jsx  (owns positions state + form + timeline)
 *   • EmpFlatList       → hr/EmpFlatList.jsx
 *   • Field, Inp, SectionLabel, SelfReportToggle → hr/hrShared.jsx
 *   • todayStr, isoToDisplay, validatePositionForm, buildCombinedPayslipsHtml → hr/hrHelpers.js
 *   • MONTHS, EMPTY_FORM → hr/hrConstants.js
 *
 * HR.jsx retains:
 *   • ["employees"] query
 *   • ["allEmpPositions"] query  — used to compute assignedEmpIds for EmpFlatList
 *   • ["payslips", selEmpId] query — payslips state per the agreed query keys
 *   • selEmpId + selfReports UI state
 *   • enrichedEmployees / assignedEmpIds derived state
 *   • currentPosition derived from allPositions (for PayslipSection)
 *   • Employee selector card
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEmployees, getPayslipsByEmployee, updateEmployee } from "../../api/employee";
import { getAllEmpPositions, updateEmpPosition } from "../../api/empPosition";
import EmpFlatList      from "./hr/EmpFlatList";
import PayslipSection   from "./hr/PayslipSection";
import PositionSection  from "./hr/PositionSection";
import StatusDot        from "./shared/StatusDot";

export default function HR({ role = "COMMON" }) {
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ["employees"],
    queryFn:  () => getEmployees().then(data => [...data].sort((a, b) => a.id - b.id)),
  });

  const { data: allPositions = [] } = useQuery({
    queryKey: ["allEmpPositions"],
    queryFn:  getAllEmpPositions,
  });

  // ── ["payslips", selEmpId] — agreed query key ────────────────────────────
  const [selEmpId, setSelEmpId] = useState("");
  const [marking,  setMarking]  = useState(false);
  const [markConfirm, setMarkConfirm] = useState(false);
  const [markError, setMarkError] = useState("");

  const canEdit = role === "SUPER" || role === "ADMIN";
  const todayStr = () => new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  const {
    data: payslips = [],
    isLoading: payLoading,
    isError: payError,
  } = useQuery({
    queryKey: ["payslips", selEmpId],
    queryFn:  () => getPayslipsByEmployee(selEmpId).then(data =>
      [...data].sort((a, b) => {
        const ya = Number(a.empYear), yb = Number(b.empYear);
        const ma = Number(a.empMonth), mb = Number(b.empMonth);
        return yb !== ya ? yb - ya : mb - ma;
      }),
    ),
    enabled: !!selEmpId,
  });

  // ── selfReports state ────────────────────────────────────────────────────
  const [selfReports, setSelfReports] = useState({});

  // ── Derived state ────────────────────────────────────────────────────────
  const selectedEmployee = employees.find((e) => String(e.id) === String(selEmpId)) ?? null;
  const isEmployeeActive = selectedEmployee?.status === "Active";

  // assignedEmpIds — derived from the global allPositions query snapshot.
  // PositionSection invalidates ["allEmpPositions"] after each save/delete
  // so this automatically updates after assignment changes.
  const assignedEmpIds = new Set(
    allPositions.filter((p) => p.status === "1").map((p) => String(p.empId)),
  );

  // currentPosition — derived from allPositions for the selected employee.
  // Used by PayslipSection for salary preview and document generation.
  const myActivePositions = allPositions
    .filter((p) => String(p.empId) === String(selEmpId) && p.status === "1")
    .sort((a, b) => (b.epEfficientDate > a.epEfficientDate ? 1 : -1));
  const currentPosition = myActivePositions[0] ?? null;

  // firstEmployee — the one root-level employee who reports to "Admin"/"Self"
  // instead of to another person. Anchored to whoever ACTUALLY holds that
  // active position (reportingTo === "Admin" or "Self"), so it stays stable
  // no matter how employee IDs shuffle around as people are added/removed.
  // Falls back to the lowest-ID employee ONLY when no one has been assigned
  // the root position yet — that fallback exists purely to prompt the very
  // first assignment; once someone is assigned, they become the permanent
  // anchor and the fallback never overrides them again.
  const rootPosition = allPositions.find(
    (p) => p.status === "1" && (p.reportingTo === "Admin" || p.reportingTo === "Self"),
  );
  const firstEmployee = rootPosition
    ? employees.find((e) => String(e.id) === String(rootPosition.empId)) ?? null
    : (employees.length > 0 ? employees[0] : null);
  const isFirstEmployee         = firstEmployee && String(firstEmployee.id) === String(selEmpId);
  const isFirstEmployeeAssigned = !!rootPosition;

  const assignedEmployeesForReporting = employees.filter(
    (e) => assignedEmpIds.has(String(e.id)) && String(e.id) !== String(selEmpId),
  );

  const enrichedEmployees = employees.map((emp) => ({
    ...emp,
    _assigned: assignedEmpIds.has(String(emp.id)),
  }));

  const isAssigned       = assignedEmpIds.has(String(selEmpId));
  // Effective termination: inactive employee whose EP_EFFICIENT_DATE has passed
  const terminationDate  = currentPosition?.epEfficientDate || null;
  const isTerminatedEffective =
    !isEmployeeActive &&
    !!terminationDate &&
    todayStr() >= terminationDate;

  // ── Payslip cache callbacks (passed to PayslipSection) ───────────────────
  const handlePayslipSaved = (record) => {
    queryClient.setQueryData(["payslips", selEmpId], (prev = []) =>
      [record, ...prev].sort((a, b) => {
        const ya = Number(a.empYear), yb = Number(b.empYear);
        const ma = Number(a.empMonth), mb = Number(b.empMonth);
        return yb !== ya ? yb - ya : mb - ma;
      }),
    );
  };

  const handlePayslipDeleted = (id) => {
    queryClient.setQueryData(["payslips", selEmpId], (prev = []) =>
      prev.filter((x) => x.id !== id),
    );
  };

  // ── Mark Inactive handler ────────────────────────────────────────────────
  const handleMarkInactive = async () => {
    if (!currentPosition || !selectedEmployee) return;
    setMarkError("");

    setMarking(true);
    const today = todayStr();

    try {
      // Step 1 — deactivate position: ACTIVE_STATUS=0, EP_EFFICIENT_DATE=today
      await updateEmpPosition(currentPosition.id, selEmpId, {
        ...currentPosition,
        epEfficientDate: today,
        activeStatus:    "0",
        status:          "0",
      });

      // Step 2 — update employee STATUS='Inactive'
      try {
        await updateEmployee(selEmpId, { ...selectedEmployee, status: "Inactive" });
      } catch (empErr) {
        // Rollback step 1
        try {
          await updateEmpPosition(currentPosition.id, selEmpId, {
            ...currentPosition,
            activeStatus: "1",
            status:       "1",
          });
        } catch {
          setMarkError(
            "Employee status update failed AND rollback failed. " +
            "Please check the data manually."
          );
          setMarking(false);
          return;
        }
        throw new Error(
          `Employee status update failed: ${empErr.message}. ` +
          `Position deactivation has been rolled back.`
        );
      }

      // Both succeeded — refresh queries
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["allEmpPositions"] });
      setMarkConfirm(false);

    } catch (err) {
      setMarkError(err.message || "Failed to mark employee as inactive.");
    } finally {
      setMarking(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="content-section">
      <div className="activity-header" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>HR — Employee Positions</h1>
      </div>

      {/* ── Step 1: Employee selector ──────────────────────────────────────── */}
      <div style={{
        background: "var(--a-surface)",
        border: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
        borderRadius: 14, padding: "20px 24px", marginBottom: 20,
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--a-teal)", marginBottom: 14 }}>
          SELECT EMPLOYEE
        </div>
        <div className="hr-layout-row" style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left — flat list */}
          <div className="hr-layout-left" style={{ flex: "0 0 360px", minWidth: 240 }}>
            <EmpFlatList
              employees={enrichedEmployees}
              loading={empLoading}
              value={selEmpId}
              onChange={(id) => setSelEmpId(id)}
              firstEmployeeId={firstEmployee?.id}
            />
          </div>

          {/* Right — selected employee details */}
          {selectedEmployee ? (
            <div className="hr-layout-right" style={{
              flex: 1, minWidth: 200,
              background: "var(--a-teal-05,rgba(20,184,166,0.05))",
              border: "1px solid var(--a-teal-20,rgba(20,184,166,0.2))",
              borderRadius: 10, padding: "16px 20px",
            }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--a-teal)", marginBottom: 12, textTransform: "uppercase" }}>
                Employee Details
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[
                  { label: "Name",   value: `${selectedEmployee.empName} ${selectedEmployee.empLastName}` },
                  { label: "ID",     value: `#${selectedEmployee.id}` },
                  { label: "Phone",  value: selectedEmployee.empPh   || "—" },
                  { label: "Email",  value: selectedEmployee.empMail || "—" },
                  { label: "Joined", value: selectedEmployee.empDoj  || "—" },
                  { label: "Status", value: selectedEmployee.status  || "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-text-faint)", marginBottom: 2 }}>{label}</div>
                    {label === "Status" ? (
                      <>
                        {/* Desktop: coloured text */}
                        <div className="hr-status-text" style={{ fontSize: "0.88rem", fontWeight: 600, color: value !== "Active" ? "#ef4444" : "var(--a-text)" }}>
                          {value}
                        </div>
                        {/* Mobile: StatusDot (CSS-toggled) */}
                        <div className="hr-status-dot">
                          <StatusDot status={selectedEmployee.status} />
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--a-text)", wordBreak: "break-all" }}>{value}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Inactive status warning ── */}
              {!isEmployeeActive && (
                <div style={{ marginTop: 14, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: "0.82rem", color: "#ef4444", fontWeight: 600 }}>
                  ⚠️ This employee is <strong>{selectedEmployee.status}</strong>. Payslip generation is disabled.
                  {isTerminatedEffective && terminationDate && (
                    <span style={{ display: "block", marginTop: 4, fontWeight: 500 }}>
                      Effective date: {terminationDate}
                    </span>
                  )}
                </div>
              )}

              {/* ── Mark Inactive button — SUPER/ADMIN only, active + assigned employees ── */}
              {canEdit && isEmployeeActive && isAssigned && (
                <div style={{ marginTop: 16 }}>
                  {markConfirm ? (
                    /* ── Confirmation step ── */
                    <div style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 8, padding: "12px 16px",
                    }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ef4444", marginBottom: 10 }}>
                        ⚠️ Mark <strong>{selectedEmployee?.empName}</strong> as Inactive?
                        This will deactivate their position and block payslip generation.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleMarkInactive}
                          disabled={marking}
                          style={{
                            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.5)",
                            borderRadius: 6, color: "#ef4444", padding: "6px 14px",
                            fontWeight: 700, fontSize: "0.78rem",
                            cursor: marking ? "not-allowed" : "pointer",
                            opacity: marking ? 0.6 : 1,
                          }}
                        >
                          {marking ? "Processing…" : "Yes, Mark Inactive"}
                        </button>
                        <button
                          onClick={() => setMarkConfirm(false)}
                          disabled={marking}
                          style={{
                            background: "none", border: "1px solid var(--a-teal-20)",
                            borderRadius: 6, color: "var(--a-text-faint)", padding: "6px 14px",
                            fontWeight: 600, fontSize: "0.78rem",
                            cursor: marking ? "not-allowed" : "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Initial button ── */
                    <button
                      onClick={() => setMarkConfirm(true)}
                      style={{
                        background:   "rgba(239,68,68,0.08)",
                        border:       "1px solid rgba(239,68,68,0.35)",
                        borderRadius: 8, color: "#ef4444",
                        padding:      "8px 18px", fontWeight: 700,
                        fontSize:     "0.8rem", cursor: "pointer",
                        transition:   "opacity 0.15s",
                      }}
                    >
                      🔴 Mark Inactive
                    </button>
                  )}
                </div>
              )}

              {markError && (
                <div style={{ marginTop: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "#ef4444" }}>
                  ❌ {markError}
                  <button
                    onClick={() => setMarkError("")}
                    style={{ marginLeft: 12, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: "0.75rem" }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ) : (
            !empLoading && (
              <div className="hr-layout-right" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", color: "var(--a-text-faint)", fontSize: "0.88rem", border: "1px dashed var(--a-teal-20,rgba(20,184,166,0.2))", borderRadius: 10, fontStyle: "italic" }}>
                ← Click an employee to select them
              </div>
            )
          )}
        </div>
      </div>

      {!selEmpId && !empLoading && (
        <div style={{ textAlign: "center", padding: "32px 24px", color: "var(--a-text-faint)", fontSize: "0.9rem" }}>
          👆 Select an employee to view and manage their positions.
        </div>
      )}

      {/* ── Step 2 & 3: Payslip + Position sections (only when employee selected) ── */}
      {selEmpId && (
        <>
          <PayslipSection
            selectedEmployee={selectedEmployee}
            currentPosition={currentPosition}
            isEmployeeActive={isEmployeeActive}
            terminationDate={terminationDate}
            isTerminatedEffective={isTerminatedEffective}
            payslips={payslips}
            payLoading={payLoading}
            payError={payError}
            onPayslipSaved={handlePayslipSaved}
            onPayslipDeleted={handlePayslipDeleted}
            role={role}
          />
          <PositionSection
            selEmpId={selEmpId}
            selectedEmployee={selectedEmployee}
            isEmployeeActive={isEmployeeActive}
            isFirstEmployee={isFirstEmployee}
            isFirstEmployeeAssigned={isFirstEmployeeAssigned}
            firstEmployee={firstEmployee}
            isSelfReport={selfReports[selEmpId] ?? false}
            onSelfReportToggle={(checked) =>
              setSelfReports((p) => ({ ...p, [selEmpId]: checked }))
            }
            assignedEmployeesForReporting={assignedEmployeesForReporting}
            role={role}
          />
        </>
      )}
    </div>
  );
}