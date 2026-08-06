import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { serializeNote } from "@/lib/note-serializer";
import FloatingNoteClient from "./FloatingNoteClient";
import type { Note } from "@/types";

export default async function FloatingPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user)
    redirect(
      `/login?returnTo=${encodeURIComponent(`/notes/${params.id}/floating`)}`
    );

  const note = await prisma.note.findFirst({
    where: {
      id: params.id,
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
        noteId={params.id}
      />
    </div>
  );
}
