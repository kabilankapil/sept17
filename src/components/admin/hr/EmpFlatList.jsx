// src/components/admin/hr/EmpFlatList.jsx
//
// Employee list panel with search, "FIRST" badge, and two-section layout:
//   ① Unassigned employees (amber header — need position assigned first)
//   ② Assigned employees (teal header)
//
// Props:
//   employees       — enriched array (each item has _assigned: boolean)
//   loading         — boolean
//   value           — currently selected empId (string)
//   onChange        — (id: string) => void
//   firstEmployeeId — id of the real root employee (from HR.jsx), used for
//                     the "FIRST" badge — must match the same source of
//                     truth used for the actual "Reporting To" assignment
//                     logic, not be recomputed independently here.

import { useState } from "react";
import { inputStyle } from "../shared/adminStyles";
import StatusDot from "../shared/StatusDot";

export default function EmpFlatList({ employees, loading, value, onChange, firstEmployeeId }) {
  const [query, setQuery] = useState("");

  const all = query.trim()
    ? employees.filter((e) => {
        const q = query.toLowerCase();
        return (
          String(e.id).includes(q) ||
          `${e.empName} ${e.empLastName}`.toLowerCase().includes(q) ||
          (e.empMail || "").toLowerCase().includes(q)
        );
      })
    : employees;

  const unassigned = all.filter((e) => !e._assigned);
  const assigned   = all.filter((e) =>  e._assigned);

  const renderRow = (emp, i, arr) => {
    const isSelected = String(emp.id) === String(value);
    const isActive   = emp.status === "Active";
    const isFirst    = firstEmployeeId != null && String(emp.id) === String(firstEmployeeId);

    return (
      <div
        key={emp.id}
        onClick={() => onChange(isSelected ? "" : String(emp.id))}
        style={{
          padding: "9px 10px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 7,
          background: isSelected
            ? "var(--a-teal-15,rgba(20,184,166,0.15))"
            : i % 2 === 0 ? "transparent" : "var(--a-teal-04,rgba(20,184,166,0.04))",
          borderBottom: i < arr.length - 1 ? "1px solid var(--a-teal-08,rgba(20,184,166,0.08))" : "none",
          borderLeft: isSelected ? "3px solid var(--a-teal)" : "3px solid transparent",
          transition: "background 0.1s",
          minWidth: 0,
        }}
      >
        {/* ID badge */}
        <span style={{
          fontSize: "0.65rem", fontWeight: 700,
          color: isSelected ? "var(--a-surface)" : "var(--a-teal)",
          background: isSelected ? "var(--a-teal)" : "var(--a-teal-08,rgba(20,184,166,0.1))",
          borderRadius: 5, padding: "2px 5px", minWidth: 28,
          textAlign: "center", flexShrink: 0,
        }}>
          #{emp.id}
        </span>

        {/* Name — flex:1 with truncation so it never pushes status off screen */}
        <span style={{
          fontSize: "0.86rem",
          fontWeight: isSelected ? 700 : 600,
          color: isSelected ? "var(--a-teal)" : "var(--a-text)",
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {emp.empName} {emp.empLastName}
          {isFirst && (
            <span style={{
              marginLeft: 5, fontSize: "0.6rem", fontWeight: 800,
              background: "var(--a-teal)", color: "var(--a-surface, #fff)",
              borderRadius: 4, padding: "1px 4px", verticalAlign: "middle",
              display: "inline-block",
            }}>
              FIRST
            </span>
          )}
        </span>

        {/* Status — always visible, text on desktop / dot on mobile */}
        <span className="emp-status-text" style={{
          fontSize: "0.67rem", fontWeight: 700, flexShrink: 0,
          color:      isActive ? "#22c55e" : "#ef4444",
          background: isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          borderRadius: 5, padding: "2px 6px",
          border: `1px solid ${isActive ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
          whiteSpace: "nowrap",
        }}>
          {emp.status || "—"}
        </span>
        <span className="emp-status-dot" style={{ flexShrink: 0, lineHeight: 1 }}>
          <StatusDot status={emp.status} />
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {/* Search box */}
      <div style={{ position: "relative", maxWidth: 340 }}>
        <input
          type="text"
          className="activity-input"
          style={{ ...inputStyle, marginBottom: 0, paddingLeft: 32 }}
          placeholder={loading ? "Loading employees…" : "Filter by name or ID…"}
          value={query}
          disabled={loading}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--a-text-faint)", fontSize: "0.8rem", pointerEvents: "none",
        }}>🔍</span>
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--a-text-faint)", fontSize: "1rem", lineHeight: 1, padding: 0,
            }}
          >✕</button>
        )}
      </div>

      {/* List */}
      <div style={{
        border: "1px solid var(--a-border-card,rgba(20,184,166,0.2))",
        borderRadius: 10, overflow: "hidden",
        maxHeight: 320, overflowY: "auto",
        background: "var(--a-surface)",
      }}>
        {loading ? (
          <div style={{ padding: "16px 14px", fontSize: "0.82rem", color: "var(--a-text-faint)", textAlign: "center" }}>
            Loading employees…
          </div>
        ) : (
          <>
            {/* Unassigned section */}
            {unassigned.length > 0 && (
              <>
                <div style={{
                  padding: "6px 14px",
                  background: "rgba(186,117,23,0.08)",
                  borderBottom: "1px solid rgba(186,117,23,0.2)",
                  fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.07em",
                  color: "#BA7517", display: "flex", alignItems: "center", gap: 6,
                }}>
                  ⚠ UNASSIGNED — ASSIGN POSITION FIRST
                </div>
                {unassigned.map((emp, i) => renderRow(emp, i, unassigned))}
              </>
            )}

            {/* Assigned section */}
            {assigned.length > 0 && (
              <>
                <div style={{
                  padding: "6px 14px",
                  background: "var(--a-teal-05, rgba(20,184,166,0.05))",
                  borderTop: unassigned.length > 0 ? "1px solid var(--a-teal-20)" : "none",
                  borderBottom: "1px solid var(--a-teal-20)",
                  fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.07em",
                  color: "var(--a-teal)",
                }}>
                  ASSIGNED EMPLOYEES
                </div>
                {assigned.map((emp, i) => renderRow(emp, i, assigned))}
              </>
            )}

            {unassigned.length === 0 && assigned.length === 0 && (
              <div style={{ padding: "16px 14px", fontSize: "0.82rem", color: "var(--a-text-faint)", textAlign: "center" }}>
                No employees found.
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer count + clear */}
      {!loading && (
        <div style={{ fontSize: "0.72rem", color: "var(--a-text-faint)" }}>
          {all.length} of {employees.length} employee{employees.length !== 1 ? "s" : ""}
          {value && (
            <button
              onClick={() => onChange("")}
              style={{
                marginLeft: 10, background: "none", border: "none",
                cursor: "pointer", color: "var(--a-danger,#ef4444)",
                fontSize: "0.72rem", fontWeight: 700, padding: 0,
              }}
            >
              ✕ Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
