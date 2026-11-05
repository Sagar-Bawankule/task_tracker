import "server-only";
import type { User } from "./auth";
import { listMembers, type Member } from "./data";

/** Admins can view everyone (or filter to one member); members only see themselves. */
export async function resolveScope(user: User, userParam: string | string[] | undefined) {
  if (user.role !== "admin") {
    return { userId: user.id as number | null, members: [] as Member[], isAdmin: false, selected: String(user.id) };
  }
  const members = await listMembers();
  const n = Number(userParam);
  const userId = Number.isInteger(n) && members.some((m) => m.id === n) ? n : null;
  return { userId, members, isAdmin: true, selected: userId ? String(userId) : "" };
}

export function memberOptions(members: Member[]) {
  return [{ value: "", label: "Whole team" }, ...members.map((m) => ({ value: String(m.id), label: m.name }))];
}

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
