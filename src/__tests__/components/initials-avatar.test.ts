import { initialsFor, toneFor } from "@/components/initials-avatar";

describe("initialsFor", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFor("Andra Patel")).toBe("AP");
    expect(initialsFor("Mary Jane Watson")).toBe("MJ");
  });

  it("uses one letter for a one-word name, uppercased", () => {
    expect(initialsFor("mom")).toBe("M");
  });

  it("ignores extra whitespace", () => {
    expect(initialsFor("  Jordan   Kim ")).toBe("JK");
  });

  it("returns nothing for a blank name", () => {
    expect(initialsFor("   ")).toBe("");
  });
});

describe("toneFor", () => {
  it("is stable for the same name", () => {
    expect(toneFor("Andra")).toBe(toneFor("Andra"));
  });

  it("spreads names across more than one tone", () => {
    const names = ["Andra", "Mom", "Jordan", "Priya", "Theo", "Sam", "Dad"];
    expect(new Set(names.map(toneFor)).size).toBeGreaterThan(1);
  });
});
