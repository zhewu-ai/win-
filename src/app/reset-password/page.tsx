import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tokenStr = typeof token === "string" ? token : "";
  return <ResetPasswordForm token={tokenStr} />;
}
