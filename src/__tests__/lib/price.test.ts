import { displayPrice } from "@/lib/price";

describe("displayPrice", () => {
  it("keeps real prices", () => {
    expect(displayPrice("$129.95")).toBe("$129.95");
    expect(displayPrice(" $$ ")).toBe("$$");
    expect(displayPrice("€40")).toBe("€40");
    expect(displayPrice("Under 20")).toBe("Under 20");
    expect(displayPrice("Free")).toBe("Free");
  });

  it("drops the model's placeholders", () => {
    expect(displayPrice("Not mentioned")).toBeUndefined();
    expect(displayPrice("Not explicitly mentioned")).toBeUndefined();
    expect(displayPrice("Unknown")).toBeUndefined();
    expect(displayPrice("N/A")).toBeUndefined();
    expect(displayPrice("Varies")).toBeUndefined();
  });

  it("drops placeholders that happen to carry a figure", () => {
    expect(
      displayPrice("Price not mentioned (includes $25 McDonald's gift card)")
    ).toBeUndefined();
    expect(displayPrice("Not specified, around $20")).toBeUndefined();
    expect(displayPrice("$15–$40, varies by size")).toBeUndefined();
  });

  it("drops a sentence about the price", () => {
    expect(
      displayPrice("About $30 at most stores, more online")
    ).toBeUndefined();
  });

  it("keeps ranges and approximations", () => {
    expect(displayPrice("$15–$40")).toBe("$15–$40");
    expect(displayPrice("~$20")).toBe("~$20");
  });

  it("drops empty and non-string values", () => {
    expect(displayPrice("   ")).toBeUndefined();
    expect(displayPrice(undefined)).toBeUndefined();
    expect(displayPrice(42)).toBeUndefined();
  });
});
