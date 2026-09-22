// src/components/admin/Purchase.jsx

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllPurchases, createPurchase, updatePurchase, deletePurchase,
} from "../../api/purchases";
import { getCustomers, getContacts } from "../../api/party";
import { getFiles } from "../../api/files";
import { createActivity } from "../../api/fileActivity";
import {
  PAGE_SIZE, fmtDate, iconBtn,
  canEdit as canEditRole, canDelete as canDeleteRole, canAdd as canAddRole,
} from "./shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";
import StatusDot from "./shared/StatusDot";

import {
  doctypeLabel, statusLabel, emptyPurchaseForm,
} from "./purchase/purchaseConstants";
import { DocBadge, ErrMsg } from "./purchase/purchaseHelpers";
import { validatePurchaseForm } from "./purchase/purchaseValidation";
import PurchaseDetailView from "./purchase/PurchaseDetailView";
import PurchaseFormFields from "./purchase/PurchaseFormFields";
import PurchaseItems      from "./purchase/PurchaseItems";

export default function Purchase({ role }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const canEdit   = canEditRole(role);
  const canDelete = canDeleteRole(role);
  const canAdd    = canAddRole(role);

  const [view, setView]               = useState("list");
  const [viewPurchase, setViewPurchase] = useState(null);
  const [liPurchase, setLiPurchase]   = useState(null);

  const [page, setPage]             = useState(1);
  const [confirmKey, setConfirmKey] = useState(null);

  const [editingPurchase, setEditingPurchase] = useState(null);
  const [form, setForm]                       = useState(emptyPurchaseForm());
  const [formErr, setFormErr]                 = useState("");
  const [formErrs, setFormErrs]               = useState({});
  const [saving, setSaving]                   = useState(false);
  const [toPartyContacts, setToPartyContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const { data: purchases = [], isLoading: loading, isError: purchasesError, refetch: refetchPurchases } = useQuery({
    queryKey: ["purchases"],
    queryFn:  getAllPurchases,
    select:   (data) => [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const { data: files = [] }     = useQuery({ queryKey: ["files"],     queryFn: getFiles });

  const customerName = (id) => {
    if (!id) return "—";
    const c = customers.find((c) => String(c.id) === String(id));
    return c ? `${c.id} – ${c.companyName}` : String(id);
  };
  const fileRefLabel = (ref) => {
    if (!ref) return "—";
    const f = files.find((f) => String(f.fileId) === String(ref));
    return f ? `${f.fileId} – ${f.activity}` : String(ref);
  };

  const openDetail  = (purchase) => { setViewPurchase(purchase); setView("detail"); };
  const openItems   = (purchase) => { setLiPurchase(purchase);   setView("items");  };

  const openForm = async (purchase = null) => {
    setEditingPurchase(purchase);
    setForm(purchase ? { ...emptyPurchaseForm(), ...purchase } : emptyPurchaseForm());
    setToPartyContacts([]);
    setFormErrs({});
    setView("form");
    if (purchase?.purchaseToParty) {
      setLoadingContacts(true);
      try { setToPartyContacts(await getContacts(purchase.purchaseToParty)); }
      catch { setToPartyContacts([]); toast.error("Failed to load contacts for this party."); }
      finally { setLoadingContacts(false); }
    }
  };

  const handleToPartyChange = async (customerId) => {
    setForm((prev) => ({ ...prev, purchaseToParty: customerId, purchaseAddressedTo: "" }));
    if (formErrs.purchaseToParty)
      setFormErrs((prev) => ({ ...prev, purchaseToParty: "" }));
    setToPartyContacts([]);
    if (customerId) {
      setLoadingContacts(true);
      try { setToPartyContacts(await getContacts(customerId)); }
      catch { setToPartyContacts([]); toast.error("Failed to load contacts for this party."); }
      finally { setLoadingContacts(false); }
    }
  };

  const handleFieldChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    if (formErrs[field]) setFormErrs((prev) => ({ ...prev, [field]: "" }));
  };

  const savePurchase = async () => {
    const { errs, valid } = validatePurchaseForm(form);
    setFormErrs(errs);
    if (!valid) {
      const firstErr = Object.values(errs).find(Boolean);
      setFormErr(firstErr || "Please fill in all required fields.");
      toast.error(firstErr || "Please fill in all required fields.");
      return;
    }
    setFormErr(""); setFormErrs({});
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchaseStatus:  Number(form.purchaseStatus  ?? 1),
        purchaseDoctype: String(form.purchaseDoctype ?? "3"),
      };

      let saved;
      if (editingPurchase) {
        saved = await updatePurchase(editingPurchase.id, payload);
        queryClient.setQueryData(["purchases"], (prev = []) =>
          prev.map((p) => p.id === saved.id ? saved : p)
            .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
        );
      } else {
        saved = await createPurchase(payload);
        queryClient.setQueryData(["purchases"], (prev = []) =>
          [...prev, saved].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
        );
      }

      if (form.purchaseFileRef) {
        const isNew    = !editingPurchase;
        const from     = customerName(form.purchaseFromParty);
        const to       = customerName(form.purchaseToParty);
        const docLabel = doctypeLabel(form.purchaseDoctype);
        const today    = new Date().toISOString().slice(0, 10);
        createActivity(form.purchaseFileRef, {
          fileId:      form.purchaseFileRef,
          title:       `${docLabel} ${isNew ? "Created" : "Updated"}`,
          refId:       `P-${saved.id}`,
          date:        today,
          description: `Purchase ${docLabel} ${isNew ? "created" : "updated"} — From: ${from} → To: ${to}${form.purchaseDescription ? ` | ${form.purchaseDescription}` : ""}`,
          status:      "ACTIVE",
        })
          .then(() => queryClient.invalidateQueries({ queryKey: ["files"] }))
          .catch((err) => {
            console.error("[Auto-activity] Purchase failed:", err);
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

  const handleDelete = async (id) => {
    try {
      await deletePurchase(id);
      queryClient.setQueryData(["purchases"], (prev = []) =>
        prev.filter((p) => p.id !== id)
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  const paged = purchases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Form view ─────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="content-section">
        <Btn variant="back" onClick={() => setView("list")} icon="←">← Back to Purchases</Btn>

        <div style={{ marginTop: 16, background: "var(--a-surface-solid)", border: "1px solid var(--a-border-card)", borderRadius: 12, padding: "20px 18px", maxWidth: 860 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--a-teal)" }}>
              {editingPurchase ? `Edit Purchase #${editingPurchase.id}` : "Add Purchase Record"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--a-text-muted)" }}>
              All fields marked * are required.
            </p>
          </div>

          <PurchaseFormFields
            form={form}
            setForm={setForm}
            onFieldChange={handleFieldChange}
            contacts={toPartyContacts}
            loadingContacts={loadingContacts}
            onToPartyChange={handleToPartyChange}
            errs={formErrs}
            customers={customers}
            files={files}
          />

          <ErrMsg msg={formErr} />

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn variant="primary" onClick={savePurchase} disabled={saving}>
              {saving ? "Saving…" : editingPurchase ? "Update Record" : "Add Record"}
            </Btn>
            <Btn variant="ghost" onClick={() => setView("list")}>Cancel</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────────
  if (view === "detail" && viewPurchase) {
    return (
      <PurchaseDetailView
        purchase={viewPurchase}
        onBack={() => { setView("list"); setViewPurchase(null); }}
        onEdit={() => { openForm(viewPurchase); setViewPurchase(null); }}
        onOpenItems={() => openItems(viewPurchase)}
        canEdit={canEdit}
        customerName={customerName}
        fileRefLabel={fileRefLabel}
        doctypeLabel={doctypeLabel}
        statusLabel={statusLabel}
      />
    );
  }

  // ── Line items view ───────────────────────────────────────────
  if (view === "items" && liPurchase) {
    return (
      <PurchaseItems
        purchase={liPurchase}
        role={role}
        customers={customers}
        customerName={customerName}
        onBack={() => { setView("list"); setLiPurchase(null); }}
        onEdit={() => { openForm(liPurchase); setLiPurchase(null); }}
        canEdit={canEdit}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <div className="content-section">
      <div className="activity-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--a-teal)", margin: 0 }}>
            Purchases
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: "0.74rem", color: "var(--a-text-muted)" }}>
            Manage Enquiries, Quotations, Orders, Invoices and Payments
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={refetchPurchases} icon="↺">Refresh</Btn>
          {canAdd && (
            <Btn variant="teal" onClick={() => openForm()} icon="＋">+ Add Purchase</Btn>
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
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="activity-empty">
                        {purchasesError
                          ? "Failed to load purchases. Please try again."
                          : canAdd
                          ? "No purchases found. Click \"+ Add Purchase\" to create one."
                          : "No purchases found."}
                      </td>
                    </tr>
                  ) : paged.map((row, idx) => (
                    <tr
                      key={row.id}
                      style={{
                        cursor: "pointer",
                        background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--a-teal-10, rgba(20,184,166,0.10))"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))"; }}
                      onClick={() => openDetail(row)}
                    >
                      <td style={{ color: "var(--a-teal)", fontWeight: 700 }}>{row.id}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(row.purchaseDate)}</td>
                      <td><DocBadge type={doctypeLabel(row.purchaseDoctype)} /></td>
                      <td style={{ fontWeight: 600, color: "var(--a-teal)" }}>{customerName(row.purchaseFromParty)}</td>
                      <td>{customerName(row.purchaseToParty)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{row.purchaseTxType || "—"}</td>
                      <td style={{ fontWeight: 700 }}>{fileRefLabel(row.purchaseFileRef)}</td>
                      <td><StatusDot status={statusLabel(row.purchaseStatus)} /></td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Line Items"
                          style={iconBtn("var(--a-teal)", "var(--a-teal-05)", "var(--a-teal-20)")}
                          onClick={() => openItems(row)}>📋</button>
                        {canEdit && (
                          <button
                            title="Edit"
                            style={iconBtn("var(--a-indigo,#6366f1)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                            onClick={() => openForm(row)}>✏️</button>
                        )}
                        {canDelete && (
                          confirmKey === `purchase-${row.id}` ? (
                            <ConfirmDelete
                              onConfirm={() => { setConfirmKey(null); handleDelete(row.id); }}
                              onCancel={() => setConfirmKey(null)}
                            />
                          ) : (
                            <button
                              title="Delete"
                              style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                              onClick={() => setConfirmKey(`purchase-${row.id}`)}>🗑️</button>
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
            {purchases.length === 0 ? (
              <p style={{ color: "var(--a-text-muted)", textAlign: "center", padding: "24px 0" }}>
                {purchasesError ? "Failed to load purchases. Please try again." : "No purchases found."}
              </p>
            ) : paged.map((row) => (
              <div key={row.id} className="tx-card" onClick={() => openDetail(row)}>
                <div className="tx-card-header">
                  <span className="tx-card-id">#{row.id}</span>
                  <DocBadge type={doctypeLabel(row.purchaseDoctype)} />
                  <StatusDot status={statusLabel(row.purchaseStatus)} />
                </div>
                <div className="tx-card-body">
                  <div className="tx-card-row">
                    <span className="tx-card-label">From</span>
                    <span className="tx-card-value">{customerName(row.purchaseFromParty)}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">To</span>
                    <span className="tx-card-value">{customerName(row.purchaseToParty)}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">TX</span>
                    <span className="tx-card-value">{row.purchaseTxType || "—"}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">File</span>
                    <span className="tx-card-value">{fileRefLabel(row.purchaseFileRef)}</span>
                  </div>
                  <div className="tx-card-row">
                    <span className="tx-card-label">Date</span>
                    <span className="tx-card-value">{fmtDate(row.purchaseDate)}</span>
                  </div>
                </div>
                <div className="tx-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="tx-card-btn tx-card-btn-view" onClick={() => openItems(row)}>📋 Items</button>
                  {canEdit && (
                    <button className="tx-card-btn tx-card-btn-edit" onClick={() => openForm(row)}>✏️ Edit</button>
                  )}
                  {canDelete && (
                    confirmKey === `purchase-${row.id}` ? (
                      <ConfirmDelete
                        onConfirm={() => { setConfirmKey(null); handleDelete(row.id); }}
                        onCancel={() => setConfirmKey(null)}
                      />
                    ) : (
                      <button className="tx-card-btn tx-card-btn-del" onClick={() => setConfirmKey(`purchase-${row.id}`)}>🗑️</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination total={purchases.length} page={page} onChange={setPage} />
          <p className="table-hint">
            {purchases.length} record{purchases.length !== 1 ? "s" : ""} · Click any row to view details
          </p>
        </>
      )}
    </div>
  );
}