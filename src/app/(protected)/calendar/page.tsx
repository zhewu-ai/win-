import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import CalendarPageClient from "@/components/calendar/CalendarPageClient";

// M12 工作日历独立页：仅管理员可见。普通用户直接访问 /calendar 跳回首页并提示无权限。
// R2 起入口已并入左侧列表、在右面板嵌入展示，本页保留仅供深链/直接访问（管理员）。
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; new?: string; event?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/?notice=calendar_forbidden");
  }
  const sp = await searchParams;
  const initialAction = {
    date: sp.date,
    newEvent: sp.new === "1",
    eventId: sp.event,
  };
  return <CalendarPageClient initialAction={initialAction} />;
}
