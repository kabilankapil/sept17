// ── employee/CreateLinkModal.jsx ──────────────────────────────────────────────
// Lets a Super User generate a temporary onboarding link (Employee Onboarding
// Link Module). Shown from the "+ Create Link" button on the Employees page,
// placed before "+ Add Employee".
import { useState } from "react";
import { createPortal } from "react-dom";
import { createOnboardingLink, buildOnboardingLink } from "../../../api/employeeOnboarding";
import Btn from "../shared/Btn";

const PRESETS = [
  { label: "1 Hour", hours: 1 },
  { label: "1 Day",  hours: 24 },
  { label: "7 Days", hours: 168 },
];

// Matches the backend clamp in links.php (1 hour .. 30 days).
const MIN_HOURS = 1;
const MAX_HOURS = 720;

export default function CreateLinkModal({ onClose }) {
  const [hours, setHours]     = useState(24);
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("2");
  const [customUnit, setCustomUnit]   = useState("hours"); // "hours" | "days"
  const [creating, setCreating] = useState(false);
  const [error, setError]     = useState("");
  const [link, setLink]       = useState(null);   // { url, expiresAt } once created
  const [copied, setCopied]   = useState(false);

  const customHours = Math.round(Number(customValue || 0) * (customUnit === "days" ? 24 : 1));
  const customOutOfRange = isCustom && customValue !== "" &&
    (customHours < MIN_HOURS || customHours > MAX_HOURS);

  const selectPreset = (h) => { setIsCustom(false); setHours(h); };
  const selectCustom = () => { setIsCustom(true); setHours(customHours); };

  const handleCreate = async () => {
    if (customOutOfRange) return;
    setError(""); setCreating(true);
    try {
      const finalHours = isCustom ? customHours : hours;
      const result = await createOnboardingLink(finalHours);
      setLink({ url: buildOnboardingLink(result.token), expiresAt: result.expiresAt });
    } catch (e) {
      setError(e.message || "Failed to create the onboarding link.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy automatically — please copy the link manually.");
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--a-surface-solid, #0d1b1b)",
          border: "1px solid var(--a-teal-25)",
          borderRadius: 16, width: "100%", maxWidth: 440,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "18px 18px 14px", borderBottom: "1px solid var(--a-border)",
        }}>
          <span style={{ fontSize: "1.2rem" }}>🔗</span>
          <div style={{ fontWeight: 700, color: "var(--a-text)", fontSize: "1rem" }}>
            Create Employee Onboarding Link
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: "auto", background: "var(--a-danger-10)",
              border: "1px solid var(--a-danger-30)", color: "var(--a-danger)",
              width: 30, height: 30, borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {!link ? (
            <>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--a-text-muted)" }}>
                Choose how long the link should stay active. The employee will use it
                to submit their own details for your review before they're added.
              </p>

              <div>
                <label style={{
                  display: "block", fontSize: "0.75rem", fontWeight: 700,
                  color: "var(--a-text-faint)", marginBottom: 6,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  Link validity
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PRESETS.map((p) => {
                    const active = !isCustom && hours === p.hours;
                    return (
                      <button
                        key={p.hours}
                        onClick={() => selectPreset(p.hours)}
                        style={{
                          padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                          fontSize: "0.82rem", fontWeight: 600,
                          border: `1px solid ${active ? "var(--a-teal)" : "var(--a-border)"}`,
                          background: active ? "var(--a-teal-15, rgba(20,184,166,0.15))" : "transparent",
                          color: active ? "var(--a-teal)" : "var(--a-text-muted)",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={selectCustom}
                    style={{
                      padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                      fontSize: "0.82rem", fontWeight: 600,
                      border: `1px solid ${isCustom ? "var(--a-teal)" : "var(--a-border)"}`,
                      background: isCustom ? "var(--a-teal-15, rgba(20,184,166,0.15))" : "transparent",
                      color: isCustom ? "var(--a-teal)" : "var(--a-text-muted)",
                    }}
                  >
                    Custom…
                  </button>
                </div>

                {isCustom && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="number"
                        min={1}
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        placeholder="e.g. 2"
                        className="activity-input"
                        style={{ maxWidth: 100 }}
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        className="activity-input"
                        style={{ maxWidth: 130, cursor: "pointer" }}
                      >
                        <option value="hours">Hour(s)</option>
                        <option value="days">Day(s)</option>
                      </select>
                    </div>
                    <div style={{
                      marginTop: 6, fontSize: "0.75rem",
                      color: customOutOfRange ? "var(--a-danger, #ef4444)" : "var(--a-text-faint)",
                    }}>
                      {customValue === ""
                        ? "Enter how long the link should stay active."
                        : customOutOfRange
                          ? `Must be between 1 hour and 30 days (${MIN_HOURS}–${MAX_HOURS} hours).`
                          : `Link will expire in ${customHours} hour${customHours === 1 ? "" : "s"}${
                              customUnit === "days" ? ` (${customValue} day${Number(customValue) === 1 ? "" : "s"})` : ""
                            }.`}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--a-danger, #ef4444)" }}>
                  ⚠ {error}
                </span>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--a-text-muted)" }}>
                Share this link with the new employee. It expires on{" "}
                <strong style={{ color: "var(--a-text)" }}>
                  {new Date(link.expiresAt).toLocaleString()}
                </strong>.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.target.select()}
                  className="activity-input"
                  style={{ flex: 1, fontSize: "0.8rem" }}
                />
                <Btn variant={copied ? "primary" : "default"} onClick={handleCopy}>
                  {copied ? "Copied ✓" : "Copy"}
                </Btn>
              </div>
              {error && (
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--a-danger, #ef4444)" }}>
                  ⚠ {error}
                </span>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, padding: "14px 18px 18px", borderTop: "1px solid var(--a-border)" }}>
          {!link ? (
            <>
              <Btn
                variant="primary"
                onClick={handleCreate}
                disabled={creating || (isCustom && (customValue === "" || customOutOfRange))}
                icon="✓"
              >
                {creating ? "Generating…" : "Generate Link"}
              </Btn>
              <Btn variant="ghost" onClick={onClose} icon="✕">Cancel</Btn>
            </>
          ) : (
            <Btn variant="primary" onClick={onClose} icon="✓">Done</Btn>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}