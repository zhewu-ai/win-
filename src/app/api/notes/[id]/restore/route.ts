import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOrResponse } from "@/lib/auth";
import { serializeNote } from "@/lib/note-serializer";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const note = await prisma.note.findFirst({
    where: {
      id: params.id,
      userId: session.userId,
      deletedAt: { not: null },
    },
  });

  if (!note) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const restored = await prisma.note.update({
    where: { id: params.id },
    data: { deletedAt: null },
    include: { attachments: true },
  });

  return NextResponse.json(
    serializeNote(restored as unknown as Record<string, unknown>)
  );
}
