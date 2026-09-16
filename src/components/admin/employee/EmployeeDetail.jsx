// ── employee/EmployeeDetail.jsx ───────────────────────────────────────────────
import { inputStyle } from "../shared/adminStyles";
import { fmt } from "../shared/adminStyles";
import Btn from "../shared/Btn";
import { printPayslipFromRecord } from "../PDFTemplates";
import { MONTHS, YEARS } from "./employeeConstants";

export default function EmployeeDetail({
  view, role, payslips, psLoading,
  selMonth, setSelMonth, selYear, setSelYear,
  currentPosition, isEmployeeActive, generating, handleGenerate,
  onBack, onEdit,
}) {
  const emp           = view.employee;
  const activePayslip = payslips.find(
    (p) => String(p.empMonth) === String(selMonth) && String(p.empYear) === String(selYear),
  ) ?? null;
  const hasPayslip    = !!activePayslip;
  const hasPosition   = !!currentPosition;

  // Salary preview from the active position (same source HR uses)
  const basic      = parseFloat(currentPosition?.empBasic     || 0);
  const hra        = parseFloat(currentPosition?.empHra       || 0);
  const allowance  = parseFloat(currentPosition?.empAllowance || 0);
  const tds        = parseFloat(currentPosition?.empTds       || 0);
  const pt         = parseFloat(currentPosition?.empPt        || 0);
  const loans      = parseFloat(currentPosition?.empLoans     || 0);
  const totalGross = basic + hra + allowance;
  const totalDed   = tds + pt + loans;
  const netPay     = totalGross - totalDed;
  const hasSalary  = totalGross > 0;

  const canGenerateRole = role === "SUPER" || role === "ADMIN";

  return (
    <div className="content-section">
      <div className="activity-header" style={{ alignItems: "center", marginBottom: 20 }}>
        <div className="act-breadcrumb">
          <button onClick={onBack} className="act-back-btn">← Employees</button>
          <span className="act-breadcrumb-label">/ <strong>{emp.empName} {emp.empLastName}</strong></span>
        </div>
        {canGenerateRole && <Btn variant="teal" onClick={() => onEdit(emp)}>✏️ Edit</Btn>}
      </div>

      {/* Employee info card */}
      <div style={{ background: "var(--a-surface)", border: "1px solid var(--a-border-card, rgba(20,184,166,0.2))", borderRadius: 14, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ background: "linear-gradient(135deg, var(--a-teal-15,rgba(20,184,166,0.15)), var(--a-teal-08,rgba(20,184,166,0.08)))", borderBottom: "1px solid var(--a-border-card, rgba(20,184,166,0.2))", padding: "18px 28px" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--a-teal)", marginBottom: 4 }}>Employee ID #{emp.id}</div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "var(--a-text)" }}>{emp.empName} {emp.empLastName}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {[
            { label: "Phone",   value: emp.empPh       || "—", icon: "📞" },
            { label: "Email",   value: emp.empMail     || "—", icon: "✉️" },
            { label: "PAN",     value: emp.empPan      || "—", icon: "🪪" },
            { label: "Aadhaar", value: emp.empAdhar    || "—", icon: "🪪" },
            { label: "DOB",     value: emp.empDob      || "—", icon: "📅" },
            { label: "Joining", value: emp.empDoj      || "—", icon: "📅" },
            { label: "Bank",    value: emp.empBankName || "—", icon: "🏦" },
            { label: "IFSC",    value: emp.empIfscCode || "—", icon: "🔢" },
            { label: "Acc No",  value: emp.empAccNo    || "—", icon: "🔢" },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ padding: "14px 22px", borderRight: "1px solid var(--a-border-card, rgba(20,184,166,0.1))", borderBottom: "1px solid var(--a-border-card, rgba(20,184,166,0.1))" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-text-faint)", marginBottom: 4 }}>{icon} {label}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--a-text)", wordBreak: "break-all" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payslip section */}
      <div style={{ background: "var(--a-surface)", border: "1px solid var(--a-border-card, rgba(20,184,166,0.2))", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        {/* Header with month/year pickers */}
        <div style={{ background: "linear-gradient(135deg, var(--a-teal-15,rgba(20,184,166,0.15)), var(--a-teal-08,rgba(20,184,166,0.08)))", borderBottom: "1px solid var(--a-border-card, rgba(20,184,166,0.2))", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--a-teal)" }}>
            📄 Payslip
            {psLoading && <span style={{ marginLeft: 8, fontSize: "0.75rem", opacity: 0.6 }}>Loading…</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <select className="activity-input" style={{ ...inputStyle, width: 140, marginBottom: 0 }}
              value={selMonth}
              onChange={(e) => setSelMonth(e.target.value)}>
              <option value="">— Month —</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
            <select className="activity-input" style={{ ...inputStyle, width: 90, marginBottom: 0 }}
              value={selYear}
              onChange={(e) => setSelYear(e.target.value)}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          {/* Inactive employee warning — takes priority over the position warning */}
          {!isEmployeeActive && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: "0.82rem", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--a-danger,#ef4444)", fontWeight: 600 }}>
              ⚠ This employee is <strong>{emp.status}</strong>. Payslip generation is disabled.
            </div>
          )}

          {/* No position warning */}
          {isEmployeeActive && !hasPosition && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: "0.82rem", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--a-danger,#ef4444)", fontWeight: 600 }}>
              ⚠ No active position assigned. Go to the <strong>HR tab</strong> to assign a position and salary before generating payslips.
            </div>
          )}

          {/* Salary preview from current position */}
          {hasPosition && (
            <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Basic",       value: fmt(basic),      color: "var(--a-teal)" },
                { label: "HRA",         value: fmt(hra),         color: "var(--a-teal)" },
                { label: "Allowance",   value: fmt(allowance),   color: "var(--a-teal)" },
                { label: "Gross",       value: fmt(totalGross),  color: "var(--a-teal)", bold: true },
                { label: "Deductions",  value: fmt(totalDed),    color: "#ef4444" },
                { label: "Net Pay",     value: fmt(netPay),      color: "var(--a-text)", bold: true },
              ].map(({ label, value, color, bold }) => (
                <div key={label} style={{ padding: "8px 14px", background: "var(--a-teal-05,rgba(20,184,166,0.05))", border: "1px solid var(--a-teal-20,rgba(20,184,166,0.15))", borderRadius: 8, minWidth: 90 }}>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "var(--a-text-faint)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: bold ? 700 : 600, color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Payslip status for selected month */}
          {selMonth && !psLoading && (
            <div style={{ marginBottom: 16, padding: "9px 14px", borderRadius: 8, fontSize: "0.82rem", background: hasPayslip ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)", border: `1px solid ${hasPayslip ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`, color: hasPayslip ? "#15803d" : "var(--a-danger,#ef4444)" }}>
              {hasPayslip
                ? `✅ Payslip exists for ${MONTHS[Number(activePayslip.empMonth) - 1]} ${activePayslip.empYear}.`
                : `⚠ No payslip for ${MONTHS[Number(selMonth) - 1]} ${selYear}.${hasPosition && hasSalary ? " Click Generate to create." : ""}`}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            {canGenerateRole && isEmployeeActive && !hasPayslip && selMonth && hasPosition && hasSalary && (
              <Btn variant="primary" onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating…" : "Generate Payslip"}
              </Btn>
            )}
            <button
              onClick={() => hasPayslip && printPayslipFromRecord({ employee: emp, currentPosition, record: activePayslip })}
              disabled={!hasPayslip}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 18px", borderRadius: 7, fontSize: "0.83rem", fontWeight: 700, border: "none", cursor: hasPayslip ? "pointer" : "not-allowed", background: hasPayslip ? "var(--a-teal)" : "var(--a-teal-08)", color: hasPayslip ? "#fff" : "var(--a-text-faint)", opacity: hasPayslip ? 1 : 0.5 }}
              title={hasPayslip ? "Open printable payslip" : "Generate a payslip first"}
            >
              ⬇ Download Payslip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}