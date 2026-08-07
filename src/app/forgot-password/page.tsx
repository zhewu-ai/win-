import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ManualRecoveryInfo from "./ManualRecoveryInfo";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <ManualRecoveryInfo />;
}
