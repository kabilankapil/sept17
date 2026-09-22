// src/components/admin/party/CustomerFormFields.jsx
//
// Renders the add/edit form grid for a customer record.
// Does NOT own any state or queries — all values flow in via props.
// The save/cancel buttons remain in Party.jsx (same pattern as PurchaseFormFields).
//
// Props:
//   form               — current form state object
//   onChange(f, v)     — update field `f` to value `v` (handles uppercase, clears error)
//   onAddressChange(f,v) — same but syncs shipping when sameAddress is active
//   sameAddress        — boolean: shipping mirrors buyer address
//   onSameAddressChange(checked) — checkbox handler in parent
//   errors             — field-level error map  { fieldName: "message" }
//   isIntl             — derived bool: form.customerType === "International"

import { Field } from "./partyShared";
import { CUSTOMER_TYPES, STATUS_OPTIONS } from "./partyConstants";

// ── Private: section header ───────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em",
      color: "var(--a-teal)", paddingTop: 8, paddingBottom: 4,
      borderBottom: "1px solid var(--a-teal-20)", marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

// ── Private: banner-level error (e.g. API error) ─────────────────────────────

function ErrMsg({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      color: "var(--a-danger)", background: "var(--a-danger-10)",
      border: "1px solid var(--a-danger-30)",
      borderRadius: 6, padding: "8px 14px", fontSize: "0.83rem", marginTop: 10,
    }}>
      ⚠ {msg}
    </div>
  );
}

// ── CustomerFormFields (exported) ─────────────────────────────────────────────

export default function CustomerFormFields({
  form,
  onChange,
  onAddressChange,
  sameAddress,
  onSameAddressChange,
  errors = {},
  isIntl,
  formErr,
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>

        {/* ── BASIC INFORMATION ── */}
        <SectionLabel>BASIC INFORMATION</SectionLabel>

        {/* DB col: NAME */}
        <Field label="Company Name" required error={errors.companyName}>
          <input className="activity-input" placeholder="Company name" value={form.companyName}
            onChange={e => onChange("companyName", e.target.value)} />
        </Field>
        {/* DB col: CONTACT */}
        <Field label="Contact Number" required error={errors.contactNumber}>
          <input className="activity-input" placeholder="10-digit phone" value={form.contactNumber}
            onChange={e => onChange("contactNumber", e.target.value)} maxLength={10} />
        </Field>
        {/* DB col: GMAIL_ID */}
        <Field label="Email" required error={errors.email}>
          <input type="email" className="activity-input" placeholder="email@company.com" value={form.email}
            onChange={e => onChange("email", e.target.value)} />
        </Field>
        {/* DB col: WEBSITE */}
        <Field label="Website" required error={errors.website}>
          <input className="activity-input" placeholder="www.example.com" value={form.website}
            onChange={e => onChange("website", e.target.value)} />
        </Field>
        {/* DB col: CUST_TYPE — stores "Local" or "International" as-is */}
        <Field label="Customer Type" required>
          <select className="activity-input" value={form.customerType}
            onChange={e => onChange("customerType", e.target.value)}>
            {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {/* DB col: STATUS — Integer 1/0, converted via party.js */}
        <Field label="Status" required>
          <select className="activity-input" value={form.status}
            onChange={e => onChange("status", e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        {/* ── TAX & LEGAL ── */}
        <SectionLabel>TAX &amp; LEGAL</SectionLabel>

        {/* DB col: GST */}
        <Field label="GST Number" required error={errors.gst}>
          <input className="activity-input" placeholder="29AAAAA0000A1Z5" value={form.gst}
            onChange={e => onChange("gst", e.target.value)} maxLength={15} />
        </Field>
        {/* DB col: PAN */}
        <Field label="PAN Number" required error={errors.pan}>
          <input className="activity-input" placeholder="AAAAA0000A" value={form.pan}
            onChange={e => onChange("pan", e.target.value)} maxLength={10} />
        </Field>
        {/* DB col: TAN */}
        <Field label="TAN Number" required error={errors.tan}>
          <input className="activity-input" placeholder="BLRM12345A" value={form.tan}
            onChange={e => onChange("tan", e.target.value)} maxLength={10} />
        </Field>
        {/* DB col: CIN */}
        <Field label="CIN Number" required error={errors.cin}>
          <input className="activity-input" placeholder="U72200KA2013PTC069886" value={form.cin}
            onChange={e => onChange("cin", e.target.value)} maxLength={21} />
        </Field>
        {/* DB col: C_GSTLUTNO */}
        <Field label="GST LUT No." required span2 error={errors.cGstLutNo}>
          <input className="activity-input" placeholder="LUT290124AB1234567" value={form.cGstLutNo}
    onChange={e => onChange("cGstLutNo", e.target.value)} maxLength={17} />
        </Field>

        {/* ── BUYER ADDRESS ── */}
        <SectionLabel>BUYER ADDRESS</SectionLabel>

        {/* DB col: BUYER_ADDRESS_1 */}
        <Field label="Address Line 1" required error={errors.buyerAddress1}>
          <input className="activity-input" placeholder="Street / Building" value={form.buyerAddress1}
            onChange={e => onAddressChange("buyerAddress1", e.target.value)} />
        </Field>
        {/* DB col: BUYER_ADDRESS_2 */}
        <Field label="Address Line 2" required error={errors.buyerAddress2}>
          <input className="activity-input" placeholder="Area / Landmark" value={form.buyerAddress2}
            onChange={e => onAddressChange("buyerAddress2", e.target.value)} />
        </Field>
        {/* DB col: BUYER_ADDRESS_3 */}
        <Field label="Address Line 3" required span2 error={errors.buyerAddress3}>
          <input className="activity-input" placeholder="City, State, PIN" value={form.buyerAddress3}
            onChange={e => onAddressChange("buyerAddress3", e.target.value)} />
        </Field>

        {/* ── SHIPPING ADDRESS (with "same as buyer" checkbox) ── */}
        <div style={{
          gridColumn: "1 / -1",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 8, paddingBottom: 4,
          borderBottom: "1px solid var(--a-teal-20)", marginBottom: 4,
        }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--a-teal)" }}>
            SHIPPING ADDRESS <span style={{ color: "var(--a-danger)" }}>*</span>
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={sameAddress}
              onChange={e => onSameAddressChange(e.target.checked)}
              style={{ accentColor: "var(--a-teal)", width: 14, height: 14, cursor: "pointer" }}
            />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--a-text-muted)", letterSpacing: "0.03em" }}>
              Same as Buyer Address
            </span>
          </label>
        </div>

        {/* DB col: SHIPPING_ADDRESS_1 */}
        <Field label="Address Line 1" required error={errors.shippingAddress1}>
          <input className="activity-input" placeholder="Street / Building" value={form.shippingAddress1}
            disabled={sameAddress} style={{ opacity: sameAddress ? 0.5 : 1 }}
            onChange={e => onChange("shippingAddress1", e.target.value)} />
        </Field>
        {/* DB col: SHIPPING_ADDRESS_2 */}
        <Field label="Address Line 2" required error={errors.shippingAddress2}>
          <input className="activity-input" placeholder="Area / Landmark" value={form.shippingAddress2}
            disabled={sameAddress} style={{ opacity: sameAddress ? 0.5 : 1 }}
            onChange={e => onChange("shippingAddress2", e.target.value)} />
        </Field>
        {/* DB col: SHIPPING_ADDRESS_3 */}
        <Field label="Address Line 3" required span2 error={errors.shippingAddress3}>
          <input className="activity-input" placeholder="City, State, PIN" value={form.shippingAddress3}
            disabled={sameAddress} style={{ opacity: sameAddress ? 0.5 : 1 }}
            onChange={e => onChange("shippingAddress3", e.target.value)} />
        </Field>

        {/* ── BANK DETAILS ── */}
        <SectionLabel>BANK DETAILS</SectionLabel>

        {/* DB col: BANKACCHOLDER */}
        <Field label="Account Holder Name" required error={errors.bankAccHolder}>
          <input className="activity-input" placeholder="Name as on account" value={form.bankAccHolder}
            onChange={e => onChange("bankAccHolder", e.target.value)} />
        </Field>
        {/* DB col: BANKNAME */}
        <Field label="Bank Name" required error={errors.bankName}>
          <input className="activity-input" placeholder="e.g. State Bank of India" value={form.bankName}
            onChange={e => onChange("bankName", e.target.value)} />
        </Field>
        {/* DB col: ACCNUMBER */}
        <Field label="Account Number" required error={errors.accountNumber}>
          <input className="activity-input" placeholder="Account number" value={form.accountNumber}
            onChange={e => onChange("accountNumber", e.target.value)} />
        </Field>
        {/* DB col: MICRCODE */}
        <Field label="MICR Code" required error={errors.micrCode}>
          <input className="activity-input" placeholder="9-digit MICR code" value={form.micrCode}
            onChange={e => onChange("micrCode", e.target.value)} maxLength={9} />
        </Field>
        {/* DB col: IFSCCODE */}
        <Field label="IFSC Code" required error={errors.ifscCode}>
          <input className="activity-input" placeholder="SBIN0001234" value={form.ifscCode}
            onChange={e => onChange("ifscCode", e.target.value)} maxLength={11} />
        </Field>

        {/* International-only bank fields — required when CUST_TYPE = "International" */}
        {/* DB col: C_SWIFT_CODE */}
        <Field label="SWIFT Code" required={isIntl} error={errors.cSwiftCode}>
          <input className="activity-input" placeholder="e.g. SBININBB" value={form.cSwiftCode}
            onChange={e => onChange("cSwiftCode", e.target.value)} />
        </Field>
        {/* DB col: C_BANKCODE */}
        <Field label="Bank Code" required={isIntl} error={errors.cBankCode}>
          <input className="activity-input" placeholder="Bank code" value={form.cBankCode}
            onChange={e => onChange("cBankCode", e.target.value)} />
        </Field>
        {/* DB col: C_IBAN */}
        <Field label="IBAN" required={isIntl} error={errors.cIban}>
          <input className="activity-input" placeholder="IBAN number" value={form.cIban}
            onChange={e => onChange("cIban", e.target.value)} />
        </Field>

        {/* DB col: C_BANKBRANCH_ADD_1/2/3 */}
        <Field label="Branch Address Line 1" error={errors.cBankBranchAdd1}>
          <input className="activity-input" placeholder="Branch street" value={form.cBankBranchAdd1}
            onChange={e => onChange("cBankBranchAdd1", e.target.value)} />
        </Field>
        <Field label="Branch Address Line 2" error={errors.cBankBranchAdd2}>
          <input className="activity-input" placeholder="Branch area" value={form.cBankBranchAdd2}
            onChange={e => onChange("cBankBranchAdd2", e.target.value)} />
        </Field>
        <Field label="Branch Address Line 3" span2 error={errors.cBankBranchAdd3}>
          <input className="activity-input" placeholder="City, State, PIN" value={form.cBankBranchAdd3}
            onChange={e => onChange("cBankBranchAdd3", e.target.value)} />
        </Field>

      </div>{/* end grid */}

      {/* Banner-level API error (e.g. duplicate GST) */}
      <ErrMsg msg={formErr} />
    </>
  );
}
