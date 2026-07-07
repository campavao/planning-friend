import { decodeHTMLEntities } from "@/lib/scrape";

describe("decodeHTMLEntities", () => {
  it("decodes the common named entities", () => {
    expect(decodeHTMLEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHTMLEntities("&lt;div&gt;")).toBe("<div>");
    expect(decodeHTMLEntities("say &quot;hi&quot;")).toBe('say "hi"');
  });

  it("decodes apostrophe and slash escapes", () => {
    expect(decodeHTMLEntities("it&#39;s")).toBe("it's");
    expect(decodeHTMLEntities("it&#x27;s")).toBe("it's");
    expect(decodeHTMLEntities("a&#x2F;b")).toBe("a/b");
  });

  it("decodes non-breaking spaces (from the website scraper)", () => {
    expect(decodeHTMLEntities("a&nbsp;b")).toBe("a b");
  });

  it("decodes generic numeric entities (from the instagram scraper)", () => {
    // &#233; = é, &#x2764; = ❤
    expect(decodeHTMLEntities("caf&#233;")).toBe("café");
    expect(decodeHTMLEntities("love &#x2764;")).toBe("love ❤");
  });

  it("leaves plain text untouched", () => {
    expect(decodeHTMLEntities("plain text")).toBe("plain text");
  });

  it("handles multiple mixed entities in one string", () => {
    expect(decodeHTMLEntities("a &amp; b &lt; c&nbsp;&#233;")).toBe(
      "a & b < c é"
    );
  });
});
