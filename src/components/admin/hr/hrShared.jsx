// src/components/admin/hr/hrShared.jsx
//
// Shared micro-components used across hr/ sub-components.

import { labelStyle, inputStyle } from "../shared/adminStyles";

// ── Form field wrapper ────────────────────────────────────────────────────────

export function Field({ label, required, children, span2, error }) {
  return (
    <div style={{ gridColumn: span2 ? "1 / -1" : undefined }}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: "var(--a-danger)" }}> *</span>}
      </label>
      {children}
      {error && (
        <span style={{
          display: "block", marginTop: 4, fontSize: "0.71rem",
          fontWeight: 600, color: "var(--a-danger, #ef4444)", lineHeight: 1.35,
        }}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}

// ── Simple text input ─────────────────────────────────────────────────────────

export function Inp({ value, onChange, placeholder, disabled }) {
  return (
    <input
      type="text"
      className="activity-input"
      style={{ ...inputStyle, ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

// ── Section label in the form grid ────────────────────────────────────────────

export function SectionLabel({ children }) {
  return (
    <div style={{
      gridColumn: "1 / -1", fontSize: "0.72rem", fontWeight: 800,
      letterSpacing: "0.08em", color: "var(--a-teal)",
      paddingTop: 8, paddingBottom: 4,
      borderBottom: "1px solid var(--a-teal-20)", marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

// ── Self-report / Report-to-Admin toggle ──────────────────────────────────────

const TOGGLE_STYLE = `
  .sr-toggle { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
  .sr-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
  .sr-slider { position: absolute; cursor: pointer; inset: 0; background: var(--a-teal-20, rgba(20,184,166,0.2)); border-radius: 22px; transition: 0.2s; }
  .sr-slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
  .sr-toggle input:checked + .sr-slider { background: var(--a-teal); }
  .sr-toggle input:checked + .sr-slider:before { transform: translateX(16px); }
`;


