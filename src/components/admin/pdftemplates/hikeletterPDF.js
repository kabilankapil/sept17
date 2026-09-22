// src/components/admin/pdfTemplates/hikeletterPDF.js
//
// Salary Revision / Pay Hike Letter — standalone document.
//
// Uses the shared LETTER_CSS (teal corporate theme) and the unified
// fmtCurrency() formatter so the salary breakup table matches the
// payslip's number formatting exactly.

import {
  LOGO_SRC,
  CO,
  esc,
  fmtDate,
  fmtCurrency,
  todayDash,
  todayStr,
  openPrintWindow,
} from "./pdfShared";
import { notifyGlobal } from "../shared/ToastContext";

function buildHikeLetterHtml({
  employee,
  position,
}) {
  const empName =
    `${employee.empName || ""} ${employee.empLastName || ""}`.trim();
  const firstName = employee.empName || empName;
  const effDate = position.epEfficientDate || todayStr();
  const basic = parseFloat(position.empBasic || 0);
  const hra = parseFloat(position.empHra || 0);
  const allowance = parseFloat(position.empAllowance || 0);
  const gross = parseFloat(
    position.empMonthGross || position.empCtc || basic + hra + allowance,
  );
  const dateStr = todayDash();

  const effDateObj = effDate ? new Date(effDate) : new Date();
  const monthLabel = effDateObj
    .toLocaleString("en-IN", { month: "long", year: "numeric" })
    .toUpperCase()
    .replace(" ", "-");

  const annualGross = (gross * 12).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Salary Revision Letter – ${empName}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  color: #000;
  background: #fff;
  padding: 18mm 20mm 28mm 20mm;
  line-height: 1.8;
}
@media print {
  @page { size: A4; margin: 18mm 20mm 28mm 20mm; }
  body { padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

/* ── Header ── */
.letter-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 12px;
}
.co-block { flex: 1; padding-right: 20px; }
.co-name  { font-size: 26px; font-weight: 900; color: #000; line-height: 1.15; margin-bottom: 6px; }
.co-addr  { font-size: 10px; color: #444; line-height: 1.7; }
.logo-img { width: 100px; height: 100px; object-fit: contain; flex-shrink: 0; }

/* ── Title band ── */
.title-band {
  background: #fff;
  color: #000;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 9px 0;
  margin: 0 0 16px;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
}

/* ── Ref / meta row ── */
.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  margin-bottom: 4px;
}
.meta-left { width: 50%; }
.meta-right { width: 50%; display: flex; flex-direction: column; align-items: flex-start; padding-left: 20px; }
.meta-right div { display: flex; justify-content: space-between; width: 100%; }
.meta-right span.label { font-weight: 700; min-width: 110px; }

/* ── TO block ── */
.to-block { font-size: 11.5px; margin-bottom: 16px; }

/* ── Body text ── */
.body-text { font-size: 12px; margin-bottom: 16px; line-height: 1.9; }
.body-text p { margin-bottom: 6px; }
.indent { padding-left: 40px; }

/* ── Payment table ── */
.pay-table { width: 100%; border-collapse: collapse; margin: 0 0 10px; font-size: 12px; }
.pay-table .section-head td {
  font-weight: 700;
  padding: 4px 0 2px 40px;
  font-size: 12px;
}
.pay-table .pay-row td {
  color: #00008b;
  padding: 3px 8px 3px 40px;
  border-bottom: 1px solid #00008b;
  font-weight: 600;
  text-transform: uppercase;
}
.pay-table .pay-row td.amount {
  text-align: right;
  padding-right: 8px;
}
.pay-table .spacer td { padding: 6px 0; border-bottom: 1px solid #ccc; }
.pay-table .total-row td {
  padding: 4px 8px 4px 40px;
  font-size: 12px;
  border-bottom: 1px solid #000;
}
.pay-table .total-row td.amount { text-align: right; padding-right: 8px; }

/* ── Footer ── */
.page-footer {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  border-top: 1px solid #000;
  background: #fff;
  padding: 6px 20mm;
  text-align: center;
  font-size: 9.5px;
  color: #000;
  letter-spacing: 0.2px;
}
</style>
</head><body>

<!-- Company header -->
<div class="letter-header">
  <div class="co-block">
    <div class="co-name">${esc(position?.companyName || CO.name)}</div>
    <div class="co-addr">
      ${esc(CO.addr1)}, ${esc(CO.addr2)}<br/>
      ${esc(CO.state)}<br/>
      ${esc(CO.website)} &nbsp;|&nbsp; ${esc(CO.phone)}<br/>
      ${esc(CO.email)}
    </div>
  </div>
  <img src="${LOGO_SRC}" alt="Logo" class="logo-img"/>
</div>
<hr style="border:none;border-top:3px solid #000;margin:0 0 0;"/>

<!-- Title band -->
<div class="title-band">PAY HIKE FOR MONTH OF - ${monthLabel}</div>

<!-- Ref + meta -->
<div style="display:flex;font-size:11.5px;margin-bottom:2px;">
  <div style="width:50%;">
    <div><strong>REF NO :</strong> PYHK/LTR/${dateStr}/${employee.id || 1}</div>
    <div style="margin-top:4px;"><strong>TO</strong></div>
    <div style="padding-left:8px;">
      ${esc(empName)},<br/>
      ${esc(employee.empAddress1 || "")},<br/>
      ${employee.empAddress2 ? esc(employee.empAddress2) + ",<br/>" : ""}${esc(employee.empAddress3 || "")}
    </div>
  </div>
  <div style="width:50%;padding-left:20px;">
    <div style="display:flex;justify-content:space-between;"><span><strong>DATE :</strong></span><span>${dateStr}</span></div>
    <div style="display:flex;justify-content:space-between;"><span><strong>DESIGNATION :</strong></span><span>${esc(position.position || "—")}</span></div>
    <div style="display:flex;justify-content:space-between;"><span><strong>EMAIL :</strong></span><span>${esc(employee.empMail || "—")}</span></div>
    <div style="display:flex;justify-content:space-between;"><span><strong>CURRENCY :</strong></span><span>INR</span></div>
  </div>
</div>

<br/>

<!-- Body -->
<div class="body-text">
  <p>DEAR ${esc(firstName)},</p>
  <p class="indent">We are pleased to communicate to you that based on the Performance appraisal your salary is ${fmtCurrency(gross)} revised and the new monthly salary is as follows</p>
</div>

<!-- Payment table -->
<table class="pay-table">
  <tr class="section-head"><td colspan="2">Payment</td></tr>
  <tr class="pay-row">
    <td>FIXED PAY</td>
    <td class="amount">${fmtCurrency(basic)}</td>
  </tr>
  <tr class="pay-row">
    <td>HRA</td>
    <td class="amount">${fmtCurrency(hra)}</td>
  </tr>
  <tr class="pay-row">
    <td>OTHER ALLOWANCE</td>
    <td class="amount">${fmtCurrency(allowance)}</td>
  </tr>
  <tr class="total-row">
    <td>Gross Annual Salary</td>
    <td class="amount">${fmtCurrency(annualGross)}</td>
  </tr>
</table>

<br/>
<div class="body-text">
  <p>New salary will be implemented from ${fmtDate(effDate)} &nbsp; till further communication on salary revision.</p>
</div>

<br/>
<div style="font-size:12px;">With Regards</div>

<br/><br/><br/><br/><br/>

<div style="font-size:12px;">(Authorised signatory)</div>

<!-- Footer -->
<div class="page-footer">
  ${esc(position?.companyName || CO.name)} &nbsp;·&nbsp; ${esc(CO.addr1)}, ${esc(CO.addr2)} &nbsp;·&nbsp; ${esc(CO.email)}
</div>

</body></html>`;
}

export function printHikeLetter({
  employee,
  position,
}) {
  if (!position) {
    notifyGlobal("No active position found for this employee.", "error");
    return;
  }
  try {
    openPrintWindow(
      buildHikeLetterHtml({ employee, position }),
    );
  } catch (e) {
    notifyGlobal("Could not generate hike letter: " + e.message, "error");
  }
}
