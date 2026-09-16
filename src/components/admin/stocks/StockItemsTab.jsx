// ── stocks/StockItemsTab.jsx ──────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStockItems, createStockItem, updateStockItem, deleteStockItem, getStocks } from "../../../api/stocks";
import { PAGE_SIZE, canEdit, canDelete, canAdd, fmtDate, thStyle, tdBase, tdNowrap, iconBtn, labelStyle, inputStyle, editCardStyle } from "../shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "../shared/AdminTable";
import { useToast } from "../shared/ToastContext";
import Btn from "../shared/Btn";
import DatePicker from "../DatePicker";
import { errStyle, errBorder, emptyItemForm, emptyItemErrors, validateItemForm, buildBalanceMap } from "./stocksConstants";
import { StatusBadge, BalanceBadge, DetailField, DeleteTypeModal } from "./stocksShared";

// paste StockItemsTab function body here unchanged
export default function StockItemsTab({ role }) {
  const toast = useToast();
  const queryClient = useQueryClient();

const { data: items = [], isLoading: loading, isError: itemsError, refetch: refetchItems } = useQuery({
  queryKey: ["stockItems"],
  queryFn: () => getStockItems().then(data =>
    [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
  ),
});

const { data: movements = [] } = useQuery({
  queryKey: ["stocks"],
  queryFn: getStocks,
});

  const [page, setPage]             = useState(1);
  const [showAdd, setShowAdd]       = useState(false);
  const [addForm, setAddForm]       = useState(emptyItemForm());
  const [addErrs, setAddErrs]       = useState(emptyItemErrors());
  const [saving, setSaving]         = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [editErrs, setEditErrs]     = useState(emptyItemErrors());
  const [confirmKey, setConfirmKey] = useState(null);
  const [permConfirmKey, setPermConfirmKey] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // { id, label }
  const [selectedItem, setSelectedItem] = useState(null);



  const balanceMap = useMemo(() => buildBalanceMap(items, movements), [items, movements]);

  const paged     = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const editable  = canEdit(role);
  const addable   = canAdd(role);
  const deletable = canDelete(role);

  const handleAdd = async () => {
    const errs = validateItemForm(addForm);
    setAddErrs(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      await createStockItem({ ...addForm, smOpeningBalance: Number(addForm.smOpeningBalance) || 0 });
      toast.success("Stock item created.");
      setShowAdd(false);
      setAddForm(emptyItemForm());
      setAddErrs(emptyItemErrors());
      //setLoading(true); load();
      await refetchItems();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditForm({ ...row, smOpeningBalance: String(row.smOpeningBalance ?? "0") });
    setEditErrs(emptyItemErrors());
    setShowAdd(false);
  };

  const handleEdit = async (id) => {
    const errs = validateItemForm(editForm);
    setEditErrs(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      await updateStockItem(id, { ...editForm, smOpeningBalance: Number(editForm.smOpeningBalance) || 0 });
      toast.success("Stock item updated.");
      setEditingId(null);
      //setLoading(true); load();
      await refetchItems();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteStockItem(id);
      toast.success("Stock item deleted.");
      //setLoading(true); load();
      await refetchItems();
    } catch (e) { toast.error(e.message); }
  };

  const handlePermanentDelete = async (id) => {
    try {
      await deleteStockItem(id, { permanent: true });
      toast.success("Stock item permanently deleted.");
      await refetchItems();
    } catch (e) { toast.error(e.message); }
  };

  // Shared form — DB columns: productName, smUnit, smOpeningBalance, openingDate, smDescription, status
  const formFields = (form, setForm, errs) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px 20px" }}>
      {/* productName */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>
          Product Name <span style={{ color: "var(--a-danger)" }}>*</span>
        </label>
        <input className="activity-input"
          style={{ ...inputStyle, ...errBorder(errs.productName) }}
          placeholder="e.g. BC547 Transistor"
          value={form.productName}
          onChange={e => setForm({ ...form, productName: e.target.value })} />
        {errs.productName && <span style={errStyle}>{errs.productName}</span>}
      </div>

      {/* smUnit */}
      <div>
        <label style={labelStyle}>
          Measured In <span style={{ color: "var(--a-danger)" }}>*</span>
        </label>
        <input className="activity-input"
          style={{ ...inputStyle, ...errBorder(errs.smUnit) }}
          placeholder="e.g. pcs, kg, m"
          value={form.smUnit}
          onChange={e => setForm({ ...form, smUnit: e.target.value })} />
        {errs.smUnit && <span style={errStyle}>{errs.smUnit}</span>}
      </div>

      {/* smOpeningBalance */}
      <div>
        <label style={labelStyle}>
          Opening Balance <span style={{ color: "var(--a-danger)" }}>*</span>
        </label>
        <input className="activity-input"
          style={{ ...inputStyle, ...errBorder(errs.smOpeningBalance) }}
          type="number" min="0"
          placeholder="0"
          value={form.smOpeningBalance}
          onChange={e => setForm({ ...form, smOpeningBalance: e.target.value })} />
        {errs.smOpeningBalance && <span style={errStyle}>{errs.smOpeningBalance}</span>}
      </div>

      {/* openingDate — DatePicker */}
      <div>
        <label style={labelStyle}>
          Opening Date <span style={{ color: "var(--a-danger)" }}>*</span>
        </label>
        <DatePicker
          value={form.openingDate}
          onChange={date => setForm({ ...form, openingDate: date })}
        />
        {errs.openingDate && <span style={errStyle}>{errs.openingDate}</span>}
      </div>

      {/* smDescription */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>
          Description <span style={{ color: "var(--a-danger)" }}>*</span>
        </label>
        <textarea className="activity-input activity-textarea"
          style={{ ...inputStyle, minHeight: 60, resize: "vertical", ...errBorder(errs.smDescription) }}
          placeholder="Description is required…"
          value={form.smDescription}
          onChange={e => setForm({ ...form, smDescription: e.target.value })} />
        {errs.smDescription && <span style={errStyle}>{errs.smDescription}</span>}
      </div>

      {/* status */}
      <div>
        <label style={labelStyle}>Status</label>
        <select className="activity-input" style={inputStyle}
          value={form.status}
          onChange={e => setForm({ ...form, status: Number(e.target.value) })}>
          <option value={1}>Active</option>
          <option value={0}>Inactive</option>
        </select>
      </div>
    </div>
  );

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedItem) {
    const balance = balanceMap[selectedItem.id] ?? 0;
    return (
      <div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Btn variant="back" onClick={() => setSelectedItem(null)} icon="←">← Back</Btn>
            <span style={{ color: "var(--a-text-faint)", fontSize: "0.85rem" }}>
              / <strong style={{ color: "var(--a-teal)" }}>Stock Items</strong>
              {" / "}{selectedItem.productName || `#${selectedItem.id}`}
            </span>
          </div>
          {editable && (
            <Btn variant="default" icon="✏️" title="Edit this item"
              onClick={() => { setSelectedItem(null); startEdit(selectedItem); }}>
              Edit
            </Btn>
          )}
        </div>

        <div style={{ ...editCardStyle, cursor: "default" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: "1.3rem" }}>🗂️</span>
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--a-text)" }}>
                {selectedItem.productName || "—"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--a-text-faint)", marginTop: 2 }}>
                Stock Item #{selectedItem.id}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "22px 28px" }}>
            <DetailField label="Measured In">
              {selectedItem.smUnit || <span style={{ color: "var(--a-text-faint)" }}>—</span>}
            </DetailField>

            <DetailField label="Current Balance">
              <BalanceBadge value={balance} />
            </DetailField>

            <DetailField label="Opening Balance">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {selectedItem.smOpeningBalance ?? "0"}
              </span>
            </DetailField>

            <DetailField label="Opening Date">
              {fmtDate(selectedItem.openingDate) || "—"}
            </DetailField>

            <DetailField label="Status">
              <StatusBadge status={selectedItem.status} />
            </DetailField>

            <DetailField label="Description" fullWidth>
              {selectedItem.smDescription
                ? <span style={{ whiteSpace: "pre-wrap" }}>{selectedItem.smDescription}</span>
                : <span style={{ color: "var(--a-text-faint)", fontStyle: "italic" }}>No description provided.</span>
              }
            </DetailField>
          </div>
          {/* Formula text removed */}
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const colSpan = editable ? 7 : 6;

  return (
    <>
      {deleteModal && (
        <DeleteTypeModal
          itemLabel={deleteModal.label}
          onSoft={() => { setDeleteModal(null); handleDelete(deleteModal.id); }}
          onPermanent={() => { setDeleteModal(null); handlePermanentDelete(deleteModal.id); }}
          onCancel={() => setDeleteModal(null)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--a-text-muted)" }}>
          Manage product catalog — items here appear as dropdown options in Stock Movements.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={() => refetchItems()} icon="↺">Refresh</Btn>
          {addable && (
            <Btn variant="teal" icon={showAdd ? "✕" : "＋"}
              onClick={() => { setShowAdd(!showAdd); setEditingId(null); setAddErrs(emptyItemErrors()); }}>
              {showAdd ? "✕ Cancel" : "+ Add Item"}
            </Btn>
          )}
        </div>
      </div>

      {showAdd && (
        <div style={{ ...editCardStyle, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
            New Stock Item
          </h3>
          {formFields(addForm, setAddForm, addErrs)}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn variant="primary" onClick={handleAdd} disabled={saving} icon="💾">
              {saving ? "Saving…" : "Save"}
            </Btn>
            <Btn variant="ghost" icon="✕" onClick={() => {
              setShowAdd(false); setAddForm(emptyItemForm()); setAddErrs(emptyItemErrors());
            }}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ padding: 40, textAlign: "center", color: "var(--a-text-faint)" }}>Loading…</p>
      ) : (
        <>
          <TableScroller>
            <table style={{ width: "100%", minWidth: 680, tableLayout: "auto", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44 }}>ID</th>
                  <th style={{ ...thStyle, minWidth: 120, textAlign: "center" }}>PRODUCT NAME</th>
                  <th style={{ ...thStyle, width: 110 }}>MEASURED IN</th>
                  <th style={{ ...thStyle, width: 130, color: "var(--a-teal)", background: "rgba(20,184,166,0.12)" }}>
                    CURRENT BAL.
                  </th>
                  <th style={{ ...thStyle, width: 110 }}>OPENING DATE</th>
                  <th style={{ ...thStyle, width: 90 }}>STATUS</th>
                  {editable && <th style={{ ...thStyle, width: 80, textAlign: "center" }}>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="activity-empty">
                      {itemsError
                        ? "Failed to load stock items. Please try again."
                        : editable ? 'No stock items yet. Click "+ Add Item" to create one.' : "No stock items found."}
                    </td>
                  </tr>
                ) : paged.map((row, idx) => (
                  <tr key={row.id}
                    style={{
                      background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))",
                      transition: "background 0.12s",
                      cursor: editingId === row.id ? "default" : "pointer",
                    }}
                    onClick={() => { if (editingId !== row.id) setSelectedItem(row); }}
                    onMouseEnter={e => { if (editingId !== row.id) e.currentTarget.style.background = "var(--a-teal-10)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04)"; }}>
                    {editingId === row.id ? (
                      <td colSpan={colSpan} style={{ padding: 0 }}>
                        <div style={editCardStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                            <Btn variant="back" icon="←" onClick={() => { setEditingId(null); setEditErrs(emptyItemErrors()); }}>← Back</Btn>
                            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
                              Edit Stock Item #{row.id}
                            </h3>
                          </div>
                          {formFields(editForm, setEditForm, editErrs)}
                          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                            <Btn variant="primary" onClick={() => handleEdit(row.id)} disabled={saving} icon="💾">
                              {saving ? "Saving…" : "Save"}
                            </Btn>
                            <Btn variant="ghost" icon="✕" onClick={() => { setEditingId(null); setEditErrs(emptyItemErrors()); }}>Cancel</Btn>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td style={{ ...tdNowrap, color: "var(--a-teal)", fontWeight: 700 }}>{row.id}</td>
                        <td style={{ ...tdBase, fontWeight: 600,textAlign: "center" }}>{row.productName || "—"}</td>
                        <td style={tdNowrap}>{row.smUnit || "—"}</td>
                        <td style={{ ...tdBase, textAlign: "center", background: "rgba(20,184,166,0.04)" }}>
                          <BalanceBadge value={balanceMap[row.id] ?? 0} />
                        </td>
                        <td style={tdNowrap}>{fmtDate(row.openingDate)}</td>
                        <td style={tdBase}><StatusBadge status={row.status} /></td>
                        {editable && (
                          <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}
                            onClick={e => e.stopPropagation()}>
                            <button title="Edit"
                              style={iconBtn("var(--a-indigo,#6366f1)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                              onClick={() => startEdit(row)}>✏️</button>
                            {deletable && (
                              <button title="Delete"
                                style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                                onClick={() => setDeleteModal({ id: row.id, label: row.productName || `#${row.id}` })}>🗑️</button>
                            )}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroller>
          {/* Balance legend / formula text removed */}
          <Pagination total={items.length} page={page} onChange={setPage} />
          <div style={{ marginTop: 8, color: "var(--a-text-faint)", fontSize: "0.75rem" }}>
            {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
          <p className="table-hint">💡 Click any row to view full details</p>
        </>
      )}
    </>
  );
}