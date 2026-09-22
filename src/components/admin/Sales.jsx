// src/components/admin/Sales.jsx
//
// Sales management: list view, add/edit form, detail view, line items view.
// Owns ["sales"], ["customers"], ["files"] React Query keys.
//
// Sub-components (./sales/):
//   SaleDetailView   — read-only detail card
//   LineItemsView    — line items table + form (owns ["salesItems", id])
//   SaleFormFields   — extracted add/edit form fields
//
// Constants / helpers / validation (./sales/):
//   salesConstants   — DOCTYPE_OPTIONS, STATUS_OPTIONS, CURRENCIES, emptySaleForm
//   salesHelpers     — DocBadge, ErrMsg, Field, DetailRow, InfoCard, SectionCard
//   salesValidation  — validateSaleForm (pure, no side-effects)

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSales, createSale, updateSale, deleteSale } from "../../api/sales";
import { getCustomers, getContacts } from "../../api/party";
import { getFiles } from "../../api/files";
import { createActivity } from "../../api/fileActivity";
import {
  PAGE_SIZE, fmtDate, iconBtn, 
  canEdit as canEditRole, canAdd as canAddRole, canDelete as canDeleteRole,
} from "./shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";
import StatusDot from "./shared/StatusDot";
import SaleDetailView  from "./sales/SaleDetailView";
import LineItemsView   from "./sales/LineItemsView";
import SaleFormFields  from "./sales/SaleFormFields";
import { DocBadge, ErrMsg } from "./sales/salesHelpers";
import { emptySaleForm } from "./sales/salesConstants";
import { validateSaleForm } from "./sales/salesValidation";

export default function Sales({ role }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // ── Permissions ──────────────────────────────────────────────
  // Use shared canEdit/canAdd helpers from adminStyles (Purchase pattern)
  // instead of inlining the role checks here.
  const canEdit = canEditRole(role);
  const canAdd  = canAddRole(role);
  const canDelete = canDeleteRole(role);

  // ── View router ──────────────────────────────────────────────
  // Single string drives the entire view — impossible to get conflicting
  // boolean states. "list" | "form" | "detail" | "items"
  const [view, setView]         = useState("list");
  const [viewSale, setViewSale] = useState(null);
  const [liSale, setLiSale]     = useState(null);

  // ── List state ───────────────────────────────────────────────
  const [page, setPage]             = useState(1);
  const [confirmKey, setConfirmKey] = useState(null);

  // ── Form state ───────────────────────────────────────────────
  const [editingSale, setEditingSale]           = useState(null);
  const [form, setForm]                         = useState(emptySaleForm);
  const [formErr, setFormErr]                   = useState("");
  const [formErrs, setFormErrs]                 = useState({});
  const [saving, setSaving]                     = useState(false);
  const [toPartyContacts, setToPartyContacts]   = useState([]);
  const [loadingContacts, setLoadingContacts]   = useState(false);

  // ── Queries ──────────────────────────────────────────────────
  const { data: sales     = [], isLoading: l1, isError: salesError, refetch: refetchSales } = useQuery({
    queryKey: ["sales"],
    queryFn:  getSales,
    select:   (data) => [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
  });
  const { data: customers = [], isLoading: l2 } = useQuery({
    queryKey: ["customers"],
    queryFn:  getCustomers,
  });
  const { data: files = [], isLoading: l3 } = useQuery({
    queryKey: ["files"],
    queryFn:  getFiles,
  });
  const loading = l1 || l2 || l3;

  // ── Derived label helpers ────────────────────────────────────
  const customerName = (id) => {
    const c = customers.find((c) => String(c.id) === String(id));
    return c ? `${c.id}-${c.companyName}` : id || "—";
  };
  const fileRefLabel = (ref) => {
    const f = files.find((f) => String(f.fileId) === String(ref));
    return f ? `${f.fileId}-${f.activity}` : ref || "—";
  };

  // ── Navigation ───────────────────────────────────────────────
  const openItems  = (sale) => { setLiSale(sale);  setViewSale(null); setView("items"); };
  const openDetail = (sale) => { setViewSale(sale); setView("detail"); };

  // ── Form open ────────────────────────────────────────────────
  const openForm = async (sale = null) => {
    setEditingSale(sale);
    // emptySaleForm() pre-fills today's date; spread sale on top when editing
    setForm(sale ? { ...emptySaleForm(), ...sale } : emptySaleForm());
    setToPartyContacts([]);
    setFormErr(""); setFormErrs({}); setView("form");
    if (sale?.toParty) {
      setLoadingContacts(true);
      try { setToPartyContacts(await getContacts(sale.toParty)); }
      catch { setToPartyContacts([]); toast.error("Failed to load contacts for this party."); }
      finally { setLoadingContacts(false); }
    }
  };

  // ── Form field change ────────────────────────────────────────
  // Handles fromParty/toParty side-effects (contact fetch, cascading reset).
  // Passed as `onFieldChange` to SaleFormFields — keeps form logic in parent.
  const handleFormChange = async (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    if (formErrs[field]) setFormErrs((prev) => ({ ...prev, [field]: "" }));

    if (field === "fromParty") {
      setForm((prev) => {
        const reset = String(val) === String(prev.toParty);
        return reset
          ? { ...prev, fromParty: val, toParty: "", addressedTo: "" }
          : { ...prev, fromParty: val };
      });
      if (String(val) === String(form.toParty)) {
        setToPartyContacts([]);
        setFormErrs((prev) => ({ ...prev, fromParty: "", toParty: "" }));
      }
      return;
    }

    if (field === "toParty") {
      setForm((prev) => ({ ...prev, toParty: val, addressedTo: "" }));
      setToPartyContacts([]);
      if (val) {
        setLoadingContacts(true);
       try { setToPartyContacts(await getContacts(val)); }
        catch { setToPartyContacts([]); toast.error("Failed to load contacts for this party."); }
        finally { setLoadingContacts(false); }
      }
    }
  };

  // ── Save sale ────────────────────────────────────────────────
  const saveSale = async () => {
    // validateSaleForm imported from salesValidation.js — pure function
    const { errs, valid } = validateSaleForm(form);
    setFormErrs(errs);
    if (!valid) {
      const firstErr = Object.values(errs).find(Boolean);
      setFormErr(firstErr || "Please fill in all required fields.");
      toast.error(firstErr || "Please fill in all required fields.");
      return;
    }
    setSaving(true); setFormErr(""); setFormErrs({});
    try {
      let saved;
      if (editingSale) {
        saved = await updateSale(editingSale.id, form);
        queryClient.setQueryData(["sales"], (prev = []) =>
          [...prev.map((s) => s.id === saved.id ? saved : s)]
            .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
        );
      } else {
        saved = await createSale(form);
        queryClient.setQueryData(["sales"], (prev = []) =>
          [...prev, saved].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
        );
      }

      // Auto-log activity on the referenced file (fire-and-forget)
      if (form.fileReference) {
        const isNew  = !editingSale;
        const from   = customerName(form.fromParty);
        const to     = customerName(form.toParty);
        const today  = new Date().toISOString().slice(0, 10);
        createActivity(form.fileReference, {
          fileId:      form.fileReference,
          title:       `${form.documentType} ${isNew ? "Created" : "Updated"}`,
          refId:       `S-${saved.id}`,
          date:        today,
          description: `${form.transactionType} ${form.documentType} ${isNew ? "created" : "updated"} — From: ${from} → To: ${to}${form.description ? ` | ${form.description}` : ""}`,
          status:      "ACTIVE",
        })
          .then(() => queryClient.invalidateQueries({ queryKey: ["files"] }))
          .catch((err) => {
            console.error("[Auto-activity] Sales failed:", err);
            toast.error(`Activity log failed: ${err.message}`);
          });
      }

      setView("list");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete sale ──────────────────────────────────────────────
  const deleteSaleRecord = async (sale) => {
    try {
      await deleteSale(sale.id);
      queryClient.setQueryData(["sales"], (prev = []) =>
        prev.filter((s) => s.id !== sale.id)
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Paging ───────────────────────────────────────────────────
  const pagedSales = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ════════════════════════════════════════════════════════════
  // Views
  // ════════════════════════════════════════════════════════════

  // ── Form view ────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="content-section">
        <Btn variant="back" onClick={() => setView("list")} icon="←">← Back to Sales</Btn>
        <div style={{ marginTop: 16, background: "var(--a-surface-solid)", border: "1px solid var(--a-border-card)", borderRadius: 12, padding: "20px 18px", maxWidth: 860 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--a-teal)" }}>
              {editingSale ? `Edit Sales #${editingSale.id}` : "Add Sales Record"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--a-text-muted)" }}>
              All fields are required. Fill in all details before saving.
            </p>
          </div>

          {/* ── All 13 form fields via SaleFormFields ── */}
          <SaleFormFields
            form={form}
            onFieldChange={handleFormChange}
            errs={formErrs}
            customers={customers}
            files={files}
            contacts={toPartyContacts}
            loadingContacts={loadingContacts}
          />

          <ErrMsg msg={formErr} />

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn variant="primary" onClick={saveSale} disabled={saving}>
              {saving ? "Saving…" : editingSale ? "Update Record" : "Add Record"}
            </Btn>
            <Btn variant="ghost" onClick={() => setView("list")}>Cancel</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────
  if (view === "detail" && viewSale) {
    return (
      <SaleDetailView
        sale={viewSale}
        onBack={() => { setView("list"); setViewSale(null); }}
        onEdit={() => { openForm(viewSale); setViewSale(null); }}
        onOpenItems={() => openItems(viewSale)}
        canEdit={canEdit}
        customerName={customerName}
        fileRefLabel={fileRefLabel}
      />
    );
  }

  // ── Line items view ──────────────────────────────────────────
  if (view === "items" && liSale) {
    return (
      <LineItemsView
        sale={liSale}
        role={role}
        customerName={customerName}
        customers={customers}
        onBack={() => { setView("list"); setLiSale(null); }}
        onEdit={() => { openForm(liSale); setLiSale(null); }}
        canEdit={canEdit}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────
  return (
    <div className="content-section">
      <div className="activity-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--a-teal)" }}>
            Sales
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: "0.74rem", color: "var(--a-text-muted)" }}>
            Manage RFQs, Quotations, Orders, Invoices and Payments
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={refetchSales} icon="↺">Refresh</Btn>
          {canAdd && (
            <Btn variant="teal" onClick={() => openForm()} icon="＋">+ Add Sales</Btn>
          )}
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading…</p>
      ) : (
        <>
          {/* ── Desktop table (hidden on mobile) ── */}
          <div className="activity-table-wrap tx-table-wrap">
            <TableScroller>
              <table className="activity-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Doc Type</th>
                    <th>From Party</th>
                    <th>To Party</th>
                    <th>TX Type</th>
                    <th>File Ref</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="activity-empty">
                        {salesError
                          ? "Failed to load sales records. Please try again."
                          : canEdit
                          ? "No sales records found. Click \"+ Add Sales Record\" to create one."
                          : "No sales records found."}
                      </td>
                    </tr>
                  ) : pagedSales.map((sale, idx) => (
                    <tr key={sale.id}
                      style={{
                        cursor: "pointer",
                        background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--a-teal-10, rgba(20,184,166,0.10))"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))"; }}
                      onClick={() => openDetail(sale)}
                    >
                      <td style={{ color: "var(--a-teal)", fontWeight: 700 }}>{sale.id}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(sale.date)}</td>
                      <td><DocBadge type={sale.documentType} /></td>
                      <td>{customerName(sale.fromParty)}</td>
                      <td>{customerName(sale.toParty)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{sale.transactionType}</td>
                      <td>{fileRefLabel(sale.fileReference)}</td>
                      <td><StatusDot status={sale.status} /></td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <button title="Line Items"
                          style={iconBtn("var(--a-teal)", "var(--a-teal-05)", "var(--a-teal-20)")}
                          onClick={() => openItems(sale)}>📋</button>
                        {canEdit && (
                          <button title="Edit"
                            style={iconBtn("var(--a-indigo,#6366f1)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                            onClick={() => openForm(sale)}>✏️</button>
                        )}
                        {canDelete && (
                          confirmKey === `sale-${sale.id}` ? (
                            <ConfirmDelete
                              onConfirm={() => { setConfirmKey(null); deleteSaleRecord(sale); }}
                              onCancel={() => setConfirmKey(null)}
                            />
                          ) : (
                            <button title="Delete"
                              style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                              onClick={() => setConfirmKey(`sale-${sale.id}`)}>🗑️</button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
          </div>

          {/* ── Mobile cards (hidden on desktop) ── */}
          <div className="tx-cards">
           {sales.length === 0 ? (
              <p style={{ color: "var(--a-text-muted)", textAlign: "center", padding: "24px 0" }}>
                {salesError ? "Failed to load sales records. Please try again." : "No sales records found."}
              </p>
            ) : pagedSales.map((sale) => (
              <div key={sale.id} className="tx-card" onClick={() => openDetail(sale)}>
                <div className="tx-card-header">
                  <span className="tx-card-id">#{sale.id}</span>
                  <DocBadge type={sale.documentType} />
                  <StatusDot status={sale.status} />
                </div>
                <div className="tx-card-body">
                  <div className="tx-card-row">
                    <span className="tx-card-label">From</span>
                    <span className="tx-card-value">{customerName(sale.fromParty)}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">To</span>
                    <span className="tx-card-value">{customerName(sale.toParty)}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">TX</span>
                    <span className="tx-card-value">{sale.transactionType}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">File</span>
                    <span className="tx-card-value">{fileRefLabel(sale.fileReference)}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">Date</span>
                    <span className="tx-card-value">{fmtDate(sale.date)}</span>
                  </div>
                </div>
                <div className="tx-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="tx-card-btn tx-card-btn-view" onClick={() => openItems(sale)}>📋 Items</button>
                  {canEdit && (
                    <button className="tx-card-btn tx-card-btn-edit" onClick={() => openForm(sale)}>✏️ Edit</button>
                  )}
                  {canDelete && (
                    confirmKey === `sale-${sale.id}` ? (
                      <ConfirmDelete
                        onConfirm={() => { setConfirmKey(null); deleteSaleRecord(sale); }}
                        onCancel={() => setConfirmKey(null)}
                      />
                    ) : (
                      <button className="tx-card-btn tx-card-btn-del" onClick={() => setConfirmKey(`sale-${sale.id}`)}>🗑️</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination total={sales.length} page={page} onChange={setPage} />
          <p className="table-hint">
            {sales.length} record{sales.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
