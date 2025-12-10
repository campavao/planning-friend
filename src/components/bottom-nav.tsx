"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "Home" },
  { href: "/dashboard/planner", icon: "📅", label: "Plan" },
  { href: "/dashboard/gifts", icon: "🎁", label: "Gifts" },
  { href: "/dashboard/friends", icon: "👥", label: "Friends" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === "/") return null;

  return (
    <nav
      // z-40 to be below modals
      className="md:hidden fixed left-0 right-0 z-40 px-4 ios-fixed-bottom"
      style={{
        bottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        WebkitTransform: "translate3d(0,0,0)",
        transform: "translate3d(0,0,0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-lg shadow-black/10 border border-border/50 mx-auto max-w-sm">
        <div className="flex justify-around items-center py-2 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <span
                  className={`text-2xl mb-0.5 ${
                    isActive ? "animate-float" : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    isActive ? "text-primary" : ""
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
