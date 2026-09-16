// ── stocks/stocksShared.jsx ───────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const active = Number(status) === 1;
  return (
    <span style={{
      background:   active ? "rgba(20,184,166,0.12)"          : "rgba(239,68,68,0.10)",
      color:        active ? "var(--a-teal)"                   : "var(--a-danger)",
      border:       `1px solid ${active ? "var(--a-teal-30)"  : "rgba(239,68,68,0.3)"}`,
      borderRadius: 20, padding: "2px 10px",
      fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function DirectionBadge({ value }) {
  const isIn = (value || "").toUpperCase() === "IN";
  return (
    <span style={{
      background:   isIn ? "rgba(34,197,94,0.12)"             : "rgba(249,115,22,0.12)",
      color:        isIn ? "#22c55e"                           : "#f97316",
      border:       `1px solid ${isIn ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`,
      borderRadius: 20, padding: "2px 10px",
      fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {value || "—"}
    </span>
  );
}

export function BalanceBadge({ value }) {
  const n      = Number(value) || 0;
  const color  = n > 0 ? "#22c55e"              : n < 0 ? "var(--a-danger)"       : "var(--a-text-faint)";
  const bg     = n > 0 ? "rgba(34,197,94,0.10)" : n < 0 ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.04)";
  const border = n > 0 ? "rgba(34,197,94,0.3)"  : n < 0 ? "rgba(239,68,68,0.3)"  : "rgba(0,0,0,0.15)";
  return (
    <span style={{
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: 6, padding: "2px 10px",
      fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
    }}>
      {n}
    </span>
  );
}

export function DeleteTypeModal({ itemLabel = "this record", onSoft, onPermanent, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={onCancel}
    >
      <div style={{
       background: "var(--a-card-bg)",
       border: "1px solid var(--a-border-card)",
        borderRadius: 14,
        padding: "32px 28px 24px",
        width: 360,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column", gap: 0,
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ fontSize: "2.2rem" }}>🗑️</span>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--a-text)" }}>
            Delete {itemLabel}?
          </span>
        </div>

        {/* Subtitle */}
        <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--a-text-faint)", marginBottom: 24, lineHeight: 1.5 }}>
          Choose how you want to delete this record.
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>

          {/* Soft Delete */}
          <button onClick={onSoft} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 10, padding: "12px 16px",
            cursor: "pointer", textAlign: "left", width: "100%",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(245,158,11,0.08)"}
          >
            <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>🟡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#f59e0b", marginBottom: 3 }}>
                Soft Delete
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--a-text-faint)", lineHeight: 1.45 }}>
                Sets status to Inactive. Record is hidden but can be restored later.
              </div>
            </div>
          </button>

          {/* Permanent Delete */}
          <button onClick={onPermanent} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 10, padding: "12px 16px",
            cursor: "pointer", textAlign: "left", width: "100%",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
          >
            <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>🔴</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--a-danger)", marginBottom: 3 }}>
                Permanent Delete
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--a-text-faint)", lineHeight: 1.45 }}>
                Removes the record from the database forever. This cannot be undone.
              </div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button onClick={onCancel} style={{
          width: "100%", padding: "9px 0",
          background: "transparent",
          border: "1px solid var(--a-border)",
          borderRadius: 8, cursor: "pointer",
          fontSize: "0.82rem", fontWeight: 600,
          color: "var(--a-text-faint)",
          transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--a-teal-08)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DetailField({ label, children, fullWidth = false }) {
  return (
    <div style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
      <div style={{
        fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--a-text-faint)", marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "0.9rem", color: "var(--a-text)",
        fontWeight: 500, lineHeight: 1.55, wordBreak: "break-word",
      }}>
        {children ?? <span style={{ color: "var(--a-text-faint)" }}>—</span>}
      </div>
    </div>
  );
}