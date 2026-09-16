// src/components/admin/activityLog/activityLogConstants.js
//
// Shared constants and helpers for ActivityLog and its sub-components.

import { localDate } from "../shared/adminStyles";

// ─── Purchase doctype labels (mirrors Purchase.jsx / purchaseConstants.js) ──
export const PURCHASE_DOCTYPE_OPTIONS = [
  { value: "1", label: "Enquiry" },
  { value: "2", label: "Quotation" },
  { value: "3", label: "Purchase Order" },
  { value: "4", label: "Invoice" },
  { value: "5", label: "Delivery Note" },
];

export const purchaseDoctypeLabel = (v) =>
  PURCHASE_DOCTYPE_OPTIONS.find((o) => o.value === String(v))?.label ?? String(v ?? "—");

// ─── Empty form factories ─────────────────────────────────────
export const emptyActForm = () => ({
  date: localDate(),
  status: "ACTIVE",
  description: "",
  // ── logs_file_activities chain fields ──
  causeId: "",
  effectId: "",
  expireDate: "",
  logDescription: "",
});

// Days-before-expiry at which a log entry is flagged "expiring soon"
export const EXPIRE_SOON_DAYS = 7;

/** "yyyy-mm-dd" | "dd-mm-yyyy" → Date, or null if unparseable/empty. */
function parseAnyDate(val) {
  if (!val) return null;
  const datePart = val.split("T")[0].split(" ")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;
  const iso = parts[0].length === 4 ? datePart : `${parts[2]}-${parts[1]}-${parts[0]}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Returns "expired" | "soon" | null for a given expire date. */
export function expiryFlag(expireDate) {
  const d = parseAnyDate(expireDate);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= EXPIRE_SOON_DAYS) return "soon";
  return null;
}
