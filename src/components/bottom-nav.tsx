"use client";

import { Calendar, Gift, Home, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/planner", icon: Calendar, label: "Plan" },
  { href: "/dashboard/gifts", icon: Gift, label: "Gifts" },
  { href: "/dashboard/friends", icon: Users, label: "Friends" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export const TAB_PATHS = new Set(NAV_ITEMS.map((item) => item.href));

// Determine if a nav item is active based on pathname
export function isNavItemActive(itemHref: string, pathname: string): boolean {
  return itemHref === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(itemHref);
}

export function BottomNav() {
  const pathname = usePathname();

  // Save current tab to localStorage for persistence across app restarts
  useEffect(() => {
    if (pathname && TAB_PATHS.has(pathname)) {
      try {
        localStorage.setItem("lastTab", pathname);
      } catch {
        // Ignore storage errors
      }
    }
  }, [pathname]);

  // Don't show on login page
  if (pathname === "/") return null;

  return (
    <nav
      className="md:hidden fixed left-0 right-0 z-40 ios-fixed-bottom"
      style={{
        bottom: 0,
        WebkitTransform: "translate3d(0,0,0)",
        transform: "translate3d(0,0,0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="bg-white/95 backdrop-blur-lg border-t border-[var(--border)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center px-2 py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item.href, pathname);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item flex-1"
              >
                <div
                  className={`nav-icon ${
                    isActive
                      ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] shadow-md"
                      : ""
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? "text-white" : "text-[var(--muted-foreground)]"
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isActive
                      ? "text-[var(--primary)]"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area padding for notched phones */}
        <div className="safe-area-bottom bg-white/95" />
      </div>
    </nav>
  );
}
