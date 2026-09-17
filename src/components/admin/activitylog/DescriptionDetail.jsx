// src/components/admin/activitylog/DescriptionDetail.jsx
//
// Description detail block with collapse/expand, used in the activity
// detail panel. Extracted from ActivityLog.jsx with no behavior changes.

import { useState, useEffect, useRef } from "react";

export default function DescriptionDetail({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      setNeedsClamp(ref.current.scrollHeight > ref.current.clientHeight + 2);
    }
  }, [text]);

  const COLLAPSED_LINES = 5;
  const LINE_HEIGHT = 1.75;
  const FONT_SIZE = 15.2; // 0.95rem approx
  const maxHeight = COLLAPSED_LINES * LINE_HEIGHT * FONT_SIZE;

  return (
    <div style={{ padding: "20px 28px" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-text-faint, #64748b)", marginBottom: 10 }}>
        📝 Description
      </div>
      <div style={{
        background: "var(--a-teal-05, rgba(20,184,166,0.04))",
        border: "1px solid var(--a-teal-10, rgba(20,184,166,0.1))",
        borderRadius: 8, padding: "14px 18px", minHeight: 48,
      }}>
        <div
          ref={ref}
          style={{
            color: "var(--a-text-body, #1e293b)",
            lineHeight: LINE_HEIGHT,
            fontSize: "0.95rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: expanded ? "none" : `${maxHeight}px`,
            overflow: "hidden",
          }}
        >
          {text || <span style={{ color: "var(--a-text-faint)", fontStyle: "italic" }}>No description provided.</span>}
        </div>
        {(needsClamp || expanded) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--a-teal)",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 600,
              padding: "8px 0 0",
              display: "block",
            }}
          >
            {expanded ? "▲ Show less" : "▼ Show more"}
          </button>
        )}
      </div>
    </div>
  );
}
