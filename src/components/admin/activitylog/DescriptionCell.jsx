// src/components/admin/activitylog/DescriptionCell.jsx
//
// Table-cell description with 3-line clamp + expand toggle.
// Extracted from ActivityLog.jsx with no behavior changes.

import { useState, useEffect, useRef } from "react";

export default function DescriptionCell({ text, onClick }) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      setNeedsClamp(ref.current.scrollHeight > ref.current.clientHeight + 2);
    }
  }, [text]);

  if (!text) {
    return (
      <td style={{ color: "var(--a-text-muted)" }} onClick={onClick}>—</td>
    );
  }

  const LINE_HEIGHT = 1.5;
  const FONT_SIZE = 13;
  const MAX_LINES = 3;
  const maxHeight = LINE_HEIGHT * FONT_SIZE * MAX_LINES;

  return (
    <td style={{ color: "var(--a-text-muted)", maxWidth: 280, width: 280, padding: "8px 12px" }}>
      <div
        ref={ref}
        style={{
          maxHeight: expanded ? "none" : `${maxHeight}px`,
          overflow: "hidden",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          cursor: "pointer",
          lineHeight: `${LINE_HEIGHT}`,
          fontSize: "0.81rem",
        }}
        onClick={onClick}
      >
        {text}
      </div>
      {(needsClamp || expanded) && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          style={{
            background: "none",
            border: "none",
            color: "var(--a-teal)",
            cursor: "pointer",
            fontSize: "0.7rem",
            padding: "2px 0 0",
            fontWeight: 600,
            display: "block",
          }}
        >
          {expanded ? "▲ Show less" : "▼ Show more"}
        </button>
      )}
    </td>
  );
}
