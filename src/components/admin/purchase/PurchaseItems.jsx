// src/components/admin/purchase/PurchaseItems.jsx
//
// Line items table + add/edit form for a single purchase.
// Owns: ["purchaseItems", purchase.purchaseFileRef] React Query key.
//
// Props:
//   purchase  — parent purchase object (from fromPurchaseDTO)
//   role      — user role string
//   customers — customer list (passed from Purchase, avoids redundant fetch)
//   onBack    — () => void
//   onEdit    — () => void   (NEW — opens purchase header edit form)
//   canEdit   — bool        (NEW — pre-computed by parent, no repeated role checks)

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPurchaseItemsByRef,
  createPurchaseItem,
  updatePurchaseItem,
  deletePurchaseItem,
} from "../../../api/purchaseItems";
import {
  PAGE_SIZE, fmt, fmtDate, calcLine, iconBtn, editCardStyle,
  thStyle, tdBase, tdNowrap,
  canEdit as canEditRole, canDelete as canDeleteRole, canAdd as canAddRole,
} from "../shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "../shared/AdminTable";
import { useToast } from "../shared/ToastContext";
import Btn from "../shared/Btn";
import StatusDot from "../shared/StatusDot";
import { printPurchaseOrder } from "../PDFTemplates";
import { doctypeLabel, emptyItemForm } from "./purchaseConstants";
import { DocBadge } from "./purchaseHelpers";
import { validateItemForm } from "./purchaseValidation";
import ItemFormFields from "./ItemFormFields";

export default function PurchaseItems({ purchase, role, customers, customerName, onBack, onEdit, canEdit: canEditProp }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── Permissions ──────────────────────────────────────────────
  // Accept pre-computed canEdit from parent (Purchase.jsx already has it).
  // Fall back to role-based check so this component still works standalone.
  const canEdit   = canEditProp  ?? canEditRole(role);
  const canDelete = canDeleteRole(role);
  const canAdd    = canAddRole(role);

  // ── View router ──────────────────────────────────────────────
  // Replaces showAdd + editingId booleans — same fix applied to Purchase.jsx.
  // "list" | "add" | "edit"
  const [view, setView]         = useState("list");
  const [editingItem, setEditingItem] = useState(null);

  // ── Form state ───────────────────────────────────────────────
  const [form, setForm]           = useState(() => ({ ...emptyItemForm(purchase.purchaseFileRef) }));
  const [formErrs, setFormErrs]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [confirmKey, setConfirmKey] = useState(null);
  const [page, setPage]           = useState(1);

  // ── Query ────────────────────────────────────────────────────
  const { data: items = [], isLoading: loading, refetch: refetchItems } = useQuery({
    queryKey: ["purchaseItems", purchase.purchaseFileRef],
    queryFn:  () => getPurchaseItemsByRef(purchase.purchaseFileRef),
    enabled:  !!purchase.purchaseFileRef,
  });

  // ── Print ────────────────────────────────────────────────────
  const handlePrint = () => printPurchaseOrder({ purchase, items, customers });

  // ── Form field change ────────────────────────────────────────
  const handleFormChange = (field, val) => {
    const updated = { ...form, [field]: val };
    setForm({ ...updated, ...calcLine(updated) });
    if (formErrs[field]) setFormErrs((prev) => ({ ...prev, [field]: "" }));
  };

  // ── Navigation ───────────────────────────────────────────────
  const openAdd = () => {
    setForm({ ...emptyItemForm(purchase.purchaseFileRef) });
    setFormErrs({});
    setEditingItem(null);
    setView("add");
  };

  const openEdit = (item) => {
    setEditingItem(item);
    // Zero out stored tax amounts before calcLine so stale DB values
    // never bleed through — calcLine recomputes from rates.
    const base = {
      ...item,
      refFileNo:  String(item.refFileNo),
      status:     String(item.status),
      cgstAmount: 0, sgstAmount: 0, igstAmount: 0, total: 0,
    };
    setForm({ ...base, ...calcLine(base) });
    setFormErrs({});
    setView("edit");
  };

  const closeForm = () => {
    setView("list");
    setEditingItem(null);
    setFormErrs({});
  };

  // ── Save ─────────────────────────────────────────────────────
  const saveItem = async () => {
    const { errs, valid } = validateItemForm(form);
    if (!valid) {
      setFormErrs(errs);
      toast.error("Please fix the highlighted errors before saving.");
      return;
    }
    setFormErrs({});
    setSaving(true);
    try {
      if (view === "edit" && editingItem) {
        // Optimistic update — no refetch round-trip (Sales pattern)
        const saved = await updatePurchaseItem(editingItem.id, {
          ...form, refFileNo: Number(form.refFileNo),
        });
        queryClient.setQueryData(
          ["purchaseItems", purchase.purchaseFileRef],
          (prev = []) => prev.map((x) => x.id === saved.id ? saved : x)
        );
      } else {
        // Optimistic insert — no refetch round-trip (Sales pattern)
        const saved = await createPurchaseItem({
          ...form, refFileNo: Number(form.refFileNo),
        });
        queryClient.setQueryData(
          ["purchaseItems", purchase.purchaseFileRef],
          (prev = []) => [...prev, saved]
        );
      }
      closeForm();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await deletePurchaseItem(id);
      queryClient.setQueryData(
        ["purchaseItems", purchase.purchaseFileRef],
        (prev = []) => prev.filter((item) => item.id !== id)
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Grand totals — single reduce pass ───────────────────────
  // Was grandTotals() called twice as an IIFE — two full iterations.
  // Now computed once, referenced in both totals row and summary cards.
  const totals = items.reduce(
    (acc, l) => ({
      taxable: acc.taxable + Number(l.taxableValue || 0),
      cgst:    acc.cgst    + Number(l.cgstAmount   || 0),
      sgst:    acc.sgst    + Number(l.sgstAmount   || 0),
      igst:    acc.igst    + Number(l.igstAmount   || 0),
      total:   acc.total   + Number(l.total        || 0),
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );
  const totalTax = totals.cgst + totals.sgst + totals.igst;

  // Normalise item status from DB (0/1 integer) OR new readable string ("Active"/"Inactive")
  // purchaseItems API has no fromDTO mapper so raw DB values come through.
  // This bridges old stored values and new form values safely.
  const itemStatusDisplay = (s) => {
    if (s === 1 || s === "1") return "Active";
    if (s === 0 || s === "0") return "Inactive";
    return String(s || "Active"); // already "Active"/"Inactive" from new form
  };

  const paged   = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const colSpan = canEdit ? 13 : 12;

  // ── Form view (add or edit) ──────────────────────────────────
  if (view === "add" || view === "edit") {
    return (
      <div className="content-section">
        <Btn variant="back" onClick={closeForm} icon="←">← Back to Items</Btn>

        <div style={{ marginTop: 16, background: "var(--a-surface-solid)", border: "1px solid var(--a-border-card)", borderRadius: 12, padding: "18px 16px", maxWidth: 860 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
              {view === "edit" ? `Edit Item #${editingItem?.id}` : "New Line Item"}
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--a-text-muted)" }}>
              All fields marked * are required
            </span>
          </div>
          <ItemFormFields form={form} onChange={handleFormChange} errs={formErrs} />
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn variant="primary" onClick={saveItem} disabled={saving} icon="💾">
              {saving ? "Saving…" : view === "edit" ? "Update Item" : "Save Item"}
            </Btn>
            <Btn variant="ghost" onClick={closeForm} icon="✕">Cancel</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────
  return (
    <div className="content-section" style={{ animation: "fadeIn 0.25s ease" }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant="back" onClick={onBack} icon="←">← Purchases</Btn>
        <span style={{ color: "var(--a-text-faint)" }}>/</span>
        <span style={{ color: "var(--a-text-muted)", fontSize: "0.88rem" }}>#{purchase.id}</span>
        <span style={{ color: "var(--a-text-faint)" }}>/</span>
        <span style={{ color: "var(--a-teal)", fontWeight: 600, fontSize: "0.88rem" }}>Line Items</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={refetchItems} icon="↺">Refresh</Btn>
          <Btn variant="primary" onClick={handlePrint} icon="🖨️" title="Open print-ready invoice in a new tab">Print Invoice</Btn>
          {onEdit && canEdit && (
            <Btn variant="default" onClick={onEdit} icon="✏️">Edit Purchase</Btn>
          )}
          {canAdd && (
            <Btn variant="teal" onClick={openAdd} icon="＋">+ Add Item</Btn>
          )}
        </div>
      </div>

      {/* ── Purchase summary strip ── */}
      <div className="li-summary-strip">
        {[
          { label: "Purchase ID",  content: <span style={{ fontWeight: 700, color: "var(--a-teal)" }}>#{purchase.id}</span> },
          { label: "Doc Type",     content: <DocBadge type={doctypeLabel(purchase.purchaseDoctype)} /> },
          { label: "From → To",    content: <span style={{ fontSize: "0.88rem", color: "var(--a-text)" }}>{customerName ? customerName(purchase.purchaseFromParty) : purchase.purchaseFromParty} → {customerName ? customerName(purchase.purchaseToParty) : purchase.purchaseToParty}</span> },
          { label: "Date",         content: <span style={{ fontSize: "0.88rem" }}>{fmtDate(purchase.purchaseDate)}</span> },
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

      {loading ? (
        <p className="loading">Loading…</p>
      ) : (
        <>
          <TableScroller>
            <table style={{ width: "100%", minWidth: 900, tableLayout: "auto", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44 }}>#</th>
                  <th style={{ ...thStyle, minWidth: 160 }}>PRODUCT / SERVICE</th>
                  <th style={{ ...thStyle, width: 80 }}>HSN</th>
                  <th style={{ ...thStyle, width: 60, textAlign: "right" }}>QTY</th>
                  <th style={{ ...thStyle, width: 60 }}>UNIT</th>
                  <th style={{ ...thStyle, width: 90, textAlign: "right" }}>RATE</th>
                  <th style={{ ...thStyle, width: 100, textAlign: "right" }}>TAXABLE</th>
                  <th style={{ ...thStyle, width: 110, textAlign: "right", background: "var(--a-teal-15)" }}>
                    CGST<span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 4, opacity: 0.8 }}>rate·amt</span>
                  </th>
                  <th style={{ ...thStyle, width: 110, textAlign: "right", background: "var(--a-teal-15)" }}>
                    SGST<span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 4, opacity: 0.8 }}>rate·amt</span>
                  </th>
                  <th style={{ ...thStyle, width: 110, textAlign: "right", background: "var(--a-teal-15)" }}>
                    IGST<span style={{ fontWeight: 400, fontSize: "0.65rem", marginLeft: 4, opacity: 0.8 }}>rate·amt</span>
                  </th>
                  <th style={{ ...thStyle, width: 100, textAlign: "right" }}>TOTAL</th>
                  <th style={{ ...thStyle, width: 80 }}>STATUS</th>
                  {canEdit && (
                    <th style={{ ...thStyle, width: 80, textAlign: "center" }}>ACTIONS</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="activity-empty">
                      {canAdd
                        ? "No items found. Click \"+ Add Item\" to create one."
                        : "No items found."}
                    </td>
                  </tr>
                ) : paged.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--a-teal-10)"; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))";
                    }}
                  >
                    <td style={{ color: "var(--a-text-faint)" }}>{idx + 1}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: "var(--a-teal)" }}>
                      {row.nameOfProductService || "—"}
                    </td>
                    <td style={tdNowrap}>{row.hsnAcs || "—"}</td>
                    <td style={{ ...tdNowrap, textAlign: "right" }}>{row.quantity ?? "—"}</td>
                    <td style={tdNowrap}>{row.unit || "—"}</td>
                    <td style={{ ...tdNowrap, textAlign: "right" }}>{fmt(row.unitRate)}</td>
                    <td style={{ ...tdNowrap, textAlign: "right", fontWeight: 700 }}>{fmt(row.taxableValue)}</td>
                    <td style={{ ...tdNowrap, textAlign: "right", background: "var(--a-teal-05)" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--a-text-faint)", display: "block" }}>{row.cgstRate}%</span>
                      <strong>{fmt(row.cgstAmount)}</strong>
                    </td>
                    <td style={{ ...tdNowrap, textAlign: "right", background: "var(--a-teal-05)" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--a-text-faint)", display: "block" }}>{row.sgstRate}%</span>
                      <strong>{fmt(row.sgstAmount)}</strong>
                    </td>
                    <td style={{ ...tdNowrap, textAlign: "right", background: "var(--a-teal-05)" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--a-text-faint)", display: "block" }}>{row.igstRate}%</span>
                      <strong>{fmt(row.igstAmount)}</strong>
                    </td>
                    <td style={{ ...tdNowrap, textAlign: "right", fontWeight: 700, color: "var(--a-teal)" }}>
                      {fmt(row.total)}
                    </td>
                    <td style={tdBase}>
                      {/* StatusDot replaces ItemStatusBadge — status now stored as readable string */}
                      <StatusDot status={itemStatusDisplay(row.status)} />
                    </td>
                    {canEdit && (
                      <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}>
                        <button
                          title="Edit"
                          style={iconBtn("var(--a-indigo,#6366f1)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                          onClick={() => openEdit(row)}
                        >✏️</button>
                        {canDelete && (
                          confirmKey === `item-${row.id}` ? (
                            <ConfirmDelete
                              onConfirm={() => { setConfirmKey(null); handleDelete(row.id); }}
                              onCancel={() => setConfirmKey(null)}
                            />
                          ) : (
                            <button
                              title="Delete"
                              style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                              onClick={() => setConfirmKey(`item-${row.id}`)}
                            >🗑️</button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}

                {/* ── Grand totals row ── */}
                {items.length > 0 && (
                  <tr style={{ background: "var(--a-teal-10)", fontWeight: 700, borderTop: "2px solid var(--a-teal-25)" }}>
                    <td colSpan={6} style={{ ...tdBase, color: "var(--a-teal)", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.06em" }}>
                      TOTAL ({items.length} item{items.length !== 1 ? "s" : ""})
                    </td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 800 }}>{fmt(totals.taxable)}</td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 800, background: "var(--a-teal-15)" }}>{fmt(totals.cgst)}</td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 800, background: "var(--a-teal-15)" }}>{fmt(totals.sgst)}</td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 800, background: "var(--a-teal-15)" }}>{fmt(totals.igst)}</td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 800, color: "var(--a-teal)" }}>{fmt(totals.total)}</td>
                    <td colSpan={canEdit ? 2 : 1} />
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroller>

          <Pagination total={items.length} page={page} onChange={setPage} />

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
        </>
      )}
    </div>
  );
}


