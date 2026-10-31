import { shortDuration } from "@/lib/short-duration";

describe("shortDuration", () => {
  it.each([
    ["15 minutes", "15 min"],
    ["1 minute", "1 min"],
    ["40 mins", "40 min"],
    ["1 hour 30 minutes", "1 hr 30 min"],
    ["2 hours and 15 minutes", "2 hr 15 min"],
    ["Less than 10 minutes", "<10 min"],
    ["Under 5 minutes", "<5 min"],
    ["About 20 minutes", "~20 min"],
    ["30 seconds", "30 sec"],
  ])("shortens %s to %s", (input, expected) => {
    expect(shortDuration(input)).toBe(expected);
  });

  it("leaves values it doesn't recognise as they were", () => {
    expect(shortDuration("Overnight")).toBe("Overnight");
    expect(shortDuration("10 min")).toBe("10 min");
  });
});
