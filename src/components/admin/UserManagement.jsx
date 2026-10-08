import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUsers, registerUser, updateUser, deleteUser, updateUserStatus,
} from  "../../api/users";
import { getCurrentUser, setCurrentUser } from "../../utils/userStore";
import { ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";

// ── constants ─────────────────────────────────────────────────────────────────

const ROLES = ["SUPER", "ADMIN", "COMMON"];

const roleBadgeStyle = (role) => {
  const map = {
    SUPER:  { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
    ADMIN:  { background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd" },
    COMMON: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
  };
  return {
    ...(map[role] ?? map.COMMON),
    padding: "2px 10px", borderRadius: 12,
    fontSize: "0.78rem", fontWeight: 700, display: "inline-block",
  };
};

const statusBadge = (status) => ({
  background: status === 1 ? "#d1fae5" : "#fee2e2",
  color:      status === 1 ? "#065f46" : "#991b1b",
  border:     `1px solid ${status === 1 ? "#6ee7b7" : "#fca5a5"}`,
  padding: "3px 10px", borderRadius: 12,
  fontSize: "0.75rem", fontWeight: 600, display: "inline-block",
  cursor: "pointer",
});

const emptyAdd = { gmail: "", username: "", contact: "", password: "", role: "COMMON" };

// ── EyeIcon ───────────────────────────────────────────────────────────────────
function EyeIcon({ show }) {
  return show ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

// ── PasswordInput — input with show/hide toggle ───────────────────────────────
function PasswordInput({ value, onChange, placeholder = "Password *", style = {} }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", ...style }}>
      <input
        className="activity-input"
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingRight: 36, width: "100%", boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{
          position: "absolute", right: 8,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--a-text-faint)", padding: 0,
          display: "flex", alignItems: "center",
          transition: "color 0.15s",
        }}
        title={show ? "Hide password" : "Show password"}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <EyeIcon show={show} />
      </button>
    </div>
  );
}

// ── EditModal — full-screen modal for editing a user ─────────────────────────
function EditModal({ user, editForm, setEditForm, onSave, onCancel, isSelf }) {
  return (
    <div className="um-edit-modal-backdrop" onClick={onCancel}>
      <div className="um-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-edit-modal-header">
          <div className="um-card-avatar" style={{ width: 44, height: 44, fontSize: "1.1rem" }}>
            {user.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "var(--a-text)", fontSize: "1rem" }}>
              {user.username}
              {isSelf && <span style={{ color: "var(--a-text-faint)", fontSize: "0.72rem", fontWeight: 400, marginLeft: 6 }}>(you)</span>}
            </div>
            <div style={{ color: "var(--a-text-muted)", fontSize: "0.78rem" }}>{user.gmail}</div>
          </div>
          <button onClick={onCancel} className="um-edit-modal-close" aria-label="Close">✕</button>
        </div>

        <div className="um-edit-modal-body">
          <div className="um-edit-field">
            <label className="um-card-label">Username</label>
            <input className="activity-input" placeholder="Username"
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
          </div>
          <div className="um-edit-field">
            <label className="um-card-label">Contact</label>
            <input className="activity-input" placeholder="Contact"
              value={editForm.contact}
              onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} />
          </div>
          <div className="um-edit-field">
            <label className="um-card-label">Role</label>
            <select className="activity-input" value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="um-edit-field">
            <label className="um-card-label">New Password</label>
            <PasswordInput
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="Leave blank to keep"
            />
          </div>
        </div>

        <div className="um-edit-modal-footer">
          <Btn variant="primary" onClick={onSave} icon="✓">Save Changes</Btn>
          <Btn variant="ghost" onClick={onCancel} icon="✕">Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const currentUser = getCurrentUser();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: loading, isError: usersError  } = useQuery({
    queryKey: ["users"],
    queryFn:  getUsers,
  });

  const [confirmKey, setConfirmKey] = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [addForm,    setAddForm]    = useState(emptyAdd);
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({});

  // ── add user ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const { gmail, username, password, contact, role } = addForm;
    if (!gmail || !username || !password) { toast.error("Gmail, username and password are required."); return; }
    if (!gmail.includes("@"))             { toast.error("Enter a valid email."); return; }
    try {
      await registerUser({ gmail, username, contact, password, role });
      toast.success(`User "${username}" added as ${role}.`);
      setShowAdd(false);
      setAddForm(emptyAdd);
      queryClient.invalidateQueries(["users"]);
    } catch (e) { toast.error(e.message); }
  };

  // ── edit ────────────────────────────────────────────────────────────────────
  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({ username: u.username, contact: u.contact ?? "", password: "", role: u.role });
  };

  const handleEditSave = async (u) => {
    try {
      await updateUser(u.id, editForm);
      if (u.id === currentUser?.id) {
        setCurrentUser({ ...currentUser, username: editForm.username || currentUser.username,
          contact: editForm.contact ?? currentUser.contact, role: editForm.role || currentUser.role });
        toast.success("Profile updated.");
      } else {
        toast.success("User updated.");
      }
      setEditingId(null);
      queryClient.invalidateQueries(["users"]);
    } catch (e) { toast.error(e.message); }
  };

  // ── toggle status ───────────────────────────────────────────────────────────
  const handleToggleStatus = async (u) => {
    const newStatus = u.status === 1 ? 0 : 1;
    try {
      await updateUserStatus(u.id, newStatus);
      toast.success(`"${u.username}" is now ${newStatus === 1 ? "enabled" : "disabled"}.`);
      queryClient.invalidateQueries(["users"]);
    } catch (e) { toast.error(e.message); }
  };

  // ── delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (u) => {
    try {
      await deleteUser(u.id);
      toast.success(`"${u.username}" deleted.`);
      queryClient.invalidateQueries(["users"]);
    } catch (e) { toast.error(e.message); }
  };

  // ── the user currently being edited (for modal) ──────────────────────────
  const editingUser = editingId ? users.find((u) => u.id === editingId) : null;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="content-section">

      {/* Header */}
      <div className="activity-header" style={{ marginBottom: 16 }}>
        <h1>User Management</h1>
        <Btn variant="teal" icon="＋"
          onClick={() => { setShowAdd(true); setAddForm(emptyAdd); }}>
          + Add User
        </Btn>
      </div>

      {/* ── Add-user form ── */}
      {showAdd && (
        <div className="um-add-form">
          <p className="um-add-title">New User</p>
          <div className="um-add-grid">
            <input className="activity-input" placeholder="Email *"
              value={addForm.gmail}
              onChange={(e) => setAddForm({ ...addForm, gmail: e.target.value })} />
            <input className="activity-input" placeholder="Username *"
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} />
            <input className="activity-input" placeholder="Contact"
              value={addForm.contact}
              onChange={(e) => setAddForm({ ...addForm, contact: e.target.value })} />
            <PasswordInput
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
            />
            <select className="activity-input" value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn variant="primary" onClick={handleAdd} icon="✓">Save</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)} icon="✕">Cancel</Btn>
          </div>
        </div>
      )}

    
      {/* ── Confirm modals ── */}
      {confirmKey && (() => {
        const isStatus = confirmKey.startsWith("status-");
        const u = users.find(u =>
          `user-${u.id}` === confirmKey || `status-${u.id}` === confirmKey
        );
        const willDisable = isStatus && u?.status === 1;
        return (
          <ConfirmDelete
            label={
              isStatus
                ? (willDisable ? "Disable this user?" : "Enable this user?")
                : "This user will be permanently removed."
            }
            icon={isStatus ? (willDisable ? "🚫" : "✅") : "🗑️"}
            confirmText={isStatus ? (willDisable ? "Disable" : "Enable") : "Delete"}
            confirmClass={isStatus ? (willDisable ? "act-delete" : "act-save") : "act-delete"}
            onConfirm={() => {
              if (!u) { setConfirmKey(null); return; }
              setConfirmKey(null);
              if (isStatus) handleToggleStatus(u);
              else handleDelete(u);
            }}
            onCancel={() => setConfirmKey(null)}
          />
        );
      })()}

      {/* ── Edit modal (replaces inline edit — no more overlapping) ── */}
      {editingUser && (
        <EditModal
          user={editingUser}
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={() => handleEditSave(editingUser)}
          onCancel={() => setEditingId(null)}
          isSelf={editingUser.id === currentUser?.id}
        />
      )}

      {/* ── Loading ── */}
      {loading ? (
        <p style={{ color: "var(--a-text-muted)", padding: "20px 0" }}>Loading…</p>
      ) : (
        <>
          {/* ══ DESKTOP TABLE (hidden on mobile via CSS) ══ */}
          <div className="um-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="activity-empty">
                      {usersError ? "Failed to load users. Please try again." : "No users found."}
                    </td>
                  </tr>
                ) : users.map((u, i) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} style={isSelf ? { background: "var(--a-teal-05)" } : {}}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{u.username}</strong>{" "}
                        {isSelf && <span style={{ color: "var(--a-text-faint)", fontSize: "0.72rem" }}>(you)</span>}
                      </td>
                      <td style={{ color: "var(--a-text-muted)", fontSize: "0.85rem" }}>{u.gmail}</td>
                      <td>
                        <span style={{ color: "var(--a-text-muted)", fontSize: "0.85rem" }}>{u.contact || "—"}</span>
                      </td>
                      <td>
                        <span style={roleBadgeStyle(u.role)}>{u.role}</span>
                      </td>
                      <td>
                        <span style={statusBadge(u.status)} title="Click to toggle"
                          onClick={() => setConfirmKey(`status-${u.id}`)}>
                          {u.status === 1 ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <Btn variant="default" onClick={() => startEdit(u)} icon="✏️" title="Edit user">Edit</Btn>
                          {!isSelf ? (
                            <Btn variant="danger" onClick={() => setConfirmKey(`user-${u.id}`)} icon="🗑️" title="Delete user">Delete</Btn>
                          ) : (
                            <span style={{ color: "var(--a-text-faint)", fontSize: "0.72rem", marginLeft: 2 }}>(edit only)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ══ MOBILE CARDS (hidden on desktop via CSS) ══ */}
          <div className="um-cards">
            {users.length === 0 ? (
              <p style={{ color: "var(--a-text-muted)", textAlign: "center", padding: "24px 0" }}>
                {usersError ? "Failed to load users. Please try again." : "No users found."}
              </p>
            ) : users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <div key={u.id} className={`um-card${isSelf ? " um-card-self" : ""}`}>

                  {/* Card header row */}
                  <div className="um-card-header">
                    <div className="um-card-avatar">
                      {u.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="um-card-meta">
                      <span className="um-card-name">
                        <strong>{u.username}</strong>
                        {isSelf && <span className="um-card-you"> (you)</span>}
                      </span>
                      <span className="um-card-email">{u.gmail}</span>
                    </div>
                    {/* Status badge — tap to toggle */}
                    <span style={statusBadge(u.status)}
                      onClick={() => setConfirmKey(`status-${u.id}`)}>
                      {u.status === 1 ? "Active" : "Off"}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="um-card-body">
                    <div className="um-card-row">
                      <span className="um-card-label">Contact</span>
                      <span className="um-card-value">{u.contact || "—"}</span>
                    </div>
                    <div className="um-card-row">
                      <span className="um-card-label">Role</span>
                      <span style={roleBadgeStyle(u.role)}>{u.role}</span>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="um-card-actions">
                    <Btn variant="default" onClick={() => startEdit(u)} icon="✏️">Edit</Btn>
                    {!isSelf && (
                      <Btn variant="danger" onClick={() => setConfirmKey(`user-${u.id}`)} icon="🗑️">Delete</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="table-hint" style={{ marginTop: 12 }}>
            💡 SUPER users can edit username, contact, role and password for any account.
          </p>
        </>
      )}
    </div>
  );
}
