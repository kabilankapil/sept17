// src/components/admin/pdfTemplates/pdfShared.js
//
// Shared primitives used by every PDF module:
//   • Company constants (CO, LOGO_SRC)
//   • Base CSS reset
//   • Date / number / HTML-escape helpers
//   • Indian number-to-words
//   • Auth / fetch helpers (authHeaders, apiGet)
//   • Pop-up helper (openPrintWindow)
//   • PDF persistence helpers (savePdfBlob, linkPdfToRecord)
//   • Shared HTML header/footer blocks (invoiceCoHeader, letterHeaderHR, letterFooter)
//   • Shared "letter" CSS theme + currency formatter (used by all HR letters + payslip)
//
// Nothing in this file renders JSX — plain JS only.

import { BASE_URL } from "../../../api/_base";
import { notifyGlobal } from "../shared/ToastContext";

// ── Company constants ─────────────────────────────────────────
//
// CO      — full details (GST, CIN, PAN) used by Sales / Purchase / Matpass PDFs
// CO_HR   — HR-only details (name, address, website, phone, email) used by
//           payslip and all HR letter PDFs (no tax registration numbers)
//
export const CO = {
  name: "MosIC Solutions Pvt Ltd",
  addr1: "No:93/9, Novel MSR Park office, Marthahalli,",
  addr2: "Bangalore 560037",
  state: "Karnataka",
  gst: "29AAICM6836G1Z3",
  pan: "AAICM6836G",
  cin: "U72200KA2013PTC069886",
  website: "www.mosics.com",
  phone: "+91-9980914698",
  email: "salesandsupport@mosics.com",
};

// HR PDFs only need name + address + contact — no tax registration numbers.
export const CO_HR = {
  name: CO.name,
  addr1: CO.addr1,
  addr2: `${CO.addr2}, ${CO.state}`,
  website: CO.website,
  phone: CO.phone,
  email: CO.email,
};

// Served from public/images/logo.jpg.
// window.location.origin gives an absolute URL that works in popup windows
// and blob: URL iframes alike.
export const LOGO_SRC = `${window.location.origin}/images/logo.jpg`;

// ── Month names (for payslip header) ─────────────────────────
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Base CSS reset (extended by each theme) ───────────────────
export const BASE_CSS = `
 * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#000;
         background:#fff; padding:20px; }
  @media print {
   @page { size:A4; margin:14mm 10mm; }
  @page { margin-header: 0; margin-footer: 0; }
  body { padding:12mm 10mm; }
  .no-print { display:none !important; }
  html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }

  /* ── Shared header layout (used by all invoiceCoHeader variants) ── */
  .hdr       { display:flex; align-items:flex-end; gap:16px;
               border-bottom:2.5px solid #0f766e; padding-bottom:14px; margin-bottom:0; }
  .hdr-body  { flex:1; }
  .co-name   { font-size:26px; font-weight:900; color:#0f766e;
               letter-spacing:-0.5px; line-height:1.15; margin-bottom:3px; }
  .co-addr   { font-size:10.5px; color:#000; line-height:1.5; margin-bottom:4px; }
  .co-meta-grid { width:100%; border:none; border-collapse:collapse;
                  font-size:10.5px; color:#000; }
  .co-meta-grid td { padding:1px 0; vertical-align:top; }
  .co-meta-grid td:last-child { text-align:right; }
`;

// ════════════════════════════════════════════════════════════════
// SHARED "LETTER" THEME — used by appointment/promotion, hike,
// resignation, and payslip so all HR documents look consistent
// (teal corporate theme, sans-serif, same header/footer/title bands).
// ════════════════════════════════════════════════════════════════
export const LETTER_CSS = `${BASE_CSS}
  body { padding:24px 32px 40px; line-height:1.7; font-size:12px; }
  @media print {
    @page { size:A4; margin:14mm 16mm; }
    body { padding:0; }
  }

  /* ── Title band ── */
  .doc-title {
    text-align:center; font-size:16px; font-weight:800;
    letter-spacing:1px; color:#0f766e;
    border-top:2px solid #0f766e; border-bottom:2px solid #0f766e;
    padding:8px 0; margin:14px 0 16px;
  }

  /* ── Ref / date row ── */
  .ref-date { display:flex; justify-content:space-between;
              margin-bottom:14px; font-size:11.5px; font-weight:600; color:#000; }

  /* ── Employee address block ── */
  .addr { margin-bottom:16px; font-size:12px; line-height:1.7; }

  /* ── Body text ── */
  .section { page-break-inside:avoid; break-inside:avoid; }
  h2 { font-size:13px; font-weight:900; text-transform:uppercase;
       margin:20px 0 10px; letter-spacing:0.01em;
       page-break-after:avoid; break-after:avoid; color:#0f766e; }
  p  { font-size:12px; margin-bottom:12px; text-align:justify; line-height:1.7; }
  ol { font-size:12px; padding-left:22px; margin:0 0 10px; }
  ol li { margin-bottom:8px; text-align:justify; line-height:1.7;
          page-break-inside:avoid; break-inside:avoid; }
  ol.alpha { list-style-type:lower-alpha; }
  ol.roman { list-style-type:lower-roman; padding-left:28px; }

  /* ── Signature & declaration ── */
  .sign-section { margin-top:36px; font-size:12px; line-height:1.9;
                  page-break-inside:avoid; break-inside:avoid; }
  .declare { border-top:1px solid #444; margin-top:32px; padding-top:16px;
             font-size:12px; line-height:2.0;
             page-break-inside:avoid; break-inside:avoid; }
  .field-row { margin-top:16px; font-size:12px; line-height:2.4; }
  .field-row p { margin:0; text-align:left; }

  /* ── Generic salary / data table (used by hike letter, etc.) ── */
  table.sal { width:100%; border-collapse:collapse; margin:14px 0; }
  table.sal td { border:1px solid #ccc; padding:7px 12px; font-size:12px; }
  table.sal td:last-child { text-align:right; font-weight:600; }
  table.sal tr.total td { font-weight:700; background:#fafffe; border-top:2px solid #0f766e; }
  table.sal td.teal { color:#0f766e; font-weight:700; }
  table.sal td.teal-val { color:#0f766e; font-weight:700; text-align:right; }
`;

// ── Date helpers ──────────────────────────────────────────────
/** "dd-mm-yyyy" */
export function todayDash() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** "dd/mm/yyyy" */
export function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Normalises ISO / dd-mm-yyyy / mixed strings → "dd-mm-yyyy" */
export function fmtDate(val) {
  if (!val) return "—";
  const datePart = val.split("T")[0].split(" ")[0];
  const parts = datePart.split("-");
  if (parts.length === 3 && parts[0].length === 4)
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return datePart;
}

/** Indian locale currency format, always 2 dp */
export function fmtINR(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Unified currency formatter — "Rs. 1,23,456.00"
 * Used by payslip and hike letter so amounts render identically everywhere.
 */
export function fmtCurrency(v) {
  return `Rs.\u00a0${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * "₹ 1,23,456" — for whole-rupee annual CTC figures in letters.
 */
export function fmtRupeeWhole(v) {
  return `\u20B9 ${Number(v || 0).toLocaleString("en-IN")}`;
}

/** HTML-escape a value (safe default for template literals) */
export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ── Logo size presets ─────────────────────────────────────────
//
// Use these named keys wherever a logo size is needed, instead of
// hardcoding raw pixel values.  All header functions accept a logoSize
// param that forwards directly to logoImgTag().
//
//   sm  →  60px   compact sub-sections (e.g. payslip continuation pages)
//   md  →  80px   body-level inline references
//   lg  → 105px   standard document header  ← default for all headers
//   xl  → 130px   prominent / cover-page headers (offer letters, etc.)
//
export const LOGO_SIZE = {
  sm: 60,
  md: 80,
  lg: 105,
  xl: 130,
};

// ── Logo helper ───────────────────────────────────────────────
//
// Three calling styles — all backwards-compatible:
//
//   logoImgTag()               → 80 × 80  (LOGO_SIZE.md — bare default)
//   logoImgTag(105)            → 105 × 105  (number → square)
//   logoImgTag("lg")           → 105 × 105  (named preset key)
//   logoImgTag("xl")           → 130 × 130
//   logoImgTag({ w:160, h:60}) → 160 wide × 60 tall  (non-square / wide logo)
//
// The header functions (invoiceCoHeader, letterHeaderHR, …) default to
// LOGO_SIZE.lg (105px) and accept a logoSize param so individual letters
// can override without touching pdfShared at all.
export function logoImgTag(size = LOGO_SIZE.md) {
  let w, h;

  if (typeof size === "number") {
    // logoImgTag(105) — backwards-compatible square
    w = h = size;
  } else if (typeof size === "string") {
    // logoImgTag("lg") — named preset
    const px = LOGO_SIZE[size] ?? LOGO_SIZE.md;
    w = h = px;
  } else if (size && typeof size === "object") {
    // logoImgTag({ w: 160, h: 60 }) — explicit non-square dimensions
    w = size.w ?? size.width ?? LOGO_SIZE.md;
    h = size.h ?? size.height ?? w;
  } else {
    w = h = LOGO_SIZE.md;
  }

  return `<img src="${LOGO_SRC}" alt="MosIC Logo"
    style="width:${w}px;height:${h}px;object-fit:contain;flex-shrink:0;" />`;
}

// ── Number → words (Indian system) ───────────────────────────
const _ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const _TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function _belowHundred(n) {
  return n < 20
    ? _ONES[n]
    : _TENS[Math.floor(n / 10)] + (n % 10 ? " " + _ONES[n % 10] : "");
}

function _belowThousand(n) {
  return n < 100
    ? _belowHundred(n)
    : _ONES[Math.floor(n / 100)] +
        " hundred" +
        (n % 100 ? " and " + _belowHundred(n % 100) : "");
}

export function numberToWords(amount) {
  const n = Math.round(Number(amount) || 0);
  if (n === 0) return "zero rupees";
  let rem = n,
    parts = [];
  if (rem >= 10_000_000) {
    parts.push(_belowThousand(Math.floor(rem / 10_000_000)) + " crore");
    rem %= 10_000_000;
  }
  if (rem >= 100_000) {
    parts.push(_belowThousand(Math.floor(rem / 100_000)) + " lakh");
    rem %= 100_000;
  }
  if (rem >= 1_000) {
    parts.push(_belowThousand(Math.floor(rem / 1_000)) + " thousand");
    rem %= 1_000;
  }
  if (rem > 0) parts.push(_belowThousand(rem));
  return parts.join(" ") + " rupees";
}

// ── Auth / fetch helpers ──────────────────────────────────────
function authHeaders() {
  const token = sessionStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Pop-up helper ─────────────────────────────────────────────
export function openPrintWindow(html) {
  const win = window.open("", "_blank", "width=960,height=750,scrollbars=yes");
  if (!win) {
    notifyGlobal("Pop-up blocked — please allow pop-ups for this site.", "error");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    try {
      win.focus();
      win.document.head.insertAdjacentHTML(
        "beforeend",
        `<style>@page { margin: 14mm 10mm; }</style>`,
      );
      win.print();
    } catch {
      /* already triggered or blocked */
    }
  }, 650);
}

// ── PDF persistence helpers ───────────────────────────────────
// savePdfBlob: uploads HTML as a blob file and returns the server-assigned blob ID.
// linkPdfToRecord: PATCHes the record's pdfBlobId field (best-effort, never throws).
export async function savePdfBlob(htmlContent, filename) {
  try {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const file = new File([blob], filename, { type: "text/html" });
    const fd = new FormData();
    fd.append("file", file);
    const token = sessionStorage.getItem("auth_token");
    const res = await fetch(`${BASE_URL}/api/blobs`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}

export async function linkPdfToRecord(type, id, blobId) {
  if (!blobId) return;
  try {
    const token = sessionStorage.getItem("auth_token");
    await fetch(`${BASE_URL}/api/${type}/${id}/pdf-blob`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ pdfBlobId: blobId }),
    });
  } catch {
    /* best-effort */
  }
}

// ── Shared HTML header blocks ─────────────────────────────────
// invoiceCoHeader → used by invoicePDF (teal invoice / purchase theme)
// letterHeaderHR  → used by appointmentPDF, hikeletterPDF, resignationPDF
//                   (all HR letter types) — teal corporate theme, logo LEFT
// letterFooter    → signature + employee declaration/acknowledgment block

// Invoice / Purchase / Matpass header — identical structure to matpassPDF header
// logoSize: "sm" | "md" | "lg" | "xl" | number | { w, h }  (default "lg" = 105px)
export function invoiceCoHeader(logoSize = "lg") {
  return `<div class="hdr">
    ${logoImgTag(logoSize)}
    <div class="hdr-body">
      <div class="co-name">${CO.name}</div>
      <div class="co-addr">${CO.addr1}&nbsp;&nbsp;${CO.addr2},&nbsp;${CO.state}</div>
      <table class="co-meta-grid">
        <tr>
          <td>GST No: ${CO.gst}</td>
          <td>PAN No: ${CO.pan}</td>
        </tr>
        <tr>
          <td>CIN No: ${CO.cin}</td>
          <td>Website: ${CO.website}</td>
        </tr>
        <tr>
          <td>Phone: ${CO.phone}</td>
          <td>Email: ${CO.email}</td>
        </tr>
      </table>
    </div>
  </div>`;
}

// ── HR letter header (teal corporate theme) ───────────────────
// Used by appointmentPDF, hikeletterPDF, resignationPDF, and payslipPDF.
// Logo LEFT, company name/address/contact block RIGHT — same structure as
// invoiceCoHeader / matpassPDF header, but using CO_HR (no GST/CIN/PAN).
// logoSize: "sm" | "md" | "lg" | "xl" | number | { w, h }  (default "xl" = 130px)
export function letterHeaderHR(logoSize = "xl") {
  return `<div class="hdr">
    ${logoImgTag(logoSize)}
    <div class="hdr-body">
      <div class="co-name">${CO_HR.name}</div>
      <div class="co-addr">${CO_HR.addr1}&nbsp;&nbsp;${CO_HR.addr2}</div>
      <table class="co-meta-grid">
        <tr>
          <td>Phone: ${CO_HR.phone}</td>
          <td>Email: ${CO_HR.email}</td>
        </tr>
        <tr>
          <td>Website: ${CO_HR.website}</td>
          <td></td>
        </tr>
      </table>
    </div>
  </div>`;
}

// Backwards-compat alias — old name used by previous lettersPDF.js.
export const letterCoHeaderHR = letterHeaderHR;

// ── Shared letter footer (signature + declaration) ─────────────
// Used by appointment/promotion letters (employee must sign & return).
// Hike and resignation letters use simpler, document-specific sign-offs.
export function letterFooter() {
  return `<div style="page-break-inside:avoid; break-inside:avoid;">
    <div class="sign-section">
      <p>Sincerely,<br/>for ${CO_HR.name}</p>
      <div style="margin-top:50px"><strong>Managing Director</strong></div>
    </div>
    <div class="declare">
      <strong>Declaration &amp; Acknowledgment from Employee:</strong><br/>
      I have read, understood and agree to accept employment on the terms and conditions herein.<br/><br/>
      I shall be reporting to duty on _______________________
      <div class="field-row">
        <p>Name &nbsp;&nbsp;&nbsp;:</p>
        <p>Signature:</p>
        <p>Date &nbsp;&nbsp;&nbsp;:</p>
        <p>Place &nbsp;&nbsp;&nbsp;:</p>
      </div>
    </div>
  </div>`;
}
