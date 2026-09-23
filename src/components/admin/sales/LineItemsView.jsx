// src/components/admin/sales/LineItemsView.jsx
//
// Line items table + add/edit form for a single sale.
//
// Owns: ["salesItems", sale.id] React Query key.
// Mutations update the cache directly via queryClient.setQueryData
// (optimistic — faster than refetch round-trip, correct on next load).
//
// Props:
//   sale         — sale object
//   role         — user role string
//   customerName — (id) => string
//   customers    — customer[]
//   onBack       — () => void
//   onEdit       — () => void
//   canEdit      — bool

import { useState, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLineItems, createLineItem, updateLineItem, deleteLineItem } from "../../../api/sales";
import { printSalesInvoice } from "../PDFTemplates";
import { fmt, fmtDate, calcLine, iconBtn, editCardStyle, canDelete as canDeleteRole } from "../shared/adminStyles";
import { TableScroller, ConfirmDelete } from "../shared/AdminTable";
import { useToast } from "../shared/ToastContext";
import Btn from "../shared/Btn";
import StatusDot from "../shared/StatusDot";
import { DocBadge, ErrMsg, Field } from "./salesHelpers";
import { ITEM_STATUS_OPTIONS, EMPTY_LI, EMPTY_LI_ERRORS } from "./salesConstants";
import { validateLineItem } from "./salesValidation";

export default function LineItemsView({ sale, role, customerName, customers, onBack, onEdit, canEdit }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canDelete = canDeleteRole(role);

  const [showForm, setShowForm]     = useState(false);
  const [editingLi, setEditingLi]   = useState(null);
  const [liF, setLiF]               = useState(EMPTY_LI);
  const [liErrs, setLiErrs]         = useState(EMPTY_LI_ERRORS);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);

  // ── Query ────────────────────────────────────────────────────
  const { data: items = [], isLoading: loading, refetch: refetchItems } = useQuery({
    queryKey: ["salesItems", sale.id],
    queryFn:  () => getLineItems(sale.id),
    enabled:  !!sale?.id,
  });

  // ── Helpers ──────────────────────────────────────────────────
  const handlePrint = async () => {
    await printSalesInvoice({ sale, items, customers });
  };

  const handleLiChange = (field, val) => {
    const updated = { ...liF, [field]: val };
    setLiF({ ...updated, ...calcLine(updated) });
    if (liErrs[field]) setLiErrs((prev) => ({ ...prev, [field]: "" }));
  };

  const openAdd = () => {
    setEditingLi(null); setLiF(EMPTY_LI); setLiErrs(EMPTY_LI_ERRORS);
    setShowForm(true); setError(null);
  };

  const openEdit = (li) => {
    setEditingLi(li);
    // Zero out stored tax amounts before calcLine so stale DB values
    // never bleed through — calcLine recomputes from rates.
    const base = { ...li, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, total: 0 };
    setLiF({ ...base, ...calcLine(base) });
    setLiErrs(EMPTY_LI_ERRORS);
    setShowForm(true); setError(null);
  };

  const saveLi = async () => {
    // validateLineItem imported from salesValidation.js — pure function, no inline closure
    const { errs, valid } = validateLineItem(liF);
    setLiErrs(errs);
    if (!valid) {
      const firstErr = Object.values(errs).find(Boolean);
      toast.error(firstErr || "Please fix the errors before saving.");
      return;
    }
    setSaving(true); setError(null);
    try {
      if (editingLi) {
        const updated = await updateLineItem(editingLi.id, sale.id, liF);
        queryClient.setQueryData(["salesItems", sale.id], (prev = []) =>
          prev.map((x) => x.id === updated.id ? updated : x)
        );
      } else {
        const created = await createLineItem(sale.id, liF);
        queryClient.setQueryData(["salesItems", sale.id], (prev = []) => [...prev, created]);
      }
      setShowForm(false); setEditingLi(null); setLiF(EMPTY_LI); setLiErrs(EMPTY_LI_ERRORS);
    } catch (e) {
      toast.error(e.message);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteLi = async (li) => {
    try {
      await deleteLineItem(li.id);
      queryClient.setQueryData(["salesItems", sale.id], (prev = []) =>
        prev.filter((x) => x.id !== li.id)
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Grand totals — single reduce pass ───────────────────────
  // Previously five separate .reduce() calls — five full array iterations
  // on every render. Now one pass computes all five values at once.
  const totals = items.reduce(
    (acc, l) => ({
      taxable: acc.taxable + l.taxableValue,
      cgst:    acc.cgst    + l.cgstAmount,
      sgst:    acc.sgst    + l.sgstAmount,
      igst:    acc.igst    + l.igstAmount,
      total:   acc.total   + l.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );
  const totalTax = totals.cgst + totals.sgst + totals.igst;

  const roInput = { background: "var(--a-teal-05)", color: "var(--a-text-muted)" };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="content-section">

      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant="back" onClick={onBack} icon="←">← Sales</Btn>
        <span style={{ color: "var(--a-text-faint)" }}>/</span>
        <span style={{ color: "var(--a-text-muted)", fontSize: "0.88rem" }}>#{sale.id}</span>
        <span style={{ color: "var(--a-text-faint)" }}>/</span>
        <span style={{ color: "var(--a-teal)", fontWeight: 600, fontSize: "0.88rem" }}>Line Items</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={refetchItems} icon="↺">Refresh</Btn>
          <Btn variant="primary" onClick={handlePrint} icon="🖨️" title="Open print-ready invoice in a new tab">Print</Btn>
          {onEdit && canEdit && <Btn variant="default" onClick={onEdit} icon="✏️">Edit Sale</Btn>}
          {canEdit && <Btn variant="teal" onClick={openAdd} icon="＋">+ Add Item</Btn>}
        </div>
      </div>

      {/* ── Sale summary strip ── */}
      <div className="li-summary-strip">
        {[
          { label: "Sale ID",   content: <span style={{ fontWeight: 700, color: "var(--a-teal)" }}>#{sale.id}</span> },
          { label: "Doc Type",  content: <DocBadge type={sale.documentType} /> },
          { label: "From → To", content: <span style={{ fontSize: "0.88rem", color: "var(--a-text)" }}>{customerName(sale.fromParty)} → {customerName(sale.toParty)}</span> },
          { label: "Date",      content: <span style={{ fontSize: "0.88rem" }}>{fmtDate(sale.date)}</span> },
        ].map(({ label, content }) => (
          <div key={label} className="li-summary-cell">
            <p style={{
              margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700,
              letterSpacing: "0.07em", color: "var(--a-text-faint)", textTransform: "uppercase",
            }}>{label}</p>
            <p style={{ margin: 0 }}>{content}</p>
          </div>
        ))}
      </div>


      {/* ── Add / Edit form ── */}
      {showForm && (
        <div style={editCardStyle}>
          <p style={{
            margin: "0 0 12px", fontSize: "0.78rem", fontWeight: 700,
            color: "var(--a-teal)", letterSpacing: "0.06em",
          }}>
            {editingLi ? "EDIT LINE ITEM" : "ADD LINE ITEM"}
            <span style={{ marginLeft: 8, fontWeight: 400, color: "var(--a-text-muted)" }}>
              — Tax amounts calculated automatically.
            </span>
          </p>

          {/* Product + HSN */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px 16px", marginBottom: 12 }}>
            <Field label="Product / Service" required error={liErrs.product}>
              <input className="activity-input" placeholder="Enter product or service name"
                value={liF.product} onChange={(e) => handleLiChange("product", e.target.value)} />
            </Field>
            <Field label="HSN / SAC Code" error={liErrs.hsnCode}>
              <input className="activity-input" placeholder="e.g. 8471"
                value={liF.hsnCode} onChange={(e) => handleLiChange("hsnCode", e.target.value)} />
            </Field>
          </div>

          {/* Qty / Unit / Rate / Taxable */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px 16px", marginBottom: 12 }}>
            <Field label="Quantity" required error={liErrs.quantity}>
              <input type="number" min="0.01" step="any" className="activity-input" placeholder="0"
                value={liF.quantity} onChange={(e) => handleLiChange("quantity", e.target.value)} />
            </Field>
            <Field label="Unit">
              <input className="activity-input" placeholder="Nos / Kg / L"
                value={liF.unit} onChange={(e) => handleLiChange("unit", e.target.value)} />
            </Field>
            <Field label="Unit Rate" required error={liErrs.unitRate}>
              <input type="number" min="0.01" step="any" className="activity-input" placeholder="0.00"
                value={liF.unitRate} onChange={(e) => handleLiChange("unitRate", e.target.value)} />
            </Field>
            <Field label="Taxable Value">
              <input readOnly className="activity-input" style={roInput} value={fmt(liF.taxableValue)} />
            </Field>
          </div>

          {/* Tax details */}
          <div style={{
            border: "1px solid var(--a-teal-20)", borderRadius: 8,
            padding: "12px 16px", marginBottom: 12, background: "var(--a-teal-05)",
          }}>
            <p style={{
              margin: "0 0 10px", fontSize: "0.72rem", fontWeight: 700,
              letterSpacing: "0.08em", color: "var(--a-teal)",
            }}>TAX DETAILS</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px 16px" }}>
              {[
                ["CGST", "cgstRate", "cgstAmount"],
                ["SGST", "sgstRate", "sgstAmount"],
                ["IGST", "igstRate", "igstAmount"],
              ].map(([label, rateKey, amtKey]) => (
                <Fragment key={label}>
                  <div>
                    <p style={{
                      margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700,
                      color: "var(--a-teal)", letterSpacing: "0.05em",
                    }}>{label}</p>
                    <Field label="Rate %" error={liErrs[rateKey]}>
                      <input type="number" min="0" step="any" className="activity-input" placeholder="0"
                        value={liF[rateKey]} onChange={(e) => handleLiChange(rateKey, e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Amount">
                    <input readOnly className="activity-input"
                      style={{ ...roInput, fontWeight: 600 }} value={fmt(liF[amtKey])} />
                  </Field>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Total + Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 12 }}>
            <Field label="Total">
              <input readOnly className="activity-input"
                style={{ ...roInput, fontWeight: 700 }} value={fmt(liF.total)} />
            </Field>
            <Field label="Status">
              <select className="activity-input" value={liF.status}
                onChange={(e) => handleLiChange("status", e.target.value)}>
                {ITEM_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <ErrMsg msg={error} />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" onClick={saveLi} disabled={saving} icon="💾">
              {saving ? "Saving…" : editingLi ? "Update Item" : "Add Item"}
            </Btn>
            <Btn variant="ghost" icon="✕"
              onClick={() => { setShowForm(false); setError(null); }}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {/* ── Line items table ── */}
      <div className="activity-table-wrap">
        <TableScroller>
          <table className="activity-table" style={{ minWidth: 900, tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ minWidth: 150 }}>Product / Service</th>
                <th style={{ width: 80 }}>HSN</th>
                <th style={{ width: 60, textAlign: "right" }}>Qty</th>
                <th style={{ width: 60 }}>Unit</th>
                <th style={{ width: 90, textAlign: "right" }}>Rate</th>
                <th style={{ width: 100, textAlign: "right" }}>Taxable</th>
                <th style={{ width: 110, textAlign: "right", background: "var(--a-teal-15)" }}>
                  CGST<span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 4, opacity: 0.8 }}>rate·amt</span>
                </th>
                <th style={{ width: 110, textAlign: "right", background: "var(--a-teal-15)" }}>
                  SGST<span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 4, opacity: 0.8 }}>rate·amt</span>
                </th>
                <th style={{ width: 110, textAlign: "right", background: "var(--a-teal-15)" }}>
                  IGST<span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 4, opacity: 0.8 }}>rate·amt</span>
                </th>
                <th style={{ width: 100, textAlign: "right" }}>Total</th>
                <th style={{ width: 80 }}>Status</th>
                {canEdit && <th style={{ width: 90, textAlign: "center" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canEdit ? 13 : 12} className="activity-empty">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={canEdit ? 13 : 12} className="activity-empty">
                  No line items yet. {canEdit && "Click \"+ Add Item\" to begin."}
                </td></tr>
              ) : items.map((li, idx) => (
                <tr key={li.id}
                  style={{ background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--a-teal-10, rgba(20,184,166,0.10))"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))"; }}
                >
                  <td style={{ color: "var(--a-text-faint)" }}>{idx + 1}</td>
                  <td style={{ color: "var(--a-teal)", fontWeight: 600 }} title={li.product}>{li.product || "—"}</td>
                  <td>{li.hsnCode || "—"}</td>
                  <td style={{ textAlign: "right" }}>{li.quantity}</td>
                  <td>{li.unit || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(li.unitRate)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(li.taxableValue)}</td>
                  <td style={{ textAlign: "right", background: "var(--a-teal-05)" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--a-text-faint)", display: "block" }}>{li.cgstRate}%</span>
                    <strong>{fmt(li.cgstAmount)}</strong>
                  </td>
                  <td style={{ textAlign: "right", background: "var(--a-teal-05)" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--a-text-faint)", display: "block" }}>{li.sgstRate}%</span>
                    <strong>{fmt(li.sgstAmount)}</strong>
                  </td>
                  <td style={{ textAlign: "right", background: "var(--a-teal-05)" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--a-text-faint)", display: "block" }}>{li.igstRate}%</span>
                    <strong>{fmt(li.igstAmount)}</strong>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--a-teal)" }}>{fmt(li.total)}</td>
                  <td><StatusDot status={li.status} /></td>
                  {canEdit && (
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <button title="Edit"
                        style={iconBtn("var(--a-indigo,#818cf8)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                        onClick={() => openEdit(li)}>✏️</button>
                      {canDelete && (
                        confirmKey === `li-${li.id}` ? (
                          <ConfirmDelete
                            onConfirm={() => { setConfirmKey(null); deleteLi(li); }}
                            onCancel={() => setConfirmKey(null)}
                          />
                        ) : (
                          <button title="Delete"
                            style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                            onClick={() => setConfirmKey(`li-${li.id}`)}>🗑️</button>
                        )
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {/* ── Totals row ── */}
              {items.length > 0 && (
                <tr style={{ background: "var(--a-teal-10)", fontWeight: 700, borderTop: "2px solid var(--a-teal-25)" }}>
                  <td colSpan={6} style={{ color: "var(--a-teal)", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.06em" }}>
                    TOTAL ({items.length} item{items.length !== 1 ? "s" : ""})
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{fmt(totals.taxable)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, background: "var(--a-teal-15)" }}>{fmt(totals.cgst)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, background: "var(--a-teal-15)" }}>{fmt(totals.sgst)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, background: "var(--a-teal-15)" }}>{fmt(totals.igst)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "var(--a-teal)" }}>{fmt(totals.total)}</td>
                  <td colSpan={canEdit ? 2 : 1} />
                </tr>
              )}
            </tbody>
          </table>
        </TableScroller>
      </div>

      {!showForm && error && <ErrMsg msg={error} />}

      {/* ── Summary cards ── */}
      {items.length > 0 && (
        <div className="li-totals-grid">
          {[
            { label: "Taxable Value", value: `INR ${fmt(totals.taxable)}`, color: "var(--a-text)" },
            { label: "Total Tax",     value: `INR ${fmt(totalTax)}`,        color: "#d97706" },
            { label: "Invoice Total", value: `INR ${fmt(totals.total)}`,    color: "var(--a-teal)" },
            { label: "Items Count",   value: items.length,                  color: "var(--a-text)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="li-totals-card">
              <p className="li-totals-label">{label}</p>
              <p className="li-totals-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
