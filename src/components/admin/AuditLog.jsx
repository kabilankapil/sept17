import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLog } from "../../api/auditLog";
import Btn from "./shared/Btn";

// ── constants ─────────────────────────────────────────────────────────────

const TABLE_OPTIONS = [
  { value: "",                              label: "All modules" },
  { value: "sales_register",                label: "Sales" },
  { value: "sales_document_item_list",      label: "Sales Items" },
  { value: "purchase_register",             label: "Purchase" },
  { value: "purchase_document_item_list",   label: "Purchase Items" },
  { value: "file_index",                    label: "Files" },
  { value: "logs_file_activities",          label: "Activity Log" },
  { value: "employee",                      label: "Employee" },
  { value: "emp_position_table",            label: "Employee Position" },
  { value: "emp_payslip",                   label: "Payslip" },
  { value: "customer_details",              label: "Customer" },
  { value: "party_directory",               label: "Party" },
  { value: "material_pass",                 label: "MAT Pass" },
  { value: "stock_inout_list",              label: "Stocks" },
  { value: "stock_items",                   label: "Stock Items" },
  { value: "users",                         label: "Users" },
  { value: "activity_type",                 label: "Activity Type" },
];

const ACTION_OPTIONS = [
  { value: "",       label: "All actions" },
  { value: "create",  label: "Created" },
  { value: "update",  label: "Edited" },
  { value: "delete",  label: "Deleted" },
];

const actionBadge = (action) => {
  const map = {
    create: { background: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7" },
    update: { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
    delete: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
  };
  return {
    ...(map[action] ?? map.update),
    padding: "3px 10px", borderRadius: 12,
    fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
    display: "inline-block",
  };
};

const actionLabel = {
  create: "Created",
  update: "Edited",
  delete: "Deleted",
};

const tableLabel = (name) =>
  TABLE_OPTIONS.find((t) => t.value === name)?.label || name;

const inputStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--a-border, #cbd5e1)",
  background: "var(--a-input-bg, #fff)",
  fontSize: "0.85rem",
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── main component ───────────────────────────────────────────────────────

export default function AuditLog() {
  const [filters, setFilters] = useState({
    table: "", action: "", actor: "", from: "", to: "",
  });
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["audit-log", filters, page],
    queryFn: () => getAuditLog({ ...filters, page, limit: LIMIT }),
    keepPreviousData: true,
  });

  const rows = data ?? [];

  function updateFilter(field, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters({ table: "", action: "", actor: "", from: "", to: "" });
  }

  return (
    <div className="content-section">

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Audit Log</h1>
        <Btn variant="ghost" icon="⟳" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "Refresh"}
        </Btn>
      </div>

      <p style={{ fontSize: "0.85rem", color: "var(--a-text-faint)", marginTop: 0, marginBottom: 18 }}>
        Every create, edit, and delete across the system — who did it and when.
        Use this to trace what happened if something looks wrong.
      </p>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end",
          padding: "14px 16px", borderRadius: 8,
          background: "var(--a-teal-05)", border: "1px solid var(--a-teal-20)",
          marginBottom: 18,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: 4, color: "var(--a-text-muted)" }}>MODULE</label>
          <select style={inputStyle} value={filters.table} onChange={(e) => updateFilter("table", e.target.value)}>
            {TABLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: 4, color: "var(--a-text-muted)" }}>ACTION</label>
          <select style={inputStyle} value={filters.action} onChange={(e) => updateFilter("action", e.target.value)}>
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: 4, color: "var(--a-text-muted)" }}>USER (EMAIL)</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="e.g. admin@mosic.com"
            value={filters.actor}
            onChange={(e) => updateFilter("actor", e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: 4, color: "var(--a-text-muted)" }}>FROM</label>
          <input
            type="date"
            style={inputStyle}
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: 4, color: "var(--a-text-muted)" }}>TO</label>
          <input
            type="date"
            style={inputStyle}
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
          />
        </div>

        <Btn variant="ghost" onClick={clearFilters}>Clear</Btn>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      {isLoading ? (
        <p style={{ color: "var(--a-text-faint)" }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: "#ef4444" }}>{error?.message || "Failed to load audit log."}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--a-text-faint)" }}>No matching activity found.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--a-border)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--a-teal-08)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px" }}>DATE &amp; TIME</th>
                <th style={{ padding: "10px 14px" }}>USER</th>
                <th style={{ padding: "10px 14px" }}>ACTION</th>
                <th style={{ padding: "10px 14px" }}>MODULE</th>
                <th style={{ padding: "10px 14px" }}>RECORD</th>
                
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--a-border)" }}>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{formatDateTime(row.createdAt)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600 }}>{row.actorEmail}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--a-text-faint)" }}>{row.actorRole}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={actionBadge(row.action)}>{actionLabel[row.action] || row.action}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>{tableLabel(row.tableName)}</td>
                  <td style={{ padding: "10px 14px" }}>#{row.recordId}</td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
        <Btn variant="ghost" small onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
          ← Prev
        </Btn>
        <span style={{ fontSize: "0.82rem", color: "var(--a-text-faint)" }}>Page {page}</span>
        <Btn variant="ghost" small onClick={() => setPage((p) => p + 1)} disabled={rows.length < LIMIT || isLoading}>
          Next →
        </Btn>
      </div>

    </div>
  );
}
