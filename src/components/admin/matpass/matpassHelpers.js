// src/components/admin/matpass/matpassHelpers.js
//
// Pure logic helpers and the fixFileActivity side-effect function.
// No React state or JSX — import anywhere without hook rules applying.

import { localDate } from "../shared/adminStyles";
import { createActivity, getActivities, deleteActivity } from "../../../api/fileActivity";

// ── Name / label resolvers ────────────────────────────────────────────────────

/** Resolve a customer ID to a display name from the customers list. */
export const resolveCustomerName = (customers, id) => {
  if (!id) return "—";
  const c = customers.find(c => String(c.id) === String(id));
  return c ? (c.companyName || c.customerName || c.name || `#${id}`) : `#${id}`;
};

/** Resolve a file ID to a display label from the files list. */
export const resolveFileLabel = (files, id) => {
  if (!id) return "—";
  const f = files.find(f => String(f.fileId) === String(id));
  return f ? (f.activity || f.fileId) : String(id);
};

// ── Stock balance ─────────────────────────────────────────────────────────────

/** Compute live balance for one item from its opening balance + all movements. */
export function computeItemBalance(itemId, stockItems, movements) {
  const item    = stockItems.find(i => String(i.id) === String(itemId));
  const opening = Number(item?.smOpeningBalance) || 0;
  const relevant = movements.filter(
    m => String(m.stockItemId) === String(itemId) && Number(m.status) !== 0,
  );
  const ins  = relevant.filter(m => (m.stockInOut || "").toUpperCase() === "IN")
    .reduce((s, m) => s + (Number(m.stockQuantity) || 0), 0);
  const outs = relevant.filter(m => (m.stockInOut || "").toUpperCase() === "OUT")
    .reduce((s, m) => s + (Number(m.stockQuantity) || 0), 0);
  return opening + ins - outs;
}

// ── Stock availability validation ─────────────────────────────────────────────

/**
 * Validates that no OUT-direction stock row exceeds available balance.
 * Returns an error string (first offending item) or null if all rows are valid.
 *
 * @param {string}  direction  — "IN" or "OUT"
 * @param {Array}   rows       — stock row objects (from StockItemsSection state)
 * @param {Array}   stockItems — full stock items list
 * @param {Array}   movements  — all stock movements
 * @param {number|null} editingMatpassId — for edit: exclude this matpass's own movements
 */
export function validateStockAvailability(direction, rows, stockItems, movements, editingMatpassId = null) {
  if ((direction || "IN").toUpperCase() !== "OUT") return null;

  const visibleRows = rows.filter(r => !r.deleted && r.stockItemId);

  for (const row of visibleRows) {
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;

    // Exclude this matpass's own existing movements so edits don't double-count
    const relevantMovements = editingMatpassId
      ? movements.filter(m => String(m.matPassId) !== String(editingMatpassId))
      : movements;

    const avail = computeItemBalance(row.stockItemId, stockItems, relevantMovements);

    if (qty > avail) {
      const item = stockItems.find(i => String(i.id) === String(row.stockItemId));
      const name = item?.productName || `Item #${row.stockItemId}`;
      return `"${name}" — requested ${qty}, but only ${avail} unit${avail === 1 ? "" : "s"} available. Cannot go negative.`;
    }
  }

  return null;
}

// ── Form validation ───────────────────────────────────────────────────────────

/** Returns an error string or null if the form is valid. */
export const validateMatpassForm = (f) => {
  if (!f.inOrOut)       return "Direction (IN/OUT) is required.";
  if (!f.party)         return "Party is required.";
  if (!f.date)          return "Date is required.";
  if (!f.contactPerson) return "Contact Person is required.";
  if (!f.fileRef)       return "File Reference is required.";
  if (!f.discription)   return "Description is required.";
  if (f.status === "" || f.status === null || f.status === undefined) return "Status is required.";
  return null;
};

// ── Payload builders ──────────────────────────────────────────────────────────

/**
 * Build a matpass description from the form.
 * Falls back to a generated string from the file activity if description is blank.
 *
 * @param {Object} form  — matpass form state
 * @param {Array}  files — full files list (from ["files"] query)
 */
export const buildDescription = (form, files) => {
  if (form.discription) return form.discription;
  const linkedFile   = files.find(fl => String(fl.fileId) === String(form.fileRef));
  const fileActivity = linkedFile?.activity || null;
  const parts        = [`Material ${(form.inOrOut || "IN")} Pass`];
  if (fileActivity) parts.push(fileActivity);
  return parts.join(" - ");
};

/** Build the matpass API payload from form state. */
export const buildMatpassPayload = (form, files) => ({
  inOrOut:       form.inOrOut || "IN",
  party:         form.party ? Number(form.party) : null,
  date:          form.date || null,
  quantity:      form.quantity !== "" && form.quantity !== null ? Number(form.quantity) : null,
  contactPerson: form.contactPerson || "",
  discription:   buildDescription(form, files),
  fileRef:       form.fileRef || null,
  status:        Number(form.status),
});

/** Build a single stock movement API payload from a stock row + parent matpass context. */
export const buildStockPayload = (row, matpassId, form) => ({
  stockItemId:            Number(row.stockItemId),
  stockDate:              form.date || null,
  stockInOut:             form.inOrOut || "IN",
  stockQuantity:          Number(row.quantity) || 0,
  stockReturnOrNonReturn: row.returnType || "NON-RETURN",
  stockParty:             form.party ? Number(form.party) : null,
  matPassId:              matpassId,
  stockDescription:       row.remarks || "",
  status:                 1,
});

// ── Activity log cleanup ──────────────────────────────────────────────────────

/**
 * Logs a properly-titled activity entry for a matpass save/update and sweeps
 * backend-auto-created blank "Material Pass created/updated" entries.
 *
 * @param {number} matpassId
 * @param {Object} form  — matpass form state
 * @param {Array}  files — full files list (used by buildDescription)
 */
export async function fixFileActivity(matpassId, form, files) {
  if (!form.fileRef) return;
  const fileId = String(form.fileRef);

  // refId must be "MP-<id>" so ActivityLog.jsx can parse it via /^MP-(\d+)$/i
  const actFields = {
    fileId,
    refId:       `MP-${matpassId}`,
    date:        form.date || localDate(),
    description: buildDescription(form, files),
    status:      "ACTIVE",
  };

  try {
    // Always create a new activity entry — never overwrite existing ones.
    await createActivity(fileId, actFields);

    // Sweep backend-auto-created blank entries (on both create and update).
    const refreshed  = await getActivities(fileId);
    const autoEntries = refreshed.filter(
      (a) =>
        !a.refId &&
        (a.description === "Material Pass created" ||
          a.description === "Material Pass updated"),
    );
    for (const entry of autoEntries) {
      await deleteActivity(entry.id).catch(() => { /* non-critical */ });
    }
  } catch {
    // Non-critical — matpass was saved successfully
  }
}
