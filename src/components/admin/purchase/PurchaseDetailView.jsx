// src/components/admin/purchase/PurchaseDetailView.jsx
//
// Read-only detail card for a single purchase record.
// Mirrors SaleDetailView — same layout, same helper components,
// adapted for purchase field names (purchaseDate, purchaseFromParty, etc.)
//
// Props:
//   purchase      — purchase object (from purchases query, via fromPurchaseDTO)
//   onBack        — () => void
//   onEdit        — () => void
//   onOpenItems   — () => void
//   canEdit       — bool
//   customerName  — (id) => string
//   fileRefLabel  — (ref) => string
//   doctypeLabel  — (v)  => string
//   statusLabel   — (v)  => string

import { fmtDate } from "../shared/adminStyles";
import { SectionCard, InfoCard, DetailRow, DocBadge } from "./purchaseHelpers";

export default function PurchaseDetailView({
  purchase, onBack, onEdit, onOpenItems, canEdit,
  customerName, fileRefLabel, doctypeLabel, statusLabel,
}) {
  return (
    <div style={{ padding: 24 }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button className="act-back-btn" onClick={onBack}>← Purchases</button>
        <span style={{ color: "var(--a-text-faint)" }}>/</span>
        <span style={{ color: "var(--a-text-muted)", fontSize: "0.9rem" }}>
          {doctypeLabel(purchase.purchaseDoctype)}
        </span>
        <span style={{ color: "var(--a-text-faint)" }}>/</span>
        <span style={{ color: "var(--a-teal)", fontWeight: 600, fontSize: "0.9rem" }}>
          {customerName(purchase.purchaseFromParty)} → {customerName(purchase.purchaseToParty)}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="act-btn act-save" onClick={onOpenItems}>
            <span className="btn-icon">📋</span>
            <span className="btn-label"> Line Items</span>
          </button>
          {canEdit && (
            <button className="act-btn act-edit" onClick={onEdit}>
              <span className="btn-icon">✏️</span>
              <span className="btn-label"> Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Header card ── */}
      <div style={{
        background: "var(--a-teal-05)", border: "1px solid var(--a-teal-20)",
        borderRadius: 10, padding: "18px 22px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div>
          <p style={{
            margin: "0 0 6px", fontSize: "0.68rem", fontWeight: 800,
            letterSpacing: "0.08em", color: "var(--a-text-faint)", textTransform: "uppercase",
          }}>
            Purchase Detail
          </p>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.6rem", fontWeight: 800, color: "var(--a-text)" }}>
            <DocBadge type={doctypeLabel(purchase.purchaseDoctype)} />
          </h2>
          <span style={{ fontSize: "0.78rem", color: "var(--a-text-muted)" }}>
            {purchase.purchaseTxType || "—"}
          </span>
        </div>
        <span style={{
          background: "var(--a-teal-10)", color: "var(--a-teal)", padding: "7px 16px",
          borderRadius: 20, fontSize: "0.85rem", fontWeight: 700,
          border: "1px solid var(--a-teal-30)", whiteSpace: "nowrap",
        }}>
          #{purchase.id}
        </span>
      </div>

      {/* ── Date cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <InfoCard label="Purchase Date"  value={fmtDate(purchase.purchaseDate)}     icon="📅" />
        <InfoCard label="Validity Date"  value={fmtDate(purchase.purchaseValidity)} icon="⏳" />
      </div>

      {/* ── Party cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <InfoCard label="From Party" value={customerName(purchase.purchaseFromParty)} teal />
        <InfoCard label="To Party"   value={customerName(purchase.purchaseToParty)}   teal />
      </div>

      {/* ── Document details ── */}
      <SectionCard title="Document Details">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 24px" }}>
          <DetailRow label="Currency"       value={purchase.purchaseCurrency} />
          <DetailRow label="Payment Terms"  value={purchase.purchasePaymentTerms} />
          <DetailRow label="Delivery Terms" value={purchase.purchaseDeliveryTerms} />
          <DetailRow label="Enquiry Date"   value={fmtDate(purchase.purchaseEnquireDate)} />
          <DetailRow label="Addressed To"   value={purchase.purchaseAddressedTo} />
          <DetailRow label="File Reference" value={fileRefLabel(purchase.purchaseFileRef)} />
          <DetailRow label="Status"         value={statusLabel(purchase.purchaseStatus)} teal />
        </div>
      </SectionCard>

      {/* ── Description ── */}
      <SectionCard title="Description" noMargin>
        <p style={{
          margin: 0, fontSize: "0.875rem", lineHeight: 1.7, whiteSpace: "pre-wrap",
          color: purchase.purchaseDescription ? "var(--a-text-body)" : "var(--a-text-faint)",
          fontStyle: purchase.purchaseDescription ? "normal" : "italic",
        }}>
          {purchase.purchaseDescription || "No description provided."}
        </p>
      </SectionCard>

      <div style={{ marginTop: 20 }}>
        <button className="activity-add-btn" onClick={onOpenItems}>
          <span className="btn-icon">📋</span>
          <span className="btn-label"> View Line Items</span>
        </button>
      </div>

    </div>
  );
}
