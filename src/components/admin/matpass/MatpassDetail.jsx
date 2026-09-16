// src/components/admin/matpass/MatpassDetail.jsx
//
// Read-only detail view for a single MAT Pass record.
// Owns its own data fetching for stock rows and contact resolution
// (mirrors how ContactsModal owns its query — no prop-drilling of loaded data).
//
// Props:
//   mp            — the selected matpass record
//   onBack        — () => void
//   onEdit        — (mp) => void  — triggers parent's startEdit
//   customers     — full customers list (from ["customers"] query in parent)
//   files         — full files list     (from ["files"] query in parent)
//   stockItems    — full stock items    (from ["stockItems"] query in parent)
//   allMovements  — all stock movements (from ["stocks","all"] query in parent)
//   editable      — boolean derived from role

import { useState, useEffect } from "react";
import { getStocksByMatpass } from "../../../api/stocks";
import { getContacts }        from "../../../api/party";
import { printMatpassPDF }    from "../PDFTemplates";
import { editCardStyle, fmtDate, iconBtn } from "../shared/adminStyles";
import { useToast } from "../shared/ToastContext";
import { StatusBadge, DirectionBadge, DetailField } from "./matpassShared";
import StockItemsSection from "./StockItemsSection";
import { resolveCustomerName, resolveFileLabel } from "./matpassHelpers";

export default function MatpassDetail({
  mp,
  onBack,
  onEdit,
  customers,
  files,
  stockItems,
  allMovements,
  editable,
}) {
  const toast = useToast();

  const [detailStockRows,    setDetailStockRows]    = useState([]);
  const [detailStockLoading, setDetailStockLoading] = useState(false);
  const [detailContacts,     setDetailContacts]     = useState([]);
  const [pdfLoading,         setPdfLoading]         = useState(false);

  // ── Fetch stock movements + contacts when the selected matpass changes ───────
  useEffect(() => {
    if (!mp) return;

    // Stock movements linked to this matpass
    setDetailStockLoading(true);
    getStocksByMatpass(mp.id)
      .then(movs => {
        const active = (Array.isArray(movs) ? movs : []).filter(m => Number(m.status) !== 0);
        setDetailStockRows(active.map(m => ({
          _key:        `detail-${m.id}`,
          id:          m.id,
          stockItemId: String(m.stockItemId || ""),
          quantity:    String(m.stockQuantity || ""),
          remarks:     m.stockDescription || "",
          returnType:  m.stockReturnOrNonReturn || "NON-RETURN",
          deleted:     false,
        })));
      })
      .catch(() => {})
      .finally(() => setDetailStockLoading(false));

    // Contacts for the party — used to resolve contact person's full details
    if (mp.party) {
      getContacts(mp.party)
        .then(data => setDetailContacts(Array.isArray(data) ? data : []))
        .catch(() => setDetailContacts([]));
    } else {
      setDetailContacts([]);
    }
  }, [mp]);

  // ── PDF handler ───────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const rowMovements = allMovements.filter(
        m => String(m.matPassId) === String(mp.id) && Number(m.status) !== 0,
      );
      await printMatpassPDF({ row: mp, customers, stockItems, toast, movements: rowMovements });
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Resolve contact person details from DB ────────────────────────────────────
  const contactRecord = mp.contactPerson
    ? detailContacts.find(c => String(c.id) === String(mp.contactPerson)) || null
    : null;
  const contactName  = contactRecord?.name  || (mp.contactPerson ? String(mp.contactPerson) : null);
  const contactPhone = contactRecord?.phone || null;
  const contactEmail = contactRecord?.email || null;

  // ── Derived lookups ───────────────────────────────────────────────────────────
  const customerName = (id) => resolveCustomerName(customers, id);
  const fileLabel    = (id) => resolveFileLabel(files, id);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="content-section">
      {/* Page header */}
      <div className="activity-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="act-back-btn" onClick={onBack}>← Back</button>
          <span style={{ color: "var(--a-text-faint)", fontSize: "0.85rem" }}>
            / <strong style={{ color: "var(--a-teal)" }}>MAT Pass</strong>
            {" / "}#{mp.id}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {/* PDF download */}
          <button
            title="Download Material Pass PDF"
            disabled={pdfLoading}
            onClick={handleDownloadPDF}
            style={{
              ...iconBtn("var(--a-teal)", "var(--a-teal-08, rgba(20,184,166,0.08))", "var(--a-teal-30)"),
              fontSize: "0.85rem", padding: "6px 14px",
              opacity: pdfLoading ? 0.5 : 1,
            }}
          >
            {pdfLoading ? "⏳ Generating…" : "📄 "}
          </button>
          {/* Edit shortcut */}
          {editable && (
            <button
              title="Edit this MAT Pass"
              style={{
                ...iconBtn(
                  "var(--a-indigo,#6366f1)",
                  "var(--a-indigo-10,rgba(99,102,241,0.1))",
                  "var(--a-indigo-30,rgba(99,102,241,0.3))",
                ),
                fontSize: "0.85rem", padding: "6px 14px",
              }}
              onClick={() => onEdit(mp)}
            >
              ✏️ 
            </button>
          )}
        </div>
      </div>

      <div style={{ borderBottom: "1px solid var(--a-teal-20)", marginBottom: 20 }} />

      {/* Detail card */}
      <div style={{ ...editCardStyle, cursor: "default" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <span style={{ fontSize: "1.5rem" }}>🪪</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--a-text)" }}>
                #{mp.id}
              </span>
              <DirectionBadge value={mp.inOrOut} />
              <StatusBadge status={mp.status} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--a-text-faint)", marginTop: 3 }}>
              {fmtDate(mp.date)}
            </div>
          </div>
        </div>

        {/* Fields grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "22px 28px" }}>
          <DetailField label="Direction">
            <DirectionBadge value={mp.inOrOut} />
          </DetailField>

          <DetailField label="Party">
            <span style={{ fontWeight: 600, color: "var(--a-teal)" }}>
              {customerName(mp.party)}
            </span>
          </DetailField>

          <DetailField label="Date">
            {fmtDate(mp.date) || "—"}
          </DetailField>

          {/* Contact Person — resolved from DB contacts with phone + email */}
          <DetailField label="Contact Person">
            {contactName ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600 }}>{contactName}</span>
                {contactPhone && (
                  <span style={{
                    fontSize: "0.82rem", color: "var(--a-text-faint)",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <span style={{ fontSize: "0.9rem" }}>📞</span>
                    <a href={`tel:${contactPhone}`} style={{ color: "var(--a-teal)", textDecoration: "none" }}>
                      {contactPhone}
                    </a>
                  </span>
                )}
                {contactEmail && (
                  <span style={{
                    fontSize: "0.82rem", color: "var(--a-text-faint)",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <span style={{ fontSize: "0.9rem" }}>✉️</span>
                    <a href={`mailto:${contactEmail}`} style={{ color: "var(--a-teal)", textDecoration: "none" }}>
                      {contactEmail}
                    </a>
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: "var(--a-text-faint)" }}>—</span>
            )}
          </DetailField>

          <DetailField label="File Reference">
            {mp.fileRef
              ? <span style={{ fontWeight: 600 }}>{fileLabel(mp.fileRef)}</span>
              : <span style={{ color: "var(--a-text-faint)" }}>—</span>}
          </DetailField>

          <DetailField label="Status">
            <StatusBadge status={mp.status} />
          </DetailField>

          {mp.quantity != null && mp.quantity !== "" && (
            <DetailField label="Quantity">
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                {mp.quantity}
              </span>
            </DetailField>
          )}

          <DetailField label="Description" fullWidth>
            {mp.discription
              ? <span style={{ whiteSpace: "pre-wrap" }}>{mp.discription}</span>
              : <span style={{ color: "var(--a-text-faint)", fontStyle: "italic" }}>No description provided.</span>}
          </DetailField>
        </div>

        {/* Stock items */}
        {detailStockLoading ? (
          <div style={{
            marginTop: 20, padding: 16,
            textAlign: "center", color: "var(--a-text-faint)", fontSize: "0.82rem",
          }}>
            Loading stock items…
          </div>
        ) : (
          <StockItemsSection
            rows={detailStockRows}
            setRows={() => {}}        // no-op — readOnly
            stockItems={stockItems}
            allMovements={allMovements}
            readOnly
          />
        )}
      </div>
    </div>
  );
}
