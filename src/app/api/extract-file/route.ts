import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const base = process.env.EXTRACT_API_URL; // server-side env
    if (!base) {
      return NextResponse.json(
        { error: "Missing EXTRACT_API_URL" },
        { status: 500 }
      );
    }

    const incomingFormData = await req.formData();
    const file = incomingFormData.get("file");
    const patientId = incomingFormData.get("patientId");
    const mongoDocumentId = incomingFormData.get("mongoDocumentId");

    // Explicitly construct the upstream payload to ensure clarity for the extraction model service
    const upstreamFormData = new FormData();
    if (file) upstreamFormData.append("file", file);
    if (patientId) upstreamFormData.append("patientId", patientId);
    if (mongoDocumentId) upstreamFormData.append("mongoDocumentId", mongoDocumentId);

    const upstream = await fetch(`${base}/extract-file`, {
      method: "POST",
      body: upstreamFormData,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
