/**
 * stocks.js
 * ─────────
 * Stock Items (catalog) + Stock Movements CRUD
 * Talks to Java backend on port 8080
 *
 * Endpoints:
 *   Stock Items (catalog): /api/stock-items
 *   Stock Movements:       /api/stocks
 */

import { authHeaders, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

async function handleResponse(res) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    switch (res.status) {
      case 401: throw new Error("Session expired. Please log in again.");
      case 403: throw new Error("You do not have permission to perform this action.");
      case 404: throw new Error("Record not found. It may have been deleted.");
      case 409: throw new Error("This record conflicts with an existing entry.");
      case 500: throw new Error("Server error. Please try again later.");
      default:  throw new Error(data.message || "Something went wrong. Please try again.");
    }
  }
  return data;
}

// ── Stock Items (product catalog) ────────────────────────────────────────────
// Backend DTO fields (from StockItemMapper.java):
//   id, productName, openingDate, smDescription, smUnit, smOpeningBalance, status

export async function getStockItems() {
  const res = await fetch(`${BASE_URL}/api/stock-items`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createStockItem(data) {
  const res = await fetch(`${BASE_URL}/api/stock-items`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateStockItem(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/stock-items/${id}`, "PUT", {
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}
/*
export async function deleteStockItem(id) {
  const res = await mutationFetch(`${BASE_URL}/api/stock-items/${id}`, "DELETE");
  return handleResponse(res);
}
*/
export async function deleteStockItem(id, options = {}) {
  const url = options.permanent
    ? `${BASE_URL}/api/stock-items/${id}?permanent=true`
    : `${BASE_URL}/api/stock-items/${id}`;
  const res = await mutationFetch(url, "DELETE");
  return handleResponse(res);
}
// ── Stock Movements ──────────────────────────────────────────────────────────
// Backend DTO fields (from StocksMapper.java):
//   id, stockItemId, stockDate, stockDescription, stockInOut,
//   stockQuantity, stockReturnOrNonReturn, stockParty, matPassId, status

export async function getStocks() {
  const res = await fetch(`${BASE_URL}/api/stocks`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getStocksByMatpass(matpassId) {
  const res = await fetch(`${BASE_URL}/api/stocks/matpass/${matpassId}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createStock(data) {
  const res = await fetch(`${BASE_URL}/api/stocks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateStock(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/stocks/${id}`, "PUT", {
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteStock(id) {
  const res = await mutationFetch(`${BASE_URL}/api/stocks/${id}`, "DELETE");
  return handleResponse(res);
}
