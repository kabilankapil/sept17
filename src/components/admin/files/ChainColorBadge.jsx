/**
 * ChainColorBadge.jsx
 * ───────────────────
 * Yellow/Green/Red dot for a file's Create Link chain state.
 * Styled to match the existing shared/StatusDot.jsx convention.
 * Pass either `color` directly, or `colorsMap` + `fileId` to look it up.
 */
import { getFileColor, CHAIN_COLOR_HEX, CHAIN_COLOR_LABEL } from "../../../utils/chainColor";

export default function ChainColorBadge({ color, colorsMap, fileId }) {
  const resolved = color || (colorsMap ? getFileColor(colorsMap, fileId) : "yellow");
  const hex   = CHAIN_COLOR_HEX[resolved]   || CHAIN_COLOR_HEX.yellow;
  const label = CHAIN_COLOR_LABEL[resolved] || CHAIN_COLOR_LABEL.yellow;

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }} title={label}>
      <span style={{
        width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
        background: hex, display: "inline-block",
        boxShadow: `0 0 0 3px ${hex}22`,
      }} />
      <span style={{ color: hex, fontSize: "0.78rem", fontWeight: 600 }}>
        {label}
      </span>
    </span>
  );
}
