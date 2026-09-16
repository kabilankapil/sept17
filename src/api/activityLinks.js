/**
 * Create Link API for EXISTING activities inside one file.
 *
 * Canonical relationship storage is logs_file_activities:
 *   cause_id / effect_id / current_id / file_ref_id
 *
 * No new activity and no new file is created by this feature.
 */
import { authHeaders, mutationFetch } from "./_auth";
import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text().catch(() => "");
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

export async function getAvailableActivities(fileId) {
  const res = await fetch(
    `${BASE_URL}/api/activity-links/available?fileRefId=${encodeURIComponent(fileId)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error((await safeJson(res)).error || "Failed to load single activities");
  return res.json();
}

/**
 * rows use the chain-builder sequence:
 * [{ causeActivityId|null, effectActivityId|null, description, date }]
 */
export async function saveChain(fileId, rows) {
  const res = await fetch(`${BASE_URL}/api/activity-links`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ fileRefId: fileId, rows }),
  });
  if (!res.ok) throw new Error((await safeJson(res)).error || "Failed to save activity chain");
  return res.json();
}

export async function unlinkActivityChain(fileId, activityId) {
  const res = await mutationFetch(
    `${BASE_URL}/api/activity-links/${encodeURIComponent(fileId)}/${encodeURIComponent(activityId)}`,
    "DELETE"
  );
  if (!res.ok) throw new Error((await safeJson(res)).error || "Failed to unlink activity chain");
  return safeJson(res);
}
