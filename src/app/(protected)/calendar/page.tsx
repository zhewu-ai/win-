import CalendarPageClient from "@/components/calendar/CalendarPageClient";

// M12 工作日历独立页：所有已登录用户可用（(protected) 布局已保证登录态）。
// R2 起入口已并入左侧列表、在右面板嵌入展示，本页保留仅供深链/直接访问。
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; new?: string; event?: string }>;
}) {
  const sp = await searchParams;
  const initialAction = {
    date: sp.date,
    newEvent: sp.new === "1",
    eventId: sp.event,
  };
  return <CalendarPageClient initialAction={initialAction} />;
}
