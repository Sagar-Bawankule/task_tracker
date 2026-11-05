"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/daily", label: "Daily", icon: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { href: "/weekly", label: "Weekly Summary", icon: "M4 19V9M10 19V5M16 19v-7M22 19H2" },
  { href: "/monthly", label: "Monthly", icon: "M3 9h18M3 15h18M9 3v18M15 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" },
  { href: "/tasks", label: "Tasks", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Nav({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  const links = [
    ...LINKS,
    ...(role === "admin"
      ? [{ href: "/team", label: "Team", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" }]
      : []),
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className="sticky top-0 z-20 border-b border-stone-200 bg-white md:fixed md:inset-y-0 md:left-0 md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">SB</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-stone-900">Shree Beauty</span>
            <span className="block text-[11px] text-stone-500">Work Tracker</span>
          </span>
        </Link>
        <form action={logout} className="md:hidden">
          <button className="text-xs text-stone-500 hover:text-stone-800">Sign out</button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:px-3 md:pb-0">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active(l.href) ? "bg-brand-50 font-medium text-brand-700" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
            }`}
          >
            <Icon d={l.icon} />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="absolute inset-x-0 bottom-0 hidden border-t border-stone-100 p-4 md:block">
        <Link href="/account" className="block rounded-lg px-2 py-1.5 hover:bg-stone-50">
          <div className="truncate text-sm font-medium text-stone-800">{name}</div>
          <div className="text-xs capitalize text-stone-500">{role} · My account</div>
        </Link>
        <form action={logout}>
          <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-800">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
