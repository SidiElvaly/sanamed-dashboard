// src/app/api/patients/[id]/documents/[docId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFileFromIndex } from "@/lib/extractApi";

type Ctx = {
  params: Promise<{ id: string; docId: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { docId } = await ctx.params;

    const doc = await db.patientDocument.findUnique({
      where: { id: docId },
      select: {
        fileData: true,
        fileName: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.fileData) {
      return NextResponse.json({ error: "No file stored" }, { status: 404 });
    }

    const buffer = Buffer.from(doc.fileData, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.fileName ?? "document.pdf"}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { docId } = await ctx.params;

    // Delete from Qdrant via external API (Best effort)
    try {
      await deleteFileFromIndex(docId);
    } catch (e) {
      console.error("Failed to delete from Qdrant:", e);
    }

    await db.patientDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete failed:", err);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
