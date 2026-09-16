import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getSales } from "../../api/sales";
import { getAllPurchases } from "../../api/purchases";
import { getFiles } from "../../api/files";
import { getMatpasses } from "../../api/matpass";
import { getEmployees } from "../../api/employee";
import { getCustomers } from "../../api/party";
import { fmtDate } from "./shared/adminStyles";
import { getToken } from "../../api/_auth";
import { useToast } from "./shared/ToastContext";
// ── Helpers ──────────────────────────────────────────────────────────────────

const THIS_MONTH = (() => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
})();

/** dd-mm-yyyy → sortable number  */
function sortVal(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return 0;
  // yyyy-mm-dd
  if (parts[0].length === 4) return Number(`${parts[0]}${parts[1]}${parts[2]}`);
  // dd-mm-yyyy
  return Number(`${parts[2]}${parts[1]}${parts[0]}`);
}

/** Check if a dd-mm-yyyy date falls in current month */
function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;
  // yyyy-mm-dd
  const month = parts[1];
  const year = parts[0].length === 4 ? parts[0] : parts[2];
  return `${month.padStart(2, "0")}-${year}` === THIS_MONTH;
}

// ── Backup Download Button ────────────────────────────────────────────────────

function BackupButton() {
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const toast = useToast();

  async function handleDownload() {
    setStatus("loading");
    try {
      //const res = await fetch("/api/backup/download", { method: "GET" });//auth token is required for this endpoint, otherwise it returns 500 with a generic message and no indication of auth failure in the response body, so we need to add the token manually to get a proper 401 error that we can handle gracefully
      const token = getToken();
      const res = await fetch("/api/backup/download", {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        // Try to parse the JSON error message from the API
        let msg = `Server error ${res.status}`;
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch (_) {}
        throw new Error(msg);
      }

      // Extract filename from Content-Disposition header if available
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = match ? match[1] : `mosic_backup_${Date.now()}.sql`;

      // Stream the blob and trigger a browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus("idle");
    } catch (err) {
      toast.error(err.message || "Backup download failed. Please try again.");
      setStatus("error");
      // Reset back to idle after 4 s so the user can retry
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const styles = {
    idle: {
      background: "transparent",
      color: "var(--a-teal, #14b8a6)",
      border: "1.5px solid var(--a-teal, #14b8a6)",
      cursor: "pointer",
    },
    loading: {
      background: "var(--a-teal-08, rgba(20,184,166,0.08))",
      color: "var(--a-teal, #14b8a6)",
      border: "1.5px solid var(--a-teal, #14b8a6)",
      cursor: "not-allowed",
      opacity: 0.75,
    },
    error: {
      background: "rgba(239,68,68,0.08)",
      color: "#ef4444",
      border: "1.5px solid #ef4444",
      cursor: "pointer",
    },
  }[status];

  const label = {
    idle: "⬇ Backup DB",
    loading: "⏳ Exporting…",
    error: "✕ Failed — Retry",
  }[status];

  return (
    <button
      onClick={handleDownload}
      disabled={status === "loading"}
      title="Download a full SQL backup of the database (superuser only)"
      style={{
        ...styles,
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "background 0.2s, color 0.2s, opacity 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, color, loading }) {
  return (
    <div
      style={{
        background: "var(--a-card, var(--color-background-primary))",
        border: "1.5px solid var(--a-teal-20, rgba(20,184,166,0.2))",
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flex: "1 1 160px",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--a-text-faint, var(--color-text-secondary))",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        {loading ? (
          <div
            style={{
              height: 24,
              width: 60,
              background: "var(--a-teal-08, rgba(20,184,166,0.08))",
              borderRadius: 6,
              animation: "pulse 1.2s infinite",
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: color || "var(--a-teal, #14b8a6)",
              lineHeight: 1,
            }}
          >
            {value}
          </div>
        )}
        {sub && !loading && (
          <div
            style={{
              fontSize: 11,
              color: "var(--a-text-faint, var(--color-text-secondary))",
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function RecentTable({ title, icon, rows, columns, loading, emptyMsg }) {
  return (
    <div
      style={{
        background: "var(--a-card, var(--color-background-primary))",
        border: "1.5px solid var(--a-teal-20, rgba(20,184,166,0.2))",
        borderRadius: 12,
        overflow: "hidden",
        flex: "1 1 300px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--a-teal-08, rgba(20,184,166,0.08))",
          fontWeight: 600,
          fontSize: 13,
          color: "var(--a-text, var(--color-text-primary))",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>{icon}</span> {title}
      </div>

      {loading ? (
        <div style={{ padding: 20 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 18,
                marginBottom: 12,
                background: "var(--a-teal-08, rgba(20,184,166,0.08))",
                borderRadius: 6,
                animation: "pulse 1.2s infinite",
                width: `${70 + i * 8}%`,
              }}
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--a-text-faint, var(--color-text-secondary))",
          }}
        >
          {emptyMsg || "No records yet"}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--a-teal-05, rgba(20,184,166,0.05))",
                }}
              >
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      padding: "7px 12px",
                      textAlign: "left",
                      color: "var(--a-teal, #14b8a6)",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop:
                      "1px solid var(--a-teal-08, rgba(20,184,166,0.08))",
                  }}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: "8px 12px",
                        color: "var(--a-text, var(--color-text-primary))",
                        maxWidth: c.maxWidth || 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row[c.key] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({ currentUser }) {
  const { data: sales = [], isLoading: l1 } = useQuery({
    queryKey: ["sales"],
    queryFn: getSales,
  });
  const { data: purchases = [], isLoading: l2 } = useQuery({
    queryKey: ["purchases"],
    queryFn: getAllPurchases,
  });
  const { data: files = [], isLoading: l3 } = useQuery({
    queryKey: ["files"],
    queryFn: getFiles,
  });
  const { data: matpasses = [], isLoading: l4 } = useQuery({
    queryKey: ["matpasses"],
    queryFn: getMatpasses,
  });
  const { data: employees = [], isLoading: l5 } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });
  const { data: customers = [], isLoading: l6 } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });
  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const activeFiles = files.filter(
    (f) => (f.status || "").toLowerCase() === "active",
  ).length;
  const salesThisMonth = sales.filter((s) => isThisMonth(s.date)).length;
  const purchThisMonth = purchases.filter((p) =>
    isThisMonth(p.purchaseDate),
  ).length;
  const matpassIn = matpasses.filter(
    (m) => (m.inOrOut || "").toUpperCase() === "IN",
  ).length;
  const matpassOut = matpasses.filter(
    (m) => (m.inOrOut || "").toUpperCase() === "OUT",
  ).length;
  const activeEmployees = employees.filter(
    (e) => (e.status || "").toLowerCase() === "active",
  ).length;
  const activeCustomers = customers.filter(
    (c) => (c.status || "").toLowerCase() === "active",
  ).length;

  // ── Recent rows (last 5 by date) ────────────────────────────────────────────
  const recentFiles = [...files]
    .sort((a, b) => sortVal(b.date) - sortVal(a.date))
    .slice(0, 5)
    .map((f) => ({
      subject: f.subject,
      activity: f.activity,
      date: fmtDate(f.date),
    }));

  const recentSales = [...sales]
    .sort((a, b) => sortVal(b.date) - sortVal(a.date))
    .slice(0, 5)
    .map((s) => ({
      from: s.fromParty || s.salesFromParty || "—",
      to: s.toParty || s.salesToParty || "—",
      type: s.documentType || "—",
      date: fmtDate(s.date),
    }));

  const recentMatpass = [...matpasses]
    .sort((a, b) => sortVal(b.date) - sortVal(a.date))
    .slice(0, 5)
    .map((m) => ({
      direction: m.inOrOut || "—",
      party: m.party || "—",
      date: fmtDate(m.date),
    }));

  const badge = {
    SUPER: { bg: "#fef3c7", color: "#92400e", label: "Super Admin" },
    ADMIN: { bg: "#dbeafe", color: "#1e40af", label: "Admin" },
    COMMON: { bg: "#f0fdf4", color: "#166534", label: "User" },
  }[currentUser?.role] ?? { bg: "#f3f4f6", color: "#374151", label: "User" };

  const isSuperuser = currentUser?.role === "SUPER";

  return (
    <div className="content-section">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
          <span style={{ fontSize: 13, color: "var(--a-text-faint)" }}>
            Welcome back, <strong>{currentUser?.username}</strong>
            {" · "}
            <span
              style={{
                background: badge.bg,
                color: badge.color,
                padding: "1px 8px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {badge.label}
            </span>
          </span>
        </div>

        {/* Backup button — superuser only */}
        {isSuperuser && <BackupButton />}
      </div>

      {/* Metric Cards */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}
      >
        <MetricCard
          icon="📁"
          label="Active Files"
          value={activeFiles}
          sub={`${files.length} total`}
          loading={loading}
        />
        <MetricCard
          icon="📈"
          label="Sales This Month"
          value={salesThisMonth}
          sub={`${sales.length} total`}
          loading={loading}
        />
        <MetricCard
          icon="📦"
          label="Purchases This Month"
          value={purchThisMonth}
          sub={`${purchases.length} total`}
          loading={loading}
        />
        <MetricCard
          icon="🔄"
          label="Matpass"
          value={`${matpassIn} IN`}
          sub={`${matpassOut} OUT · ${matpasses.length} total`}
          loading={loading}
        />
        <MetricCard
          icon="👥"
          label="Employees"
          value={activeEmployees}
          sub={`${employees.length} total`}
          loading={loading}
        />
        <MetricCard
          icon="🏢"
          label="Customers"
          value={activeCustomers}
          sub={`${customers.length} total`}
          loading={loading}
        />
      </div>

      {/* Recent Tables */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <RecentTable
          title="Recent Files"
          icon="📁"
          loading={loading}
          rows={recentFiles}
          columns={[
            { key: "subject", label: "Subject", maxWidth: 180 },
            { key: "activity", label: "Activity", maxWidth: 120 },
            { key: "date", label: "Date", maxWidth: 100 },
          ]}
          emptyMsg="No files yet"
        />
        <RecentTable
          title="Recent Sales"
          icon="📈"
          loading={loading}
          rows={recentSales}
          columns={[
            { key: "from", label: "From", maxWidth: 140 },
            { key: "to", label: "To", maxWidth: 140 },
            { key: "type", label: "Type", maxWidth: 100 },
            { key: "date", label: "Date", maxWidth: 100 },
          ]}
          emptyMsg="No sales yet"
        />
        <RecentTable
          title="Recent Matpass"
          icon="🔄"
          loading={loading}
          rows={recentMatpass}
          columns={[
            { key: "direction", label: "IN / OUT", maxWidth: 80 },
            { key: "party", label: "Party", maxWidth: 160 },
            { key: "date", label: "Date", maxWidth: 100 },
          ]}
          emptyMsg="No matpass records yet"
        />
      </div>
    </div>
  );
}
