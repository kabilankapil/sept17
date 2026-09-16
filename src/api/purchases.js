// src/api/purchases.js

import { authHeaders, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

/**
 * Safely parse the response body exactly once.
 * Returns {} if the body is empty or not valid JSON — never throws.
 */
async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

/**
 * Read + parse the body, then throw if the response was not OK.
 * Consuming the body first means it is always read exactly once
 * regardless of status code.
 */
async function handleResponse(res, fallbackMsg) {
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || fallbackMsg);
  return data;
}

// ── Purchase field mapping ────────────────────────────────────────────────────
// Normalises all ID fields to strings so PDF template lookups
// (customers.find) never fail due to number vs string mismatch.
function fromPurchaseDTO(dto) {
  if (!dto) return dto;
  return {
    id:                    dto.id,
    purchaseDate:          dto.purchaseDate          || "",
    purchaseValidity:      dto.purchaseValidity      || "",
    purchaseFromParty:     String(dto.purchaseFromParty || ""),
    purchaseToParty:       String(dto.purchaseToParty   || ""),
    purchaseEnquireDate:   dto.purchaseEnquireDate   || "",
    purchaseDeliveryTerms: dto.purchaseDeliveryTerms || "",
    purchasePaymentTerms:  dto.purchasePaymentTerms  || "",
    purchaseCurrency:      dto.purchaseCurrency      || "INR",
    purchaseDoctype:       String(dto.purchaseDoctype ?? "3"),
    purchaseTxType:        dto.purchaseTxType        || "",
    purchaseDescription:   dto.purchaseDescription   || "",
    purchaseAddressedTo:   String(dto.purchaseAddressedTo || ""),
    purchaseFileRef:       String(dto.purchaseFileRef    || ""),
    purchaseStatus:        String(dto.purchaseStatus  ?? "0"),
  };
}

export async function getAllPurchases() {
  const res = await fetch(`${BASE_URL}/api/purchases`, { headers: authHeaders() });
  const data = await handleResponse(res, `Failed to fetch purchases (${res.status})`);
  return Array.isArray(data) ? data.map(fromPurchaseDTO) : [];
}

export async function getPurchaseById(id) {
  const res = await fetch(`${BASE_URL}/api/purchases/${id}`, { headers: authHeaders() });
  return fromPurchaseDTO(await handleResponse(res, `Failed to fetch purchase #${id}`));
}

export async function createPurchase(data) {
  const res = await fetch(`${BASE_URL}/api/purchases`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return fromPurchaseDTO(await handleResponse(res, `Failed to create purchase (${res.status})`));
}

export async function updatePurchase(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/purchases/${id}`, "PUT", {
    body: JSON.stringify(data),
  });
  return fromPurchaseDTO(await handleResponse(res, `Failed to update purchase #${id}`));
}

export async function deletePurchase(id) {
  const res = await mutationFetch(`${BASE_URL}/api/purchases/${id}`, "DELETE");
  return handleResponse(res, `Failed to delete purchase #${id}`);
}
