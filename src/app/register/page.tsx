import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { register } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/questions");
  return <AuthForm mode="register" action={register} />;
}
