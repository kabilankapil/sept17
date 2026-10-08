// src/components/admin/activitylog/AddFromEmailModal.jsx
//
// Pick a .eml file, preview it, choose which attachment (if any) goes with the
// activity, then hand the result back to the parent via onUse(). Nothing is
// saved here — the parent pre-fills the normal "New Activity" form with it.
//
// onUse({ date: "yyyy-mm-dd", description: string, file: File | null })

import { useState, useRef } from "react";
import { parseEml } from "../../../utils/emlParser";
import { labelStyle, localDate } from "../shared/adminStyles";
import { useToast } from "../shared/ToastContext";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES } from "./activityHelpers";

// Same types the server accepts for uploads (POST /api/blobs).
const UPLOAD_EXTS = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "xls", "xlsx", "txt", "zip"];
const extOf = (name) => (name.split(".").pop() || "").toLowerCase();

// activity_index.remarks is a TEXT column (65,535 bytes) and the app adds a short
// prefix to it, so keep the description comfortably under that.
const MAX_DESC_BYTES = 60000;
const byteLen = (str) => new TextEncoder().encode(str).length;

function clampBytes(str, max) {
  if (byteLen(str) <= max) return str;
  let lo = 0, hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (byteLen(str.slice(0, mid)) <= max) lo = mid; else hi = mid - 1;
  }
  const code = str.charCodeAt(lo - 1);
  if (code >= 0xd800 && code <= 0xdbff) lo -= 1; // don't cut an emoji in half
  return str.slice(0, lo);
}

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Local calendar date (yyyy-mm-dd) of the email's sent time.
function toLocalISODate(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return localDate();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildDescription(m) {
  const when = m.date
    ? new Date(m.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const header = [
    m.from && `Email from: ${m.from}`,
    m.to && `To: ${m.to}`,
    m.cc && `Cc: ${m.cc}`,
    when && `Date: ${when}`,
    `Subject: ${m.subject}`,
  ].filter(Boolean);
  return `${header.join("\n")}\n\n${m.bodyText}`.trim();
}

// Why an attachment can't be used, or "" if it can.
function problemWith(att) {
  if (!UPLOAD_EXTS.includes(extOf(att.name))) return "file type not supported for upload";
  if (att.size > MAX_FILE_SIZE_BYTES) return `larger than ${MAX_FILE_SIZE_MB} MB`;
  return "";
}

export default function AddFromEmailModal({ onClose, onUse }) {
  const toast = useToast();
  const pickerRef = useRef(null);

  const [mail, setMail]               = useState(null);
  const [description, setDescription] = useState("");
  const [selected, setSelected]       = useState(-1); // index into mail.attachments, -1 = none
  const [reading, setReading]         = useState(false);
  const [trimmed, setTrimmed]         = useState(false);

  const handlePick = async (e) => {
    const f = e.target.files[0];
    e.target.value = ""; // allow picking the same file again
    if (!f) return;
    setReading(true);
    try {
      const m = await parseEml(f);
      setMail(m);
      let d = buildDescription(m);
      const tooLong = byteLen(d) > MAX_DESC_BYTES;
      if (tooLong) d = clampBytes(d, MAX_DESC_BYTES - 100) + "\n\n[... trimmed: email text was too long to store]";
      setTrimmed(tooLong);
      setDescription(d);
      // Default: first real (non-logo) attachment that can be uploaded.
      setSelected(m.attachments.findIndex((a) => !a.isInline && !problemWith(a)));
    } catch (err) {
      setMail(null);
      toast.error(err.message || "Could not read the email file.");
    } finally {
      setReading(false);
    }
  };

  const looksEmpty = mail && !mail.from && !mail.bodyText;
  const tooLongNow = byteLen(description) > MAX_DESC_BYTES;

  const handleUse = () => {
    onUse({
      date: toLocalISODate(mail.date),
      description,
      file: selected >= 0 ? mail.attachments[selected].file : null,
    });
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--a-surface, #0d1b1b)",
          border: "1px solid var(--a-teal-20)",
          borderRadius: 14, width: "100%", maxWidth: 640,
          maxHeight: "88vh", display: "flex", flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "18px 22px 14px", borderBottom: "1px solid var(--a-teal-10)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>
              Add Activity from Email
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--a-text-faint)" }}>
              Choose a saved email (.eml) — its text becomes the description, one attachment can be uploaded
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem",
                     color: "var(--a-text-faint)", lineHeight: 1, padding: "4px 6px" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          <input ref={pickerRef} type="file" accept=".eml" style={{ display: "none" }} onChange={handlePick} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="act-btn act-upload" onClick={() => pickerRef.current.click()} disabled={reading}>
              {reading ? "Reading…" : mail ? "📧 Choose a different email" : "📧 Choose .eml file"}
            </button>
          </div>

          {looksEmpty && (
            <p style={{ margin: "14px 0 0", fontSize: "0.82rem", color: "var(--a-danger, #ef4444)" }}>
              ⚠️ This file doesn&apos;t look like a valid email (no sender and no text).
            </p>
          )}

          {mail && !looksEmpty && (
            <>
              <div style={{
                margin: "16px 0", padding: "10px 14px", borderRadius: 8, fontSize: "0.82rem",
                background: "var(--a-teal-05)", border: "1px solid var(--a-teal-10)", lineHeight: 1.6,
              }}>
                <div><strong>Subject:</strong> {mail.subject}</div>
                <div><strong>From:</strong> {mail.from}</div>
                {mail.to && <div><strong>To:</strong> {mail.to}</div>}
                {mail.cc && <div><strong>Cc:</strong> {mail.cc}</div>}
                <div><strong>Date:</strong> {mail.date ? new Date(mail.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</div>
              </div>

              <label style={labelStyle}>Description (editable)</label>
              <textarea
                className="activity-input activity-textarea"
                style={{ width: "100%", boxSizing: "border-box", minHeight: 160, resize: "vertical" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div style={{ fontSize: "0.72rem", marginTop: 3, color: tooLongNow ? "var(--a-danger, #ef4444)" : "var(--a-text-faint)" }}>
                {description.length.toLocaleString()} characters
                {tooLongNow && " — too long to store, please shorten it"}
                {!tooLongNow && trimmed && " — the email text was too long and has been trimmed to fit"}
              </div>

              <label style={{ ...labelStyle, marginTop: 16 }}>Attachment to upload (one per activity)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input type="radio" name="emlAtt" checked={selected === -1} onChange={() => setSelected(-1)} />
                  No attachment
                </label>
                {mail.attachments.map((a, i) => {
                  const problem = problemWith(a);
                  return (
                    <label
                      key={i}
                      style={{
                        display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem",
                        cursor: problem ? "not-allowed" : "pointer", opacity: problem ? 0.55 : 1,
                      }}
                    >
                      <input
                        type="radio" name="emlAtt" disabled={!!problem}
                        checked={selected === i} onChange={() => setSelected(i)}
                      />
                      <span>
                        📄 {a.name} <span style={{ color: "var(--a-text-faint)" }}>({fmtSize(a.size)})</span>
                        {a.isInline && <span style={{ color: "var(--a-text-faint)" }}> — likely a logo/embedded image</span>}
                        {problem && <span style={{ color: "var(--a-danger, #ef4444)" }}> — ⚠️ {problem}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {mail.attachments.filter((a) => !a.isInline).length > 1 && (
                <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--a-text-faint)" }}>
                  This email has more than one attachment. Only one can go with this activity.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 22px", borderTop: "1px solid var(--a-teal-10)",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button className="act-btn act-cancel" onClick={onClose}>Cancel</button>
          <button
            className="act-btn act-save"
            onClick={handleUse}
            disabled={!mail || looksEmpty || !description.trim() || tooLongNow}
          >
            Use this email
          </button>
        </div>
      </div>
    </div>
  );
}
