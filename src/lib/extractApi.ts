export async function extractAndIndexFile(file: File, mongoDocumentId?: string, patientId?: string) {
  const base = process.env.NEXT_PUBLIC_EXTRACT_API_URL || process.env.EXTRACT_API_URL;
  if (!base) throw new Error("Missing EXTRACT_API_URL");

  const fd = new FormData();
  fd.append("file", file);
  if (mongoDocumentId) {
    fd.append("mongoDocumentId", mongoDocumentId);
  }
  if (patientId) {
    fd.append("patientId", patientId);
  }

  const res = await fetch(`${base}/extract-file`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Extract API failed: ${err}`);
  }

  return res.json();
}

/**
 * Best-effort deletion of a file from the index (Qdrant) via the Extract API.
 * This helper should be called within a try/catch block to avoid blocking main flows.
 */
export async function deleteFileFromIndex(mongoDocumentId: string) {
  // Prefer server-side env var, fallback to public if needed
  const base = process.env.EXTRACT_API_URL || process.env.NEXT_PUBLIC_EXTRACT_API_URL;

  if (!base) {
    console.warn("Skipping deleteFileFromIndex: EXTRACT_API_URL not set");
    return;
  }

  const res = await fetch(`${base}/delete-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mongoDocumentId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Extract API delete failed: ${res.status} ${errorText}`);
  }
}
