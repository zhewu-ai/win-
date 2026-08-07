import { NextResponse } from "next/server";
import { authOrResponse } from "@/lib/auth";
import { hardDeleteNotes } from "@/lib/permanent-delete";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const { deletedIds } = await hardDeleteNotes(session.userId, [params.id]);
  if (deletedIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
