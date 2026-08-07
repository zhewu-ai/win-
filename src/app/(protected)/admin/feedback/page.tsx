import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminFeedbackClient from "./AdminFeedbackClient";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }
  return <AdminFeedbackClient />;
}
