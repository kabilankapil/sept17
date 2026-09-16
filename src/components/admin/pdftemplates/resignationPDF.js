// src/components/admin/pdfTemplates/resignationPDF.js
//
// Relieving Letter — international standard business letter format.
// A4, generous margins, strong typography, professional spacing.
//
// Export (signature unchanged):
//   printResignationLetter({ employee, position, lastWorkingDate })

import {
  esc,
  fmtDate,
  todayDash,
  LOGO_SRC,
  CO,
  openPrintWindow,
} from "./pdfShared";
import { notifyGlobal } from "../shared/ToastContext";

const RESIGN_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  color: #000;
  background: #fff;
  padding: 18mm 20mm 28mm 20mm;
  line-height: 1.8;
}

@media print {
  @page { size: A4; margin: 18mm 20mm 28mm 20mm; }
  body  { padding: 0; }
  html  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

/* ── Company header ──────────────────────────────────────────── */
.letter-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 12px;
}
.co-block    { flex: 1; padding-right: 20px; }
.co-name     { font-size: 26px; font-weight: 900; color: #000; line-height: 1.15; margin-bottom: 6px; }
.co-addr     { font-size: 10px; color: #444; line-height: 1.7; }
.logo-img    { width: 100px; height: 100px; object-fit: contain; flex-shrink: 0; }
.header-rule { border: none; border-top: 3px solid #000; margin: 0 0 0; }

/* ── Title band ──────────────────────────────────────────────────
   Light teal band with dark text — clean, professional.
──────────────────────────────────────────────────────────────── */
.title-band {
  background: #fff;
  color: #000;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  padding: 9px 0;
  margin: 0 0 32px;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
}

/* ── Date ────────────────────────────────────────────────────── */
.date-line {
  text-align: right;
  font-size: 12px;
  color: #000;
  margin-bottom: 32px;
  letter-spacing: 0.3px;
}

/* ── TO WHOMSOEVER ───────────────────────────────────────────── */
.concern-heading {
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 28px;
  text-decoration: underline;
}

/* ── Body text ───────────────────────────────────────────────── */
.body-para {
  font-size: 13.5px;
  line-height: 2.0;
  text-align: justify;
  margin-bottom: 24px;
  color: #000;
}

/* ── Signature ───────────────────────────────────────────────── */
.sign-block {
  margin-top: 70px;
  font-size: 13px;
  line-height: 1.9;
}
.sign-name  { font-weight: 700; font-size: 13px; margin-top: 4px; }
.sign-title { font-size: 12px; color: #333; }

/* ── Footer — fixed at bottom of every printed page ─────────── */
.page-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 1px solid #000;
  background: #fff;
  padding: 6px 20mm;
  text-align: center;
}
.footer-note { font-size: 9.5px; color: #000; letter-spacing: 0.2px; }
`;

function buildResignationLetterHtml({ employee, position, lastWorkingDate }) {
  const empName =
    `${employee.empName || ""} ${employee.empLastName || ""}`.trim();
  const dateStr = todayDash();
  const desig = position?.position || position?.role || "—";
  const dept = position?.department || "";
  const fromDate = fmtDate(employee.empDoj || "—");
  const toDate = fmtDate(lastWorkingDate || "—");
  const companyName = position?.companyName || CO.name;
  const empId = position?.empId ?? employee.id ?? 1;
  const refNo = `REL/LTR/${dateStr}/${empId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Relieving Letter – ${esc(empName)}</title>
  <style>${RESIGN_CSS}</style>
</head>
<body>
<div>

        <!-- Company header -->
        <div class="letter-header">
          <div class="co-block">
            <div class="co-name">${esc(companyName)}</div>
            <div class="co-addr">
              ${esc(CO.addr1)}, ${esc(CO.addr2)}<br/>
              ${esc(CO.state)}<br/>
              ${esc(CO.website)} &nbsp;|&nbsp; ${esc(CO.phone)}<br/>
              ${esc(CO.email)}
            </div>
          </div>
          <img class="logo-img" src="${LOGO_SRC}" alt="Logo"/>
        </div>
        <hr class="header-rule"/>

        <!-- Black title band -->
        <div class="title-band">Relieving Letter</div>

        <!-- Ref + Date -->
        <div class="date-line">
          <strong>Ref:</strong> ${esc(refNo)} &nbsp;&nbsp;&nbsp; <strong>Date:</strong> ${dateStr}
        </div>

        <!-- To Whomsoever -->
        <div class="concern-heading">To Whomsoever It May Concern</div>

        <!-- Body -->
        <p class="body-para">
          This is to certify that <strong>${esc(empName)}</strong> was employed with
          <strong>${esc(companyName)}</strong> as <strong>${esc(desig)}</strong>${dept ? ` in the <strong>${esc(dept)}</strong> department` : ""},
          from <strong>${fromDate}</strong> to <strong>${toDate}</strong>.
        </p>

        <p class="body-para">
          During the period of employment, ${esc(employee.empName || "the employee")} demonstrated
          professionalism, dedication, and a high standard of conduct. All handover formalities have been
          duly completed and the employee stands relieved from services with effect from
          <strong>${toDate}</strong>.
        </p>

        <p class="body-para">
          We wish ${esc(employee.empName || "them")} the very best in all future endeavours.
        </p>

        <!-- Signature -->
        <div class="sign-block">
          <div>For <strong>${esc(companyName)}</strong>,</div>
          <br/><br/><br/>
          <div class="sign-name">Authorised Signatory</div>
          <div class="sign-title">Director</div>
        </div>

        <!-- Footer -->
        <div class="page-footer">
          <div class="footer-note">
            ${esc(companyName)} &nbsp;·&nbsp; ${esc(CO.addr1)}, ${esc(CO.addr2)} &nbsp;·&nbsp; ${esc(CO.email)}
          </div>
        </div>

</div>
</body>
</html>`;
}

export function printResignationLetter({
  employee,
  position,
  lastWorkingDate,
}) {
  try {
    openPrintWindow(
      buildResignationLetterHtml({ employee, position, lastWorkingDate }),
    );
  } catch (e) {
    notifyGlobal("Could not generate resignation letter: " + e.message, "error");
  }
}
