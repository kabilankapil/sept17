// src/components/admin/pdfTemplates/invoicePDF.js
//
// Invoice-family PDFs (monochrome theme):
//   printInvoice        — drop-in replacement for invoiceGenerator.printInvoice
//   buildInvoiceBlobUrl — drop-in replacement for invoiceGenerator.buildInvoiceBlobUrl
//   printSalesInvoice   — Sales.jsx invoice print + blob persistence
//   printPurchaseOrder  — Purchase.jsx PO print + blob persistence
//
// All caller import paths stay the same — they import from ../PDFTemplates which
// re-exports everything from here.

import {
  CO, BASE_CSS,
  fmtDate, fmtINR, esc, numberToWords,
  invoiceCoHeader,
  openPrintWindow, apiGet, savePdfBlob, linkPdfToRecord,
} from "./pdfShared";

// ── Monochrome invoice / purchase theme ──────────────────────
const INVOICE_CSS = `${BASE_CSS}
  .page { max-width:820px; margin:0 auto; }

  /* Header — .hdr / .hdr-body / .co-name / .co-addr / .co-meta-grid defined in BASE_CSS */

  /* Print button (screen only) */
  .print-btn { display:inline-block; margin-bottom:14px; padding:8px 20px;
               background:#222; color:#fff; border:none; border-radius:6px;
               font-size:12px; font-weight:700; cursor:pointer; }
  .print-btn:hover { background:#444; }

  /* Doc title */
  .doc-title { text-align:center; font-size:15px; font-weight:bold;
               letter-spacing:1px; margin:10px 0 0;
               text-decoration:underline; text-underline-offset:3px; color:#111; }

  /* Party info grid */
  .grid2 { display:grid; grid-template-columns:1fr 1fr; width:100%; }
  .cell  { padding:7px 10px; border:1px solid #bbb; border-top:none; border-right:none;
           font-size:10.5px; line-height:1.9; word-break:break-word;
           page-break-inside:avoid; break-inside:avoid; }
  .cell:last-child { border-right:1px solid #bbb; }
  .cell-label { font-weight:800; font-size:9px; text-transform:uppercase;
                color:#555; letter-spacing:0.04em; margin-bottom:3px; }
  .kv { display:flex; gap:4px; flex-wrap:wrap; }
  .kk { font-weight:700; min-width:80px; flex-shrink:0; }

  /* Items table */
  .tbl-wrap { border:1px solid #bbb; border-top:none; overflow:hidden; width:100%; }
  table.items { width:100%; border-collapse:collapse; table-layout:fixed; }
  table.items th { background:#fff; color:#111; padding:5px 4px;
                   font-size:8.5px; font-weight:700; text-transform:uppercase;
                   letter-spacing:0.02em; border:1px solid #888; text-align:center; }
  table.items td { padding:4px 4px; border:1px solid #bbb;
                   font-size:10px; vertical-align:middle; color:#111;
                   overflow:hidden; word-break:break-word; }
  table.items tbody tr { page-break-inside:avoid; break-inside:avoid; }
  table.items tr:nth-child(even) td { background:#fff; }

  /* Totals */
  .totals-wrap { display:grid; grid-template-columns:1fr auto;
                 border:1px solid #bbb; border-top:none;
                 page-break-inside:avoid; break-inside:avoid; }
  .words { padding:10px; border-right:1px solid #bbb; }
  .amts  { padding:8px 14px; min-width:220px; }
  .aline { display:flex; justify-content:space-between; gap:24px;
           padding:2px 0; font-size:10.5px; }
  .aline.bold { font-weight:800; font-size:11.5px; border-top:1px solid #bbb;
                padding-top:5px; margin-top:4px; color:#111; }
  .aline.rnd  { font-weight:900; font-size:13px; color:#111;
                border-top:2px solid #111; padding-top:4px; margin-top:2px; }

  /* ── Terms & Conditions — compact numbered list ── */
  .terms {
    border:1px solid #bbb; border-top:none;
    padding:9px 12px; font-size:10px; line-height:1.8; color:#222;
    page-break-inside:avoid; break-inside:avoid;
  }
  .terms-heading {
    font-size:9px; font-weight:800; text-transform:uppercase;
    letter-spacing:0.06em; color:#555; margin-bottom:6px;
  }
  .terms-meta-line {
    margin-bottom:4px; font-size:10px;
  }
  .terms-meta-line b { font-weight:700; }
  .terms-divider {
    border:none; border-top:1px solid #ddd; margin:7px 0;
  }
  .terms-list {
    margin:0; padding:0; list-style:none;
  }
  .terms-list li {
    display:flex; gap:6px; margin-bottom:4px;
    font-size:10px; line-height:1.75;
    page-break-inside:avoid; break-inside:avoid;
  }
  .terms-list li .tc-num {
    font-weight:700; flex-shrink:0; min-width:14px;
  }

  /* Signature row */
  .sig-row { display:flex; justify-content:space-between; align-items:flex-end;
             margin-top:64px; padding:0 10px;
             page-break-inside:avoid; break-inside:avoid; }
  .sig-right { text-align:center; }
  .sig-right::before { content:""; display:block; width:200px;
                       border-top:1px solid #333; margin:0 auto 8px; }
  .sig-label { font-size:10px; font-weight:700; text-transform:uppercase; }

  /* Pagination */
  .page-break { page-break-before:always; break-before:always; }
`;

// ── Party block (buyer / seller metadata) ─────────────────────
function buildPartyBlock(toParty, fromPartyName, meta) {
  const { refNo, dateStr, currency, paymentTerms, deliveryTerms, validity, contactName } = meta;
  const pName = esc(toParty.companyName || toParty.name || "—");
  const pGst  = esc(toParty.gstNo  || toParty.gst  || "—");
  const pCin  = esc(toParty.cinNo  || toParty.cin  || "—");
  const pPan  = esc(toParty.panNo  || toParty.pan  || "—");
  const pLut  = esc(toParty.cGstLutNo || toParty.gstLutNo || "—");
  const bAddr = [toParty.buyerAddress1||"", toParty.buyerAddress2||"", toParty.buyerAddress3||""]
                  .filter(Boolean).map(esc).join("<br/>") || "—";
  const sAddr = [toParty.shippingAddress1||"", toParty.shippingAddress2||"", toParty.shippingAddress3||""]
                  .filter(Boolean).map(esc).join("<br/>") || "—";

  return `
  <div class="grid2" style="border-top:1px solid #bbb">
    <div class="cell">
      <div class="kv"><span class="kk">TO PARTY</span><span>: ${pName}</span></div>
      <div class="kv"><span class="kk">GST NO</span><span>: ${pGst}</span></div>
      <div class="kv"><span class="kk">CIN NO</span><span>: ${pCin}</span></div>
      <div class="kv"><span class="kk">PAN No</span><span>: ${pPan}</span></div>
      <div class="kv"><span class="kk">GST LUT No</span><span>: ${pLut}</span></div>
    </div>
    <div class="cell">
      <div class="kv"><span class="kk">REF NO</span><span>: ${esc(refNo)}</span></div>
      <div class="kv"><span class="kk">DATE</span><span>: ${esc(dateStr)}</span></div>
      <div class="kv"><span class="kk">VALIDITY</span><span>: ${fmtDate(validity)}</span></div>
      <div class="kv"><span class="kk">CURRENCY</span><span>: ${esc(currency||"INR")}</span></div>
    </div>
  </div>
  <div class="grid2">
    <div class="cell">
      <div class="cell-label">Billing Address</div>
      <div style="margin-top:4px">${bAddr}</div>
    </div>
    <div class="cell">
      <div class="cell-label">Shipping Address</div>
      <div style="margin-top:4px">${sAddr}</div>
      ${contactName ? `<div style="margin-top:8px"><span style="font-weight:700">Kind Attention</span>: ${esc(contactName)}</div>` : ""}
    </div>
  </div>
  `;
}

// ── Line item row ───────────────────────────
function invoiceTableHeader() {
  return `<table class="items">
    <thead><tr>
      <th style="width:4%">S.NO</th>
      <th style="width:22%;text-align:left">NAME / DESCRIPTION</th>
      <th style="width:9%">HSN/SAC</th>
      <th style="width:5%">QTY</th>
      <th style="width:5%">UNIT</th>
      <th style="width:8%;text-align:right">RATE</th>
      <th style="width:10%;text-align:right">TAXABLE</th>
      <th style="width:9%;text-align:right">CGST</th>
      <th style="width:9%;text-align:right">SGST</th>
      <th style="width:9%;text-align:right">IGST</th>
      <th style="width:10%;text-align:right">TOTAL</th>
    </tr></thead>
    <tbody>`;
}

function buildItemRow(li, rowNum) {
  return `<tr>
    <td style="text-align:center">${rowNum}</td>
    <td><b>${esc(li.product || li.nameOfProductService || "")}</b></td>
    <td style="text-align:center">${esc(li.hsnCode || li.hsnAcs || "")}</td>
    <td style="text-align:center">${Number(li.quantity)||0}</td>
    <td style="text-align:center">${esc(li.unit||"")}</td>
    <td style="text-align:right">${fmtINR(li.unitRate)}</td>
    <td style="text-align:right">${fmtINR(li.taxableValue)}</td>
    <td style="text-align:right">${fmtINR(li.cgstAmount)}</td>
    <td style="text-align:right">${fmtINR(li.sgstAmount)}</td>
    <td style="text-align:right">${fmtINR(li.igstAmount)}</td>
    <td style="text-align:right;font-weight:700">${fmtINR(li.total)}</td>
  </tr>`;
}

// ── Western number-to-words (Thousands / Millions / Billions) ─
function toWesternWords(n) {
  if (n === 0) return "Zero";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety",
  ];
  function belowThousand(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    if (num < 100) {
      const t = tens[Math.floor(num / 10)];
      const o = ones[num % 10];
      return o ? `${t} ${o}` : t;
    }
    const h = ones[Math.floor(num / 100)];
    const rest = belowThousand(num % 100);
    return rest ? `${h} Hundred ${rest}` : `${h} Hundred`;
  }
  const scales = [
    { value: 1_000_000_000, name: "Billion" },
    { value: 1_000_000,     name: "Million" },
    { value: 1_000,         name: "Thousand" },
  ];
  let remaining = n;
  const parts = [];
  for (const { value, name } of scales) {
    if (remaining >= value) {
      parts.push(`${belowThousand(Math.floor(remaining / value))} ${name}`);
      remaining %= value;
    }
  }
  if (remaining > 0) parts.push(belowThousand(remaining));
  return parts.join(" ");
}

// ── Currency-aware number-to-words ────────────────────────────
// INR  → Indian system (Lakhs / Crores) via existing numberToWords()
// Rest → Western system (Thousands / Millions / Billions)
function numberToWordsForCurrency(amount, cur) {
  if (cur === "INR") {
    return numberToWords(amount)
      .replace(/\s*(rupees|only)\s*/gi, " ")
      .trim();
  }
  return toWesternWords(Math.round(amount));
}

// ── Totals block (words + amount grid) ───────────────────────
function buildTotalsBlock(items, currency) {
  const grandTaxable = items.reduce((a, l) => a + (Number(l.taxableValue) || 0), 0);
  const grandCgst    = items.reduce((a, l) => a + (Number(l.cgstAmount)   || 0), 0);
  const grandSgst    = items.reduce((a, l) => a + (Number(l.sgstAmount)   || 0), 0);
  const grandIgst    = items.reduce((a, l) => a + (Number(l.igstAmount)   || 0), 0);
  const grandTotal   = items.reduce((a, l) => a + (Number(l.total)        || 0), 0);
  const roundOff     = Math.round(grandTotal);

  const cur = (currency || "INR").toUpperCase();
  const CURRENCY_UNIT = {
    INR: "Rupees", USD: "Dollars", EUR: "Euros",
    GBP: "Pounds", AED: "Dirhams", SGD: "Dollars",
  };
  const unitWord      = CURRENCY_UNIT[cur] || cur;
  const rawWords      = numberToWordsForCurrency(roundOff, cur);
  const amountInWords = `${rawWords} ${unitWord} Only`;

  return `<div class="totals-wrap">
    <div class="words">
      <div style="font-weight:800;font-size:9px;text-transform:uppercase;
                  letter-spacing:0.04em;margin-bottom:6px;color:#555">Total Amount in Words</div>
      <div style="font-size:11px;font-style:italic;color:#111;
                  font-weight:600;text-transform:capitalize">
        ${amountInWords}
      </div>
    </div>
    <div class="amts">
      <div class="aline"><span>TOTAL TAXABLE</span><span>${fmtINR(grandTaxable)}</span></div>
      <div class="aline"><span>TOTAL CGST</span><span>${fmtINR(grandCgst)}</span></div>
      <div class="aline"><span>TOTAL SGST</span><span>${fmtINR(grandSgst)}</span></div>
      <div class="aline"><span>TOTAL IGST</span><span>${fmtINR(grandIgst)}</span></div>
      <div class="aline bold">
        <span>TOTAL (${esc(currency||"INR")})</span><span>${fmtINR(grandTotal)}</span>
      </div>
      <div class="aline rnd"><span>ROUND OFF</span><span>${roundOff}</span></div>
    </div>
  </div>`;
}

// ── Paginated items section (max 10 rows per print page) ──────
const ITEMS_PER_PAGE = 10;

function buildPagedItems(items, currency, descHtml = "") {
  if (!items || items.length === 0) {
    return `${descHtml}
      <div class="tbl-wrap">${invoiceTableHeader()}
        <tr><td colspan="11" style="text-align:center;padding:16px;color:#888;
            font-style:italic">No line items</td></tr>
      </tbody></table></div>
      ${buildTotalsBlock([], currency)}`;
  }

  const chunks = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE)
    chunks.push(items.slice(i, i + ITEMS_PER_PAGE));

  let html = descHtml;
  chunks.forEach((chunk, pageIdx) => {
    const offset = pageIdx * ITEMS_PER_PAGE;
    const isLast = pageIdx === chunks.length - 1;
    if (pageIdx > 0) html += `<div class="page-break"></div>`;
    html += `<div class="tbl-wrap">${invoiceTableHeader()}`;
    chunk.forEach((li, i) => { html += buildItemRow(li, offset + i + 1); });
    html += `</tbody></table></div>`;
    if (isLast) {
      html += buildTotalsBlock(items, currency);
    } else {
      const shown = offset + chunk.length;
      html += `<p style="font-size:10px;color:#888;text-align:right;margin-top:4px">
        Continued on next page… (${shown} of ${items.length} items shown)</p>`;
    }
  });
  return html;
}

// ── Terms & Conditions renderer ───────────────────────────────
function buildTermsBlock(description, paymentTerms, deliveryTerms) {
  const hasDesc = description && description.trim();
  const hasMeta = paymentTerms || deliveryTerms;
  if (!hasDesc && !hasMeta) return "";

const metaLines = [];
if (paymentTerms)  metaLines.push(`<div class="terms-meta-line"><b>Payment Terms:</b> ${esc(paymentTerms)}</div>`);
if (deliveryTerms) metaLines.push(`<div class="terms-meta-line"><b>Delivery Terms:</b> ${esc(deliveryTerms)}</div>`);
const metaHtml = metaLines.join("");

  let listHtml = "";
  if (hasDesc) {
    const sections = parseDescriptionSections(description);
    if (sections.length > 0) {
      const items = sections.map((s, i) => {
        const titlePart = `<b>${esc(s.title)}${s.subtitle ? ` — ${esc(s.subtitle)}` : ""}</b>`;
        return `<li><span class="tc-num">${i + 1}.</span><span>${titlePart}: ${esc(s.body)}</span></li>`;
      }).join("");
      listHtml = `<ol class="terms-list">${items}</ol>`;
    } else {
      listHtml = `<div style="font-size:10px;line-height:1.8">${esc(description)}</div>`;
    }
  }

  const divider = (metaHtml && listHtml) ? `<hr class="terms-divider"/>` : "";

  return `<div class="terms">
    <div class="terms-heading">Terms &amp; Conditions</div>
    ${metaHtml}${divider}${listHtml}
  </div>`;
}

// ── Section parser ────────────────────────────────────────────
function parseDescriptionSections(raw) {
  if (!raw || !raw.trim()) return [];

  if (/\n/.test(raw)) {
    const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    const sections = [];

    for (const block of blocks) {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      if (lines.length === 1) {
        if (sections.length > 0)
          sections[sections.length - 1].body += " " + lines[0];
        continue;
      }

      const title = lines[0];
      const maybeSubtitle = lines[1];
      const isSubtitle =
        maybeSubtitle.length < 80 &&
        !/\.$/.test(maybeSubtitle) &&
        /^[A-Z]/.test(maybeSubtitle) &&
        lines.length > 2;

      const subtitle  = isSubtitle ? maybeSubtitle : "";
      const bodyLines = isSubtitle ? lines.slice(2) : lines.slice(1);
      sections.push({ title, subtitle, body: bodyLines.join(" ") });
    }
    return sections.filter(s => s.body.trim());
  }

  const KNOWN_TITLES = [
    "Product description","Technical specification","Custom and ASIC orders",
    "Product lifecycle and obsolescence","Payment terms","Advance payment",
    "Accepted payment modes","Late payment","Taxes and statutory deductions",
    "Credit limits and facilities","Delivery terms","Lead times",
    "Packaging and handling","Courier and freight","Partial shipments",
    "Transit insurance","Inspection and claims","Export control and compliance",
  ];
  const text = raw.replace(/\s{2,}/g, " ").trim();
  const escapedTitles = KNOWN_TITLES.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const titleRe = new RegExp(`(?:^|(?<=\\. ))(${escapedTitles.join("|")})(?=\\s)`, "g");
  const parts = text.split(titleRe).filter(Boolean);

  const sections = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const title = parts[i].trim();
    const rest  = (parts[i + 1] || "").trim();
    const m = rest.match(/^([^.]{10,80})\.\s+(.+)/s);
    sections.push(m
      ? { title, subtitle: m[1].trim(), body: m[2].trim() }
      : { title, subtitle: "", body: rest }
    );
  }
  return sections.filter(s => s.body.trim());
}

// ── Core HTML builder ─────────────────────────────────────────
function buildInvoiceHTML({
  docType, refNo, date, validity, currency,
  toParty, fromPartyName, contactName,
  paymentTerms, deliveryTerms, description, items,
}) {
  const dateStr  = fmtDate(date);
  const termsHtml = buildTermsBlock(description, paymentTerms, deliveryTerms);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>${esc(docType)} — ${esc(refNo)}</title>
<style>${INVOICE_CSS}</style>
</head><body>
<div class="page">
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  ${invoiceCoHeader()}
  <div class="doc-title">${esc(docType).toUpperCase()}</div>
  ${buildPartyBlock(toParty || {}, fromPartyName || CO.name, {
    refNo, dateStr, currency, paymentTerms, deliveryTerms, validity, contactName,
  })}
  ${buildPagedItems(items || [], currency)}
  ${termsHtml}
  <div class="sig-row">
    <div style="font-size:11px;font-weight:700">FOR ${esc(CO.name.toUpperCase())}</div>
    <div class="sig-right">
      <div class="sig-label">Authorised Signature</div>
    </div>
  </div>
</div>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════

// ── 1 · Drop-in replacements for invoiceGenerator.js (ActivityLog.jsx) ──

export function printInvoice(doc) {
  openPrintWindow(buildInvoiceHTML({
    docType:       doc.docType       || "Invoice",
    refNo:         doc.refNo         || "",
    date:          doc.date          || "",
    validity:      doc.validity      || "",
    currency:      doc.currency      || "INR",
    toParty:       doc.toParty       || {},
    fromPartyName: CO.name,
    contactName:   doc.contactName   || "",
    paymentTerms:  doc.paymentTerms  || "",
    deliveryTerms: doc.deliveryTerms || "",
    description:   doc.description   || "",
    items:         doc.items         || [],
  }));
}

export function buildInvoiceBlobUrl(doc) {
  const html = buildInvoiceHTML({
    docType:       doc.docType       || "Invoice",
    refNo:         doc.refNo         || "",
    date:          doc.date          || "",
    validity:      doc.validity      || "",
    currency:      doc.currency      || "INR",
    toParty:       doc.toParty       || {},
    fromPartyName: CO.name,
    contactName:   doc.contactName   || "",
    paymentTerms:  doc.paymentTerms  || "",
    deliveryTerms: doc.deliveryTerms || "",
    description:   doc.description   || "",
    items:         doc.items         || [],
  });
  return URL.createObjectURL(new Blob([html], { type: "text/html" }));
}

// ── 2 · Sales Invoice (Sales.jsx) ────────────────────────────
export async function printSalesInvoice({ sale, items, customers }) {
  const [resolvedItems, resolvedCustomers] = await Promise.all([
    items     ? Promise.resolve(items)     : apiGet(`/api/sales-items/by-sales/${sale.id}`).catch(() => []),
    customers ? Promise.resolve(customers) : apiGet("/api/customers").catch(() => []),
  ]);

  const toParty   = resolvedCustomers.find(c => String(c.id) === String(sale.toParty))   || {};
  const fromParty = resolvedCustomers.find(c => String(c.id) === String(sale.fromParty)) || {};

  let contactName = sale.addressedTo || "—";
  if (sale.addressedTo && sale.toParty) {
    try {
      const list  = await apiGet(`/api/customers/${sale.toParty}/parties`);
      const found = (Array.isArray(list) ? list : [])
        .find(c => String(c.id) === String(sale.addressedTo));
      if (found) contactName = found.partyName || found.name || contactName;
    } catch { /* keep raw value */ }
  }

  const refNo         = `S-${String(sale.id).padStart(3, "0")}`;
  const dateStr       = fmtDate(sale.date);
  const docType       = sale.documentType || "Sales Invoice";
  const fromPartyName = fromParty.companyName || fromParty.name || CO.name;

  const html = buildInvoiceHTML({
    docType, refNo, date: sale.date, validity: sale.validity,
    currency: sale.currency, toParty, fromPartyName, contactName,
    paymentTerms: sale.paymentTerms, deliveryTerms: sale.deliveryTerms,
    description: sale.description, items: resolvedItems,
  });

  openPrintWindow(html);
  savePdfBlob(html, `sales-${refNo}-${dateStr}.html`)
    .then(blobId => linkPdfToRecord("sales", sale.id, blobId))
    .catch(() => {});
}

// ── 3 · Purchase Order (Purchase.jsx) ────────────────────────
const PURCHASE_DOCTYPE_LABELS = {
  "1": "Enquiry", "2": "Quotation", "3": "Purchase Order",
  "4": "Invoice", "5": "Delivery Note",
};

export async function printPurchaseOrder({ purchase, items, customers }) {
  const fileRef = purchase.purchaseFileRef ?? purchase.id;
  const [resolvedItems, resolvedCustomers] = await Promise.all([
    items     ? Promise.resolve(items)     : apiGet(`/api/purchase-items/by-ref/${fileRef}`).catch(() => []),
    customers ? Promise.resolve(customers) : apiGet("/api/customers").catch(() => []),
  ]);

  const toParty   = resolvedCustomers.find(c => String(c.id) === String(purchase.purchaseToParty))   || {};
  const fromParty = resolvedCustomers.find(c => String(c.id) === String(purchase.purchaseFromParty)) || {};

  let contactName = purchase.purchaseAddressedTo || "—";
  if (purchase.purchaseAddressedTo && purchase.purchaseToParty) {
    try {
      const list  = await apiGet(`/api/customers/${purchase.purchaseToParty}/parties`);
      const found = (Array.isArray(list) ? list : [])
        .find(c => String(c.id) === String(purchase.purchaseAddressedTo));
      if (found) contactName = found.partyName || found.name || contactName;
    } catch { /* keep raw value */ }
  }

  const refNo         = `P-${String(purchase.id).padStart(3, "0")}`;
  const dateStr       = fmtDate(purchase.purchaseDate);
  const docType       = PURCHASE_DOCTYPE_LABELS[String(purchase.purchaseDoctype)] || `Type ${purchase.purchaseDoctype}`;
  const fromPartyName = fromParty.companyName || fromParty.name || CO.name;

  const html = buildInvoiceHTML({
    docType, refNo, date: purchase.purchaseDate, validity: purchase.purchaseValidity,
    currency: purchase.purchaseCurrency, toParty, fromPartyName, contactName,
    paymentTerms: purchase.purchasePaymentTerms, deliveryTerms: purchase.purchaseDeliveryTerms,
    description: purchase.purchaseDescription, items: resolvedItems,
  });

  openPrintWindow(html);
  savePdfBlob(html, `purchase-${refNo}-${dateStr}.html`)
    .then(blobId => linkPdfToRecord("purchases", purchase.id, blobId))
    .catch(() => {});
}