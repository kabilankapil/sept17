// src/components/admin/activitylog/activityHelpers.js
//
// Pure helper functions used by ActivityLog.jsx. Extracted as-is with no
// behavior changes — every function here took explicit arguments and closed
// over nothing in the original file, so this move is purely mechanical.

// ── File-type → small colored icon badge (S.No & File cell) ───
export function fileKindOf(fileName = "", fileType = "") {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const type = (fileType || "").toLowerCase();
  if (ext === "pdf" || type.includes("pdf")) return { cls: "pdf", label: "PDF" };
  if (["doc", "docx"].includes(ext) || type.includes("word")) return { cls: "doc", label: "W" };
  if (["xls", "xlsx", "csv"].includes(ext) || type.includes("sheet") || type.includes("excel")) return { cls: "xls", label: "X" };
  if (["ppt", "pptx"].includes(ext) || type.includes("presentation")) return { cls: "ppt", label: "P" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || type.startsWith("image/")) return { cls: "img", label: "IMG" };
  return { cls: "generic", label: "FILE" };
}

// A log row only counts as "linkable" (has the connectivity option) when it
// was originally saved with "Link to another activity? Yes" — which always
// leaves an expireDate and/or logDescription behind. Rows created with "No"
// are plain standalone entries and have neither, so they're excluded from
// the Continues From / Also Closes pickers entirely.
export function hasConnectivity(log) {
  return !!(log?.expireDate || log?.logDescription?.trim());
}

// Whether this log CURRENTLY participates in an actual chain relationship —
// it has its own cause_id/effect_id, or some other active log points at it
// via cause_id/effect_id. This is different from hasConnectivity() above,
// which only says a row *could* be linked (was created with the linking
// option) — it stays true forever even after a link is removed, since
// expireDate/logDescription aren't touched by unlinking. isChainLinked()
// reflects the live chain state, so once a chain is unlinked (see
// api/file-logs/{id} DELETE, which clears cause_id/effect_id on every
// affected row) this correctly flips to false and the card goes yellow.
export function isChainLinked(log, fileLogHistory) {
  if (!log) return false;

  // log_status is the source of truth for the three-state workflow:
  // single = yellow, open = green, closed = red.
  const status = String(log.logStatus || log.log_status || "single").toLowerCase();
  if (status === "open" || status === "closed") return true;

  return false;
}

// A connectable open log is "claimed" once some other open log already
// points at it as its Continues-From (causeId) or Also-Closes (effectId)
// target — i.e. it's already part of somebody else's chain. Claimed
// entries are filtered out of the New Activity pickers so only genuinely
// unclaimed, standalone-open activities show up as options.
export function unclaimedConnectable(openLogs) {
  // Only GREEN / OPEN chain endpoints are available for Follow Up Activity.
  // Yellow single activities are never shown, even when they still keep
  // their old log description after an unlink.
  return openLogs.filter((l) =>
    String(l?.logStatus || l?.log_status || "").toLowerCase() === "open"
  );
}

// Confirm-delete copy for an activity row. Mirrors the backend's own
// "is this row part of a chain?" check (see api/file-logs/{id} DELETE) so
// the warning always matches what will actually happen:
//  - part of a chain  → nothing gets deleted; the whole chain is unlinked
//    and every linked activity (this one included) becomes standalone.
//  - standalone entry → this is a real, permanent delete, as before.
export function deleteActLabel(act, fileLogHistory) {
  const log = fileLogHistory.find((l) => String(l.currentId) === String(act?.id));
  if (!log) return "This action cannot be undone.";

  if (isChainLinked(log, fileLogHistory)) {
    return "This activity is part of a chain. Deleting it won't remove any files — instead, the whole chain will be unlinked and every activity in it will become a standalone entry.";
  }
  return "This action cannot be undone.";
}

// Resolve a Cause ID / Effect ID reference to a human label the same way the
// Continues From / Also Closes dropdowns already do: prefer the linked
// activity's own main Description field, fall back to its attached file
// name, then its log description, then the bare activity number if none
// of those exist.
export function linkedActLabel(id, { actById, blobMetaByBlobId, fileLogHistory }) {
  if (!id) return null;
  const linkedAct = actById[id];
  const description = linkedAct?.description?.trim();
  const fileName = linkedAct?.blobId ? blobMetaByBlobId[linkedAct.blobId]?.fileName : null;
  const linkedLog = fileLogHistory.find((l) => String(l.currentId) === String(id));
  return description || fileName || linkedLog?.logDescription || `Activity #${id}`;
}

// Same red/green/yellow classification as the card list (act-row-card--*):
// closed → red, open → green, no connectivity option → yellow. Used to color
// the Cause ID / Effect ID badges in the detail view so their state is
// visible at a glance without having to click through to that activity.
export function linkedActState(id, { fileLogHistory }) {
  if (!id) return null;
  const log = fileLogHistory.find((l) => String(l.currentId) === String(id));
  if (!log || !isChainLinked(log, fileLogHistory)) return "standalone";
  return log.logStatus === "open" ? "open" : "closed";
}

// ── File size limit ───────────────────────────────────────────
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
