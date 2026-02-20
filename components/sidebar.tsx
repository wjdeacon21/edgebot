"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/lib/useUserRole";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-md bg-white p-2 shadow-md border border-gray-200 lg:hidden cursor-pointer"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-52 border-r border-gray-200 bg-white flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <h1 className="text-base font-semibold text-[#0e103a] font-machina">Ops Dashboard</h1>
            <p className="text-xs text-gray-500">Edge Patagonia</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 lg:hidden cursor-pointer"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm mb-0.5 ${
                    isActive
                      ? "bg-gray-100 text-[#0e103a] font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-[#0e103a]"
                  }`}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </aside>
    </>
  );
}
