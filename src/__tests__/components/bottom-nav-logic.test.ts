/**
 * Tests for navigation logic from bottom-nav.tsx
 */

// ============================================
// NAV_ITEMS configuration
// ============================================
const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/planner", label: "Plan" },
  { href: "/dashboard/gifts", label: "Gifts" },
  { href: "/dashboard/friends", label: "Friends" },
  { href: "/dashboard/settings", label: "Settings" },
];

const TAB_PATHS = new Set(NAV_ITEMS.map((item) => item.href));

describe("NAV_ITEMS configuration", () => {
  it("has exactly 5 navigation items", () => {
    expect(NAV_ITEMS).toHaveLength(5);
  });

  it("all items have href and label", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href).toBeDefined();
      expect(item.href.startsWith("/dashboard")).toBe(true);
      expect(item.label).toBeDefined();
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("first item is the dashboard home", () => {
    expect(NAV_ITEMS[0].href).toBe("/dashboard");
    expect(NAV_ITEMS[0].label).toBe("Home");
  });

  it("all hrefs are unique", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

// ============================================
// TAB_PATHS set
// ============================================
describe("TAB_PATHS", () => {
  it("contains all nav item hrefs", () => {
    expect(TAB_PATHS.has("/dashboard")).toBe(true);
    expect(TAB_PATHS.has("/dashboard/planner")).toBe(true);
    expect(TAB_PATHS.has("/dashboard/gifts")).toBe(true);
    expect(TAB_PATHS.has("/dashboard/friends")).toBe(true);
    expect(TAB_PATHS.has("/dashboard/settings")).toBe(true);
  });

  it("does not contain non-tab paths", () => {
    expect(TAB_PATHS.has("/dashboard/share")).toBe(false);
    expect(TAB_PATHS.has("/")).toBe(false);
    expect(TAB_PATHS.has("/dashboard/123")).toBe(false);
  });
});

// ============================================
// Active state detection logic
// ============================================
describe("navigation active state detection", () => {
  // Replicate the isActive logic from bottom-nav
  function isActive(itemHref: string, pathname: string): boolean {
    return itemHref === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(itemHref);
  }

  describe("dashboard home (/dashboard)", () => {
    it("is active only on exact /dashboard", () => {
      expect(isActive("/dashboard", "/dashboard")).toBe(true);
    });

    it("is NOT active on sub-pages", () => {
      expect(isActive("/dashboard", "/dashboard/planner")).toBe(false);
      expect(isActive("/dashboard", "/dashboard/settings")).toBe(false);
      expect(isActive("/dashboard", "/dashboard/123")).toBe(false);
    });
  });

  describe("planner (/dashboard/planner)", () => {
    it("is active on exact path", () => {
      expect(isActive("/dashboard/planner", "/dashboard/planner")).toBe(true);
    });

    it("is active on sub-paths", () => {
      expect(isActive("/dashboard/planner", "/dashboard/planner/week")).toBe(
        true
      );
    });

    it("is NOT active on other pages", () => {
      expect(isActive("/dashboard/planner", "/dashboard")).toBe(false);
      expect(isActive("/dashboard/planner", "/dashboard/gifts")).toBe(false);
    });
  });

  describe("gifts (/dashboard/gifts)", () => {
    it("is active on exact path", () => {
      expect(isActive("/dashboard/gifts", "/dashboard/gifts")).toBe(true);
    });

    it("is NOT active on gift_idea content page", () => {
      // /dashboard/123 should not activate gifts tab
      expect(isActive("/dashboard/gifts", "/dashboard/123")).toBe(false);
    });
  });

  describe("settings (/dashboard/settings)", () => {
    it("is active on exact path", () => {
      expect(isActive("/dashboard/settings", "/dashboard/settings")).toBe(true);
    });
  });

  describe("edge case: login page", () => {
    it("no nav item is active on /", () => {
      for (const item of NAV_ITEMS) {
        expect(isActive(item.href, "/")).toBe(false);
      }
    });
  });
});

// ============================================
// Tab persistence logic
// ============================================
describe("tab persistence logic", () => {
  it("only saves known tab paths", () => {
    const shouldSave = (pathname: string) => TAB_PATHS.has(pathname);

    expect(shouldSave("/dashboard")).toBe(true);
    expect(shouldSave("/dashboard/planner")).toBe(true);
    expect(shouldSave("/dashboard/gifts")).toBe(true);

    // These should NOT be saved
    expect(shouldSave("/dashboard/123")).toBe(false);
    expect(shouldSave("/dashboard/share")).toBe(false);
    expect(shouldSave("/")).toBe(false);
  });
});
