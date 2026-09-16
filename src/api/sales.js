/**
 * sales.js
 * ─────────
 * Sales CRUD + Sales Items CRUD
 * Talks to Java backend on port 8080
 *
 * Endpoints:
 *   Sales:       /api/sales
 *   Sales Items: /api/sales-items  |  /api/sales-items/by-sales/{refFileNo}
 */

import { authHeaders, mutationFetch } from "./_auth";

import { BASE_URL } from "./_base";

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function handleResponse(res, fallbackMsg) {
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || fallbackMsg);
  return data;
}

// ── Sale field mapping ───────────────────────────────────────────────────────
// Backend DTO fields (from SalesMapper.java):
//   salesDate, salesValidity, salesFromParty, salesToParty, salesEnquireDate,
//   salesDeliveryTerms, salesPaymentTerms, salesCurrency, salesDoctype,
//   salesTxType, salesDescription, salesAddressedTo, salesFileRef, salesStatus

function fromSaleDTO(dto) {
  if (!dto) return dto;
  return {
    id:              dto.id,
    date:            dto.salesDate           || "",
    validity:        dto.salesValidity       || "",
    fromParty:       String(dto.salesFromParty  || ""),
    toParty:         String(dto.salesToParty    || ""),
    enquiryDate:     dto.salesEnquireDate    || "",
    deliveryTerms:   dto.salesDeliveryTerms  || "",
    paymentTerms:    dto.salesPaymentTerms   || "",
    currency:        dto.salesCurrency       || "INR",
    documentType:    dto.salesDoctype        || "RFQ",
    transactionType: dto.salesTxType         || "SALES",
    addressedTo:     String(dto.salesAddressedTo || ""),
    fileReference:   String(dto.salesFileRef    || ""),
    status:          dto.salesStatus         || "Active",
    description:     dto.salesDescription    || "",
  };
}

function toSaleDTO(data) {
  return {
    salesDate:          data.date            || null,
    salesValidity:      data.validity        || null,
    salesFromParty:     data.fromParty       || null,
    salesToParty:       data.toParty         || null,
    salesEnquireDate:   data.enquiryDate     || null,
    salesDeliveryTerms: data.deliveryTerms   || "",
    salesPaymentTerms:  data.paymentTerms    || "",
    salesCurrency:      data.currency        || "INR",
    salesDoctype:       data.documentType    || "RFQ",
    salesTxType:        data.transactionType || "SALES",
    salesDescription:   data.description     || "",
    salesAddressedTo:   data.addressedTo     || null,
    salesFileRef:       data.fileReference   || null,
    salesStatus:        data.status          || "Active",
  };
}

// ── Sales Item field mapping ─────────────────────────────────────────────────
// Backend DTO fields (from SalesItemMapper.java):
//   nameOfProductService, hsnAcs, quantity, unit, unitRate, taxableValue,
//   cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount,
//   total, refFileNo, status

function fromLineItemDTO(dto) {
  if (!dto) return dto;
  return {
    id:           dto.id,
    saleId:       dto.refFileNo            || "",
    product:      dto.nameOfProductService || "",
    hsnCode:      dto.hsnAcs              || "",
    quantity:     Number(dto.quantity      || 0),
    unit:         dto.unit                || "",
    unitRate:     Number(dto.unitRate      || 0),
    taxableValue: Number(dto.taxableValue  || 0),
    cgstRate:     (dto.cgstRate  != null && dto.cgstRate  !== "" && Number(dto.cgstRate)  !== 0) ? Number(dto.cgstRate)  : "",
    cgstAmount:   Number(dto.cgstAmount    || 0),
    sgstRate:     (dto.sgstRate  != null && dto.sgstRate  !== "" && Number(dto.sgstRate)  !== 0) ? Number(dto.sgstRate)  : "",
    sgstAmount:   Number(dto.sgstAmount    || 0),
    igstRate:     (dto.igstRate  != null && dto.igstRate  !== "" && Number(dto.igstRate)  !== 0) ? Number(dto.igstRate)  : "",
    igstAmount:   Number(dto.igstAmount    || 0),
    total:        Number(dto.total         || 0),
    status:       dto.status === 1 ? "Active" : dto.status === 0 ? "Inactive" : "Active",
  };
}

function toLineItemDTO(saleId, data) {
  // Recompute tax amounts from rate x taxable so that if a user leaves a
  // rate field blank (or clears it to 0), the stored amount is always 0 —
  // never a stale value carried over from a previous save.
  const taxable  = Number(data.taxableValue) || 0;
  const cgstRate = Number(data.cgstRate)     || 0;
  const sgstRate = Number(data.sgstRate)     || 0;
  const igstRate = Number(data.igstRate)     || 0;
  const cgstAmt  = cgstRate ? (taxable * cgstRate) / 100 : 0;
  const sgstAmt  = sgstRate ? (taxable * sgstRate) / 100 : 0;
  const igstAmt  = igstRate ? (taxable * igstRate) / 100 : 0;
  return {
    refFileNo:            Number(saleId),
    nameOfProductService: data.product || "",
    hsnAcs:               data.hsnCode || "",
    quantity:             Number(data.quantity) || 0,
    unit:                 data.unit             || "",
    unitRate:             Number(data.unitRate) || 0,
    taxableValue:         taxable,
    cgstRate:             cgstRate,
    cgstAmount:           cgstAmt,
    sgstRate:             sgstRate,
    sgstAmount:           sgstAmt,
    igstRate:             igstRate,
    igstAmount:           igstAmt,
    total:                taxable + cgstAmt + sgstAmt + igstAmt,
    status:               data.status === "Active" ? 1 : 0,
  };
}

// ── Sales CRUD ───────────────────────────────────────────────────────────────

export async function getSales() {
  const res = await fetch(`${BASE_URL}/api/sales`, { headers: authHeaders() });
  const list = await handleResponse(res, "Failed to fetch sales");
  return Array.isArray(list) ? list.map(fromSaleDTO) : [];
}

export async function createSale(data) {
  const res = await fetch(`${BASE_URL}/api/sales`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify(toSaleDTO(data)),
  });
  return fromSaleDTO(await handleResponse(res, "Failed to create sale"));
}

export async function updateSale(id, data) {
  const res = await mutationFetch(`${BASE_URL}/api/sales/${id}`, "PUT", {
    body: JSON.stringify(toSaleDTO(data)),
  });
  return fromSaleDTO(await handleResponse(res, "Failed to update sale"));
}

export async function deleteSale(id) {
  const res = await mutationFetch(`${BASE_URL}/api/sales/${id}`, "DELETE");
  return handleResponse(res, "Failed to delete sale");
}

// ── Sales Items CRUD ─────────────────────────────────────────────────────────

export async function getLineItems(saleId) {
  const res = await fetch(`${BASE_URL}/api/sales-items/by-sales/${saleId}`, {
    headers: authHeaders(),
  });
  const list = await handleResponse(res, "Failed to fetch sales items");
  return Array.isArray(list) ? list.map(fromLineItemDTO) : [];
}

export async function createLineItem(saleId, data) {
  const res = await fetch(`${BASE_URL}/api/sales-items`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify(toLineItemDTO(saleId, data)),
  });
  return fromLineItemDTO(await handleResponse(res, `Failed to create sales item (HTTP ${res.status})`));
}

export async function updateLineItem(id, saleId, data) {
  const res = await mutationFetch(`${BASE_URL}/api/sales-items/${id}`, "PUT", {
    body: JSON.stringify(toLineItemDTO(saleId, data)),
  });
  return fromLineItemDTO(await handleResponse(res, `Failed to update sales item (HTTP ${res.status})`));
}

export async function deleteLineItem(id) {
  const res = await mutationFetch(`${BASE_URL}/api/sales-items/${id}`, "DELETE");
  return handleResponse(res, `Failed to delete sales item (HTTP ${res.status})`);
}
