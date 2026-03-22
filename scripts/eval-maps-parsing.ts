/**
 * Eval script for Google Maps URL parsing and Gemini analysis.
 *
 * Tests two layers:
 * 1. URL parsing (no API keys needed): extractGoogleMapsPlaceName, isGoogleMapsUrl, etc.
 * 2. End-to-end Gemini analysis (requires GOOGLE_AI_API_KEY): full pipeline test
 *
 * Usage:
 *   # Unit tests only (no API key needed)
 *   npx tsx scripts/eval-maps-parsing.ts
 *
 *   # Full end-to-end with Gemini (needs GOOGLE_AI_API_KEY)
 *   GOOGLE_AI_API_KEY=your-key npx tsx scripts/eval-maps-parsing.ts --e2e
 */

// ---- Import source functions ----
// We re-implement them here to avoid needing the full Next.js build

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

function isGoogleMapsShortUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "maps.app.goo.gl" || hostname === "goo.gl";
  } catch {
    return false;
  }
}

function isGoogleMapsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return (
      isGoogleMapsShortUrl(url) ||
      ((hostname.includes("google.com") || hostname.includes("google.co")) &&
        urlObj.pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

function extractGoogleMapsPlaceName(resolvedUrl: string): string | null {
  try {
    const urlObj = new URL(resolvedUrl);
    if (
      !urlObj.hostname.includes("google.com") &&
      !urlObj.hostname.includes("google.co")
    ) {
      return null;
    }

    // Pattern 1: /maps/place/NAME/@coords
    const placeMatch = urlObj.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    }

    // Pattern 2: /maps/search/NAME
    const searchMatch = urlObj.pathname.match(/\/maps\/search\/([^/@]+)/);
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
    }

    // Pattern 3: ?q=NAME query parameter
    const qParam = urlObj.searchParams.get("q");
    if (qParam && urlObj.pathname.includes("/maps")) {
      return qParam.replace(/\+/g, " ");
    }

    return null;
  } catch {
    return null;
  }
}

// ---- Test cases ----

interface TestCase {
  name: string;
  input: string;
  expected: string | null;
}

const URL_DETECTION_TESTS: { name: string; input: string; expected: boolean }[] =
  [
    {
      name: "Short maps.app.goo.gl URL",
      input: "https://maps.app.goo.gl/cLp65YnSZEWE6cuu5?g_st=ic",
      expected: true,
    },
    {
      name: "Short maps.app.goo.gl URL without params",
      input: "https://maps.app.goo.gl/cLp65YnSZEWE6cuu5",
      expected: true,
    },
    {
      name: "Full Google Maps place URL",
      input:
        "https://www.google.com/maps/place/Central+Park/@40.7829,-73.9654,15z",
      expected: true,
    },
    {
      name: "Google Maps search URL",
      input: "https://www.google.com/maps/search/pizza+near+me",
      expected: true,
    },
    {
      name: "Non-maps Google URL",
      input: "https://www.google.com/search?q=pizza",
      expected: false,
    },
    {
      name: "Random URL",
      input: "https://www.example.com/page",
      expected: false,
    },
    {
      name: "goo.gl short URL",
      input: "https://goo.gl/maps/abc123",
      expected: true,
    },
  ];

const PLACE_EXTRACTION_TESTS: TestCase[] = [
  {
    name: "Standard place URL with coordinates",
    input:
      "https://www.google.com/maps/place/Joe's+Pizza/@40.7308,-73.9973,17z/data=!3m1!4b1",
    expected: "Joe's Pizza",
  },
  {
    name: "Place URL with encoded name",
    input:
      "https://www.google.com/maps/place/Tatiana+by+Kwame+Onwuachi/@40.6655,-73.9629,17z",
    expected: "Tatiana by Kwame Onwuachi",
  },
  {
    name: "Place URL with special characters",
    input:
      "https://www.google.com/maps/place/L'Artusi/@40.7336,-74.0050,17z",
    expected: "L'Artusi",
  },
  {
    name: "Central Park",
    input:
      "https://www.google.com/maps/place/Central+Park/@40.7829,-73.9654,15z/data=!3m1!4b1",
    expected: "Central Park",
  },
  {
    name: "Search URL pattern",
    input: "https://www.google.com/maps/search/best+ramen+in+NYC/@40.7,-74.0,13z",
    expected: "best ramen in NYC",
  },
  {
    name: "Query parameter pattern",
    input: "https://www.google.com/maps?q=Empire+State+Building",
    expected: "Empire State Building",
  },
  {
    name: "Coordinates only (no place name)",
    input: "https://www.google.com/maps/@40.7308,-73.9973,17z",
    expected: null,
  },
  {
    name: "Non-Google URL",
    input: "https://www.yelp.com/biz/joes-pizza-new-york",
    expected: null,
  },
  {
    name: "google.co.uk maps URL",
    input:
      "https://www.google.co.uk/maps/place/Big+Ben/@51.5007,-0.1246,17z",
    expected: "Big Ben",
  },
  {
    name: "URL-encoded place name with %20",
    input:
      "https://www.google.com/maps/place/The%20Smith/@40.7267,-73.9898,17z",
    expected: "The Smith",
  },
];

// ---- Test runner ----

function runUnitTests() {
  console.log("\n=== URL Detection Tests ===\n");
  let passed = 0;
  let failed = 0;

  for (const test of URL_DETECTION_TESTS) {
    const result = isGoogleMapsUrl(test.input);
    const ok = result === test.expected;
    if (ok) {
      passed++;
      console.log(`  ✓ ${test.name}`);
    } else {
      failed++;
      console.log(`  ✗ ${test.name}`);
      console.log(`    Expected: ${test.expected}, Got: ${result}`);
    }
  }

  console.log("\n=== Place Name Extraction Tests ===\n");

  for (const test of PLACE_EXTRACTION_TESTS) {
    const result = extractGoogleMapsPlaceName(test.input);
    const ok = result === test.expected;
    if (ok) {
      passed++;
      console.log(`  ✓ ${test.name}: "${result}"`);
    } else {
      failed++;
      console.log(`  ✗ ${test.name}`);
      console.log(`    Expected: "${test.expected}", Got: "${result}"`);
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  return failed === 0;
}

// ---- E2E test with Gemini (optional) ----

async function runE2ETests() {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.log(
      "\nSkipping E2E tests (set GOOGLE_AI_API_KEY to enable)\n"
    );
    return;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

  const E2E_TEST_CASES = [
    {
      name: "Google Maps short link for a restaurant",
      url: "https://maps.app.goo.gl/cLp65YnSZEWE6cuu5?g_st=ic",
      expectFields: ["title", "location"],
      expectCategory: ["date_idea", "event", "travel"],
    },
  ];

  console.log("\n=== E2E Gemini Analysis Tests ===\n");

  for (const test of E2E_TEST_CASES) {
    console.log(`\nTesting: ${test.name}`);
    console.log(`URL: ${test.url}`);

    // Simulate what the app does: sparse page content + Maps context
    const prompt = `You are an AI assistant that analyzes content to extract useful information.

THIS IS A GOOGLE MAPS LINK. The page content will be sparse because Google Maps is a JavaScript app. You MUST use Google Search to:
1. Search for the original URL "${test.url}" to identify the place
2. Then search for that place by name to find its website, address, hours, menu, and reservation links
3. Categorize this as "date_idea" (for restaurants/bars/cafes) or "event" (for venues) or "travel" (for tourist attractions)

Website URL: ${test.url}
Page description: Google Maps link (original URL: ${test.url}). Use Google Search to look up this URL and find the place name, address, and details.
Site name: Google Maps

Page content (text extracted from HTML):
"""
Google Maps
"""

Return valid JSON with:
{
  "isMultiItem": false,
  "items": [{
    "category": "date_idea" | "event" | "travel",
    "title": "Place Name",
    "data": {
      "location": "Full address",
      "type": "dinner" | "activity" | "entertainment" | "other",
      "description": "Brief description",
      "website": "Official website URL",
      "menu_link": "Menu URL if restaurant",
      "reservation_link": "Reservation URL if applicable",
      "price_range": "$" | "$$" | "$$$" | "$$$$"
    },
    "suggested_tags": ["tag1", "tag2"]
  }]
}

Respond ONLY with valid JSON.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text!;
      console.log(`\nRaw response (first 1000 chars):\n${text.substring(0, 1000)}`);

      // Try to parse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const item = parsed.items?.[0];
        if (item) {
          console.log(`\nParsed result:`);
          console.log(`  Category: ${item.category}`);
          console.log(`  Title: ${item.title}`);
          console.log(`  Location: ${item.data?.location}`);
          console.log(`  Website: ${item.data?.website}`);
          console.log(`  Menu: ${item.data?.menu_link}`);
          console.log(`  Reservation: ${item.data?.reservation_link}`);
          console.log(`  Price range: ${item.data?.price_range}`);
          console.log(`  Tags: ${item.suggested_tags?.join(", ")}`);

          // Validate expected fields
          const missingFields = test.expectFields.filter(
            (f) => !item[f] && !item.data?.[f]
          );
          if (missingFields.length > 0) {
            console.log(`  ⚠ Missing expected fields: ${missingFields.join(", ")}`);
          }

          if (!test.expectCategory.includes(item.category)) {
            console.log(
              `  ⚠ Unexpected category: ${item.category} (expected one of: ${test.expectCategory.join(", ")})`
            );
          }

          // Check if we got a real place name (not just "Google Maps Location")
          if (
            item.title === "Google Maps Location" ||
            item.title === "Google Maps" ||
            !item.title
          ) {
            console.log(`  ✗ FAILED: Gemini didn't identify the place`);
          } else {
            console.log(`  ✓ SUCCESS: Identified as "${item.title}"`);
          }
        } else {
          console.log(`  ✗ FAILED: No items in response`);
        }
      } else {
        console.log(`  ✗ FAILED: No JSON in response`);
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error}`);
    }
  }
}

// ---- Main ----

async function main() {
  const allPassed = runUnitTests();

  if (process.argv.includes("--e2e")) {
    await runE2ETests();
  } else {
    console.log(
      "Tip: Run with --e2e and GOOGLE_AI_API_KEY to test Gemini analysis"
    );
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
