/**
 * chainColor.js
 * ─────────────
 * Client-side mirror of the backend's computeFileColor() / getChainLinks()
 * (see helpers/chainHelpers.php). Given the full list of active
 * activity_links rows (one getAllLinks() call), derives Yellow/Green/Red
 * for every file in a single pass — avoids one status request per file.
 *
 * Keep this in sync with chainHelpers.php if the traversal rules change.
 */

/**
 * @param {Array} links - active (is_deleted=0) activity_links rows
 * @returns {Map<number, 'yellow'|'green'|'red'>} fileId -> color
 */
export function computeChainColors(links) {
  const colors = new Map();

  // Group edges by cause and by effect for O(1) traversal lookups.
  const byCause = new Map();
  const byEffect = new Map();
  const touchedFiles = new Set();

  for (const l of links) {
    if (l.cause_file_id  != null) { byCause.set(Number(l.cause_file_id), l);  touchedFiles.add(Number(l.cause_file_id)); }
    if (l.effect_file_id != null) { byEffect.set(Number(l.effect_file_id), l); touchedFiles.add(Number(l.effect_file_id)); }
  }

  for (const fileId of touchedFiles) {
    if (colors.has(fileId)) continue;

    // Walk backward to the true start, collecting every edge in the chain.
    const chainLinks = [];
    const visited = new Set([fileId]);

    let cur = fileId;
    while (byEffect.has(cur)) {
      const l = byEffect.get(cur);
      chainLinks.unshift(l);
      if (l.cause_file_id == null) break;
      cur = Number(l.cause_file_id);
      if (visited.has(cur)) break; // cycle guard
      visited.add(cur);
    }

    cur = fileId;
    while (byCause.has(cur)) {
      const l = byCause.get(cur);
      chainLinks.push(l);
      if (l.effect_file_id == null) break;
      cur = Number(l.effect_file_id);
      if (visited.has(cur)) break; // cycle guard
      visited.add(cur);
    }

    const color = chainLinks.every((l) => l.link_status === "closed") ? "red" : "green";
    for (const memberFileId of visited) colors.set(memberFileId, color);
  }

  return colors;
}

/** Look up a single file's color from a precomputed Map, defaulting to yellow. */
export function getFileColor(colorsMap, fileId) {
  return colorsMap.get(Number(fileId)) || "yellow";
}

export const CHAIN_COLOR_HEX = {
  yellow: "#f59e0b",
  green:  "#22c55e",
  red:    "#ef4444",
};

export const CHAIN_COLOR_LABEL = {
  yellow: "Single",
  green:  "Linked (open)",
  red:    "Linked (closed)",
};
