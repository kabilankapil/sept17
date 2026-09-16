/**
 * adminStyles.js
 * ──────────────
 * Single source of truth for all shared admin UI constants.
 * Import from here instead of redefining in each module.
 *
 * Role permission matrix:
 * ┌─────────┬──────┬─────┬────────┐
 * │ Action  │SUPER │ADMIN│ COMMON │
 * ├─────────┼──────┼─────┼────────┤
 * │ View    │  ✅  │ ✅  │  ✅    │
 * │ Add     │  ✅  │ ✅  │  ✅    │
 * │ Edit    │  ✅  │ ✅  │  ❌    │
 * │ Delete  │  ✅  │ ❌  │  ❌    │
 * │ Users   │  ✅  │ ❌  │  ❌    │
 * └─────────┴──────┴─────┴────────┘
 *
 * Usage in any module:
 *   import { canEdit, canDelete } from "../shared/adminStyles";
 *
 *   {canEdit(role) && <button onClick={() => handleEdit(row)}>✏️</button>}
 *   {canDelete(role) && <button onClick={() => setConfirmKey(...)}>🗑️</button>}
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 10;

// ── Role helpers ──────────────────────────────────────────────────────────────

/** Returns true if the role may edit records (SUPER and ADMIN only). */
export const canEdit   = (role) => role === "SUPER" || role === "ADMIN";

/** Returns true if the role may delete records (SUPER only). */
export const canDelete = (role) => role === "SUPER";

/** Returns true if the role may add records (all authenticated roles). */
export const canAdd    = (role) => role === "SUPER" || role === "ADMIN" || role === "COMMON";

/** Returns true if the role may access the Users management tab (SUPER only). */
// export const canManageUsers = (role) => role === "SUPER";

// ── Number / date formatters ──────────────────────────────────────────────────

/** Format a number as Indian locale currency string — e.g. 1,23,456.78 */
export const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Normalise any date string to dd-mm-yyyy for display.
 * Handles: yyyy-mm-dd (ISO), dd-mm-yyyy, dd/mm/yyyy.
 * Returns "—" for empty / unparseable values.
 */
export const fmtDate = (val) => {
  if (!val) return "—";
  const datePart = val.split("T")[0].split(" ")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return val;
  if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return datePart;
};

/** Returns today's date as yyyy-mm-dd (for default date field values). */
export const localDate = () => new Date().toISOString().slice(0, 10);

/** Returns current datetime as yyyy-mm-ddTHH:mm (for datetime-local inputs). */


/** Convert dd-mm-yyyy (backend format) → yyyy-mm-dd (HTML date input format). */
export const toISODate = (val) => {
  if (!val) return "";
  const datePart = val.split("T")[0].split(" ")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return val;
  if (parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return datePart;
};
/**
 * Normalise any datetime string to dd-mm-yyyy HH:MM for display.
 */

/**
 * Parse any date string into a Date object for reliable latest-first sorting.
 * Handles: yyyy-mm-dd (ISO), dd-mm-yyyy, dd/mm/yyyy, and ISO datetime strings.
 * Returns epoch (new Date(0)) for empty / unparseable values so they sink to the bottom.
 */
export const toSortableDate = (val) => {
  if (!val) return new Date(0);
  const datePart = val.split("T")[0].split(" ")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return new Date(0);
  if (parts[0].length !== 4) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return new Date(datePart);
};

/**
 * Tax line auto-calculation (used by Sales and Purchase).
 */
export function calcLine(f) {
  const taxable = (Number(f.quantity) || 0) * (Number(f.unitRate) || 0);
  const cgstAmt = (taxable * (Number(f.cgstRate) || 0)) / 100;
  const sgstAmt = (taxable * (Number(f.sgstRate) || 0)) / 100;
  const igstAmt = (taxable * (Number(f.igstRate) || 0)) / 100;
  return {
    taxableValue: taxable,
    cgstAmount:   cgstAmt,
    sgstAmount:   sgstAmt,
    igstAmount:   igstAmt,
    total:        taxable + cgstAmt + sgstAmt + igstAmt,
  };
}

// ── Shared style objects ───────────────────────────────────────────────────────

export const thStyle = {
  padding: "12px 16px",
  fontSize: "0.7rem", fontWeight: 800,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--a-teal)",
  background: "var(--a-teal-08, rgba(20,184,166,0.08))",
  borderBottom: "2px solid var(--a-teal-20)",
  whiteSpace: "nowrap", userSelect: "none",
};

export const tdBase = {
  padding: "13px 16px", fontSize: "0.875rem",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--a-teal-08, rgba(20,184,166,0.08))",
  color: "var(--a-text)",
};

export const tdNowrap = { ...tdBase, whiteSpace: "nowrap" };

export const iconBtn = (color, bg, border) => ({
  width: 30, height: 30, padding: 0, borderRadius: 6,
  fontSize: "0.95rem",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", border: `1px solid ${border}`,
  background: bg, color,
  transition: "all 0.15s ease", marginRight: 4,
});

export const labelStyle = {
  display: "block", fontSize: "0.75rem", fontWeight: 700,
  color: "var(--a-text-faint)", marginBottom: 5,
  textTransform: "uppercase", letterSpacing: "0.05em",
};

export const inputStyle = { width: "100%", boxSizing: "border-box" };

export const editCardStyle = {
  background: "var(--a-teal-05)",
  border: "2px solid var(--a-teal-20)",
  borderRadius: 10, margin: "4px 8px 8px", padding: "20px 24px",
};
