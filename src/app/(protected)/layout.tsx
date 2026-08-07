import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReleaseNoteModal from "@/components/ReleaseNoteModal";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // 未登录或账号被禁用都回到登录页（禁用用户旧 session 不继续放行页面）
  if (!user || user.status !== "active") redirect("/login");
  return (
    <>
      {children}
      <ReleaseNoteModal />
    </>
  );
}
