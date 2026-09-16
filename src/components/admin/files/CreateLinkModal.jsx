/**
 * CreateLinkModal.jsx
 *
 * Create chain using existing single activities.
 * Renders as an inline card (same visual language as the
 * "New Activity" panel) instead of a popup overlay.
 *
 * Example:
 *
 * NULL (Start) → ss1
 * ss1          → s1
 * s1           → NULL (End)
 */

import { useEffect, useMemo, useState } from "react";
import {
  getAvailableActivities,
  saveChain,
} from "../../../api/activityLinks";
import { useToast } from "../shared/ToastContext";
import { labelStyle, inputStyle, editCardStyle } from "../shared/adminStyles";
import DatePicker from "../DatePicker";
import Btn from "../shared/Btn";

const emptyRow = () => ({
  causeActivityId: "",
  effectActivityId: "",
  description: "",
  date: "",
  isClosed: false,
});

// ── Small helpers to match the Add Activity panel's field styling ──
const FieldError = ({ msg }) =>
  msg ? (
    <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
      <span>⚠</span> {msg}
    </p>
  ) : null;

const errBorder = (hasErr) =>
  hasErr ? { outline: "1.5px solid #ef4444", border: "1px solid #ef4444" } : {};


export default function CreateLinkModal({
  isOpen,
  fileId,
  fileActivities = [],
  onClose,
  onSaved,
}) {
  const toast = useToast();

  const [available, setAvailable] = useState([]);
  const [rows, setRows] = useState([emptyRow()]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  /*
   * Load available SINGLE activities.
   */
  useEffect(() => {
    if (!isOpen || !fileId) return;

    setRows([emptyRow()]);
    setError("");
    setLoading(true);

    getAvailableActivities(fileId)
      .then((data) => {
        setAvailable(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setAvailable([]);
        setError(err.message || "Failed to load available activities");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, fileId]);


  /*
   * Activity details map.
   */
  const activityMeta = useMemo(() => {
    const map = new Map();

    for (const activity of fileActivities) {
      if (activity.id !== undefined) map.set(String(activity.id), activity);
      if (activity.currentId !== undefined) map.set(String(activity.currentId), activity);
      if (activity.current_id !== undefined) map.set(String(activity.current_id), activity);
    }

    return map;
  }, [fileActivities]);


  /*
   * Get activity label.
   */
  function getLabel(id) {
    if (!id) return "NULL";

    const availableActivity = available.find((item) => {
      const currentId = item.currentId ?? item.current_id;
      return String(currentId) === String(id);
    });

    const activity = activityMeta.get(String(id));

    const description =
      activity?.description ||
      activity?.logDescription ||
      activity?.log_description ||
      availableActivity?.description ||
      availableActivity?.logDescription ||
      availableActivity?.log_description ||
      "";

    if (description) return `#${id} — ${description}`;

    return `Activity #${id}`;
  }


  /*
   * Get selected activity IDs.
   */
  const selectedIds = useMemo(() => {
    const ids = new Set();

    rows.forEach((row) => {
      if (row.effectActivityId && !row.isClosed) {
        ids.add(String(row.effectActivityId));
      }
    });

    return ids;
  }, [rows]);


  /*
   * Activities available for a row.
   * Already selected activities cannot be selected again.
   */
  function getOptionsForRow(index) {
    const currentValue = rows[index]?.effectActivityId || "";

    return available.filter((item) => {
      const id = item.currentId ?? item.current_id;

      if (id === undefined || id === null) return false;

      /* Allow current selected value. */
      if (String(id) === String(currentValue)) return true;

      /* Prevent duplicate activity. */
      return !selectedIds.has(String(id));
    });
  }


  /*
   * Select NEXT activity.
   */
  function selectEffect(index, value) {
    setError("");

    /* User selected NULL (End). */
    if (value === "__NULL_END__") {
      setRows((previous) => {
        const next = previous.slice(0, index + 1).map((row) => ({ ...row }));
        next[index] = { ...next[index], effectActivityId: "", isClosed: true };
        return next;
      });
      return;
    }

    /* Normal activity selected. */
    setRows((previous) => {
      const next = previous.slice(0, index + 1).map((row) => ({ ...row }));
      next[index] = { ...next[index], effectActivityId: value, isClosed: false };
      return next;
    });
  }


  /*
   * Update description/date.
   */
  function updateRow(index, field, value) {
    setRows((previous) =>
      previous.map((row, rowIndex) => (rowIndex !== index ? row : { ...row, [field]: value }))
    );
  }


  /*
   * Add next activity row.
   *
   * Example:
   *   NULL → ss1
   * becomes:
   *   NULL → ss1
   *   ss1  → Select activity
   */
  function addNextActivity() {
    setError("");

    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;

    if (lastRow.isClosed) {
      setError("This chain is already closed.");
      return;
    }

    if (!lastRow.effectActivityId) {
      setError("Select an activity before adding the next activity.");
      return;
    }

    setRows((previous) => [
      ...previous,
      {
        causeActivityId: lastRow.effectActivityId,
        effectActivityId: "",
        description: "",
        date: "",
        isClosed: false,
      },
    ]);
  }


  /*
   * Remove last row.
   */
  function removeLastActivity() {
    setError("");

    if (rows.length === 1) {
      setRows([emptyRow()]);
      return;
    }

    setRows((previous) => previous.slice(0, -1));
  }


  /*
   * Chain is closed if final row has NULL End.
   */
  const chainClosed = rows.length > 0 && rows[rows.length - 1].isClosed;


  /*
   * Build preview.
   */
  const chainPreview = useMemo(() => {
    const nodes = ["NULL (Start)"];

    rows.forEach((row) => {
      if (row.isClosed) {
        nodes.push("NULL (End)");
      } else if (row.effectActivityId) {
        nodes.push(getLabel(row.effectActivityId));
      }
    });

    return nodes;
  }, [rows, available, fileActivities]);


  /*
   * Validate before save.
   */
  function validate() {
    if (!fileId) return "No file is currently open.";
    if (rows.length === 0) return "Add at least one activity.";

    /* First row must select activity. */
    if (!rows[0].effectActivityId) return "Select the first activity.";

    /* Validate normal rows. */
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      /* Closed row. */
      if (row.isClosed) {
        if (i === 0) return "The chain needs activities before NULL (End).";
        continue;
      }

      if (!row.effectActivityId) return `Row ${i + 1}: select the next activity.`;

      /* First row starts with NULL. */
      if (i === 0) {
        if (row.causeActivityId) return "First row must start with NULL.";
      }

      /* Every following row starts from previous effect. */
      if (i > 0) {
        const previous = rows[i - 1];

        if (previous.isClosed) return "No activity can be added after NULL (End).";

        if (String(row.causeActivityId) !== String(previous.effectActivityId)) {
          return `Row ${i + 1}: previous activity connection is invalid.`;
        }
      }
    }

    /* Date and Description are required on every row. */
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.date) return `Row ${i + 1}: date is required.`;
      if (!row.description || !row.description.trim()) return `Row ${i + 1}: description is required.`;
    }

    /* Minimum 2 activities. */
    const activities = rows.filter((row) => !row.isClosed && row.effectActivityId);
    if (activities.length < 2) return "Select at least two activities to create a chain.";

    return null;
  }


  /*
   * Save chain.
   */
  async function handleSave() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = rows.map((row) => ({
        causeActivityId: row.causeActivityId ? String(row.causeActivityId) : null,
        effectActivityId: row.isClosed ? null : row.effectActivityId ? String(row.effectActivityId) : null,
        description: row.description || null,
        date: row.date || null,
      }));

      const result = await saveChain(fileId, payload);

      toast.success(result.message || "Activity chain saved successfully");

      await onSaved?.(result);

      onClose();
    } catch (err) {
      setError(err.message || "Failed to save activity chain");
    } finally {
      setSaving(false);
    }
  }


  if (!isOpen) {
    return null;
  }


  return (
    <div style={{ ...editCardStyle, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
        Create Activity Chain
      </h3>

      <p style={{ fontSize: "0.78rem", color: "var(--a-text-faint, #64748b)", margin: "0 0 18px" }}>
        Build the chain in one direction. Each selected activity automatically becomes the previous step.
        No new activity is created.
      </p>

      {loading ? (
        <p className="loading">Loading available activities…</p>
      ) : (
        <>
          {available.length === 0 && !error && (
            <p
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--a-input-bg, #fff)",
                border: "1px solid var(--a-border, #cbd5e1)",
                fontSize: "0.85rem",
              }}
            >
              No single activities are available for linking.
            </p>
          )}

          {available.length > 0 && (
            <>
              {rows.map((row, index) => {
                const firstRow = index === 0;

                return (
                  <div
                    key={index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "14px 20px",
                      marginBottom: 14,
                      padding: "16px 18px",
                      borderRadius: 8,
                      border: row.isClosed ? "1px solid #ef4444" : "1px solid var(--a-border, #cbd5e1)",
                      background: row.isClosed ? "rgba(239,68,68,0.04)" : "var(--a-input-bg, #fff)",
                    }}
                  >
                    {/* FROM */}
                    <div>
                      <label style={labelStyle}>From</label>
                      <div
                        style={{
                          ...inputStyle,
                          padding: "8px 12px",
                          border: "1px solid var(--a-border, #cbd5e1)",
                          borderRadius: 6,
                          background: "var(--a-bg-subtle, #f8fafc)",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          minHeight: 20,
                          boxSizing: "border-box",
                        }}
                      >
                        {firstRow ? "NULL (Start)" : getLabel(row.causeActivityId)}
                      </div>
                    </div>

                    {/* NEXT ACTIVITY */}
                    <div>
                      <label style={labelStyle}>Next Activity</label>
                      <select
                        className="activity-input"
                        style={inputStyle}
                        value={row.isClosed ? "__NULL_END__" : row.effectActivityId}
                        onChange={(event) => selectEffect(index, event.target.value)}
                      >
                        <option value="">Select existing activity</option>

                        {/* NULL END appears from second row onwards. */}
                        {index > 0 && (
                          <option value="__NULL_END__">NULL (End) — Close Chain</option>
                        )}

                        {getOptionsForRow(index).map((item) => {
                          const id = item.currentId ?? item.current_id;
                          return (
                            <option key={item.id ?? id} value={id}>
                              {getLabel(id)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* DATE */}
                    <div>
                      <label style={labelStyle}>Date <span style={{ color: "#ef4444" }}>*</span></label>
                      <div style={{ ...errBorder(!row.date), borderRadius: 6 }}>
                        <DatePicker
                          value={row.date}
                          onChange={(date) => updateRow(index, "date", date)}
                        />
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div>
                      <label style={labelStyle}>Description <span style={{ color: "#ef4444" }}>*</span></label>
                      <input
                        type="text"
                        className="activity-input"
                        style={{ ...inputStyle, ...errBorder(!row.description?.trim()) }}
                        placeholder="Link description"
                        value={row.description}
                        onChange={(event) => updateRow(index, "description", event.target.value)}
                      />
                    </div>
                  </div>
                );
              })}

              {/* BUTTONS */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4, marginBottom: 18 }}>
                <Btn
                  variant="ghost"
                  icon="＋"
                  onClick={addNextActivity}
                  disabled={chainClosed || !rows[rows.length - 1]?.effectActivityId}
                >
                  Add Next Activity
                </Btn>

                <Btn
                  variant="ghost"
                  icon="↩"
                  onClick={removeLastActivity}
                  disabled={rows.length === 1 && !rows[0]?.effectActivityId}
                >
                  Remove Last Activity
                </Btn>
              </div>

              {/* PREVIEW */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: 8,
                  background: "var(--a-input-bg, #fff)",
                  border: chainClosed ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(34,197,94,0.35)",
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-text-faint)" }}>
                  Chain Preview
                </div>

                <div style={{ marginTop: 10, fontSize: "0.875rem", color: "var(--a-text)" }}>
                  {chainPreview.map((item, index) => (
                    <span key={index}>
                      {index > 0 && " → "}
                      {item}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: chainClosed ? "#dc2626" : "#16a34a",
                  }}
                >
                  {chainClosed
                    ? "🔴 CLOSED — Final activity connects to NULL (End)"
                    : "🟢 OPEN — Chain has no final NULL endpoint yet"}
                </div>
              </div>

              <p style={{ fontSize: "0.72rem", color: "var(--a-text-faint, #64748b)", marginTop: 10, marginBottom: 0 }}>
                🟡 Single activities can be selected. Creating an incomplete chain makes the activities 🟢 Open.
                Selecting NULL (End) makes the complete chain 🔴 Closed.
              </p>
            </>
          )}

          <FieldError msg={error} />
        </>
      )}

      {/* FOOTER */}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <Btn
          variant="primary"
          icon="💾"
          onClick={handleSave}
          disabled={saving || loading || available.length < 2}
        >
          {saving ? "Saving…" : chainClosed ? "Create Closed Chain" : "Create Open Chain"}
        </Btn>

        <Btn variant="ghost" icon="✕" onClick={onClose} disabled={saving}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}