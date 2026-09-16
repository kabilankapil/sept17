import { useEffect, useState } from "react";
import { useAuthBlob, downloadBlob } from "../../hooks/useAuthBlob";
import { useToast } from "./shared/ToastContext";

// ── Preview-kind detection ────────────────────────────────────
// Widened on purpose: the only format that's genuinely un-previewable
// in-browser is an archive (zip and friends) — everything else we can
// either render natively (image/pdf/text) or convert client-side
// (docx via mammoth, xlsx/csv via SheetJS, both loaded on demand).
function extOf(filename = "") {
  return (filename.split(".").pop() || "").toLowerCase();
}

const ARCHIVE_EXTS = ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"];
const TEXT_EXTS = ["txt", "csv", "log", "md", "json", "xml", "html", "htm", "css", "js", "jsx", "ts", "tsx", "yml", "yaml", "ini", "conf", "sql"];
const DOCX_EXTS = ["docx"];
const SHEET_EXTS = ["xlsx", "xls"];

function detectKind(fileType = "", filename = "") {
  const type = (fileType || "").toLowerCase();
  const ext = extOf(filename);

  if (ARCHIVE_EXTS.includes(ext) || type.includes("zip") || type.includes("compressed") || type.includes("archive")) return "archive";
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (type.startsWith("text/") || TEXT_EXTS.includes(ext)) return "text";
  if (DOCX_EXTS.includes(ext) || type.includes("wordprocessingml")) return "docx";
  if (SHEET_EXTS.includes(ext) || type.includes("spreadsheetml") || type.includes("ms-excel")) return "sheet";
  return "unsupported"; // e.g. legacy .doc/.ppt, unknown binary types
}

// mammoth / xlsx aren't installed as project dependencies, so they're
// pulled in from a CDN only when actually needed, and cached across
// previews so we don't re-download them every time. If the fetch fails
// (offline, CSP, blocked domain) the preview just falls back to the
// "no preview" + download message below — nothing breaks.
let mammothPromise = null;
function loadMammoth() {
  if (!mammothPromise) {
    mammothPromise = import(/* webpackIgnore: true */ /* @vite-ignore */ "https://esm.sh/mammoth@1.8.0/mammoth.browser");
  }
  return mammothPromise;
}
let xlsxPromise = null;
function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import(/* webpackIgnore: true */ /* @vite-ignore */ "https://esm.sh/xlsx@0.18.5");
  }
  return xlsxPromise;
}

function PreviewStatus({ children }) {
  return (
    <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.88rem" }}>
      {children}
    </div>
  );
}

function UnsupportedPreview() {
  return (
    <PreviewStatus>
      No preview available for this file type.<br />Use the download button below to save it.
    </PreviewStatus>
  );
}

function TextPreview({ blob }) {
  const [text, setText] = useState(null);
  useEffect(() => {
    let cancelled = false;
    blob.text().then((t) => { if (!cancelled) setText(t); });
    return () => { cancelled = true; };
  }, [blob]);

  if (text === null) return <PreviewStatus>Loading preview...</PreviewStatus>;
  return (
    <pre style={{
      margin: 0, padding: "14px 16px", maxHeight: 480, overflow: "auto",
      background: "var(--color-bg-subtle, #f8fafc)", border: "1px solid var(--color-border, #e2e8f0)",
      borderRadius: 6, fontSize: "0.8rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>
      {text}
    </pre>
  );
}

function DocxPreview({ blob }) {
  const [html, setHtml] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    blob.arrayBuffer()
      .then((buf) => loadMammoth().then((mammoth) => mammoth.convertToHtml({ arrayBuffer: buf })))
      .then((result) => { if (!cancelled) setHtml(result.value); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [blob]);

  if (failed) return <UnsupportedPreview />;
  if (html === null) return <PreviewStatus>Loading preview...</PreviewStatus>;
  return (
    <div
      style={{ maxHeight: 480, overflow: "auto", padding: "14px 18px", background: "#fff", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 6, fontSize: "0.88rem", lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SheetPreview({ blob }) {
  const [html, setHtml] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    blob.arrayBuffer()
      .then((buf) => loadXlsx().then((XLSX) => {
        const wb = XLSX.read(buf, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_html(firstSheet, { editable: false });
      }))
      .then((tableHtml) => { if (!cancelled) setHtml(tableHtml); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [blob]);

  if (failed) return <UnsupportedPreview />;
  if (html === null) return <PreviewStatus>Loading preview...</PreviewStatus>;
  return (
    <div
      className="blob-sheet-preview"
      style={{ maxHeight: 480, overflow: "auto", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 6, fontSize: "0.8rem" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Drop-in replacement for <img> / <iframe> that loads blobs securely.
 * Token goes in the Authorization header — never in the URL.
 *
 * Renders inline previews for images, PDFs, plain-text-style files
 * (txt/csv/json/log/md/...), Word docs (.docx), and Excel files
 * (.xlsx/.xls). Archives (zip and friends) and any other binary format
 * the browser genuinely can't render fall back to a "no preview" message
 * with the Download button still available.
 *
 * Props:
 *   blobId    — the blob ID from the activity
 *   fileType  — MIME type string e.g. "image/png", "application/pdf"
 *   filename  — used as the download filename
 *   className — optional CSS class for the img/iframe element
 *   showDownloadButton — set false when the caller already renders its own
 *     Download button elsewhere (e.g. in a header next to the title), so
 *     the two don't stack. Defaults to true.
 */
export default function BlobViewer({ blobId, fileType, filename = "file", className, showDownloadButton = true }) {
  const toast = useToast();
  const kind = detectKind(fileType, filename);
  // Every kind except a genuine archive/unknown binary needs the actual
  // bytes fetched (image/pdf use the object URL directly; text/docx/sheet
  // parse the raw Blob).
  const canPreview = kind !== "archive" && kind !== "unsupported";
  const { src, blob, loading, error } = useAuthBlob(canPreview ? blobId : null);

  if (!blobId) {
    return <p className="detail-no-file">No file attached to this activity.</p>;
  }

  if (canPreview && loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.88rem" }}>
        Loading file...
      </div>
    );
  }

  if (canPreview && error) {
    return (
      <div style={{ padding: "16px", color: "#ef4444", fontSize: "0.88rem" }}>
        Failed to load file: {error}
      </div>
    );
  }

  return (
    <div>
      {kind === "image" && <img src={src} alt={filename} className={className || "detail-file-img"} />}
      {kind === "pdf" && <iframe src={src} title={filename} className={className || "detail-file-iframe"} />}
      {kind === "text" && blob && <TextPreview blob={blob} />}
      {kind === "docx" && blob && <DocxPreview blob={blob} />}
      {kind === "sheet" && blob && <SheetPreview blob={blob} />}
      {(kind === "archive" || kind === "unsupported") && <UnsupportedPreview />}
      {/* Secure download — no token in URL, real filename set here.
          Skipped when the caller already has its own Download button. */}
      {showDownloadButton && (
        <div style={{ marginTop: 10 }}>
          <button
            className="detail-download-btn"
            onClick={() => downloadBlob(blobId, filename).catch((e) => toast.error(e.message))}
          >
            ⬇ Download
          </button>
        </div>
      )}
    </div>
  );
}