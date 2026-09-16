import { useState } from "react";
import { createPayslip, deletePayslip } from "../../../api/employee";
import { labelStyle, inputStyle, fmt, canDelete, thStyle, tdBase, tdNowrap } from "../shared/adminStyles";
import { ConfirmDelete } from "../shared/AdminTable";
import { useToast } from "../shared/ToastContext";
import DatePicker from "../DatePicker";
import {
  printPayslip, printPayslipFromRecord,
  printOfferLetter, printPromotionLetter,
  printHikeLetter, printResignationLetter,
} from "../PDFTemplates";
import { MONTHS } from "./hrConstants";

export default function PayslipSection({
  selectedEmployee,
  currentPosition,
  isEmployeeActive,
  terminationDate,
  isTerminatedEffective,
  payslips,
  payLoading,
  payError,
  onPayslipSaved,
  onPayslipDeleted,
  role,
}) {
  const toast = useToast();
  const now   = new Date();

  const [payMonth,      setPayMonth]      = useState(now.getMonth() + 1);
  const [payYear,       setPayYear]       = useState(now.getFullYear());
  const [payGenerating, setPayGenerating] = useState(false);
  const [payConfirmKey, setPayConfirmKey] = useState(null);
  const [docPanel,      setDocPanel]      = useState(null);

  const [termInputs,    setTermInputs]    = useState({ lastDate: "" });

  // ── Payslip generation ────────────────────────────────────────────────────
  const handleGeneratePayslip = async () => {
    if (!selectedEmployee) { toast.error("Select an employee first."); return; }
    if (!currentPosition)  { toast.error("No active position found for this employee."); return; }
    if (isTerminatedEffective) {
      toast.error(`Payslip cannot be generated — employee inactive as of ${terminationDate}.`);
      return;
    }
    if (!isEmployeeActive) {
      toast.error(`Cannot generate payslip — employee is "${selectedEmployee.status}".`);
      return;
    }

    const grossCheck =
      parseFloat(currentPosition.empBasic     || 0) +
      parseFloat(currentPosition.empHra       || 0) +
      parseFloat(currentPosition.empAllowance || 0);
    if (grossCheck === 0) {
      toast.error("Salary is ₹0 — update position with salary details first.");
      return;
    }

    const dup = payslips.find(
      (p) => String(p.empMonth) === String(payMonth) && String(p.empYear) === String(payYear),
    );
    if (dup) {
      toast.error(`Payslip for ${MONTHS[payMonth - 1]} ${payYear} already exists. Delete it first.`);
      return;
    }

    setPayGenerating(true);
    try {
      const payData = {
        empMonth: String(payMonth), empYear: String(payYear),
        basic:       currentPosition.empBasic     || "0",
        hra:         currentPosition.empHra       || "0",
        allowancess: currentPosition.empAllowance || "0",
        tds:         currentPosition.empTds       || "0",
        pt:          currentPosition.empPt        || "0",
        loan:        currentPosition.empLoans     || "0",
      };
      const saved = await createPayslip(selectedEmployee.id, payData);
      onPayslipSaved(saved);
      toast.success?.(`Payslip for ${MONTHS[payMonth - 1]} ${payYear} saved.`);
      printPayslip({
        employee: selectedEmployee,
        position: currentPosition,
        payMonth, payYear, refId: saved.id,
      });
    } catch (e) {
      toast.error(e.message || "Failed to save payslip.");
    } finally {
      setPayGenerating(false);
    }
  };

  const handleDeletePayslip = async (id) => {
    try {
      await deletePayslip(id);
      onPayslipDeleted(id);
    } catch (e) {
      toast.error(e.message || "Failed to delete payslip.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Document generation ─────────────────────────────────────────── */}
      <div style={{
        background: "var(--a-surface)",
        border: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
        borderRadius: 14, padding: "18px 20px", marginBottom: 20,
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--a-teal)", marginBottom: 14 }}>
          📄 GENERATE DOCUMENTS
        </div>

        {!currentPosition ? (
          <p style={{ fontSize: "0.82rem", color: "var(--a-text-faint)", fontStyle: "italic" }}>
            Assign a position to this employee before generating documents.
          </p>
        ) : (
          <>
            {/* ── Payslip controls ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: "0.68rem", fontWeight: 700, color: "var(--a-text-faint)",
                marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                Payslip Month / Year
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <select
                  className="activity-input"
                  style={{ ...inputStyle, minWidth: 110, flex: "1 1 110px" }}
                  value={payMonth}
                  onChange={(e) => setPayMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <input
                  className="activity-input"
                  style={{ ...inputStyle, width: 80, flex: "0 0 80px" }}
                  type="number" min="2000" max="2100"
                  value={payYear}
                  onChange={(e) => setPayYear(Number(e.target.value))}
                />
                <button
                  className="act-btn act-save"
                  style={{
                    flex: "1 1 180px", whiteSpace: "nowrap",
                    ...((!isEmployeeActive || isTerminatedEffective) && !payGenerating
                      ? { opacity: 0.55, cursor: "not-allowed" }
                      : {}),
                  }}
                  disabled={payGenerating}
                  title={
                    isTerminatedEffective
                      ? `Employee inactive as of ${terminationDate} — payslip generation blocked`
                      : !isEmployeeActive
                      ? `Employee is ${selectedEmployee?.status} — blocked`
                      : "Generate and save payslip"
                  }
                  onClick={handleGeneratePayslip}
                >
                  {payGenerating ? "Saving…" : "💾 Generate & Save Payslip"}
                </button>
              </div>
            </div>

            {/* ── Letter buttons ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                className={`act-btn ${docPanel === "offer" ? "act-save" : "act-edit"}`}
                onClick={() => { printOfferLetter({ employee: selectedEmployee, position: currentPosition }); }}
              >
                📋 Offer Letter
              </button>
              <button
                className={`act-btn ${docPanel === "promotion" ? "act-save" : "act-edit"}`}
                onClick={() => { printPromotionLetter({ employee: selectedEmployee, position: currentPosition }); }}
              >
                🎖 Promotion Letter
              </button>
              <button
                className="act-btn act-edit"
                onClick={() => { printHikeLetter({ employee: selectedEmployee, position: currentPosition }); }}
              >
                💰 Hike Letter
              </button>
              <button
                className={`act-btn ${docPanel === "resignation" ? "act-delete" : "act-edit"}`}
                onClick={() => setDocPanel((p) => p === "resignation" ? null : "resignation")}
              >
                🚪 Resignation Letter
              </button>
            </div>

            {/* Resignation letter sub-panel */}
            {docPanel === "resignation" && (
              <div style={{
                background: "rgba(239,68,68,0.04)",
                border: "2px solid rgba(239,68,68,0.3)", borderRadius: 10,
                padding: "16px", marginTop: 12,
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ef4444", marginBottom: 12 }}>
                  🚪 RESIGNATION LETTER — Extra Details
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={labelStyle}>Last Working Day</label>
                    <DatePicker label="" value={termInputs.lastDate}
                      onChange={(v) => setTermInputs((p) => ({ ...p, lastDate: v }))} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="act-btn act-delete" onClick={() => {
                      if (!termInputs.lastDate) { toast.error("Last Working Day is required."); return; }
                      printResignationLetter({ employee: selectedEmployee, position: currentPosition, lastWorkingDate: termInputs.lastDate });
                      setDocPanel(null);
                    }}>📄 Generate</button>
                    <button className="act-btn act-cancel" onClick={() => setDocPanel(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Payslip history — single unified list (no duplicate desktop/mobile) ── */}
      <div style={{
        background: "var(--a-surface)",
        border: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
        borderRadius: 14, overflow: "hidden", marginBottom: 20,
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,var(--a-teal-15,rgba(20,184,166,0.15)),var(--a-teal-08,rgba(20,184,166,0.08)))",
          borderBottom: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--a-teal)" }}>🗂 Payslip History</span>
          {payLoading
            ? <span style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>Loading…</span>
            : <span style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>{payslips.length} record{payslips.length !== 1 ? "s" : ""}</span>
          }
        </div>

        {/* Scrollable table — works on both desktop and mobile */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 480, tableLayout: "auto", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, minWidth: 80 }}>MONTH</th>
                <th style={{ ...thStyle, minWidth: 60 }}>YEAR</th>
                <th style={{ ...thStyle, minWidth: 100 }}>GROSS (₹)</th>
                <th style={{ ...thStyle, minWidth: 110 }}>DEDUCTIONS (₹)</th>
                <th style={{ ...thStyle, minWidth: 110 }}>NET SALARY (₹)</th>
                <th style={{ ...thStyle, width: 90, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="activity-empty">
                   {payLoading
                      ? "Loading…"
                      : payError
                      ? "Failed to load payslips. Please try again."
                      : 'No payslips found. Use "Generate & Save Payslip" above.'}
                  </td>
                </tr>
              ) : payslips.map((ps, idx) => {
                const gross = parseFloat(ps.totalGross     || 0);
                const ded   = parseFloat(ps.totalDeduction || 0);
                const net   = gross - ded;
                const mName = MONTHS[Number(ps.empMonth) - 1] || ps.empMonth;
                return (
                  <tr key={ps.id} style={{ background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04,rgba(20,184,166,0.04))" }}>
                    <td style={{ ...tdBase, fontWeight: 600 }}>{mName}</td>
                    <td style={tdNowrap}>{ps.empYear}</td>
                    <td style={{ ...tdBase, color: "var(--a-teal)", fontWeight: 600 }}>{fmt(gross)}</td>
                    <td style={{ ...tdBase, color: "#ef4444" }}>{fmt(ded)}</td>
                    <td style={{ ...tdBase, fontWeight: 700 }}>{fmt(net)}</td>
                    <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button
                        title="Download payslip"
                        className="act-btn act-edit"
                        style={{ marginRight: 4 }}
                        onClick={() => printPayslipFromRecord({ employee: selectedEmployee, currentPosition, record: ps })}
                      >
                        📄
                      </button>
                      {canDelete(role) && (
                        payConfirmKey === `pay-${ps.id}` ? (
                          <ConfirmDelete
                            onConfirm={() => { setPayConfirmKey(null); handleDeletePayslip(ps.id); }}
                            onCancel={() => setPayConfirmKey(null)}
                          />
                        ) : (
                          <button
                            title="Delete payslip"
                            className="act-btn act-delete"
                            onClick={() => setPayConfirmKey(`pay-${ps.id}`)}
                          >
                            🗑️
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}