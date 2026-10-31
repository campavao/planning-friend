"use client";

import { Calendar, Gift, Home, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { useTabPrefetch } from "@/hooks/useTabPrefetch";

export const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/planner", icon: Calendar, label: "Plan" },
  { href: "/dashboard/gifts", icon: Gift, label: "Gifts" },
  { href: "/dashboard/friends", icon: Users, label: "Friends" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

// Pages that sit under Home in the IA but have no tab of their own, so Home
// stays lit while you're on them.
const HOME_CHILD_PATHS = new Set(["/dashboard/collection"]);

// Determine if a nav item is active based on pathname
export function isNavItemActive(itemHref: string, pathname: string): boolean {
  return itemHref === "/dashboard"
    ? pathname === "/dashboard" || HOME_CHILD_PATHS.has(pathname)
    : pathname.startsWith(itemHref);
}

// Screens that stand alone: sign-in, and the status page the share sheet lands
// on, which is a moment between apps rather than a place in this one.
const NO_NAV_PATHS = new Set(["/", "/dashboard/share"]);

export function showsBottomNav(pathname: string | null): boolean {
  return !NO_NAV_PATHS.has(pathname ?? "");
}

export function BottomNav() {
  const pathname = usePathname();

  // Warm the other tabs' data once we're on the dashboard, so switching tabs
  // is instant instead of showing a full-screen spinner each time.
  useTabPrefetch(!!pathname?.startsWith("/dashboard"));

  // Slides away while scrolling down and back on the first scroll up. Keyed
  // on the path so every page arrives with the nav showing.
  const hidden = useHideOnScroll(pathname);

  // Opening the app always lands on Home. It used to restore the last tab you
  // were on, which meant a fresh open rendered Home and then navigated away
  // from it — the app visibly built itself twice.

  if (!showsBottomNav(pathname)) return null;

  return (
    <nav
      className="md:hidden fixed left-0 right-0 z-40 ios-fixed-bottom transition-transform duration-300 ease-out motion-reduce:transition-none"
      style={{
        bottom: 0,
        // Still a 3D transform when hidden: the translate3d is the iOS fix
        // for fixed elements jumping during scroll, so it can't be dropped.
        WebkitTransform: `translate3d(0,${hidden ? "100%" : "0"},0)`,
        transform: `translate3d(0,${hidden ? "100%" : "0"},0)`,
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="bg-white/95 backdrop-blur-lg border-t border-[var(--border)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center px-2 py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item.href, pathname);
            // Tapping the tab you're already on is a no-op. It used to
            // re-navigate to the bare path, which scrolled the planner back to
            // the top and let its scroll-spy rewrite the focused date — so
            // tapping Plan while on Plan moved you off the week you were
            // reading. Compared against the exact path, not isActive, so Home
            // still works from the collection page underneath it.
            const isCurrent = pathname === item.href;

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                onClick={(e) => {
                  if (isCurrent) e.preventDefault();
                }}
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
