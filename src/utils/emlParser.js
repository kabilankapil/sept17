// Parses a .eml file (picked in the browser) into a plain object the
// "add email as activity" flow can use. Nothing is uploaded or saved here.
//
// postal-mime is loaded on demand, so it is only downloaded when someone
// actually picks an .eml file (not on every page load).

const MAX_EML_BYTES = 50 * 1024 * 1024; // same ceiling as POST /api/blobs

const fmtAddr = (a) => (a?.address ? (a.name ? `${a.name} <${a.address}>` : a.address) : "");
const fmtList = (list) => (list || []).map(fmtAddr).filter(Boolean).join(", ");

// HTML-only emails have no plain-text part, so build one. DOMParser gives an
// inert document: scripts don't run and images/remote content aren't loaded.
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("head, style, script").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6").forEach((n) => n.append("\n"));
  return (doc.body?.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {File} file  a .eml file from <input type="file">
 * @returns {Promise<{
 *   messageId: string|null, subject: string, from: string, fromAddress: string,
 *   to: string, cc: string, date: string|null, bodyText: string,
 *   attachments: {name: string, type: string, size: number, isInline: boolean, file: File}[]
 * }>}
 */
export async function parseEml(file) {
  if (!file || !/\.eml$/i.test(file.name)) throw new Error("Please choose a .eml file.");
  if (file.size > MAX_EML_BYTES) throw new Error("Email file is too large (max 50MB).");

  const { default: PostalMime } = await import("postal-mime");

  let mail;
  try {
    mail = await PostalMime.parse(await file.arrayBuffer());
  } catch {
    throw new Error("Could not read this email file. It may be damaged.");
  }

  const bodyText = (mail.text ?? (mail.html ? htmlToText(mail.html) : "")).trim();

  const attachments = (mail.attachments || []).map((a) => {
    const name = a.filename || "attachment";
    const type = a.mimeType || "application/octet-stream";
    return {
      name,
      type,
      size: a.content.byteLength,
      // Likely a signature logo / embedded picture rather than a real attachment.
      // Only a hint — the UI can leave it unticked by default, user can still tick it.
      isInline: !!a.contentId && type.startsWith("image/") && a.disposition !== "attachment",
      file: new File([a.content], name, { type }),
    };
  });

  return {
    messageId: mail.messageId ?? null,
    subject: mail.subject || "(no subject)",
    from: fmtAddr(mail.from),
    fromAddress: mail.from?.address ?? "",
    to: fmtList(mail.to),
    cc: fmtList(mail.cc),
    date: mail.date ?? null, // ISO string, e.g. 2026-10-06T04:45:30.000Z
    bodyText,
    attachments,
  };
}
