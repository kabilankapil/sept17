// src/api/purchaseItems.js

import { authHeaders, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

export async function getAllPurchaseItems() {
  const res = await fetch(`${BASE_URL}/api/purchase-items`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await safeJson(res)).message || `Failed to fetch purchase items (${res.status})`);
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}


export async function getPurchaseItemsByRef(refFileNo) {
  const res = await fetch(`${BASE_URL}/api/purchase-items/by-ref/${refFileNo}`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await safeJson(res)).message || `Failed to fetch items for ref #${refFileNo}`);
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}

// Recompute tax amounts from rate × taxable before sending to the backend so
// that blank/zero rates always produce zero amounts — never stale DB values.
function sanitizePurchaseItem(data) {
  const taxable  = Number(data.taxableValue) || 0;
  const cgstRate = Number(data.cgstRate)     || 0;
  const sgstRate = Number(data.sgstRate)     || 0;
  const igstRate = Number(data.igstRate)     || 0;
  const cgstAmt  = cgstRate ? (taxable * cgstRate) / 100 : 0;
  const sgstAmt  = sgstRate ? (taxable * sgstRate) / 100 : 0;
  const igstAmt  = igstRate ? (taxable * igstRate) / 100 : 0;
  return {
    ...data,
    taxableValue: taxable,
    cgstRate,  cgstAmount: cgstAmt,
    sgstRate,  sgstAmount: sgstAmt,
    igstRate,  igstAmount: igstAmt,
    total: taxable + cgstAmt + sgstAmt + igstAmt,
  };
}

export async function createPurchaseItem(data) {
  const res = await fetch(`${BASE_URL}/api/purchase-items`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(sanitizePurchaseItem(data)),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || `Failed to create purchase item (${res.status})`);
  return res.json();
}

export async function updatePurchaseItem(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/purchase-items/${id}`, "PUT", {
    body: JSON.stringify(sanitizePurchaseItem(data)),
  });
  if (!res.ok) throw new Error((await safeJson(res)).message || `Failed to update purchase item #${id}`);
  return res.json();
}

export async function deletePurchaseItem(id) {
  const res = await mutationFetch(`${BASE_URL}/api/purchase-items/${id}`, "DELETE");
  if (!res.ok) throw new Error((await safeJson(res)).message || `Failed to delete purchase item #${id}`);
  return safeJson(res);
}
