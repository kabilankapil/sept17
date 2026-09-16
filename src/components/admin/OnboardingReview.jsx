// ── OnboardingReview.jsx ───────────────────────────────────────────────────────
// Review queue for the Employee Onboarding Link Module.
// Drop this in as its own admin tab (e.g. alongside Employee.jsx) — it is not
// wired into Admin.jsx's menu here; add a menu entry that renders
// <OnboardingReview role={role} /> wherever you'd like it to live.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOnboardingLinks, approveOnboarding, rejectOnboarding,
  revokeOnboardingLink, buildOnboardingLink,
} from "../../api/employeeOnboarding";
import { thStyle, tdBase, tdNowrap } from "./shared/adminStyles";
import { TableScroller, ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";

const STATUS_LABEL = {
  pending:  "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function statusBadge(row) {
  let bg = "#f3f4f6", color = "#374151", text = STATUS_LABEL[row.status] || row.status;
  if (row.status === "pending") {
    if (row.expired && !row.submittedAt) { bg = "#fee2e2"; color = "#991b1b"; text = "Expired"; }
    else if (row.submittedAt)            { bg = "#fef3c7"; color = "#92400e"; text = "Awaiting Review"; }
    else                                  { bg = "#dbeafe"; color = "#1e40af"; text = "Link Sent"; }
  } else if (row.status === "approved") { bg = "#d1fae5"; color = "#065f46"; }
  else if (row.status === "rejected")   { bg = "#fee2e2"; color = "#991b1b"; }

  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}33`,
      padding: "3px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 600,
      display: "inline-block",
    }}>{text}</span>
  );
}

// ── Detail modal — view submitted data + approve/reject ─────────────────────
function DetailModal({ row, onClose, onApprove, onReject, busy }) {
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const d = row.submittedData || {};

  const fields = [
    ["First Name", d.empName], ["Last Name", d.empLastName],
    ["Date of Birth", d.empDob], ["Date of Joining", d.empDoj],
    ["Phone", d.empPh], ["Email", d.empMail],
    ["PAN", d.empPan], ["Aadhaar", d.empAdhar],
    ["Address 1", d.empAddress1], ["Address 2", d.empAddress2], ["Address 3", d.empAddress3],
    ["Bank Name", d.empBankName], ["Account Holder", d.empAccName],
    ["Account No", d.empAccNo], ["IFSC", d.empIfscCode],
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--a-surface-solid, #0d1b1b)", border: "1px solid var(--a-teal-25)",
        borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--a-border)" }}>
          <strong style={{ fontSize: "1rem" }}>Onboarding Submission #{row.id}</strong>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--a-text-muted)" }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {!row.submittedData ? (
            <p style={{ color: "var(--a-text-muted)" }}>The employee hasn't submitted their details yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
              {fields.map(([lbl, val]) => (
                <div key={lbl}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--a-text-faint)", textTransform: "uppercase" }}>{lbl}</div>
                  <div style={{ fontSize: "0.88rem", color: "var(--a-text)" }}>{val || "—"}</div>
                </div>
              ))}
            </div>
          )}

          {showReject && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--a-text-faint)" }}>Rejection reason *</label>
              <textarea
                className="activity-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Let them know why this wasn't approved…"
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
              />
            </div>
          )}
        </div>

        {row.status === "pending" && row.submittedData && (
          <div style={{ display: "flex", gap: 8, padding: "14px 20px 20px", borderTop: "1px solid var(--a-border)" }}>
            {!showReject ? (
              <>
                <Btn variant="primary" onClick={onApprove} disabled={busy} icon="✓">
                  {busy ? "Approving…" : "Approve"}
                </Btn>
                <Btn variant="danger" onClick={() => setShowReject(true)} icon="✕">Reject</Btn>
                <Btn variant="ghost" onClick={onClose}>Close</Btn>
              </>
            ) : (
              <>
                <Btn variant="danger" onClick={() => onReject(reason)} disabled={busy || !reason.trim()} icon="✓">
                  {busy ? "Rejecting…" : "Confirm Reject"}
                </Btn>
                <Btn variant="ghost" onClick={() => setShowReject(false)}>Back</Btn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingReview({ role = "COMMON" }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isSuper = role === "SUPER";

  const { data: requests = [], isLoading: loading, isError } = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn:  () => getOnboardingLinks(),
  });

  const [viewing, setViewing]     = useState(null);
  const [busy, setBusy]           = useState(false);
  const [confirmKey, setConfirmKey] = useState(null);

  const refresh = () => queryClient.invalidateQueries(["onboarding-requests"]);

  const handleApprove = async () => {
    if (!viewing) return;
    setBusy(true);
    try {
      await approveOnboarding(viewing.id);
      toast.success("Approved — employee record created.");
      setViewing(null);
      refresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleReject = async (reason) => {
    if (!viewing) return;
    setBusy(true);
    try {
      await rejectOnboarding(viewing.id, reason);
      toast.success("Submission rejected.");
      setViewing(null);
      refresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeOnboardingLink(id);
      toast.success("Link revoked.");
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleCopy = async (token) => {
    try {
      await navigator.clipboard.writeText(buildOnboardingLink(token));
      toast.success("Link copied.");
    } catch { toast.error("Couldn't copy the link."); }
  };

  return (
    <div className="content-section">
      <div className="activity-header" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Onboarding Requests</h1>
      </div>

      {loading ? <p className="loading">Loading…</p> : (
        <TableScroller>
          <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 44 }}>ID</th>
                <th style={thStyle}>STATUS</th>
                <th style={thStyle}>SUBMITTED</th>
                <th style={thStyle}>EXPIRES</th>
                <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={5} className="activity-empty">
                  {isError ? "Failed to load onboarding requests. Please try again." : 'No onboarding requests yet. Use "+ Create Link" on the Employees page.'}
                </td></tr>
              ) : requests.map((r) => (
                <tr key={r.id}>
                  <td style={tdNowrap}>{r.id}</td>
                  <td style={tdBase}>{statusBadge(r)}</td>
                  <td style={tdBase}>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                  <td style={tdBase}>{new Date(r.expiresAt).toLocaleString()}</td>
                  <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}>
                    {r.submittedData && (
                      <Btn variant="default" small onClick={() => setViewing(r)}>View</Btn>
                    )}
                    {isSuper && r.status === "pending" && r.token && (
                      <Btn variant="default" small onClick={() => handleCopy(r.token)} title="Copy link">Copy</Btn>
                    )}
                    {isSuper && r.status === "pending" && (
                      confirmKey === `revoke-${r.id}` ? (
                        <ConfirmDelete
                          label="Revoke this onboarding link?"
                          onConfirm={() => { setConfirmKey(null); handleRevoke(r.id); }}
                          onCancel={() => setConfirmKey(null)}
                        />
                      ) : (
                        <Btn variant="danger" small onClick={() => setConfirmKey(`revoke-${r.id}`)}>Revoke</Btn>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      )}

      {viewing && (
        <DetailModal
          row={viewing}
          onClose={() => setViewing(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          busy={busy}
        />
      )}
    </div>
  );
}