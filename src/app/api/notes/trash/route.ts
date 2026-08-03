import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { serializeNote } from "@/lib/note-serializer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    const where: Record<string, unknown> = {
      userId: session.userId,
      deletedAt: { not: null },
    };

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
        { checklistItems: { contains: q } },
      ];
    }

    const notes = await prisma.note.findMany({
      where,
      include: { attachments: true },
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json({
      notes: notes.map((n) => serializeNote(n as unknown as Record<string, unknown>)),
    });
  } catch (e) {
    console.error("GET /api/notes/trash error:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
