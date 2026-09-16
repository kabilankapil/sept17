// ── src/api/users.js ──────────────────────────────────────────────────────────
import { BASE_URL } from "./_base";
import { authHeaders, mutationFetch } from "./_auth";
import { roleToProfile, profileToRole } from "./auth";  // ← add profileToRole

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

export async function getUsers() {
  const res = await fetch(`${BASE_URL}/api/auth/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to fetch users.");
  const data = await res.json();
  return data.map(u => ({ ...u, role: profileToRole(u.profile) }));
}

export async function registerUser(data) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      gmail: data.gmail,
      username: data.username,
      contact: data.contact,
      password: data.password,
      profile: roleToProfile(data.role),  // "COMMON" → "USER" etc.
    }),
  });
 if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to add user.");
  return res.json();
}

export async function updateUser(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/auth/users/${id}`, "PUT", {
    body: JSON.stringify({
      username: data.username,
      contact: data.contact,
      password: data.password,
      profile: roleToProfile(data.role),
    }),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to update user.");
  return res.json();
}

export async function updateUserStatus(id, status) {
  const res = await mutationFetch(`${BASE_URL}/api/auth/users/${id}/status`, "PUT", {
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to update status.");
  return res.json();
}

export async function deleteUser(id) {
  const res = await mutationFetch(`${BASE_URL}/api/auth/users/${id}`, "DELETE");
  if (!res.ok) throw new Error((await safeJson(res)).message || "Failed to delete user.");
}