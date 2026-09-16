// src/components/admin/pdfTemplates/matpassPDF.js
//
// Material Pass PDFs:
//   printMatpassPDF    — open print popup
//   buildMatpassBlobUrl — return blob: URL for inline iframe viewer

import { BASE_CSS, invoiceCoHeader, esc, openPrintWindow, apiGet } from "./pdfShared";

// ── Material Pass theme — monochrome, matches invoicePDF (Sales/Purchase) ──
const MATPASS_CSS = `${BASE_CSS}
  body { padding:20px 28px; }
  .page { max-width:820px; margin:0 auto; }

  /* Header — .hdr / .hdr-body / .co-name / .co-addr / .co-meta-grid come from BASE_CSS */

  /* ── Ref / date bar directly under header ── */
  .ref-bar { display:flex; justify-content:space-between; align-items:center;
             border:1px solid #bbb; border-top:none;
             padding:6px 10px; margin-bottom:10px;
             font-size:11px; font-weight:600; color:#222; background:#fff; }
  .doc-title { text-align:center; font-size:15px; font-weight:bold;
               letter-spacing:1px; margin:10px 0 14px;
               text-decoration:underline; text-underline-offset:3px; color:#111; }
  .info-table { width:100%; border-collapse:collapse; margin-bottom:10px;
                page-break-inside:avoid; break-inside:avoid; }
  .info-table td { border:1px solid #bbb; padding:7px 10px; vertical-align:top; }
  .subject-row { display:flex; justify-content:space-between; border:1px solid #bbb;
                 padding:6px 10px; margin-bottom:10px; font-weight:700; font-size:12px;
                 page-break-inside:avoid; break-inside:avoid;
                 background:#fff; color:#111; }
  .body-text { margin-bottom:10px; font-size:11.5px; line-height:1.6; color:#000; }
  .items-table { width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:20px; }
  .items-table th { border:1px solid #888; padding:5px 4px; background:#fff;
                    color:#111; font-weight:700; text-align:center;
                    font-size:8.5px; text-transform:uppercase; letter-spacing:0.02em; }
  .items-table td { border:1px solid #bbb; padding:4px 4px; font-size:10px;
                    color:#111; vertical-align:middle; overflow:hidden; word-break:break-word; }
  .items-table tbody tr { page-break-inside:avoid; break-inside:avoid; }
  .items-table tr:nth-child(even) td { background:#fff; }
  .ack-box { border:1px solid #bbb; padding:14px 16px; margin-top:16px;
             page-break-inside:avoid; break-inside:avoid; }
  .ack-title { font-weight:bold; text-align:center; font-size:13px;
               margin-bottom:8px; letter-spacing:0.05em; color:#111; }
  .ack-text  { font-size:11.5px; line-height:1.6; margin-bottom:28px; color:#000; }
  .sign-row  { display:flex; justify-content:space-between;
               font-weight:700; font-size:12px; margin-top:8px; color:#111; }
`;

// ── Internal HTML builder ─────────────────────────────────────
// Shared by printMatpassPDF (popup) and buildMatpassBlobUrl (iframe blob).
// If the caller already has customers/stockItems in state they're passed in
// directly — no redundant API calls.
async function _buildMatpassHTML({ row, customers, stockItems, toast, movements: passedMovements }) {
  const [resolvedCustomers, resolvedStockItems] = await Promise.all([
    customers  ? Promise.resolve(customers)  : apiGet("/api/customers").catch(() => []),
    stockItems ? Promise.resolve(stockItems) : apiGet("/api/stock-items").catch(() => []),
  ]);

  const customer = resolvedCustomers.find(c => String(c.id) === String(row.party));

  let contactName  = row.contactPerson || "—";
  let contactPhone = "";
  if (row.contactPerson && row.party) {
    try {
      const list  = await apiGet(`/api/customers/${row.party}/parties`);
      const found = (Array.isArray(list) ? list : [])
        .find(c => String(c.id) === String(row.contactPerson));
      if (found) {
        contactName  = found.partyName || found.name || contactName;
        contactPhone =  found.partyPhoneno || "";
      }
    } catch { /* keep raw value */ }
  }

  let movements;
  if (passedMovements) {
    // Caller already has the movements in React Query state — no extra fetch.
    movements = passedMovements;
  } else {
    try {
      const data = await apiGet(`/api/stocks/matpass/${row.id}`);
      movements  = Array.isArray(data) ? data.filter(m => Number(m.status) !== 0) : [];
    } catch (e) {
      toast?.error?.("Could not load stock items for PDF: " + e.message);
      return null;
    }
  }

  const itemMap = {};
  (Array.isArray(resolvedStockItems) ? resolvedStockItems : [])
    .forEach(si => { itemMap[si.id] = si; });

  const direction  = (row.inOrOut || "OUT").toUpperCase();
  const dateStr    = row.date || "—";
  const returnType = movements.length > 0
    ? (movements[0].stockReturnOrNonReturn || "NON_RETURN").replace(/-/g, "_").toUpperCase()
    : "NON_RETURN";
  const partyName  = customer?.companyName || customer?.name
    || (row.party ? `Party #${row.party}` : "—");
  const addr1 = customer?.buyerAddress1 || "";
  const addr2 = customer?.buyerAddress2 || "";
  const addr3 = customer?.buyerAddress3 || "";
  const hasTopQty = row.quantity && Number(row.quantity) > 0 && movements.length === 0;

  const rowsHtml = movements.length === 0 && !hasTopQty
    ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:#888;font-style:italic">
         No stock items linked to this MAT Pass.</td></tr>`
    : hasTopQty
    ? `<tr>
         <td style="text-align:center">1</td>
         <td>${esc(row.discription || "General")}</td>
         <td style="text-align:center">—</td>
         <td style="text-align:center">${row.quantity}</td>
         <td>—</td>
       </tr>`
    : movements.map((m, i) => {
        const item = itemMap[m.stockItemId] || {};
        return `<tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${esc(item.productName || `Item #${m.stockItemId}`)}</td>
          <td style="text-align:center">${esc(item.smUnit || "—")}</td>
          <td style="text-align:center">${m.stockQuantity ?? "—"}</td>
          <td>${esc(m.stockDescription || "—")}</td>
        </tr>`;
      }).join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Material Pass</title>
<style>${MATPASS_CSS}</style>
</head><body>
<div class="page">
  ${invoiceCoHeader("lg")}
  <div class="doc-title">Material Pass</div>
  <div class="ref-bar">
    <span>Material Pass Ref : ${esc(row.refNo || row.id || "\u2014")}</span>
    <span>Date : ${dateStr}</span>
  </div>
  <table class="info-table">
    <tr>
      <td style="width:55%;vertical-align:top">
        <strong>TO</strong><br/>
        <strong style="font-size:13px">${esc(partyName)}</strong><br/><br/>
        <strong>ADDRESS DETAILS</strong><br/>
        ${addr1 ? `&nbsp;${esc(addr1)}<br/>` : ""}
        ${addr2 ? `&nbsp;${esc(addr2)}<br/>` : ""}
        ${addr3 ? `&nbsp;${esc(addr3)}<br/>` : ""}
        <br/><strong>Kind Attention:</strong>&nbsp;${esc(contactName)}${contactPhone ? ` / ${esc(contactPhone)}` : ""}
        ${row.quantity ? `<br/><br/><strong>Quantity:</strong>&nbsp;${row.quantity}` : ""}
      </td>
      <td style="vertical-align:top; padding-left:40px">
        <div style="font-size:11px; line-height:2.2;">
          <div><strong>Supply Order:</strong>&nbsp; ${dateStr}</div>
          <div><strong>Date of Supply Order:</strong>&nbsp; ${dateStr}</div>
          <div><strong>Date of Delivery:</strong>&nbsp; ${dateStr}</div>
          <div><strong>Date of Outward:</strong>&nbsp; ${dateStr}</div>
        </div>
      </td>
    </tr>
  </table>
  <div class="subject-row">
    <span>SUB: MATERIAL ${direction} PASS</span>
    <span>${returnType}</span>
  </div>
  <div class="body-text">
    <strong>Dear Sir/Madam</strong><br/>
    ${direction === "OUT"
      ? "We are delivering the following to your stores. Kindly please acknowledge the receipt."
      : "We are receiving the following items from your stores. Kindly please acknowledge the delivery."}
  </div>
  <table class="items-table">
    <thead><tr>
      <th style="width:50px">S.NO</th>
      <th>DESCRIPTION</th>
      <th style="width:80px">UNIT</th>
      <th style="width:90px">QUANTITY</th>
      <th>REMARKS</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div style="border:1px solid #bbb; height:80px; margin-bottom:16px;
              page-break-inside:avoid; break-inside:avoid;"></div>
  <div class="ack-box">
    <div class="ack-title">ACKNOWLEDGEMENT</div>
    <div class="ack-text">We acknowledge and confirm that we have inspected and received the
    items with details as mentioned above.</div>
    <div class="sign-row">
      <span>Signature of receiver</span>
      <span>Date</span>
    </div>
  </div>
</div>
</body></html>`;
}

// ── Exports ───────────────────────────────────────────────────

export async function printMatpassPDF({ row, customers, stockItems, toast }) {
  const html = await _buildMatpassHTML({ row, customers, stockItems, toast });
  if (html) openPrintWindow(html);
}

export async function buildMatpassBlobUrl({ row, customers, stockItems, toast }) {
  const html = await _buildMatpassHTML({ row, customers, stockItems, toast });
  if (!html) return null;
  return URL.createObjectURL(new Blob([html], { type: "text/html" }));
}