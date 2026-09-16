// src/components/admin/pdfTemplates/appointmentPDF.js
//
// Appointment (Offer) Letter and Promotion Letter.
//
// Layout matches the printed PDF exactly:
//   • Page 1  : company name + address LEFT, logo TOP-RIGHT, thick black rule below
//   • Pages 2+: logo top-right corner on every page (via repeating <thead>)
//   • Margins : 14mm all sides (openPrintWindow injects @page margin:14mm 10mm)
//   • Headings: plain black uppercase
//   • Body    : justified, Arial 12px
//   • Footer  : Sincerely → Managing Director → Declaration & Acknowledgment
//
// HOW THE PAGE-1 / PAGES-2+ HEADER SPLIT WORKS (pure CSS, no JS):
//
//   Chrome natively repeats <thead> on every printed page — including page 1.
//   To prevent the small repeat-logo from appearing on page 1:
//
//   1. The <thead> contains the small right-aligned logo (repeat header).
//   2. The <thead> logo cell has a negative margin-top trick: the logo is wrapped
//      in a div with margin-top equal to NEGATIVE the thead's own rendered height.
//      This is NOT the approach used here.
//
//   Instead we use the COVER approach:
//   1. <thead> contains the small logo in a right-aligned cell.
//   2. The FIRST ROW of <tbody> contains the full page-1 header with
//      position:relative, z-index:10, and a white background.
//   3. That first tbody row has a NEGATIVE margin-top (via a wrapper div with
//      margin-top: -(THEAD_H)px) so it pulls up to overlap the thead on page 1.
//      The white-background full header visually covers the thead logo on page 1.
//   4. On pages 2+, the <thead> logo prints at the top as normal; the tbody
//      first row is long gone — only the thead repeats.
//
//   THEAD_H is the rendered height of the thead: logo 70px + padding-bottom 8px = 78px.
//   We pull the tbody first row up by 78px so the full header covers the logo.
//
// Exports (unchanged — existing callers need no changes):
//   printOfferLetter({ employee, position })
//   printPromotionLetter({ employee, position })

import {
  esc,
  fmtDate,
  todayDash,
  todayStr,
  LOGO_SRC,
  CO,
  openPrintWindow,
} from "./pdfShared";
import { notifyGlobal } from "../shared/ToastContext";

// ─────────────────────────────────────────────────────────────────────────────
// Thead height constant — keep in sync with .repeat-logo height + thead padding
// ─────────────────────────────────────────────────────────────────────────────
const THEAD_H = 78; // px  (logo 70px + padding-bottom 8px)

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const APPT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  color: #000;
  background: #fff;
  padding: 14mm 14mm 14mm 14mm;
  line-height: 1.75;
}

@media print {
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  body  { padding: 0; }
  html  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}

/* ── Outer layout table ──────────────────────────────────────────
   thead  → small logo, repeats on every page (Chrome native behaviour)
   tbody  → all document content; first row pulls up to cover thead on page 1
──────────────────────────────────────────────────────────────── */
.layout-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

/* ── Repeating thead: small logo, right-aligned ─────────────────
   Visible only during @media print.
   Chrome repeats this on EVERY page, including page 1.
   On page 1 it is visually covered by .page1-header (see below).
──────────────────────────────────────────────────────────────── */
.repeat-head td {
  padding: 0 0 8px 0;
  text-align: right;
  vertical-align: top;
}
.repeat-logo {
  width: 70px;
  height: 70px;
  object-fit: contain;
  display: block;
  margin-left: auto;
}

@media screen {
  /* On screen: hide the repeat thead entirely — the full header is visible */
  .repeat-head { display: none; }
}
@media print {
  /* On print: show the thead so Chrome can repeat it on pages 2+ */
  .repeat-head { display: table-header-group; }
}

/* ── tbody wrapper ───────────────────────────────────────────── */
.layout-body td {
  padding: 0;
  vertical-align: top;
}

/* ── Page-1 cover wrapper ────────────────────────────────────────
   This div sits as the very first element inside the single tbody <td>.
   In print it is pulled up by THEAD_H pixels so it overlaps and covers
   the repeated thead logo that Chrome places at the top of page 1.
   It has a solid white background so the logo underneath is hidden.
   On pages 2+ this div is not near the top of any page, so it has
   no effect on the thead logo that repeats there.
──────────────────────────────────────────────────────────────── */
.page1-cover {
  /* screen: normal flow — no negative margin needed */
}
@media print {
  .page1-cover {
    position: relative;          /* establish stacking context         */
    margin-top: -${THEAD_H}px;  /* pull up to overlap the thead area  */
    padding-top: ${THEAD_H}px;  /* restore inner spacing so content   */
                                 /* appears at the correct position    */
    background: #fff;            /* white cover hides the thead logo   */
    z-index: 10;                 /* paint above thead                  */
  }
}

/* ── Page-1 header: company name LEFT, logo RIGHT ────────────── */
.letter-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 10px;
}
.co-block { flex: 1; padding-right: 14px; }
.co-name  { font-size: 28px; font-weight: 900; color: #000; line-height: 1.1; margin-bottom: 4px; }
.co-addr  { font-size: 10.5px; color: #000; line-height: 1.65; }
.logo-img { width: 110px; height: 110px; object-fit: contain; flex-shrink: 0; margin-top: 2px; }

/* ── Thick black rule under header ────────────────────────────── */
.header-rule { border: none; border-top: 3px solid #000; margin: 8px 0 16px; }

/* ── Ref / date row ─────────────────────────────────────────────── */
.ref-date {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 11.5px;
}
.ref-date .ref  { font-style: italic; font-weight: 700; }
.ref-date .date { font-weight: 400; }

/* ── Employee address block ──────────────────────────────────── */
.addr { margin-bottom: 14px; font-size: 12px; line-height: 1.85; }

/* ── Document subject / title ────────────────────────────────── */
.doc-title {
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  margin: 10px 0 14px;
  color: #000;
}

/* ── Section headings — plain black uppercase ──────────────── */
h2 {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  color: #000;
  margin: 22px 0 8px;
  page-break-after: avoid;
  break-after: avoid;
}

/* ── Body paragraphs ─────────────────────────────────────────── */
p { font-size: 12px; margin-bottom: 10px; text-align: justify; line-height: 1.75; }

/* ── Ordered lists ───────────────────────────────────────────── */
ol { font-size: 12px; padding-left: 20px; margin: 0 0 8px; }
ol li {
  margin-bottom: 8px;
  text-align: justify;
  line-height: 1.75;
  page-break-inside: avoid;
  break-inside: avoid;
}
ol.alpha { list-style-type: lower-alpha; }
ol.roman { list-style-type: lower-roman; padding-left: 26px; }

/* ── Section wrapper ─────────────────────────────────────────── */
.section { page-break-inside: avoid; break-inside: avoid; }

/* ── Signature block ─────────────────────────────────────────── */
.sign-section { margin-top: 30px; font-size: 12px; line-height: 2.0; }
.sign-gap     { margin-top: 48px; }

/* ── Declaration ─────────────────────────────────────────────── */
.declare {
  margin-top: 28px;
  padding-top: 14px;
  font-size: 14px;
  font-weight: 700;
  page-break-inside: avoid;
  break-inside: avoid;
}
.declare-body { font-size: 12px; font-weight: 400; margin-top: 6px; line-height: 2.0; }
.field-line   { margin-top: 10px; font-size: 12px; line-height: 2.4; }
.field-line p { margin: 0; text-align: left; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Page-1 header block (company name LEFT, logo RIGHT)
// ─────────────────────────────────────────────────────────────────────────────
function letterHeader() {
  return `
<div class="letter-header">
  <div class="co-block">
    <div class="co-name">${esc(CO.name)}</div>
    <div class="co-addr">
      ${esc(CO.addr1)},${esc(CO.addr2)}.<br/>
      ${esc(CO.state)}.Website:${esc(CO.website)},Phone: ${esc(CO.phone)}<br/>
      Email: ${esc(CO.email)}.
    </div>
  </div>
  <img class="logo-img" src="${LOGO_SRC}" alt="MosIC Logo" />
</div>
<hr class="header-rule"/>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Terms & conditions — sections 1–10 (wording matches printed PDF exactly)
// ─────────────────────────────────────────────────────────────────────────────
function termsAndConditionsHtml({
  effDate,
  ctcDisplay,
  companyName,
  companyShort,
}) {
  const co = esc(companyName);
  const cos = esc(companyShort);
  return `
<div class="section"><h2>1.Appointment</h2><ol>
  <li>Your date of appointment is effective from <strong>${fmtDate(effDate)}</strong>.</li>
  <li>You will be liable to be transferred in such capacity as the company may from time to time determine
  to any other location, department, function, establishment, or branch of the company or its subsidiary,
  associate or affiliate Company. In such case you will be governed by the terms and conditions of service
  applicable to the new assignment.</li>
  <li>The age of retirement is 58 Years.</li>
</ol></div>

<div class="section"><h2>2.Compensation</h2>
<p>You will be eligible to receive the following:</p>
<ol class="alpha">
  <li>Annual pay (CTC) of <strong>${ctcDisplay}</strong> Per Annum.</li>
  <li>You are entitled to other compensation and benefits in accordance with the company policy as
  modified and inimated to you from time to time.</li>
  <li>Your salary will be reviewed periodically as per company policy.</li>
  <li>Changes in your compensation are subject to the discretion of the company and will be subject
  to and be on the basis of your effective performance and results during your employment and
  other relevant criteria.</li>
</ol></div>

<div class="section"><h2>3.Other Benefits</h2>
<p>You will be entitle to the following:</p>
<ol class="alpha">
  <li>Leave,holidays and working hours as applicable to your category of employees and location of posting.</li>
</ol></div>

<div class="section"><h2>4.Responsibilities</h2>
<ol class="alpha">
  <li>In view of your position and office, you must effectively,diligently and to the best of your ability perform
  all responsibilities and ensure results. There may be times when you will be expected to work extra hours
  to achieve the above when the job so requires. In this connection, you are required not to engage in
  activities that have or will have an adverse impact on the reputation/image and business of company
  whether directly or indirectly.</li>
  <li>You will be required to under take travel on Company work for which you will be reimbused for travel
  expenses as per the company policy applicable to you.</li>
  <li>We at ${cos} are committed to ensure &lsquo;Integrity&rsquo; in all aspects of its functioning. You are
  expected to comply with the policies of the company including the Code of Business Conduct and other
  policies of the company as they form an integral part of the terms of employment with ${cos}.
  Consequently you are required to understand the scope and intent behind these policies and to comply
  with the same. These policies are updated/modified on a periodic basis and new policies may be
  introduced and notified to employees from time to time and you will be required to comply with same.</li>
  <li>Consistent with [c] above, any matter or situation or incident that may arise that could potentially result
  or has resulted, in any violation of the policies or the terms of your employment, shall immediately be
  brought to the notice of your Business unit head or manager.</li>
</ol></div>

<div class="section"><h2>5. Conflicts of Interest</h2>
<ol class="alpha">
  <li>You are required to engage yourself exclusively in the work assigned by ${cos} and shall not
  take up any independent or individual assignments (whether the same is part time or full time, in an
  advisory capacity or otherwise) directly or indirectly without the express written consent of your Business
  Unit Head.</li>
  <li>you shall ensure that you shall not,directly or indirectly, engage any activity or ave any interest in, or
  perform any services for any person who is involved in activities, which are or shall be in conflict with the
  interests of ${co}.</li>
  <li>The Conflict of interest Policy also refers to the need on your part, during your employement and for a
  period of one year from the cessation of your employment with ${cos} ( irrespective of the
  circumstances of, or the reasons for the cessation) not to solicit, induce or encourage:
    <ol class="roman">
      <li>Any employee of ${cos} to terminate their employment with ${cos} or to accept
      employment with any competitor, supplier or any customer with whom you have a connection.</li>
      <li>Any customer or vendor of ${cos} to move his existing business with ${cos} to
      a third party or to terminate his business relationship with ${cos}.</li>
      <li>Any existing employee to become associated with, or perform services of any type for any third party.</li>
    </ol>
  </li>
  <li>In case of any conflict or doubt,please discuss the matter with your Business Unit Head,to understand
  the position of ${cos} and resolve the conflict.</li>
</ol></div>

<div class="section"><h2>6. Confidentiality</h2>
<ol class="alpha">
  <li>In consideration of the opportunities, training and access to new techniques and know-how that will be
  made available to you, you will be required to comply with the confidentiality policy of the company.
  Therefore,please ensure that you as secret and confidential all Confidential Information ( as defined from
  time to time in the Confidentiality Policy of the company) and shall not use or disclose any such
  Confidential information except as may be required under obligation of law or as may be required by
  ${cos} and in the course of your employment. This covenant shall endure during your
  ( employment irrespective of the circumstances of, or the reasons, for the cessation).</li>
  <li>In your work for ${cos},you will be expected not to use or disclose any confidential information,
  including trade secrets, of any former employer or other person with whom you have and obligation
  of confidentiality and by signing below you affirm that you have you have no conflicting obligations or
  non-complete agreements that would prevent you from working without limitation for ${cos}.</li>
</ol></div>

<div class="section"><h2>7. Assignment of Intellectual Property</h2>
<p>During you tenure with the company you shall disclose and assign to ${cos} as its exclusive
property, all developments developed or conceived by you solely or jointly with others that are related to
the company&rsquo;s business or that results from work that you perform for the Company or using the
Company&rsquo;s equipement, supplies or facilities and shall comply with policy.</p>
</div>

<div class="section"><h2>8. Non-Compete</h2>
<p>In the course of your employment with the Company you will be providing services to customers or
clients of the Company during which process you would be handling sensitive information including but
not limited to key customers of the Company, competitor information, customer sensitive information
(&lsquo;Confidential Information&rsquo;).You acknowledge and recognize that confidential information available to you,
if leaked would cause irreparable harm to the company and its protection is of utmost importance to
( the Company. You confirm that for a period of six (6) months after separation of your employment from
the company irrespective of the circumstances of or the reason for the separation), you will not accept
any offer of employment from a customer or client with whom you have interacted or worked in a
professional capacity representing the Company client with whom you have interacted or worked in a
professional capacity representing the Company during the six(6)month preceding the date of separation.</p>
</div>

<div class="section"><h2>9. General</h2>
<ol class="alpha">
  <li>We trust that you have not provided us with any false declaration or wilfully suppressed any material
  information. If you have, you will be liable to be removed from service without any prior notice.Please
  note that you are required to inform us if there are any agreements,oral or written, which you have
  entered into and which may relate to or affect your commitments under this agreement.</li>
  <li>Your employment terms may be specifically enforce legally,if required. In this connection,if any of the
  provisions of the this Agreement are declared or found to be void or unenforceable due to any reason
  whatsoever,the remaining provisions of this Agreement shall continue in full force and effect.</li>
  <li>These employment terms supersede and replace any existing Agreement or understanding, if
  between ${cos} and you relating the same subject matter.</li>
  <li>You warrant that you are not prevented by a court or by any other administrative or judicial order
  from providing the service required under this agreement. In the event that you are not a citizen of
  the country of posting, you should have a valid work permit to work in the country of posting.</li>
</ol></div>

<div class="section"><h2>10. Notice Period</h2>
<p>This contract of employment is terminable, without resons, by either party giving two months prior written
notice. ${cos} reserves the right to pay or recover salary in lieu of notice period. Further, the
company may be at its discretion relieve you from such date as it may deem fit even prior to the
expiry of the notice period. However if the management desires the employee to continue the
employment during the notice period, the employee shall do so.</p>
<p>Please confirm that the above terms are acceptable to you and that you accept the appointment by
signing copy of this letter of appointment.</p>
</div>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature + Declaration footer
// ─────────────────────────────────────────────────────────────────────────────
function appointmentFooter(companyName) {
  return `
<div class="sign-section">
  <p>Sincerely,<br/>for ${esc(companyName)}</p>
  <div class="sign-gap"></div>
  <p><strong>Managing Director</strong></p>
</div>
<div class="declare">
  Declaration &amp; Acknowledgment from Employee:
  <div class="declare-body">
    I have read , Understood and agree to accept employment on the terms and conditions herein.<br/><br/>
    I shall be reporting to duty on &nbsp;&nbsp;_______________________
    <div class="field-line">
      <p>Name &nbsp;&nbsp;&nbsp;&nbsp;:</p>
      <p>Signature:</p>
      <p>Date &nbsp;&nbsp;&nbsp;&nbsp;:</p>
      <p>Place &nbsp;&nbsp;&nbsp;:</p>
    </div>
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main HTML builder
// ─────────────────────────────────────────────────────────────────────────────
function buildAppointmentLetterHtml({ employee, position, docType }) {
  const empName =
    `${employee.empName || ""} ${employee.empLastName || ""}`.trim();
  const effDate = position.epEfficientDate || position.epDate || todayStr();
  const dateStr = todayDash();
  const effFmt = fmtDate(effDate);
  const empId = position.empId ?? employee.id ?? 1;

  const ctcRaw = parseFloat(position.empCtc || 0)*12;
  const ctcDisplay = ctcRaw.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  });

  const isPromotion = docType === "promotion";
  const refPrefix = isPromotion ? "PROM/LTR" : "APP/LTR";
  const refNo = `${refPrefix}/${effFmt}/${empId}`;
  const title = isPromotion ? "Letter of Promotion" : "Letter of Appointment";
  const docTitle = isPromotion ? "Promotion Letter" : "Offer Letter";
  const companyName = position.companyName || CO.name;
  const companyShort = position.companyShortName || companyName;

  const openingVerb = isPromotion
    ? "its our pleasure to promote you within"
    : "its our pleasure in appointing you in";

  const addr2 = employee.empAddress2 ? `${esc(employee.empAddress2)}<br/>` : "";
  const addr3 = employee.empAddress3 ? `${esc(employee.empAddress3)}<br/>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(docTitle)} – ${esc(empName)}</title>
  <style>${APPT_CSS}</style>
</head>
<body>

<!--
  LAYOUT TABLE
  ┌──────────────────────────────────────────────────────────────────┐
  │ thead.repeat-head                                                │
  │   Small logo, right-aligned. Chrome repeats this on every page. │
  │   Hidden on screen. On page 1 it is COVERED by .page1-cover.    │
  ├──────────────────────────────────────────────────────────────────┤
  │ tbody.layout-body                                                │
  │   Single <td> containing all content.                           │
  │   Starts with .page1-cover which in @media print pulls itself   │
  │   up by THEAD_H px and paints a white background over the       │
  │   thead logo, then renders the full company header on top.      │
  │   Pages 2+: thead logo shows at top-right; body continues.      │
  └──────────────────────────────────────────────────────────────────┘

  Why this works in Chrome:
  - Chrome prints thead at the very top of the page margin on every page.
  - .page1-cover has margin-top: -THEAD_H px in print, so it starts
    THEAD_H px above where tbody would normally begin — exactly where
    the thead logo sits on page 1.
  - background:#fff on .page1-cover paints over the thead logo.
  - padding-top: THEAD_H px on .page1-cover restores the visual start
    position of the actual letter content (full header appears at top).
  - On pages 2+ the tbody is not at the top of those pages, so the
    cover div has no effect on the thead logo there.
-->
<table class="layout-table">

  <!-- REPEATING LOGO HEADER — Chrome prints this at top of EVERY page.
       On page 1 it is covered by .page1-cover below.
       On pages 2, 3, 4 … it shows as the small top-right logo. -->
  <thead class="repeat-head">
    <tr>
      <td>
        <img class="repeat-logo" src="${LOGO_SRC}" alt="MosIC Logo" />
      </td>
    </tr>
  </thead>

  <!-- ALL DOCUMENT CONTENT -->
  <tbody class="layout-body">
    <tr>
      <td>

        <!--
          PAGE-1 COVER
          In @media print:  margin-top pulls this div up to overlap the thead
                            area; white background covers the thead logo;
                            padding-top restores content position.
          In @media screen: no effect — renders in normal document flow.
        -->
        <div class="page1-cover">

          <!-- Full page-1 header: company name LEFT, large logo RIGHT -->
          ${letterHeader()}

          <!-- Ref No + Date -->
          <div class="ref-date">
            <span class="ref"><em>Ref No:</em>&nbsp;${esc(refNo)}</span>
            <span class="date">Date&nbsp;&nbsp;:&nbsp;${dateStr}</span>
          </div>

          <!-- Employee address -->
          <div class="addr">
            To<br/>
            ${esc(empName)},<br/>
            ${esc(employee.empAddress1 || "—")}<br/>
            ${addr2}${addr3}
          </div>

          <!-- Salutation -->
          <p>Dear ${esc(empName)}</p>

          <!-- Subject -->
          <div class="doc-title">Sub: ${esc(title)}</div>

          <!-- Opening paragraph -->
          <p>${openingVerb} ${esc(companyName)},as
          <strong>${esc(position.position || "—")}</strong>&nbsp;&nbsp;&nbsp;&nbsp;in&nbsp;&nbsp;
          <strong>${esc(position.department || "—")}</strong>
          or in such other capacity the management shall from time to time determine. Please note that the
          employment terms contained in this letter are subject to the company policy.</p>

        </div><!-- /.page1-cover -->

        <!-- Sections 1–10 (outside .page1-cover so no margin-top effect) -->
        ${termsAndConditionsHtml({ effDate, ctcDisplay, companyName, companyShort })}

        <!-- Signature + Declaration -->
        ${appointmentFooter(companyName)}

      </td>
    </tr>
  </tbody>

</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export function printOfferLetter({ employee, position }) {
  if (!position) {
    notifyGlobal("No active position found for this employee.", "error");
    return;
  }
  try {
    openPrintWindow(
      buildAppointmentLetterHtml({ employee, position, docType: "appointment" }),
    );
  } catch (e) {
    notifyGlobal("Could not generate offer letter: " + e.message, "error");
  }
}

export function printPromotionLetter({ employee, position }) {
  if (!position) {
    notifyGlobal("No active position found for this employee.", "error");
    return;
  }
  try {
    openPrintWindow(
      buildAppointmentLetterHtml({ employee, position, docType: "promotion" }),
    );
  } catch (e) {
    notifyGlobal("Could not generate promotion letter: " + e.message, "error");
  }
}
