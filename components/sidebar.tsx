"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/lib/useUserRole";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◻", minRole: "admin" as const },
  { href: "/drafter", label: "Drafter", icon: "✉", minRole: "ops_reviewer" as const },
  { href: "/sources", label: "Sources", icon: "📄", minRole: "admin" as const },
  { href: "/structured-facts", label: "Structured Facts", icon: "▤", minRole: "admin" as const },
  { href: "/logs", label: "Logs", icon: "☰", minRole: "admin" as const },
  { href: "/admin", label: "Admin", icon: "⚙", minRole: "admin" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useUserRole();

  return (
    <aside className="fixed left-0 top-0 h-full w-52 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-5 py-5">
        <h1 className="text-base font-semibold text-gray-900">Edge City Ops</h1>
      </div>
      <nav className="flex-1 px-3">
        {navItems
          .filter((item) => item.minRole === "ops_reviewer" || isAdmin)
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm mb-0.5 ${
                  isActive
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
