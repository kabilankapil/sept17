/**
 * ToastContext.jsx
 * ────────────────
 * Lightweight toast notification system for the admin panel.
 *
 * Usage:
 *   1. Wrap Admin with <ToastProvider> (already done in Admin.jsx)
 *   2. In any child component:
 *        import { useToast } from "./shared/ToastContext";
 *        const toast = useToast();
 *        toast.error("Something went wrong.");
 *        toast.success("Saved successfully.");
 */
import { createContext, useContext, useState, useCallback, useEffect } from "react";

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

let _nextId = 1;
const DURATION = 4000; // ms before auto-dismiss

// Module-level reference so plain JS modules outside the React tree
// (e.g. the PDF generators in pdftemplates/) can trigger a toast without
// needing access to the React context. Set by ToastProvider on mount.
let _globalToast = null;
export function notifyGlobal(msg, type = "error") {
  if (_globalToast) _globalToast(msg, type);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((msg, type) => {
    const id = _nextId++;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => dismiss(id), DURATION);
  }, [dismiss]);

  useEffect(() => {
    _globalToast = push;
    return () => { _globalToast = null; };
  }, [push]);

  const toast = {
    error:   (msg) => push(msg, "error"),
    success: (msg) => push(msg, "success"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Container ─────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none",
    }}>
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const isError = toast.type === "error";
  return (
    <div
      style={{
        pointerEvents: "all",
        display: "flex", alignItems: "flex-start", gap: 10,
        minWidth: 280, maxWidth: 400,
        padding: "12px 14px",
        borderRadius: 8,
        background: isError
          ? "rgba(239,68,68,0.12)"
          : "rgba(20,184,166,0.12)",
        border: `1px solid ${isError
          ? "rgba(239,68,68,0.35)"
          : "rgba(20,184,166,0.35)"}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
        animation: "toastIn 0.18s ease",
      }}
    >
      <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>
        {isError ? "⚠" : "✓"}
      </span>
      <span style={{
        flex: 1,
        fontSize: "0.85rem",
        fontWeight: 500,
        color: isError ? "var(--a-danger, #ef4444)" : "var(--a-teal, #14b8a6)",
        lineHeight: 1.45,
        wordBreak: "break-word",
      }}>
        {toast.msg}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: isError ? "var(--a-danger)" : "var(--a-teal)",
          fontSize: "0.85rem", padding: "0 2px", flexShrink: 0,
          opacity: 0.7, lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ── Keyframe (injected once) ──────────────────────────────────────────────────
// Appended to document head so no separate CSS file is needed.
if (typeof document !== "undefined") {
  const styleId = "mosic-toast-styles";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = `
      @keyframes toastIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }
}
