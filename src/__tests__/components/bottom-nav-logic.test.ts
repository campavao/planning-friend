/**
 * Tests for navigation logic from bottom-nav.tsx
 * Imports real exports — no duplicated logic
 */

import { NAV_ITEMS, isNavItemActive } from "@/components/bottom-nav";

// ============================================
// NAV_ITEMS configuration
// ============================================
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
// isNavItemActive
// ============================================
describe("isNavItemActive", () => {
  describe("dashboard home (/dashboard)", () => {
    it("is active on exact /dashboard", () => {
      expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    });

    it("stays active on the collection, which has no tab of its own", () => {
      expect(isNavItemActive("/dashboard", "/dashboard/collection")).toBe(true);
    });

    it("is NOT active on sub-pages that own a tab or a detail view", () => {
      expect(isNavItemActive("/dashboard", "/dashboard/planner")).toBe(false);
      expect(isNavItemActive("/dashboard", "/dashboard/settings")).toBe(false);
      expect(isNavItemActive("/dashboard", "/dashboard/123")).toBe(false);
    });
  });

  describe("planner (/dashboard/planner)", () => {
    it("is active on exact path", () => {
      expect(isNavItemActive("/dashboard/planner", "/dashboard/planner")).toBe(true);
    });

    it("is active on sub-paths", () => {
      expect(isNavItemActive("/dashboard/planner", "/dashboard/planner/week")).toBe(true);
    });

    it("is NOT active on other pages", () => {
      expect(isNavItemActive("/dashboard/planner", "/dashboard")).toBe(false);
      expect(isNavItemActive("/dashboard/planner", "/dashboard/gifts")).toBe(false);
    });
  });

  describe("gifts (/dashboard/gifts)", () => {
    it("is active on exact path", () => {
      expect(isNavItemActive("/dashboard/gifts", "/dashboard/gifts")).toBe(true);
    });

    it("is NOT active on unrelated content pages", () => {
      expect(isNavItemActive("/dashboard/gifts", "/dashboard/123")).toBe(false);
    });
  });

  describe("edge case: login page", () => {
    it("no nav item is active on /", () => {
      for (const item of NAV_ITEMS) {
        expect(isNavItemActive(item.href, "/")).toBe(false);
      }
    });
  });
});
