export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const base = process.env.SEARCH_API_URL;
  console.log("SEARCH_API_URL =", base);

  if (!base) {
    return NextResponse.json({ error: "Missing SEARCH_API_URL" }, { status: 500 });
  }

  const { query, patientId } = (await req.json()) as { query?: string; patientId?: string };

  if (!query?.trim()) return NextResponse.json({ results: [] });

  const url = new URL("/search", base);
  console.log("Upstream URL:", url.toString());

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, patientId }),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
