import { NextResponse } from "next/server";
import { authOrResponse } from "@/lib/auth";
import { recordUserActivity } from "@/lib/activity";
import { hardDeleteNotes } from "@/lib/permanent-delete";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await authOrResponse();
  if (session instanceof NextResponse) return session;

  const { deletedIds } = await hardDeleteNotes(session.userId, [id]);
  if (deletedIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  await recordUserActivity(session.userId, "permanent_delete_note", {
    count: deletedIds.length,
  });

  return NextResponse.json({ ok: true });
}
