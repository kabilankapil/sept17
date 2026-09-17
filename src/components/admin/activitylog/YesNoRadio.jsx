// src/components/admin/activitylog/YesNoRadio.jsx
//
// Common Yes/No radio toggle (Cause ID / Effect ID pickers).
// Extracted from ActivityLog.jsx with no behavior changes.

export default function YesNoRadio({ name, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", height: 36 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--a-text)", cursor: "pointer" }}>
        <input type="radio" name={name} checked={!value} onChange={() => onChange(false)} />
        No
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--a-text)", cursor: "pointer" }}>
        <input type="radio" name={name} checked={value} onChange={() => onChange(true)} />
        Yes
      </label>
    </div>
  );
}
