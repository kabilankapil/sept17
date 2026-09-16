// src/components/admin/purchase/purchaseConstants.js
//
// Single source of truth for all Purchase-specific constants,
// label helpers, shared error style, and empty-form factories.

import { localDate } from "../shared/adminStyles";

// ─── Option lists ──────────────────────────────────────────────

// NOTE: Purchase stores documentType and status as numeric IDs in the DB
// (e.g. "3" for Purchase Order, "1" for Active), unlike Sales which stores
// plain strings. value is the DB ID; label is the display string.

export const DOCTYPE_OPTIONS = [
  { value: "1", label: "Enquiry" },
  { value: "2", label: "Quotation" },
  { value: "3", label: "Purchase Order" },
  { value: "4", label: "Invoice" },
  { value: "5", label: "Delivery Note" },
];

export const STATUS_OPTIONS = [
  { value: "1", label: "Active" },
  { value: "2", label: "Closed" },
  { value: "3", label: "Cancelled" },
];

export const ITEM_STATUS_OPTIONS = [
  { value: "Active",   label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

// Named CURRENCIES to match Sales convention.
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

// ─── Label helpers ─────────────────────────────────────────────

export const doctypeLabel = (v) =>
  DOCTYPE_OPTIONS.find((o) => o.value === String(v))?.label ?? v ?? "—";

export const statusLabel = (v) =>
  STATUS_OPTIONS.find((o) => o.value === String(v))?.label ?? v ?? "—";

// Label for line item status ("Active" / "Inactive").


// ─── Inline field error style ──────────────────────────────────

export const errStyle = {
  color:         "var(--a-danger, #ef4444)",
  fontSize:      "0.72rem",
  fontWeight:    600,
  marginTop:     4,
  display:       "block",
  letterSpacing: "0.01em",
};

// ─── Empty form factories ──────────────────────────────────────

// Factory so date defaults to today each time a new form is opened.
export const emptyPurchaseForm = () => ({
  purchaseDate:          localDate(),
  purchaseValidity:      "",
  purchaseFromParty:     "",
  purchaseToParty:       "",
  purchaseEnquireDate:   "",
  purchaseDeliveryTerms: "",
  purchasePaymentTerms:  "",
  purchaseCurrency:      "INR",
  purchaseDoctype:       "3",
  purchaseTxType:        "",
  purchaseDescription:   "",
  purchaseAddressedTo:   "",
  purchaseFileRef:       "",
  purchaseStatus:        "1",
});

export const emptyItemForm = (refFileNo = "") => ({
  nameOfProductService: "",
  hsnAcs:               "",
  quantity:             "",
  unit:                 "",
  unitRate:             "",
  taxableValue:         0,
  cgstRate:             "",  cgstAmount: 0,
  sgstRate:             "",  sgstAmount: 0,
  igstRate:             "",  igstAmount: 0,
  total:                0,
  refFileNo:            String(refFileNo),
  status:               "Active",
});

// Mirrors Sales' EMPTY_LI_ERRORS — used to reset item form error state.
export const EMPTY_ITEM_ERRORS = {
  nameOfProductService: "", hsnAcs: "", quantity: "", unitRate: "",
  cgstRate: "", sgstRate: "", igstRate: "",
};
