import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import CalendarPageClient from "@/components/calendar/CalendarPageClient";

// M12 工作日历：仅管理员可见。普通用户直接访问 /calendar 跳回首页并提示无权限。
export default async function CalendarPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/?notice=calendar_forbidden");
  }
  return (
    <Suspense fallback={<div className="h-screen bg-page-bg" />}>
      <CalendarPageClient />
    </Suspense>
  );
}
