import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { serializeNote } from "@/lib/note-serializer";
import FloatingNoteClient from "./FloatingNoteClient";
import type { Note } from "@/types";

export default async function FloatingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(
      `/login?returnTo=${encodeURIComponent(`/notes/${id}/floating`)}`
    );

  const note = await prisma.note.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: { attachments: true },
  });

  if (!note) notFound();

  const serialized = serializeNote(note as unknown as Record<string, unknown>);

  return (
    <div className="min-h-screen bg-page-bg">
      <FloatingNoteClient
        initialNote={serialized as unknown as Note}
        noteId={id}
      />
    </div>
  );
}
