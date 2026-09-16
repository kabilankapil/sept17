// src/components/admin/sales/salesConstants.js
//
// Single source of truth for all Sales-specific constants,
// label helpers, shared error style, and empty-form factories.

import { localDate } from "../shared/adminStyles";

// ─── Option lists ──────────────────────────────────────────────

// NOTE: Sales stores documentType and status as plain strings in the DB
// (e.g. "RFQ", "Active"), not numeric IDs like Purchase.
// value === label here so existing saved records are never remapped.

export const DOCTYPE_OPTIONS = [
  { value: "RFQ",            label: "RFQ" },
  { value: "Quotation",      label: "Quotation" },
  { value: "Sales Order",    label: "Sales Order" },
  { value: "Invoice",        label: "Invoice" },
  { value: "Delivery Note",  label: "Delivery Note" },
  { value: "Purchase Order", label: "Purchase Order" },
];

export const STATUS_OPTIONS = [
  { value: "Active",    label: "Active" },
  { value: "Closed",    label: "Closed" },
  { value: "Cancelled", label: "Cancelled" },
];

export const ITEM_STATUS_OPTIONS = [
  { value: "Active",   label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

// Named CURRENCIES (not CURRENCY_OPTIONS) — matches Purchase alias below.
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

// ─── Label helpers ─────────────────────────────────────────────

export const doctypeLabel = (v) =>
  DOCTYPE_OPTIONS.find((o) => o.value === String(v))?.label ?? v ?? "—";

export const statusLabel = (v) =>
  STATUS_OPTIONS.find((o) => o.value === String(v))?.label ?? v ?? "—";

// Mirrors Purchase — label for line item status ("Active" / "Inactive").


// ─── Inline field error style ──────────────────────────────────


// ─── Empty form factories ──────────────────────────────────────

// Factory so date defaults to today each time a new form is opened.
export const emptySaleForm = () => ({
  date:            localDate(),
  validity:        "",
  fromParty:       "",
  toParty:         "",
  enquiryDate:     "",
  deliveryTerms:   "",
  paymentTerms:    "",
  currency:        "INR",
  documentType:    "RFQ",
  transactionType: "SALES",
  addressedTo:     "",
  fileReference:   "",
  status:          "Active",
  description:     "",
});

export const EMPTY_LI = {
  product: "", hsnCode: "", quantity: "", unit: "", unitRate: "",
  taxableValue: 0, cgstRate: "", cgstAmount: 0,
  sgstRate: "", sgstAmount: 0, igstRate: "", igstAmount: 0, total: 0,
  status: "Active",
};

export const EMPTY_LI_ERRORS = {
  product: "", hsnCode: "", quantity: "", unitRate: "",
  cgstRate: "", sgstRate: "", igstRate: "",
};
