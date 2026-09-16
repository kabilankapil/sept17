// ── pages/EmployeeOnboardingForm.jsx ──────────────────────────────────────────
// Public, unauthenticated page opened via the tokenized onboarding link.
// Mounted at:  <Route path="/onboard/:token" element={<EmployeeOnboardingForm />} />
//
// Self-contained on purpose — no admin.css dependency — so it renders
// correctly even though it lives outside the /admin shell. Styling follows
// the same visual language as the public Login page (see login.css):
// dark glass card, teal brand accent, circuit-grid backdrop.
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getPublicOnboarding, submitPublicOnboarding } from "../api/employeeOnboarding";
import {
  validateEmployeeForm, FIELD_LABELS, EMPTY_EMP,
} from "../components/admin/employee/employeeConstants";
import logo from "../images/mosics.png";
import "./EmployeeOnboardingForm.css";

function Brand() {
  return (
    <div className="eob-brand">
      <img src={logo} alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
      <span className="eob-brand-name">MosIC Solutions</span>
    </div>
  );
}

function Field({ children, span2, error, htmlLabel }) {
  return (
    <div className={`eob-field ${span2 ? "eob-field--span2" : ""}`}>
      <label>{htmlLabel}</label>
      {children}
      {error && <span className="eob-field-error">⚠ {error}</span>}
    </div>
  );
}

function Inp({ value, onChange, type = "text", placeholder, hasError }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`eob-input ${hasError ? "eob-input--error" : ""}`}
    />
  );
}

export default function EmployeeOnboardingForm() {
  const { token } = useParams();

  const [phase, setPhase]   = useState("loading"); // loading | invalid | expired | reviewed | submitted | form
  const [status, setStatus] = useState(null);       // raw status payload from backend
  const [form, setForm]     = useState(EMPTY_EMP);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const data = await getPublicOnboarding(token);
      setStatus(data);
      if (data.expired) { setPhase("expired"); return; }
      if (data.status === "approved" || data.status === "rejected") { setPhase("reviewed"); return; }
      if (data.submittedAt) { setPhase("submitted"); return; }
      setPhase("form");
    } catch (e) {
      setStatus({ error: e.message });
      setPhase(/expired/i.test(e.message) ? "expired" : "invalid");
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const f = (k) => (e) => {
    let val = e.target.value;
    if (k === "empPan" || k === "empIfscCode") val = val.toUpperCase();
    setForm((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((prev) => { const next = { ...prev }; delete next[k]; return next; });
  };

  const handleSubmit = async () => {
    const { errors: errs, isValid } = validateEmployeeForm(form);
    setErrors(errs);
    if (!isValid) {
      setSaveError(`Please fix: ${Object.keys(errs).map((k) => FIELD_LABELS[k] || k).join(", ")}.`);
      return;
    }
    setSaveError(""); setSaving(true);
    try {
      await submitPublicOnboarding(token, form);
      setPhase("submitted");
    } catch (e) {
      setSaveError(e.message || "Failed to submit your details.");
      if (e.fieldErrors) setErrors(e.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  // ── Non-form states ──────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="eob-page">
        <div className="eob-card eob-card--narrow"><Brand /><p>Loading…</p></div>
      </div>
    );
  }
  if (phase === "invalid") {
    return (
      <div className="eob-page">
        <div className="eob-card eob-card--narrow">
          <Brand />
          <div className="eob-status-icon">🔗</div>
          <h2>Link not found</h2>
          <p>This onboarding link is invalid. Please check the URL or ask your Super User to send a new one.</p>
        </div>
      </div>
    );
  }
  if (phase === "expired") {
    return (
      <div className="eob-page">
        <div className="eob-card eob-card--narrow">
          <Brand />
          <div className="eob-status-icon">⏳</div>
          <h2>Link expired</h2>
          <p>This onboarding link has expired. Please ask your Super User to generate a new one.</p>
        </div>
      </div>
    );
  }
  if (phase === "reviewed") {
    const approved = status?.status === "approved";
    return (
      <div className="eob-page">
        <div className="eob-card eob-card--narrow">
          <Brand />
          <div className="eob-status-icon">{approved ? "✅" : "🚫"}</div>
          <h2>{approved ? "You're all set" : "Submission not approved"}</h2>
          <p>
            {approved
              ? "Your details have been reviewed and approved. You've been added as an employee."
              : "Your submission was reviewed and not approved."}
          </p>
          {!approved && status?.rejectionReason && (
            <p className="eob-reason"><strong>Reason:</strong> {status.rejectionReason}</p>
          )}
        </div>
      </div>
    );
  }
  if (phase === "submitted") {
    return (
      <div className="eob-page">
        <div className="eob-card eob-card--narrow">
          <Brand />
          <div className="eob-status-icon">📨</div>
          <h2>Submitted</h2>
          <p>
            Thanks — your details have been sent for review. Your Super User will approve or reject
            your submission, and you'll be added as an official employee once approved.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="eob-page">
      <div className="eob-card">
        <Brand />
        <h2>Employee Onboarding</h2>
        <p className="eob-subtitle">
          Fill in your details below. Your Super User will review and approve this before
          you're added as an official employee.
        </p>

        <div className="eob-grid">
          <div className="eob-section eob-field--span2">👤 Personal Information</div>

          <Field htmlLabel="First Name *" error={errors.empName}>
            <Inp value={form.empName} onChange={f("empName")} placeholder="First name" hasError={!!errors.empName} />
          </Field>
          <Field htmlLabel="Last Name *" error={errors.empLastName}>
            <Inp value={form.empLastName} onChange={f("empLastName")} placeholder="Last name" hasError={!!errors.empLastName} />
          </Field>

          <Field htmlLabel="Date of Birth *" error={errors.empDob}>
            <Inp type="date" value={form.empDob} onChange={f("empDob")} hasError={!!errors.empDob} />
          </Field>
          <Field htmlLabel="Date of Joining *" error={errors.empDoj}>
            <Inp type="date" value={form.empDoj} onChange={f("empDoj")} hasError={!!errors.empDoj} />
          </Field>

          <Field htmlLabel="Phone No *" error={errors.empPh}>
            <Inp value={form.empPh} onChange={f("empPh")} placeholder="e.g. 9876543210" hasError={!!errors.empPh} />
          </Field>
          <Field htmlLabel="Email *" error={errors.empMail}>
            <Inp type="email" value={form.empMail} onChange={f("empMail")} placeholder="you@example.com" hasError={!!errors.empMail} />
          </Field>

          <Field htmlLabel="PAN No *" error={errors.empPan}>
            <Inp value={form.empPan} onChange={f("empPan")} placeholder="ABCDE1234F" hasError={!!errors.empPan} />
          </Field>
          <Field htmlLabel="Aadhaar *" error={errors.empAdhar}>
            <Inp value={form.empAdhar} onChange={f("empAdhar")} placeholder="12-digit Aadhaar" hasError={!!errors.empAdhar} />
          </Field>

          <div className="eob-section eob-field--span2">📍 Address</div>
          <Field htmlLabel="Address Line 1 *" span2 error={errors.empAddress1}>
            <Inp value={form.empAddress1} onChange={f("empAddress1")} placeholder="Street / locality" hasError={!!errors.empAddress1} />
          </Field>
          <Field htmlLabel="Address Line 2" span2>
            <Inp value={form.empAddress2} onChange={f("empAddress2")} placeholder="City, State" />
          </Field>
          <Field htmlLabel="Address Line 3" span2>
            <Inp value={form.empAddress3} onChange={f("empAddress3")} placeholder="PIN code / country" />
          </Field>

          <div className="eob-section eob-field--span2">🏦 Bank Details</div>
          <Field htmlLabel="Bank Name *" error={errors.empBankName}>
            <Inp value={form.empBankName} onChange={f("empBankName")} placeholder="e.g. SBI" hasError={!!errors.empBankName} />
          </Field>
          <Field htmlLabel="Account Holder Name *" error={errors.empAccName}>
            <Inp value={form.empAccName} onChange={f("empAccName")} placeholder="As on passbook" hasError={!!errors.empAccName} />
          </Field>
          <Field htmlLabel="Account Number *" error={errors.empAccNo}>
            <Inp value={form.empAccNo} onChange={f("empAccNo")} placeholder="Account number" hasError={!!errors.empAccNo} />
          </Field>
          <Field htmlLabel="IFSC Code *" error={errors.empIfscCode}>
            <Inp value={form.empIfscCode} onChange={f("empIfscCode")} placeholder="SBIN0001234" hasError={!!errors.empIfscCode} />
          </Field>
        </div>

        {saveError && <p className="eob-banner-error">⚠ {saveError}</p>}

        <button className="eob-submit" onClick={handleSubmit} disabled={saving}>
          {saving ? "Submitting…" : "Approve & Submit"}
        </button>
      </div>
    </div>
  );
}