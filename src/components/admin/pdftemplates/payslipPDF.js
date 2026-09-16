import {
  CO_HR,
  MONTHS,
  BASE_CSS,
  logoImgTag,
  fmtCurrency,
  openPrintWindow,
} from "./pdfShared";
import { notifyGlobal } from "../shared/ToastContext";

// ── Payslip CSS ───────────────────────────────────────────────
const PAYSLIP_CSS = `${BASE_CSS}
  body { padding:24px 28px; }

  /* ── Header ── */
  .hdr {
    display:flex; justify-content:space-between; align-items:center;
    padding-bottom:0px; margin-bottom:4px;
  }
  .hdr-logo { flex-shrink:0; }
  .hdr-info  { text-align:right; }
  .co-name   { font-size:32px; font-weight:900; color:#111;
               letter-spacing:-0.5px; line-height:1.15; margin-bottom:4px; }
  .co-meta   { font-size:10.5px; color:#000; line-height:1.75; }

  /* ── Title ── */
  .title {
    text-align:center; font-size:16px; font-weight:700;
    letter-spacing:2px; color:#111; margin:4px 0 8px;
  }

  /* ── Month band ── */
  .month {
    text-align:center; font-size:13px; font-weight:700;
    border-top:2px solid #333; border-bottom:2px solid #333;
    padding:6px 0; margin-bottom:14px; color:#000; letter-spacing:0.4px;
  }

  /* ── Employee info table ── */
  table.emp { width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11.5px; }
  table.emp td { border:none; padding:5px 10px; }
  .lbl  { font-weight:700; white-space:nowrap; }
  .rlbl { font-weight:700; white-space:nowrap; text-align:right; }
  .rval { text-align:right; }
  .emp-name-bg { background:#e5e5e5; font-weight:700; font-size:12px; white-space:nowrap; color:#000; }

  /* ── Salary table ── */
  table.main { width:100%; border-collapse:collapse; }
  table.main th {
    border:1.5px solid #333; padding:8px 10px;
    background:#e5e5e5; color:#000; font-weight:700;
    font-size:10.5px; text-align:center; letter-spacing:0.5px;
  }
  table.main td {
    border:1px solid #bbb; padding:7px 10px;
    font-size:11.5px; vertical-align:top; color:#000;
  }
  .pay-row { display:flex; justify-content:space-between; gap:8px; }
  .pay-row span:last-child { white-space:nowrap; }

  /* alternating row tint */
  table.main tbody tr:nth-child(even) td { background:#f5f5f5; }

  /* totals row */
  tr.total-row td {
    font-weight:700; font-size:12px;
    background:#ebebeb; border:1.5px solid #333; color:#000;
  }

  /* bank label rows — same highlight as column headers */
  table.main td.bank-lbl {
    background:#e5e5e5 !important; color:#000;
    font-weight:700; font-size:10.5px; letter-spacing:0.03em;
  }

  /* ── Footer ── */
  .footer { margin-top:20px; text-align:center; font-size:11.5px; font-weight:600; color:#000; }
`;

// ── Helpers ───────────────────────────────────────────────────
// Currency formatting now comes from the shared fmtCurrency() helper in
// pdfShared.js, so payslip amounts match the hike letter exactly.
const r = fmtCurrency;

// ── Payslip HTML builder ──────────────────────────────────────
export function buildPayslipHtml(employee, position, payMonth, payYear, refId) {
  const empName =
    `${employee.empName || ""} ${employee.empLastName || ""}`.trim();

  const basic = parseFloat(position.empBasic || position.basic || 0);
  const hra = parseFloat(position.empHra || position.hra || 0);
  const allowance = parseFloat(
    position.empAllowance || position.allowancess || 0,
  );
  const tds = parseFloat(position.empTds || position.tds || 0);
  const pt = parseFloat(position.empPt || position.pt || 0);
  const emploan = parseFloat(position.empLoans || position.loan || 0);

  const gross = basic + hra + allowance;
  const deductions = tds + pt + emploan;
  const netSalary = gross - deductions;

  const monthName = MONTHS[(Number(payMonth) || 1) - 1] || "";
  const shortMonth = monthName.substring(0, 3).toUpperCase();
  const shortYear = String(payYear).slice(-2);
  const monthLabel = `${shortMonth}-${shortYear}`;
  const payslipRef = `PAYSLIP/${monthName}/${payYear}/${refId || "—"}`;

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Pay Slip – ${empName} – ${monthLabel}</title>
<style>${PAYSLIP_CSS}</style>
</head><body>

  <!-- ── Header ── -->
  <div class="hdr">
    <div class="hdr-logo">${logoImgTag(130)}</div>
    <div class="hdr-info">
      <div class="co-name">${CO_HR.name}</div>
      <div class="co-meta">
        Regd Office: ${CO_HR.addr1}<br/>
        ${CO_HR.addr2}<br/>
        Phone: ${CO_HR.phone}&nbsp;&nbsp;|&nbsp;&nbsp;Email: ${CO_HR.email}
      </div>
    </div>
  </div>

  <!-- ── Title ── -->
  <div class="title">PAY SLIP</div>

  <!-- ── Month band ── -->
  <div class="month">PAY SLIP FOR MONTH OF &nbsp; ${monthLabel}</div>

  <!-- ── Employee info table ── -->
  <table class="emp">
    <tr>
      <td class="lbl">Employee ID</td>
      <td>${employee.id || "—"}</td>
      <td class="rlbl">Date</td>
      <td class="rval">${dateStr}</td>
    </tr>
    <tr>
      <td class="lbl">PAN Card No:</td>
      <td>${employee.empPan || "—"}</td>
      <td class="rlbl">Designation</td>
      <td class="rval">${position.position || position.empPosition || "—"}</td>
    </tr>
    <tr>
      <td class="lbl">PaySlip Ref:</td>
      <td>${payslipRef}</td>
      <td class="rlbl">Email</td>
      <td class="rval">${employee.empMail || "—"}</td>
    </tr>
    <tr>
      <td class="emp-name-bg">Employee Name</td>
      <td class="emp-name-bg" colspan="3">${empName}</td>
    </tr>
  </table>

  <!-- ── Salary table ── -->
  <table class="main">
    <thead>
      <tr>
        <th style="width:33%">PAYMENTS</th>
        <th style="width:34%">DEDUCTIONS</th>
        <th style="width:33%">BANK NAME</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><div class="pay-row"><span>FIXED PAY</span><span>${r(basic)}</span></div></td>
        <td><div class="pay-row"><span>PROFESSIONAL TAX</span><span>${r(pt)}</span></div></td>
        <td>${employee.empBankName || "—"}</td>
      </tr>
      <tr>
        <td><div class="pay-row"><span>HRA</span><span>${r(hra)}</span></div></td>
        <td><div class="pay-row"><span>TDS DEDUCTIONS</span><span>${r(tds)}</span></div></td>
        <td class="bank-lbl">BANK ACCOUNT NO</td>
      </tr>
      <tr>
        <td><div class="pay-row"><span>ALLOWANCES</span><span>${r(allowance)}</span></div></td>
        <td><div class="pay-row"><span>OTHER DEDUCTIONS</span><span>${r(emploan)}</span></div></td>
        <td>${employee.empAccNo || "—"}</td>
      </tr>
      <tr>
        <td></td>
        <td></td>
        <td class="bank-lbl">BANK BRANCH IFSC CODE</td>
      </tr>
      <tr>
        <td></td>
        <td></td>
        <td>${employee.empIfscCode || "—"}</td>
      </tr>
      <tr class="total-row">
        <td><div class="pay-row"><span>GROSS</span><span>${r(gross)}</span></div></td>
        <td><div class="pay-row"><span>DEDUCTIONS</span><span>${r(deductions)}</span></div></td>
        <td><div class="pay-row"><span>NET SALARY</span><span>${r(netSalary)}</span></div></td>
      </tr>
    </tbody>
  </table>

  <!-- ── Footer ── -->
  <div class="footer">% effort scaling factor &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 1</div>

</body></html>`;
}

// ── Print functions ───────────────────────────────────────────

export function printPayslip({ employee, position, payMonth, payYear, refId }) {
  if (!employee || !position) {
    notifyGlobal(
      "Missing employee or position data for this payslip.",
      "error",
    );
    return;
  }
  try {
    openPrintWindow(
      buildPayslipHtml(employee, position, payMonth, payYear, refId),
    );
  } catch (e) {
    notifyGlobal("Could not generate payslip: " + e.message, "error");
  }
}

export function printPayslipFromRecord({ employee, currentPosition, record }) {
  if (!employee || !record) {
    notifyGlobal("Missing employee or payslip record data.", "error");
    return;
  }
  try {
    openPrintWindow(
      buildPayslipHtml(
        employee,
        {
          position: currentPosition?.position || "—",
          basic: record.basic,
          hra: record.hra,
          allowancess: record.allowancess,
          tds: record.tds,
          pt: record.pt,
          loan: record.loan,
        },
        Number(record.empMonth),
        Number(record.empYear),
        record.id,
      ),
    );
  } catch (e) {
    notifyGlobal("Could not generate payslip: " + e.message, "error");
  }
}
