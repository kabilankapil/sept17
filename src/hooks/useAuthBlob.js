import { useState, useEffect } from "react";
import { BASE_URL } from "../api/_base";
import { getToken } from "../api/_auth";       // ← add this import

/**
 * Fetches a blob from the backend using the Authorization header
 * and returns a safe in-memory object URL for use in <img> and <iframe>.
 *
 * No token ever appears in the URL.
 *
 * Usage:
 *   const { src, loading, error } = useAuthBlob(blobId);
 *   <img src={src} />
 *   <iframe src={src} />
 */
export function useAuthBlob(blobId) {
  const [src,     setSrc]     = useState(null);
  const [blob,    setBlob]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!blobId) { setSrc(null); setBlob(null); return; }

    let objectUrl = null;
    setLoading(true);
    setError(null);

    const token = getToken();

    fetch(`${BASE_URL}/api/blobs/${blobId}/view`, {
      headers: { Authorization: `Bearer ${token}` },  // header, not URL
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} Unauthorized`);
        return res.blob();
      })
      .then((fetchedBlob) => {
        objectUrl = URL.createObjectURL(fetchedBlob);
        setSrc(objectUrl);
        setBlob(fetchedBlob);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Cleanup: revoke the object URL when blobId changes or component unmounts
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blobId]);

  return { src, blob, loading, error };
}

/**
 * Triggers a secure download using the Authorization header.
 * No token in the URL — creates a temporary <a> tag with an object URL.
 *
 * Usage:
 *   <button onClick={() => downloadBlob(act.blobId, act.title)}>Download</button>
 */
export async function downloadBlob(blobId, filename = "download") {
  if (!blobId) return;
  const token = getToken();

  const res = await fetch(`${BASE_URL}/api/blobs/${blobId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Download failed");

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);

  // Trigger browser download without exposing token in URL
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}