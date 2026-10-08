/**
 * AdminTable.jsx
 * ──────────────
 * Shared table primitives used by every admin module.
 *   <TableScroller>  — horizontal scroll with ‹ › arrow buttons
 *   <Pagination>     — page number buttons
 *   <ConfirmDelete>  — modal overlay yes/no replacing window.confirm
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PAGE_SIZE } from "./adminStyles";

// ── TableScroller ─────────────────────────────────────────────────────────────

export function TableScroller({ children }) {
  const ref = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [check]);

  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  const arrowBase = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    zIndex: 10, width: 28, height: 28, borderRadius: "50%",
    border: "1px solid var(--a-teal-30)",
    background: "var(--a-surface-solid, #0d1b1b)",
    color: "var(--a-teal)", fontSize: "1rem",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  };

  return (
    <div style={{ position: "relative" }}>
      {canL && <button onClick={() => scroll(-1)} style={{ ...arrowBase, left: -14 }} title="Scroll left">‹</button>}
      <div ref={ref} style={{ overflowX: "auto", overflowY: "visible", borderRadius: 8 }}>
        {children}
      </div>
      {canR && <button onClick={() => scroll(1)} style={{ ...arrowBase, right: -14 }} title="Scroll right">›</button>}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function Pagination({ total, page, onChange }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14, justifyContent: "flex-end" }}>
      <button className="act-btn act-cancel" onClick={() => onChange(page - 1)}
        disabled={page === 1} style={{ padding: "4px 10px" }}>← Prev</button>
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} style={{ padding: "4px 6px", color: "var(--a-text-faint)", fontSize: "0.85rem" }}>…</span>
        ) : (
          <button key={p} className={`act-btn ${p === page ? "act-save" : "act-cancel"}`}
            onClick={() => onChange(p)} style={{ padding: "4px 10px", minWidth: 32 }}>{p}</button>
        )
      )}
      <button className="act-btn act-cancel" onClick={() => onChange(page + 1)}
        disabled={page === totalPages} style={{ padding: "4px 10px" }}>Next →</button>
      <span style={{ fontSize: "0.78rem", color: "var(--a-text-faint)", marginLeft: 4 }}>{total} total</span>
    </div>
  );
}

// ── ConfirmDelete ─────────────────────────────────────────────────────────────
// Renders a centred modal overlay so the confirmation never disturbs the table
// layout or triggers unwanted scrolling.
//
// Usage (unchanged from the inline version):
//   const [confirmKey, setConfirmKey] = useState(null);
//
//   {confirmKey === `item-${row.id}` ? (
//     <ConfirmDelete
//       onConfirm={() => { setConfirmKey(null); handleDelete(row.id); }}
//       onCancel={() => setConfirmKey(null)}
//     />
//   ) : (
//     <button onClick={() => setConfirmKey(`item-${row.id}`)}>🗑️</button>
//   )}
//
// IMPORTANT — rendered via a portal to document.body on purpose:
// `.cdel-backdrop` is `position: fixed`, which is meant to overlay the whole
// viewport. But callers sometimes mount <ConfirmDelete> deep inside a row/card
// that has a CSS `transform` (e.g. a hover-lift effect) and/or
// `overflow: hidden`. Per the CSS spec, an ancestor with an active `transform`
// becomes the *containing block* for any `position: fixed` descendant instead
// of the viewport — so without the portal, the backdrop gets pinned and
// clipped to that small ancestor's box instead of covering the screen, and
// can flicker as hover state toggles the transform on/off. Rendering through
// a portal takes the modal out of that DOM subtree entirely, so it always
// overlays the real viewport regardless of what ancestor styles do.

export function ConfirmDelete({ onConfirm, onCancel, label = "This action cannot be undone.", icon = "🗑️", confirmText = "Delete", confirmClass = "act-delete" }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return createPortal(
    <div className="cdel-backdrop" onClick={onCancel}>
      <div className="cdel-box" onClick={(e) => e.stopPropagation()}>
        {/* Icon */}
                <div className="cdel-icon">{icon}</div>
        {/* Text */}
        <div className="cdel-text">
          <p className="cdel-title">Are you sure?</p>
          <p className="cdel-sub">{label}</p>
        </div>
        {/* Buttons */}
        <div className="cdel-btns">
          <button className="act-btn act-cancel cdel-btn" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className={`act-btn ${confirmClass} cdel-btn`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}