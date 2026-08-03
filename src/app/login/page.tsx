import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <LoginForm returnTo={searchParams.returnTo} />;
}
