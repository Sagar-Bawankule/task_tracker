import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { queryOne } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  department: string;
  active: boolean;
};

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const uid = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const user = await queryOne<User>(
    "SELECT id, name, email, role, department, active FROM users WHERE id = $1",
    [uid],
  );
  return user && user.active ? user : null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
