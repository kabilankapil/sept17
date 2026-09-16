/**
 * DatePicker.jsx
 * ──────────────
 * Drop-in date picker for the admin panel.
 *
 * Props
 * ─────
 *   value     {string}   Controlled value in "yyyy-MM-dd" (ISO) format, or "".
 *   onChange  {function} Called with a "yyyy-MM-dd" string whenever the date changes.
 *   label     {string}   Optional field label rendered above the input.
 *   required  {boolean}  Renders a red asterisk next to the label when true.
 *
 * Behaviour
 * ─────────
 *   • Displays the selected date as dd/mm/yyyy inside the trigger button.
 *   • Opens a popover calendar on click (keyboard-accessible).
 *   • Allows direct keyboard entry: type "ddmmyyyy" → auto-submits when complete.
 *   • Month navigation via ◀ / ▶ arrows or the month/year dropdowns.
 *   • "Today" shortcut resets to the current date.
 *   • Closes on outside click or Escape.
 *   • Fully theme-aware via admin CSS variables (dark/light).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { labelStyle, inputStyle } from "./shared/adminStyles";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/** "yyyy-MM-dd" → { year, month (1-based), day } | null */
function parseISO(val) {
  if (!val || typeof val !== "string") return null;
  const [y, m, d] = val.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

/** { year, month, day } → "yyyy-MM-dd" */
function toISO({ year, month, day }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** { year, month, day } → "dd/mm/yyyy" */
function toDisplay({ year, month, day }) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-based; passing it directly gives last day of that month
}

function firstDayOfMonth(year, month) {
  return new Date(year, month - 1, 1).getDay(); // 0 = Sunday
}

function today() {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate() };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Year range shown in the year dropdown
const YEAR_RANGE_BACK    = 80;
const YEAR_RANGE_FORWARD = 10;

// ─── Styles (inline, CSS-var-driven) ─────────────────────────────────────────

const S = {
  wrapper: {
    position: "relative",
    display: "inline-block",
    width: "100%",
  },

  label: {
    ...labelStyle,
  },

  trigger: {
    ...inputStyle,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    cursor: "pointer",
    // Match the look of other admin inputs
    background: "var(--a-surface)",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--a-teal-20)",
    borderRadius: 6,
    padding: "9px 12px",
    color: "var(--a-text)",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
    textAlign: "left",
    boxSizing: "border-box",
  },

  triggerOpen: {
    borderColor: "var(--a-teal-50)",
    boxShadow: "0 0 0 3px var(--a-teal-10)",
    outline: "none",
  },

  triggerPlaceholder: {
    color: "var(--a-text-faint)",
  },

  calIcon: {
    flexShrink: 0,
    opacity: 0.55,
    lineHeight: 1,
  },

  // ── Popover ──
  // position/top/left are set inline per-instance (see popoverStyle below) —
  // this is a fixed-position element rendered through a portal into
  // document.body, so it's never clipped by an ancestor's overflow (e.g. the
  // horizontal-scroll table wrapper that was cutting it off when editing a
  // row inside a table).
  popover: {
    position: "fixed",
    zIndex: 9990,
    background: "var(--a-surface-solid)",
    border: "1.5px solid var(--a-teal-20)",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
    padding: "14px 14px 10px",
    minWidth: 280,
    width: 280,
    animation: "dpFadeIn 0.15s ease",
  },

  // ── Header ──
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 4,
  },

  navBtn: {
    background: "var(--a-teal-08)",
    border: "1px solid var(--a-teal-20)",
    borderRadius: 6,
    color: "var(--a-teal)",
    width: 28,
    height: 28,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.85rem",
    flexShrink: 0,
    transition: "background 0.12s",
  },

  monthSelect: {
    background: "var(--a-surface)",
    border: "1px solid var(--a-teal-20)",
    borderRadius: 5,
    color: "var(--a-text)",
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "3px 4px",
    cursor: "pointer",
    flex: "1 1 auto",
    maxWidth: 100,
  },

  yearSelect: {
    background: "var(--a-surface)",
    border: "1px solid var(--a-teal-20)",
    borderRadius: 5,
    color: "var(--a-text)",
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "3px 4px",
    cursor: "pointer",
    width: 66,
    flexShrink: 0,
  },

  // ── Day-of-week row ──
  dowRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: 4,
  },

  dowCell: {
    textAlign: "center",
    fontSize: "0.68rem",
    fontWeight: 800,
    letterSpacing: "0.05em",
    color: "var(--a-teal)",
    padding: "4px 0",
  },

  // ── Day grid ──
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
  },

  dayBtn: (isSelected, isToday, isOtherMonth, disabled) => ({
    width: "100%",
    aspectRatio: "1",
    border: isSelected
      ? "1.5px solid var(--a-teal-50)"
      : isToday
        ? "1.5px solid var(--a-teal-30)"
        : "1.5px solid transparent",
    borderRadius: 5,
    background: isSelected
      ? "var(--a-teal-20)"
      : "transparent",
    color: disabled || isOtherMonth
      ? "var(--a-text-faint)"
      : isSelected
        ? "var(--a-teal)"
        : isToday
          ? "var(--a-teal)"
          : "var(--a-text)",
    fontSize: "0.78rem",
    fontWeight: isSelected || isToday ? 700 : 400,
    cursor: disabled ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.1s, color 0.1s",
    outline: "none",
  }),

  // ── Footer ──
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid var(--a-teal-10)",
    gap: 6,
  },

  todayBtn: {
    background: "var(--a-teal-08)",
    border: "1px solid var(--a-teal-20)",
    borderRadius: 5,
    color: "var(--a-teal)",
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "5px 10px",
    cursor: "pointer",
    transition: "background 0.12s",
  },

  clearBtn: {
    background: "var(--a-danger-10)",
    border: "1px solid var(--a-danger-20)",
    borderRadius: 5,
    color: "var(--a-danger)",
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "5px 10px",
    cursor: "pointer",
    transition: "background 0.12s",
  },

  // ── Keyboard entry ──
  keyEntry: {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.78rem",
    letterSpacing: "0.06em",
    color: "var(--a-teal)",
    background: "var(--a-teal-05)",
    border: "1px solid var(--a-teal-15)",
    borderRadius: 4,
    padding: "3px 7px",
    minWidth: 90,
    textAlign: "center",
  },
};

// Keyframe injected once
const KEYFRAMES = `@keyframes dpFadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`;
let _kfInjected = false;
function injectKeyframes() {
  if (_kfInjected) return;
  const s = document.createElement("style");
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
  _kfInjected = true;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DatePicker({ value = "", onChange, label, required = false }) {
  injectKeyframes();

  const parsed = parseISO(value);
  const todayVal = today();

  // Popover open state
  const [open, setOpen]           = useState(false);
  // Which month/year is currently *viewed* in the calendar
  const [viewYear,  setViewYear]  = useState(() => parsed?.year  ?? todayVal.year);
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? todayVal.month);

  // Keyboard entry buffer: up to 8 digits "ddmmyyyy"
  const [keyBuf, setKeyBuf] = useState("");

  const wrapRef    = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Screen position for the portal-rendered popover, computed from the
  // trigger button's bounding rect (see effect below).
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // ── Recompute popover position whenever it opens, and keep it pinned to
  //    the trigger on scroll/resize while open (e.g. scrolling a table). ──
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const POPOVER_WIDTH = 280;
      const GAP = 6;
      let left = r.left;
      // Keep it on-screen horizontally
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
      }
      let top = r.bottom + GAP;
      // Flip above the trigger if there isn't room below
      const ESTIMATED_HEIGHT = 360;
      if (top + ESTIMATED_HEIGHT > window.innerHeight && r.top > ESTIMATED_HEIGHT) {
        top = r.top - ESTIMATED_HEIGHT - GAP;
      }
      setPopoverPos({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // ── Sync view to value when value changes externally ──
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      const inWrap    = wrapRef.current?.contains(e.target);
      const inPopover = popoverRef.current?.contains(e.target);
      if (!inWrap && !inPopover) {
        setOpen(false);
        setKeyBuf("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Keyboard: Escape to close, digits for quick entry ──
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (e.key === "Escape") { setOpen(false); setKeyBuf(""); return; }

      // Digit entry — only when focus is inside the popover or trigger
      if (/^\d$/.test(e.key) && wrapRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        setKeyBuf(prev => {
          const next = (prev + e.key).slice(0, 8);
          // Auto-submit when 8 digits have been entered
          if (next.length === 8) {
            const dd = parseInt(next.slice(0, 2), 10);
            const mm = parseInt(next.slice(2, 4), 10);
            const yy = parseInt(next.slice(4, 8), 10);
            if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= daysInMonth(yy, mm)) {
              onChange?.(toISO({ year: yy, month: mm, day: dd }));
              setViewMonth(mm);
              setViewYear(yy);
              setOpen(false);
              return "";
            }
          }
          return next;
        });
      }

      // Backspace clears last digit
      if (e.key === "Backspace" && wrapRef.current?.contains(document.activeElement)) {
        setKeyBuf(prev => prev.slice(0, -1));
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onChange]);

  // ── Helpers ──
  const navigate = useCallback((delta) => {
    setViewMonth(pm => {
      let nm = pm + delta;
      if (nm < 1)  { setViewYear(py => py - 1); nm = 12; }
      if (nm > 12) { setViewYear(py => py + 1); nm = 1;  }
      return nm;
    });
  }, []);

  const selectDay = useCallback((day) => {
    onChange?.(toISO({ year: viewYear, month: viewMonth, day }));
    setOpen(false);
    setKeyBuf("");
  }, [viewYear, viewMonth, onChange]);

  const selectToday = useCallback(() => {
    const t = today();
    onChange?.(toISO(t));
    setViewYear(t.year);
    setViewMonth(t.month);
    setOpen(false);
    setKeyBuf("");
  }, [onChange]);

  const clearValue = useCallback(() => {
    onChange?.("");
    setKeyBuf("");
  }, [onChange]);

  // ── Calendar grid ──
  const firstDay  = firstDayOfMonth(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  // Cells include leading blanks + days + trailing blanks to complete last week row
  const totalCells = Math.ceil((firstDay + totalDays) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1;
    cells.push(dayNum >= 1 && dayNum <= totalDays ? dayNum : null);
  }

  // ── Year options ──
  const currentYear = todayVal.year;
  const yearOptions = [];
  for (let y = currentYear - YEAR_RANGE_BACK; y <= currentYear + YEAR_RANGE_FORWARD; y++) {
    yearOptions.push(y);
  }

  // ── Display value ──
  const displayValue  = parsed ? toDisplay(parsed) : "";
  const isOpen        = open;

  // ── Key-entry display (format as dd/mm/yyyy with placeholders) ──
  const formatKeyBuf = (buf) => {
    const d1 = buf[0] ?? "_", d2 = buf[1] ?? "_";
    const m1 = buf[2] ?? "_", m2 = buf[3] ?? "_";
    const y1 = buf[4] ?? "_", y2 = buf[5] ?? "_",
          y3 = buf[6] ?? "_", y4 = buf[7] ?? "_";
    return `${d1}${d2}/${m1}${m2}/${y1}${y2}${y3}${y4}`;
  };

  return (
    <div style={S.wrapper} ref={wrapRef}>
      {/* Label */}
      {label && (
        <label style={S.label}>
          {label}
          {required && (
            <span style={{ color: "var(--a-danger)", marginLeft: 3 }}>*</span>
          )}
        </label>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        style={{
          ...S.trigger,
          ...(isOpen ? S.triggerOpen : {}),
          ...(displayValue ? {} : S.triggerPlaceholder),
        }}
        onClick={() => { setOpen(o => !o); setKeyBuf(""); }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--a-teal-50)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--a-teal-10)"; }}
        onBlur={e  => { if (!isOpen) { e.currentTarget.style.borderColor = "var(--a-teal-20)"; e.currentTarget.style.boxShadow = ""; } }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={label ?? "Select date"}
      >
        <span style={{ flex: 1, fontVariantNumeric: "tabular-nums" }}>
          {displayValue || "dd/mm/yyyy"}
        </span>
        <span style={S.calIcon} aria-hidden>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2"  x2="16" y2="6"/>
            <line x1="8"  y1="2"  x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </span>
      </button>

      {/* Popover — portaled to document.body so it can't be clipped by an
          ancestor's overflow (e.g. a horizontally-scrolling table wrapper) */}
      {isOpen && createPortal(
        <div ref={popoverRef} style={{ ...S.popover, top: popoverPos.top, left: popoverPos.left }} role="dialog" aria-label="Date picker calendar">

          {/* ── Month / year navigation ── */}
          <div style={S.header}>
            <button
              type="button"
              style={S.navBtn}
              onClick={() => navigate(-1)}
              title="Previous month"
              aria-label="Previous month"
              onMouseEnter={e => e.currentTarget.style.background = "var(--a-teal-15)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--a-teal-08)"}
            >
              ◀
            </button>

            <select
              style={S.monthSelect}
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              aria-label="Month"
            >
              {MONTHS_LONG.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <select
              style={S.yearSelect}
              value={viewYear}
              onChange={e => setViewYear(Number(e.target.value))}
              aria-label="Year"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              type="button"
              style={S.navBtn}
              onClick={() => navigate(1)}
              title="Next month"
              aria-label="Next month"
              onMouseEnter={e => e.currentTarget.style.background = "var(--a-teal-15)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--a-teal-08)"}
            >
              ▶
            </button>
          </div>

          {/* ── Day-of-week headers ── */}
          <div style={S.dowRow} aria-hidden>
            {DAY_LABELS.map(d => (
              <div key={d} style={S.dowCell}>{d}</div>
            ))}
          </div>

          {/* ── Day grid ── */}
          <div style={S.grid} role="grid" aria-label={`${MONTHS_LONG[viewMonth - 1]} ${viewYear}`}>
            {cells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`blank-${idx}`} aria-hidden />;
              }

              const isSelected = !!(
                parsed &&
                parsed.year  === viewYear  &&
                parsed.month === viewMonth &&
                parsed.day   === dayNum
              );
              const isToday = (
                todayVal.year  === viewYear  &&
                todayVal.month === viewMonth &&
                todayVal.day   === dayNum
              );

              return (
                <button
                  key={dayNum}
                  type="button"
                  role="gridcell"
                  style={S.dayBtn(isSelected, isToday, false, false)}
                  onClick={() => selectDay(dayNum)}
                  aria-label={`${dayNum} ${MONTHS_SHORT[viewMonth - 1]} ${viewYear}${isToday ? " (today)" : ""}`}
                  aria-selected={isSelected}
                  onMouseEnter={e => {
                    if (!isSelected)
                      e.currentTarget.style.background = "var(--a-teal-08)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div style={S.footer}>
            {/* Keyboard entry hint / live buffer */}
            <div style={S.keyEntry} title="Type ddmmyyyy to enter a date quickly" aria-live="polite">
              {keyBuf.length > 0 ? formatKeyBuf(keyBuf) : "type date…"}
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={S.todayBtn}
                onClick={selectToday}
                title="Jump to today"
                onMouseEnter={e => e.currentTarget.style.background = "var(--a-teal-15)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--a-teal-08)"}
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  style={S.clearBtn}
                  onClick={clearValue}
                  title="Clear date"
                  onMouseEnter={e => e.currentTarget.style.background = "var(--a-danger-20)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--a-danger-10)"}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/*
 * ─── Usage example ────────────────────────────────────────────────────────────
 *
 *   import DatePicker from "../components/admin/DatePicker";
 *
 *   const [invoiceDate, setInvoiceDate] = useState("");
 *
 *   <DatePicker
 *     label="Invoice Date"
 *     required
 *     value={invoiceDate}
 *     onChange={setInvoiceDate}        // receives "yyyy-MM-dd"
 *   />
 *
 * Drop-in replacement for a plain <input type="date" />:
 *
 *   Before:
 *     <input
 *       type="date"
 *       value={form.date}
 *       onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
 *     />
 *
 *   After:
 *     <DatePicker
 *       value={form.date}
 *       onChange={date => setForm(f => ({ ...f, date }))}
 *     />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */