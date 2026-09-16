// src/components/admin/party/CustomerDetail.jsx
//
// Read-only detail view for a single customer.
// Receives data from its parent (Party.jsx) via props — no query of its own.
//
// Props:
//   customer  — full customer object
//   role      — user role string
//   onBack    — () => void
//   onEdit    — (customer) => void
//   onDelete  — () => void  (parent handles the actual delete + cache update)

import { useState } from "react";
import { canDelete as canDeleteRole } from "../shared/adminStyles";
import { ConfirmDelete } from "../shared/AdminTable";
import Btn       from "../shared/Btn";
import StatusDot from "../shared/StatusDot";
import { TypeBadge } from "./partyShared";
import ContactsModal from "./ContactsModal";

// ── Private: read-only display row ───────────────────────────────────────────

function DetailRow({ label, value, span2, mono, cols }) {
  return (
    <div style={{ gridColumn: span2 ? "1 / -1" : cols ? `span ${cols}` : undefined }}>
      <div style={{
        fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.07em",
        color: "var(--a-text-faint)", textTransform: "uppercase", marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "0.875rem",
        color: value ? "var(--a-text)" : "var(--a-text-faint)",
        fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
        fontWeight: mono ? 600 : 400,
        padding: "7px 11px",
        background: "var(--a-teal-04, rgba(20,184,166,0.04))",
        border: "1px solid var(--a-teal-10, rgba(20,184,166,0.10))",
        borderRadius: 6, minHeight: 34,
        wordBreak: "break-word",
      }}>
        {value || <span style={{ opacity: 0.38, fontStyle: "italic" }}>Not provided</span>}
      </div>
    </div>
  );
}

// ── Private: titled section card ─────────────────────────────────────────────

function DetailSection({ title, children, fullWidth }) {
  return (
    <div style={{
      background: "var(--a-surface-solid)", borderRadius: 12,
      border: "1px solid var(--a-border-card)", padding: "20px 24px",
      gridColumn: fullWidth ? "1 / -1" : undefined,
    }}>
      <div style={{
        fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em",
        color: "var(--a-teal)", marginBottom: 14,
        borderBottom: "1px solid var(--a-teal-20)", paddingBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Helpers: initials + deterministic avatar colour ───────────────────────────

function getInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Generates a consistent hue from the company name so every party gets its
// own colour but the same name always maps to the same colour.
function nameToHsl(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg:   `hsl(${hue}, 55%, 28%)`,
    ring: `hsl(${hue}, 65%, 45%)`,
    text: `hsl(${hue}, 80%, 82%)`,
  };
}

// ── CustomerDetail (exported) ─────────────────────────────────────────────────

export default function CustomerDetail({ customer, role, onBack, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contactsFor, setContactsFor]     = useState(null);

  const canEdit = role === "SUPER" || role === "ADMIN";
  const canDelete = canDeleteRole(role);

  const addr = (...parts) => parts.filter(Boolean).join(", ") || null;

  const initials  = getInitials(customer.companyName);
  const avatarClr = nameToHsl(customer.companyName);

  return (
    <div style={{ padding: 24 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <button className="act-back-btn" onClick={onBack}>← Back to Customers</button>
        <div style={{ flex: 1 }} />
        <Btn variant="teal" onClick={() => setContactsFor(customer)}>🤝 Parties</Btn>
        {canEdit && (
          <Btn variant="default" onClick={() => onEdit(customer)}>✏️ Edit</Btn>
        )}
        {canDelete && (
          confirmDelete ? (
            <ConfirmDelete
              label="Delete this customer?"
              onConfirm={onDelete}
              onCancel={() => setConfirmDelete(false)}
            />
          ) : (
            <Btn variant="danger" onClick={() => setConfirmDelete(true)}>🗑 Delete</Btn>
          )
        )}
      </div>

      {/* Identity card */}
      <div style={{
        background: "var(--a-surface-solid)", borderRadius: 12,
        border: "1px solid var(--a-border-card)", padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 16,
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: 12, flexShrink: 0,
          background: avatarClr.bg,
          border: `2px solid ${avatarClr.ring}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.04em",
          color: avatarClr.text,
          fontFamily: "var(--font-head, 'Barlow Condensed', sans-serif)",
          userSelect: "none",
        }}>{initials}</div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--a-teal)" }}>
            {customer.companyName}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <TypeBadge type={customer.customerType} />
            <StatusDot status={customer.status} />
            {/* Raw DB auto-generated ID — no S-xxx formatting */}
            <span style={{ fontSize: "0.75rem", color: "var(--a-text-faint)" }}>ID #{customer.id}</span>
          </div>
        </div>
      </div>

      {/* Detail sections grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        <DetailSection title="CONTACT &amp; BASIC" fullWidth>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 20px" }}>
            <DetailRow label="Contact Number" value={customer.contactNumber} />
            <DetailRow label="Email"          value={customer.email} />
            <DetailRow label="Website"        value={customer.website} />
          </div>
        </DetailSection>

        <DetailSection title="TAX &amp; LEGAL">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            <DetailRow label="GST Number" value={customer.gst}       mono />
            <DetailRow label="PAN Number" value={customer.pan}       mono />
            <DetailRow label="TAN Number" value={customer.tan}       mono />
            <DetailRow label="CIN Number" value={customer.cin}       mono />
            <DetailRow label="GST LUT No." value={customer.cGstLutNo} mono span2 />
          </div>
        </DetailSection>

        <DetailSection title="ADDRESSES">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
            <DetailRow
              label="Buyer Address"
              value={addr(customer.buyerAddress1, customer.buyerAddress2, customer.buyerAddress3)}
            />
            <DetailRow
              label="Shipping Address"
              value={addr(customer.shippingAddress1, customer.shippingAddress2, customer.shippingAddress3)}
            />
          </div>
        </DetailSection>

        <DetailSection title="BANK DETAILS" fullWidth>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 24px" }}>
            <DetailRow label="Account Holder" value={customer.bankAccHolder} />
            <DetailRow label="Bank Name"      value={customer.bankName} />
            <DetailRow label="Account Number" value={customer.accountNumber} mono />
            <DetailRow label="IFSC Code"      value={customer.ifscCode}      mono />
            <DetailRow label="MICR Code"      value={customer.micrCode}      mono />
            <DetailRow label="SWIFT Code"     value={customer.cSwiftCode}    mono />
            <DetailRow label="Bank Code"      value={customer.cBankCode}     mono />
            <DetailRow label="IBAN"           value={customer.cIban}         mono />
            <DetailRow
              label="Branch Address"
              value={addr(customer.cBankBranchAdd1, customer.cBankBranchAdd2, customer.cBankBranchAdd3)}
            />
          </div>
        </DetailSection>

      </div>

      {/* Contacts modal (lazy — only mounted when open) */}
      {contactsFor && (
        <ContactsModal
          customer={contactsFor}
          onClose={() => setContactsFor(null)}
          role={role}
        />
      )}
    </div>
  );
}
