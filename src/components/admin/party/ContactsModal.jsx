// src/components/admin/party/ContactsModal.jsx
//
// Modal for viewing / adding / editing / deleting party contacts for a customer.
// Owns the ["contacts", customer.id] query key.
//
// Props:
//   customer  — the parent customer object  { id, companyName, … }
//   onClose   — () => void
//   role      — user role string

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getContacts, createContact, updateContact, deleteContact } from "../../../api/party";
import { thStyle, tdBase, editCardStyle, canDelete as canDeleteRole } from "../shared/adminStyles";
import { ConfirmDelete } from "../shared/AdminTable";
import { useToast } from "../shared/ToastContext";
import Btn       from "../shared/Btn";
import StatusDot from "../shared/StatusDot";
import { Field } from "./partyShared";
import { validateFields } from "./partyValidation";
import { EMPTY_CONTACT, PARTY_REQUIRED, STATUS_OPTIONS } from "./partyConstants";

export default function ContactsModal({ customer, onClose, role }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm]     = useState(false);
  const [editingC, setEditingC]     = useState(null);
  const [cf, setCf]                 = useState(EMPTY_CONTACT);
  const [saving, setSaving]         = useState(false);
  const [confirmKey, setConfirmKey] = useState(null);
  const [cfErrors, setCfErrors]     = useState({});

  // ── Query ──────────────────────────────────────────────────
  const {
    data: contacts = [],
    isLoading: loading,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ["contacts", customer.id],
    queryFn:  () => getContacts(customer.id),
    enabled:  !!customer.id,
  });

  // ── Helpers ────────────────────────────────────────────────
  const openAdd  = () => { setEditingC(null); setCf(EMPTY_CONTACT); setShowForm(true); setCfErrors({}); };
  const openEdit = (c) => { setEditingC(c); setCf({ ...c }); setShowForm(true); setCfErrors({}); };

  const saveContact = async () => {
    const { errors, isValid } = validateFields(cf, PARTY_REQUIRED);
    setCfErrors(errors);
    if (!isValid) {
      const msgs = Object.values(errors);
      toast.error(msgs.length === 1 ? msgs[0] : `${msgs.length} validation errors — fix highlighted fields.`);
      return;
    }
    setSaving(true);
    try {
      if (editingC) {
        const u = await updateContact(editingC.id, customer.id, cf);
        queryClient.setQueryData(["contacts", customer.id], (prev = []) =>
          prev.map(x => x.id === u.id ? u : x),
        );
      } else {
        const c = await createContact(customer.id, cf);
        queryClient.setQueryData(["contacts", customer.id], (prev = []) => [...prev, c]);
      }
      setShowForm(false); setEditingC(null); setCf(EMPTY_CONTACT); setCfErrors({});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (c) => {
    try {
      await deleteContact(c.id);
      queryClient.setQueryData(["contacts", customer.id], (prev = []) =>
        prev.filter(x => x.id !== c.id),
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  const canEdit = role === "SUPER" || role === "ADMIN";
  const canAdd  = role === "SUPER" || role === "ADMIN" || role === "COMMON";
  const canDelete = canDeleteRole(role);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--a-surface-solid)", borderRadius: 12,
          border: "1px solid var(--a-teal-30)",
          width: "100%", maxWidth: 680, maxHeight: "85vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px", flexShrink: 0,
          borderBottom: "1px solid var(--a-teal-20)", background: "var(--a-teal-05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.5rem" }}>🤝</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--a-teal)" }}>
                Party Contacts
              </h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--a-text-muted)" }}>
                {customer.companyName}
              </p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={refetchContacts} small>Refresh</Btn>
              {canAdd && <Btn variant="primary" onClick={openAdd} small>+ Add Party</Btn>}
              <Btn variant="ghost" onClick={onClose} small>✕</Btn>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Add / Edit form */}
          {showForm && (
            <div style={editCardStyle}>
              <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", color: "var(--a-teal)" }}>
                {editingC ? "EDIT PARTY CONTACT" : "ADD PARTY CONTACT"}
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "0.73rem", color: "var(--a-text-muted)" }}>
                All fields marked <span style={{ color: "var(--a-danger)" }}>*</span> are required.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                {/* DB col: PARTY_NAME */}
                <Field label="Party Name" required error={cfErrors.name}>
                  <input
                    className="activity-input"
                    placeholder="Full name"
                    value={cf.name}
                    onChange={e => { setCf(p => ({ ...p, name: e.target.value })); setCfErrors(p => ({ ...p, name: undefined })); }}
                  />
                </Field>
                {/* DB col: PARTY_PHONENO */}
                <Field label="Phone Number" required error={cfErrors.phone}>
                  <input
                    className="activity-input"
                    placeholder="10-digit phone"
                    value={cf.phone}
                    onChange={e => { setCf(p => ({ ...p, phone: e.target.value })); setCfErrors(p => ({ ...p, phone: undefined })); }}
                  />
                </Field>
                {/* DB col: PARTY_EMAIL */}
                <Field label="Email" required error={cfErrors.email}>
                  <input
                    type="email"
                    className="activity-input"
                    placeholder="email@example.com"
                    value={cf.email}
                    onChange={e => { setCf(p => ({ ...p, email: e.target.value })); setCfErrors(p => ({ ...p, email: undefined })); }}
                  />
                </Field>
                {/* DB col: STATUS — String "Active"/"Inactive" */}
                <Field label="Status" required>
                  <select
                    className="activity-input"
                    value={cf.status}
                    onChange={e => setCf(p => ({ ...p, status: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn variant="primary" onClick={saveContact} disabled={saving}>
                  {saving ? "Saving…" : editingC ? "Update Contact" : "Add Contact"}
                </Btn>
                <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
              </div>
            </div>
          )}

          {/* Contacts table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {/* ID column: raw auto-generated DB numeric ID */}
                {["ID", "PARTY NAME", "PHONE", "EMAIL", "STATUS", canEdit ? "ACTIONS" : ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="activity-empty">Loading…</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={6} className="activity-empty">
                  No contacts yet. {canEdit && 'Click "+ Add Party" to add one.'}
                </td></tr>
              ) : contacts.map((c, idx) => (
                <tr
                  key={c.id}
                  style={{ background: idx % 2 === 1 ? "var(--a-teal-04, rgba(20,184,166,0.04))" : "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--a-teal-10)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 1 ? "var(--a-teal-04, rgba(20,184,166,0.04))" : "transparent"; }}
                >
                  {/* Raw DB auto-generated ID — no formatting */}
                  <td style={{ ...tdBase, color: "var(--a-teal)", fontWeight: 700 }}>{c.id}</td>
                  <td style={{ ...tdBase, fontWeight: 600 }}>{c.name}</td>
                  <td style={tdBase}>{c.phone}</td>
                  <td style={tdBase}>{c.email || "—"}</td>
                  <td style={tdBase}><StatusDot status={c.status} /></td>
                  <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Btn variant="default" small onClick={() => openEdit(c)}>Edit</Btn>
                        {canDelete && (
                          confirmKey === `contact-${c.id}` ? (
                            <ConfirmDelete
                              onConfirm={() => { setConfirmKey(null); deleteRow(c); }}
                              onCancel={() => setConfirmKey(null)}
                            />
                          ) : (
                            <Btn variant="danger" small onClick={() => setConfirmKey(`contact-${c.id}`)}>Delete</Btn>
                          )
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer count */}
          <div style={{ padding: "8px 16px", color: "var(--a-text-faint)", fontSize: "0.75rem", borderTop: "1px solid var(--a-teal-08)" }}>
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} at {customer.companyName}
          </div>
        </div>
      </div>
    </div>
  );
}
