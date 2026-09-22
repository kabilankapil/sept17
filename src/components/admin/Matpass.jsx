/**
 * Matpass.jsx  (MAT Pass)
 * ───────────────────────
 * List view + inline add/edit for MAT Pass records.
 * Clicking a row drills down to MatpassDetail.
 *
 * What moved out:
 *   • MatpassDetail     → matpass/MatpassDetail.jsx  (owns stock rows + contacts fetch)
 *   • MatpassFormFields → matpass/MatpassFormFields.jsx  (from formFields() inner fn)
 *   • StockItemsSection → matpass/StockItemsSection.jsx
 *   • StatusBadge, DirectionBadge → matpass/matpassShared.jsx
 *   • computeItemBalance, validate, build*, fixFileActivity → matpass/matpassHelpers.js
 *   • RETURN_OPTIONS, emptyForm, emptyStockRow → matpass/matpassConstants.js
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMatpasses, createMatpass, updateMatpass, deleteMatpass } from "../../api/matpass";
import { getCustomers, getContacts } from "../../api/party";
import { getFiles } from "../../api/files";
import {
  getStockItems, getStocks, getStocksByMatpass,
  createStock, updateStock, deleteStock,
} from "../../api/stocks";
import {
  PAGE_SIZE, canEdit, canDelete, canAdd,
  fmtDate, iconBtn, editCardStyle,
} from "./shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";

// ── matpass/ sub-components ───────────────────────────────────────────────────
import { StatusBadge, DirectionBadge }  from "./matpass/matpassShared";
import { emptyForm }     from "./matpass/matpassConstants";
import {
  validateMatpassForm,
  validateStockAvailability,
  buildMatpassPayload,
  buildStockPayload,
  fixFileActivity,
  resolveCustomerName,
  resolveFileLabel,
} from "./matpass/matpassHelpers";
import MatpassDetail      from "./matpass/MatpassDetail";
import MatpassFormFields  from "./matpass/MatpassFormFields";
import StockItemsSection  from "./matpass/StockItemsSection";

export default function Matpass({ role }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: records = [], isLoading: loading, refetch: refetchMatpasses } = useQuery({
    queryKey: ["matpasses"],
    queryFn:  () => getMatpasses().then(data =>
      [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
    ),
  });
  const { data: customers   = [] } = useQuery({ queryKey: ["customers"],    queryFn: getCustomers });
  const { data: files       = [] } = useQuery({ queryKey: ["files"],        queryFn: getFiles });
  const { data: stockItems  = [] } = useQuery({ queryKey: ["stockItems"],   queryFn: getStockItems });
  const { data: allMovements = [] } = useQuery({ queryKey: ["stocks","all"], queryFn: getStocks });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Detail view ────────────────────────────────────────────────────────────
  const [selectedMatpass, setSelectedMatpass] = useState(null);

  // ── Add form state ─────────────────────────────────────────────────────────
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState(emptyForm());
  const [addStockRows, setAddStockRows] = useState([]);
  const [addContacts, setAddContacts]   = useState([]);

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [editingId, setEditingId]               = useState(null);
  const [editForm, setEditForm]                 = useState({});
  const [editStockRows, setEditStockRows]       = useState([]);
  const [editStockLoading, setEditStockLoading] = useState(false);
  const [editContacts, setEditContacts]         = useState([]);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [confirmKey, setConfirmKey]   = useState(null);
  const [pdfLoading, setPdfLoading]   = useState(null); // row id or null
  const [saving, setSaving]           = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const editable  = canEdit(role);
  const addable   = canAdd(role);
  const deletable = canDelete(role);

  // ── Lookup helpers (list view) ─────────────────────────────────────────────
  const customerName = (id) => resolveCustomerName(customers, id);
  const fileLabel    = (id) => resolveFileLabel(files, id);

  // ── Contact helpers ────────────────────────────────────────────────────────
  const fetchContacts = async (partyId, setContacts) => {
    if (!partyId) { setContacts([]); return; }
    setLoadingContacts(true);
    try {
      const data = await getContacts(partyId);
      setContacts(Array.isArray(data) ? data : []);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleAddPartyChange  = (id) => {
    setAddForm(f => ({ ...f, party: id, contactPerson: "" }));
    fetchContacts(id, setAddContacts);
  };
  const handleEditPartyChange = (id) => {
    setEditForm(f => ({ ...f, party: id, contactPerson: "" }));
    fetchContacts(id, setEditContacts);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const err = validateMatpassForm(addForm);
    if (err) { toast.error(err); return; }

    const stockErr = validateStockAvailability(addForm.inOrOut, addStockRows, stockItems, allMovements, null);
    if (stockErr) { toast.error(stockErr); return; }

    setSaving(true);
    try {
      const newMatpass = await createMatpass(buildMatpassPayload(addForm, files));
      const matpassId  = newMatpass.id;

      for (const row of addStockRows) {
        if (!row.stockItemId) continue;
        await createStock(buildStockPayload(row, matpassId, addForm));
      }

      await fixFileActivity(matpassId, addForm, files);

      toast.success("MAT Pass created.");
      setShowAdd(false);
      setAddForm(emptyForm());
      setAddStockRows([]);
      setAddContacts([]);
      await refetchMatpasses();
      queryClient.invalidateQueries({ queryKey: ["stocks", "all"] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditForm({
      inOrOut:       row.inOrOut || "IN",
      party:         String(row.party ?? ""),
      date:          row.date || "",
      quantity:      row.quantity != null ? String(row.quantity) : "",
      contactPerson: String(row.contactPerson ?? ""),
      discription:   row.discription || "",
      fileRef:       String(row.fileRef ?? ""),
      status:        Number(row.status ?? 1),
    });
    if (row.party) fetchContacts(row.party, setEditContacts);
    setShowAdd(false);

    if (row.id) {
      setEditStockRows([]);
      setEditStockLoading(true);
      getStocksByMatpass(row.id)
        .then(movs => {
          const active = (Array.isArray(movs) ? movs : []).filter(m => Number(m.status) !== 0);
          setEditStockRows(active.map(m => ({
            _key:        `existing-${m.id}`,
            id:          m.id,
            stockItemId: String(m.stockItemId || ""),
            quantity:    String(m.stockQuantity || ""),
            remarks:     m.stockDescription || "",
            returnType:  m.stockReturnOrNonReturn || "NON-RETURN",
            deleted:     false,
          })));
        })
        .catch(() => {})
        .finally(() => setEditStockLoading(false));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContacts([]);
    setEditStockRows([]);
  };

  const handleEdit = async (id) => {
    const err = validateMatpassForm(editForm);
    if (err) { toast.error(err); return; }

    const stockErr = validateStockAvailability(editForm.inOrOut, editStockRows, stockItems, allMovements, id);
    if (stockErr) { toast.error(stockErr); return; }

    setSaving(true);
    try {
      await updateMatpass(id, buildMatpassPayload(editForm, files));

      for (const row of editStockRows) {
        if (row.id && row.deleted) {
          try {
            const existing = allMovements.find(m => m.id === row.id);
            if (existing) await updateStock(row.id, { ...existing, status: 0 });
            else await deleteStock(row.id);
          } catch { /* skip */ }
        } else if (row.id && !row.deleted) {
          if (!row.stockItemId) continue;
          await updateStock(row.id, buildStockPayload(row, id, editForm));
        } else if (!row.id && !row.deleted) {
          if (!row.stockItemId) continue;
          await createStock(buildStockPayload(row, id, editForm));
        }
      }

      await fixFileActivity(id, editForm, files);

      toast.success("MAT Pass updated.");
      cancelEdit();
      await refetchMatpasses();
      queryClient.invalidateQueries({ queryKey: ["stocks", "all"] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMatpass(id);
      toast.success("MAT Pass deleted.");
      queryClient.setQueryData(["matpasses"], (prev = []) => prev.filter(r => r.id !== id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── PDF handler (list view buttons) ───────────────────────────────────────
  const handleDownloadPDF = async (row) => {
    const { printMatpassPDF } = await import("./PDFTemplates");
    setPdfLoading(row.id);
    try {
      const rowMovements = allMovements.filter(
        m => String(m.matPassId) === String(row.id) && Number(m.status) !== 0,
      );
      await printMatpassPDF({ row, customers, stockItems, toast, movements: rowMovements });
    } finally {
      setPdfLoading(null);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ── Detail view (early return)
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedMatpass) {
    return (
      <MatpassDetail
        mp={selectedMatpass}
        onBack={() => setSelectedMatpass(null)}
        onEdit={(mp) => { setSelectedMatpass(null); startEdit(mp); }}
        customers={customers}
        files={files}
        stockItems={stockItems}
        allMovements={allMovements}
        editable={editable}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── List view
  // ══════════════════════════════════════════════════════════════════════════
  const paged   = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const colSpan = 8 + (editable ? 1 : 0);

  return (
    <div className="content-section">
      {/* Page header */}
      <div className="activity-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "var(--a-teal)" }}>
            🪪 MAT Pass
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: "0.74rem", color: "var(--a-text-muted)" }}>
            Material pass records for incoming and outgoing items
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <Btn variant="ghost" onClick={() => refetchMatpasses()} icon="↺">Refresh</Btn>
          {addable && (
            <Btn variant="teal" icon={showAdd ? "✕" : "＋"}
              onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}>
              {showAdd ? "✕ Cancel" : "+ Add MAT Pass"}
            </Btn>
          )}
        </div>
      </div>

      {/* ── Add form ── */}
      {showAdd && (
        <div style={{ ...editCardStyle, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
            New MAT Pass
          </h3>
          <MatpassFormFields
            form={addForm}
            setForm={setAddForm}
            contacts={addContacts}
            onPartyChange={handleAddPartyChange}
            customers={customers}
            files={files}
            loadingContacts={loadingContacts}
          />
          <StockItemsSection
            rows={addStockRows}
            setRows={setAddStockRows}
            stockItems={stockItems}
            allMovements={allMovements}
            direction={addForm.inOrOut}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn variant="primary" onClick={handleAdd} disabled={saving} icon="💾">
              {saving ? "Saving…" : "Submit"}
            </Btn>
            <Btn variant="ghost" icon="✕"
              onClick={() => { setShowAdd(false); setAddForm(emptyForm()); setAddStockRows([]); setAddContacts([]); }}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <p style={{ padding: 40, textAlign: "center", color: "var(--a-text-faint)" }}>Loading…</p>
      ) : (
        <>
          <TableScroller>
            <table className="activity-table" style={{ width: "100%", minWidth: 860, tableLayout: "auto", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th style={{ width: 70 }}>DIR.</th>
                  <th style={{ minWidth: 150 }}>PARTY</th>
                  <th style={{ width: 110 }}>DATE</th>
                  <th style={{ minWidth: 140 }}>FILE REF</th>
                  <th style={{ width: 70, textAlign: "center" }}>ITEMS</th>
                  <th style={{ width: 90 }}>STATUS</th>
                  <th style={{ width: 60, textAlign: "center" }}>PDF</th>
                  {editable && <th style={{ width: 80, textAlign: "center" }}>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="activity-empty">
                      {editable
                        ? 'No MAT Pass records found. Click "+ Add MAT Pass" to create one.'
                        : "No MAT Pass records found."}
                    </td>
                  </tr>
                ) : paged.map((row, idx) => {
                  const itemCount = allMovements.filter(
                    m => String(m.matPassId) === String(row.id) && Number(m.status) !== 0,
                  ).length;

                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))",
                        transition: "background 0.12s",
                        cursor: editingId === row.id ? "default" : "pointer",
                      }}
                      onClick={() => { if (editingId !== row.id) setSelectedMatpass(row); }}
                      onMouseEnter={e => { if (editingId !== row.id) e.currentTarget.style.background = "var(--a-teal-10)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04)"; }}
                    >
                      {editingId === row.id ? (
                        /* ── Inline edit form ── */
                        <td colSpan={colSpan} style={{ padding: 0 }}>
                          <div style={editCardStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                              <Btn variant="back" onClick={cancelEdit} icon="←">← Back</Btn>
                              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
                                Edit MAT Pass #{row.id}
                              </h3>
                            </div>
                            <MatpassFormFields
                              form={editForm}
                              setForm={setEditForm}
                              contacts={editContacts}
                              onPartyChange={handleEditPartyChange}
                              customers={customers}
                              files={files}
                              loadingContacts={loadingContacts}
                            />
                            {editStockLoading ? (
                              <div style={{
                                marginTop: 20, padding: 16,
                                textAlign: "center", color: "var(--a-text-faint)", fontSize: "0.82rem",
                              }}>
                                Loading stock items…
                              </div>
                            ) : (
                              <StockItemsSection
                                rows={editStockRows}
                                setRows={setEditStockRows}
                                stockItems={stockItems}
                                allMovements={allMovements}
                                direction={editForm.inOrOut}
                              />
                            )}
                            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                              <Btn variant="primary" onClick={() => handleEdit(row.id)} disabled={saving} icon="💾">
                                {saving ? "Saving…" : "Save"}
                              </Btn>
                              <Btn variant="ghost" onClick={cancelEdit} icon="✕">Cancel</Btn>
                            </div>
                          </div>
                        </td>
                      ) : (
                        /* ── Normal row ── */
                        <>
                          <td style={{ padding: "10px 12px", color: "var(--a-teal)", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {row.id}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <DirectionBadge value={row.inOrOut} />
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--a-teal)" }}>
                            {customerName(row.party)}
                          </td>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmtDate(row.date)}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {fileLabel(row.fileRef)}
                          </td>
                          {/* Items count badge */}
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            {itemCount > 0 ? (
                              <span style={{
                                background: "rgba(20,184,166,0.12)", color: "var(--a-teal)",
                                border: "1px solid var(--a-teal-30)", borderRadius: 20,
                                padding: "2px 9px", fontSize: "0.75rem", fontWeight: 700,
                              }}>
                                {itemCount}
                              </span>
                            ) : (
                              <span style={{ color: "var(--a-text-faint)", fontSize: "0.75rem" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <StatusBadge status={row.status} />
                          </td>
                          {/* PDF button */}
                          <td
                            style={{ padding: "10px 12px", textAlign: "center" }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              title="Download Material Pass PDF"
                              disabled={pdfLoading === row.id}
                              onClick={() => handleDownloadPDF(row)}
                              style={{
                                ...iconBtn("var(--a-teal)", "var(--a-teal-08, rgba(20,184,166,0.08))", "var(--a-teal-30)"),
                                fontSize: "1rem",
                                opacity: pdfLoading === row.id ? 0.5 : 1,
                              }}
                            >
                              {pdfLoading === row.id ? "⏳" : "📄"}
                            </button>
                          </td>
                          {/* Edit / Delete */}
                          {editable && (
                            <td
                              style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                title="Edit"
                                style={iconBtn(
                                  "var(--a-indigo,#6366f1)",
                                  "var(--a-indigo-10,rgba(99,102,241,0.1))",
                                  "var(--a-indigo-30,rgba(99,102,241,0.3))",
                                )}
                                onClick={() => startEdit(row)}
                              >✏️</button>
                              {deletable && (
                                confirmKey === `mp-${row.id}` ? (
                                  <ConfirmDelete
                                    onConfirm={() => { setConfirmKey(null); handleDelete(row.id); }}
                                    onCancel={() => setConfirmKey(null)}
                                  />
                                ) : (
                                  <button
                                    title="Delete"
                                    style={iconBtn(
                                      "var(--a-danger,#ef4444)",
                                      "var(--a-danger-10,rgba(239,68,68,0.1))",
                                      "var(--a-danger-30,rgba(239,68,68,0.3))",
                                    )}
                                    onClick={() => setConfirmKey(`mp-${row.id}`)}
                                  >🗑️</button>
                                )
                              )}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroller>
          <Pagination total={records.length} page={page} onChange={setPage} />
          <div style={{ marginTop: 8, color: "var(--a-text-faint)", fontSize: "0.75rem" }}>
            {records.length} record{records.length !== 1 ? "s" : ""}
          </div>
          <p className="table-hint">💡 Click any row to view full details</p>
        </>
      )}
    </div>
  );
}
