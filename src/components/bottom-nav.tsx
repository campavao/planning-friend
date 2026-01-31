"use client";

import { Calendar, Gift, Home, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/planner", icon: Calendar, label: "Plan" },
  { href: "/dashboard/gifts", icon: Gift, label: "Gifts" },
  { href: "/dashboard/friends", icon: Users, label: "Friends" },
  { href: "/dashboard/settings", icon: Settings, label: "Config" },
];

export function BottomNav() {
  const pathname = usePathname();

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
      <div className="bg-card border-t-[3px] border-border">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center py-3 border-r-[3px] border-border last:border-r-0 transition-colors ${
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-card text-foreground hover:bg-accent"
                }`}
              >
                <Icon
                  className={`w-6 h-6 mb-1 ${isActive ? "stroke-[2.5px]" : "stroke-[2px]"}`}
                />
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area padding for notched phones */}
        <div className="safe-area-bottom bg-card" />
      </div>
    </nav>
  );
}
