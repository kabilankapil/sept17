/**
 * fileActivity.js
 * ───────────────
 * Activities inside a file + single file (blob) per activity.
 * Talks to Java backend on port 8080.
 */

import { authHeaders, authHeadersMultipart, tokenUrl, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

// yyyy-mm-dd → dd-mm-yyyy  (matches backend expectation)
function toDDMMYYYY(val) {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return val; // already dd-mm-yyyy
}

// ── Field mapping ─────────────────────────────────────────────

function packRemarks(fields) {
  const extras = { refId: fields.refId || "" };
  return `__EXTRA__${JSON.stringify(extras)}||${fields.description || ""}`;
}

function parseRemarksExtras(remarks) {
  if (!remarks || !remarks.startsWith("__EXTRA__")) return { refId: "" };
  try {
    const [extraPart] = remarks.replace("__EXTRA__", "").split("||");
    return JSON.parse(extraPart);
  } catch {
    return { refId: "" };
  }
}

function cleanDescription(remarks) {
  if (!remarks || !remarks.startsWith("__EXTRA__")) return remarks || "";
  return remarks.replace("__EXTRA__", "").split("||").slice(1).join("||");
}

function fromJavaDTO(dto) {
  const extras = parseRemarksExtras(dto.activityRemarks);
  const refId  = extras.refId || "";

  // Derive typed IDs from refId so ActivityLog can link to the right record.
  // Format stored by Sales.jsx    -> "S-<id>"  e.g. "S-12"
  // Format stored by Purchase.jsx -> "P-<id>"  e.g. "P-5"
  // Format stored by Matpass.jsx  -> "MP-<id>" e.g. "MP-3"
  // Zero-padded legacy variants ("S-001") are also matched.
  const saleMatch     = /^S-(\d+)$/i.exec(refId);
  const purchaseMatch = /^P-(\d+)$/i.exec(refId);
  const matpassMatch  = /^MP-(\d+)$/i.exec(refId);

  return {
    id:          dto.id,
    fileId:      dto.activityReferenceNo,
    date:        dto.activityDate  || "",
    description: cleanDescription(dto.activityRemarks),
    // Only treat activityDocId as a real blob when the table column confirms it.
    // The backend may set a non-zero default activityDocId on auto-created entries
    // (e.g. "Material Pass created") even though no file was attached, causing a
    // 404 when the viewer tries to load it.  activityDocTable = "doc_blob_table"
    // is set by toJavaDTO only when a real blob was uploaded.
    blobId: (dto.activityDocTable === "doc_blob_table" && dto.activityDocId && Number(dto.activityDocId) > 0)
      ? Number(dto.activityDocId)
      : null,
    status:      dto.activityStatus || "ACTIVE",
    ...extras,
    // Numeric IDs — null when refId does not match the pattern
    saleId:     saleMatch     ? Number(saleMatch[1])     : null,
    purchaseId: purchaseMatch ? Number(purchaseMatch[1]) : null,
    matpassId:  matpassMatch  ? Number(matpassMatch[1])  : null,
  };
}

function toJavaDTO(fileId, fields) {
  return {
    activityReferenceNo: String(fileId),
    activityDate: toDDMMYYYY(fields.date) || "",
    activityRemarks:     packRemarks(fields),
    activityDocId:       fields.blobId   ? String(fields.blobId) : "0",
    activityDocTable:    fields.blobId   ? "doc_blob_table" : "none",
    activityStatus:      fields.status   || "ACTIVE",
  };
}

// ── Shared response helper ────────────────────────────────────

async function readError(res, fallback) {
  const text = await res.text().catch(() => "");
  try { return JSON.parse(text).message || fallback; } catch { return text || fallback; }
}

// ── Blob helpers ──────────────────────────────────────────────

async function uploadBlob(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/blobs`, {
    method: "POST",
    headers: authHeadersMultipart(),
    body: formData,
  });
  if (!res.ok) throw new Error("File upload failed");
  const data = await res.json();
  return data.id;
}

async function deleteBlob(blobId) {
  await mutationFetch(`${BASE_URL}/api/blobs/${blobId}`, "DELETE");
}

// Extension for a blob: the original filename's extension, falling back to
// a MIME-type map, then "bin". Mirrors blobExtension() in the backend's
// helpers/exportHelpers.php so both sides agree on the same extension.
const BLOB_EXT_MAP = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/x-zip": "zip",
};

function blobExtension(fileName, fileType) {
  const raw = fileName && fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
  if (raw) return raw.replace(/[^a-z0-9]/g, "") || "bin";
  return BLOB_EXT_MAP[fileType] || "bin";
}

/** Filename for a single-activity blob download — mirrors the export ZIP's
 *  per-activity naming exactly: "F_<fileId>_A_<activityId>.<ext>" (see
 *  buildActivityListPdf() in backend/helpers/exportHelpers.php), so a file
 *  downloaded individually and the same file downloaded via export share
 *  one name. */
export function activityBlobFilename(fileId, activityId, fileName, fileType) {
  const ext = blobExtension(fileName, fileType);
  return `F_${fileId}_A_${activityId}.${ext}`;
}

export function blobViewUrl(blobId) {
  if (!blobId) return null;
  return tokenUrl(`${BASE_URL}/api/blobs/${blobId}/view`);
}

export function blobDownloadUrl(blobId) {
  if (!blobId) return null;
  return tokenUrl(`${BASE_URL}/api/blobs/${blobId}/download`);
}

/** Lightweight metadata only (name/type/size) — no binary — used to show
 *  the real file name + icon on the Activity Index cards. */
export async function getBlobMeta(blobId) {
  if (!blobId) return null;
  const res = await fetch(`${BASE_URL}/api/blobs/${blobId}`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return {
    id:       data.id ?? blobId,
    fileName: data.fileName ?? data.file_name ?? "",
    fileType: data.fileType ?? data.file_type ?? "",
  };
}

// ── Activities CRUD ───────────────────────────────────────────

export async function getActivities(fileId) {
  const res = await fetch(`${BASE_URL}/api/activities/by-ref/${fileId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to fetch activities"));
  const list = await res.json();
  return list.map(fromJavaDTO);
}

export async function createActivity(fileId, fields, file = null) {
  let blobId = null;
  if (file) blobId = await uploadBlob(file);
  const payload = toJavaDTO(fileId, { ...fields, blobId });
  const res = await fetch(`${BASE_URL}/api/activities`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Clean up the orphaned blob — it was uploaded but never linked to an activity.
    if (blobId) await deleteBlob(blobId).catch(() => {});
    throw new Error(await readError(res, `Failed to create activity (HTTP ${res.status})`));
  }
  return fromJavaDTO(await res.json());
}

export async function updateActivity(activityId, fields, file = null) {
  let blobId = fields.blobId || null;
  let newBlobUploaded = false;
  // File replace is disabled in the UI — only attach when no blob exists yet.
  // If somehow a file is passed with an existing blobId, ignore the file to
  // prevent orphaned blobs. User must delete & re-upload to change the file.
  if (file && !blobId) {
    blobId = await uploadBlob(file);
    newBlobUploaded = true;
  }
  const res = await mutationFetch(`${BASE_URL}/api/activities/${activityId}`, "PUT", {
    body: JSON.stringify(toJavaDTO(fields.fileId, { ...fields, blobId })),
  });
  if (!res.ok) {
    // Clean up the newly uploaded blob — it was never linked to the activity.
    if (newBlobUploaded && blobId) await deleteBlob(blobId).catch(() => {});
    throw new Error(await readError(res, "Failed to update activity"));
  }
  return fromJavaDTO(await res.json());
}

export async function deleteActivity(activityId, blobId = null) {
  // Delete the activity FIRST — if this fails, the blob is kept safe.
  const res = await mutationFetch(`${BASE_URL}/api/activities/${activityId}`, "DELETE");
  if (!res.ok) throw new Error(await readError(res, "Failed to delete activity"));
  // Only clean up the blob AFTER the activity row is gone.
  if (blobId) await deleteBlob(blobId).catch(() => {});
}

// ── Activity Types ────────────────────────────────────────────


/** All types (active + inactive) — used by the manage modal */
export async function getAllActivityTypes() {
  const res = await fetch(`${BASE_URL}/api/activity-type`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res, "Failed to fetch activity types"));
  const list = await res.json();
  return list.map((t) => ({ id: t.id, name: t.activityTypeName, status: t.activityTypeStatus }));
}

export async function createActivityType(name) {
  const res = await fetch(`${BASE_URL}/api/activity-type`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ activityTypeName: name, activityTypeStatus: "1" }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create activity type"));
  return res.json();
}

export async function updateActivityType(id, name, status) {
  const res = await mutationFetch(`${BASE_URL}/api/activity-type/${id}`, "PUT", {
    body: JSON.stringify({ activityTypeName: name, activityTypeStatus: status }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update activity type"));
  return res.json();
}

export async function deleteActivityType(id) {
const res = await mutationFetch(`${BASE_URL}/api/activity-type/${id}`, "DELETE");
  if (!res.ok) throw new Error(await readError(res, "Failed to delete activity type"));
}