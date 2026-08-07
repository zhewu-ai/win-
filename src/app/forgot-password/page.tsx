import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <ForgotPasswordForm />;
}
