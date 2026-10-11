import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { login } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/questions");
  const { next } = await searchParams;
  return <AuthForm mode="login" action={login} next={next} />;
}
