import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export async function getCurrentUser() {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
