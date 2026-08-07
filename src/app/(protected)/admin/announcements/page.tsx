import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminAnnouncementsClient from "./AdminAnnouncementsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }
  return <AdminAnnouncementsClient />;
}
