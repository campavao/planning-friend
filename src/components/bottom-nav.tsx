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

// The capsule's shadow reaches 16px above it (8px offset, 24px blur); hiding by
// exactly 100% would leave that strip on screen.
const HIDDEN_OFFSET = "calc(100% + 24px)";

/** Whether tapping a tab you're already on scrolls its page back to the top. */
export function scrollsToTopOnRetap(href: string): boolean {
  return href !== "/dashboard/planner";
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
      className="md:hidden fixed left-0 right-0 z-40 ios-fixed-bottom px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none transition-transform duration-300 ease-out motion-reduce:transition-none"
      style={{
        bottom: 0,
        // Still a 3D transform when hidden: the translate3d is the iOS fix
        // for fixed elements jumping during scroll, so it can't be dropped.
        // Past its own height by the shadow's reach, or the shadow is left
        // behind as a grey band along the bottom edge.
        WebkitTransform: `translate3d(0,${hidden ? HIDDEN_OFFSET : "0"},0)`,
        transform: `translate3d(0,${hidden ? HIDDEN_OFFSET : "0"},0)`,
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      {/* A floating capsule rather than a full-width slab: it reads as one
          more raised control, like every button in the app, and sits clear of
          the home indicator instead of stretching under it. Only the capsule
          takes taps; the gutters around it let them through to the page. */}
      <div className="pointer-events-auto mx-auto flex max-w-md items-center rounded-full border border-white/70 bg-white/90 p-1.5 shadow-[0_8px_24px_rgba(45,52,54,0.14),0_1px_3px_rgba(45,52,54,0.1)] backdrop-blur-xl">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(item.href, pathname);
          // Tapping the tab you're already on doesn't re-navigate. It used to
          // re-navigate to the bare path, which on the planner let its
          // scroll-spy rewrite the focused date. Compared against the exact
          // path, not isActive, so Home still works from the collection page
          // underneath it.
          const isCurrent = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              data-active={isActive || undefined}
              onClick={(e) => {
                if (!isCurrent) return;
                e.preventDefault();
                // The iOS convention: tapping the open tab goes back to the
                // top. Not on the planner, where the top is weeks in the past
                // and the scroll position is the week you were reading.
                if (scrollsToTopOnRetap(item.href)) {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`nav-tab flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 ${
                isActive
                  ? "bg-[var(--primary)]/12 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              <Icon
                className="nav-tab-icon size-[22px]"
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              <span
                className={`text-[11px] leading-tight ${
                  isActive ? "font-semibold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
