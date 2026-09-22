// src/components/admin/purchase/PurchaseFormFields.jsx
//
// Renders the add/edit form for a purchase header record.
// Props:
//   form            — current purchase form state
//   setForm         — setState setter
//   contacts        — contacts list for the selected To Party
//   loadingContacts — boolean
//   onToPartyChange — async (customerId: string) => void
//   errs            — validation error map
//   customers       — full customer list (from ["customers"] query)
//   files           — full files list   (from ["files"] query)

import React from "react";
import { labelStyle, inputStyle } from "../shared/adminStyles";
import {
  DOCTYPE_OPTIONS, STATUS_OPTIONS, CURRENCIES, errStyle,
} from "./purchaseConstants";
import DatePicker from "../DatePicker";

export default function PurchaseFormFields({
  form, setForm, onFieldChange,
  contacts, loadingContacts, onToPartyChange,
  errs = {},
  customers, files,
}) {
  const err = (key) => errs[key] && <span style={errStyle}>{errs[key]}</span>;
  const errBorder = (key) =>
    errs[key] ? { border: "1px solid var(--a-danger, #ef4444)" } : {};

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>

      {/* ── Purchase Date ── */}
      <div>
        <label style={labelStyle}>Purchase Date *</label>
        <DatePicker
          value={form.purchaseDate}
          onChange={(date) => onFieldChange("purchaseDate", date)}
        />
        {err("purchaseDate")}
      </div>

      {/* ── Validity Date ── */}
      <div>
        <label style={labelStyle}>Validity Date *</label>
        <DatePicker
          value={form.purchaseValidity}
          onChange={(date) => onFieldChange("purchaseValidity", date)}
        />
        {err("purchaseValidity")}
      </div>

      {/* ── From Party ── */}
      <div>
        <label style={labelStyle}>From Party *</label>
        <select
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseFromParty") }}
          value={form.purchaseFromParty}
          onChange={(e) => {
            const val = e.target.value;
            // If new fromParty matches current toParty, reset toParty
            if (String(val) === String(form.purchaseToParty)) {
              onToPartyChange("");
              setForm((prev) => ({
                ...prev,
                purchaseFromParty: val,
                purchaseToParty: "",
                purchaseAddressedTo: "",
              }));
            } else {
              onFieldChange("purchaseFromParty", val);
            }
          }}
        >
          <option value="">— Select supplier —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
        {err("purchaseFromParty")}
      </div>

      {/* ── To Party ── */}
      <div>
        <label style={labelStyle}>To Party *</label>
        <select
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseToParty") }}
          value={form.purchaseToParty}
          onChange={(e) => onToPartyChange(e.target.value)}
        >
          <option value="">— Select recipient —</option>
          {customers
            .filter((c) => String(c.id) !== String(form.purchaseFromParty))
            .map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
        </select>
        {err("purchaseToParty")}
      </div>

      {/* ── Enquiry Date ── */}
      <div>
        <label style={labelStyle}>Enquiry Date *</label>
        <DatePicker
          value={form.purchaseEnquireDate}
          onChange={(date) => onFieldChange("purchaseEnquireDate", date)}
        />
        {err("purchaseEnquireDate")}
      </div>

      {/* ── File Reference ── */}
      <div>
        <label style={labelStyle}>File Reference *</label>
        <select
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseFileRef") }}
          value={form.purchaseFileRef}
          onChange={(e) => onFieldChange("purchaseFileRef", e.target.value)}
        >
          <option value="">— Select File —</option>
          {files.map((f) => (
            <option key={f.fileId} value={f.fileId}>
              {f.fileId} – {f.activity}
            </option>
          ))}
        </select>
        {err("purchaseFileRef")}
      </div>

      {/* ── Document Type ── */}
      <div>
        <label style={labelStyle}>Document Type *</label>
        <select
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseDoctype") }}
          value={form.purchaseDoctype}
          onChange={(e) => onFieldChange("purchaseDoctype", e.target.value)}
        >
          {DOCTYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {err("purchaseDoctype")}
      </div>

      {/* ── Currency ── */}
      <div>
        <label style={labelStyle}>Currency *</label>
        <select
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseCurrency") }}
          value={form.purchaseCurrency}
          onChange={(e) => onFieldChange("purchaseCurrency", e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {err("purchaseCurrency")}
      </div>

      {/* ── Delivery Terms ── */}
      <div>
        <label style={labelStyle}>Delivery Terms *</label>
        <input
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseDeliveryTerms") }}
          placeholder="e.g. FOB, CIF, Ex-Works"
          value={form.purchaseDeliveryTerms}
          onChange={(e) => onFieldChange("purchaseDeliveryTerms", e.target.value)}
        />
        {err("purchaseDeliveryTerms")}
      </div>

      {/* ── Payment Terms ── */}
      <div>
        <label style={labelStyle}>Payment Terms *</label>
        <input
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchasePaymentTerms") }}
          placeholder="e.g. Net 30, Advance"
          value={form.purchasePaymentTerms}
          onChange={(e) => onFieldChange("purchasePaymentTerms", e.target.value)}
        />
        {err("purchasePaymentTerms")}
      </div>

      {/* ── Transaction Type ── */}
      <div>
        <label style={labelStyle}>Transaction Type *</label>
        <input
          className="activity-input"
          style={{ ...inputStyle, ...errBorder("purchaseTxType") }}
          placeholder="e.g. Domestic, Import"
          value={form.purchaseTxType}
          onChange={(e) => onFieldChange("purchaseTxType", e.target.value)}
        />
        {err("purchaseTxType")}
      </div>

      {/* ── Addressed To (depends on To Party) ── */}
      <div>
        <label style={labelStyle}>Addressed To *</label>
        <select
          className="activity-input"
          style={{
            ...inputStyle,
            opacity: form.purchaseToParty ? 1 : 0.5,
            cursor: form.purchaseToParty ? "pointer" : "not-allowed",
            ...errBorder("purchaseAddressedTo"),
          }}
          value={form.purchaseAddressedTo}
          disabled={!form.purchaseToParty}
          onChange={(e) => onFieldChange("purchaseAddressedTo", e.target.value)}
        >
          <option value="">
            {!form.purchaseToParty
              ? "— Select To Party first —"
              : loadingContacts
              ? "Loading contacts…"
              : contacts.length === 0
              ? "— No contacts found —"
              : "— Select contact —"}
          </option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.phone ? ` (${c.phone})` : ""}
            </option>
          ))}
        </select>
        {err("purchaseAddressedTo")}
      </div>

      {/* ── Status ── */}
      <div>
        <label style={labelStyle}>Status</label>
        <select
          className="activity-input"
          style={inputStyle}
          value={form.purchaseStatus}
          onChange={(e) => onFieldChange("purchaseStatus", e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Description (full width) ── */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>Description *</label>
        <textarea
          className="activity-input activity-textarea"
          style={{
            ...inputStyle,
            minHeight: 68,
            resize: "vertical",
            ...errBorder("purchaseDescription"),
          }}
          placeholder="Description is required…"
          value={form.purchaseDescription}
          onChange={(e) => onFieldChange("purchaseDescription", e.target.value)}
        />
        {err("purchaseDescription")}
      </div>
    </div>
  );
}