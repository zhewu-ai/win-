import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    redirect("/");
  }
  return <AdminUsersClient currentUserId={admin.id} />;
}
