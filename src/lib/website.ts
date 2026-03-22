// Website scraper for extracting content from generic web pages

export interface WebsiteInfo {
  url: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  pageContent?: string;
  structuredData?: Record<string, unknown>;
  siteName?: string;
}

// Helper to decode HTML entities
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

// Extract text content from HTML, removing scripts/styles
function extractTextContent(html: string): string {
  // Remove script and style tags and their contents
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = decodeHTMLEntities(text);

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate to reasonable length for AI processing (about 10k chars)
  if (text.length > 10000) {
    text = text.substring(0, 10000) + "...";
  }

  return text;
}

// Extract Open Graph and meta tags
function extractMetaTags(html: string): {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
} {
  const result: {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  } = {};

  // Try og:title first, then regular title
  const ogTitle =
    html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
  if (ogTitle) {
    result.title = decodeHTMLEntities(ogTitle[1]);
  } else {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag) {
      result.title = decodeHTMLEntities(titleTag[1]);
    }
  }

  // Try og:description first, then meta description
  const ogDescription =
    html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
  if (ogDescription) {
    result.description = decodeHTMLEntities(ogDescription[1]);
  } else {
    const metaDescription =
      html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) ||
      html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/);
    if (metaDescription) {
      result.description = decodeHTMLEntities(metaDescription[1]);
    }
  }

  // Get og:image
  const ogImage =
    html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);
  if (ogImage) {
    result.image = ogImage[1];
  }

  // Get og:site_name
  const ogSiteName =
    html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]*)"/) ||
    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:site_name"/);
  if (ogSiteName) {
    result.siteName = decodeHTMLEntities(ogSiteName[1]);
  }

  return result;
}

// Extract JSON-LD structured data (Schema.org)
function extractStructuredData(html: string): Record<string, unknown> | null {
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);

      // Handle @graph arrays (multiple schema objects)
      if (data["@graph"] && Array.isArray(data["@graph"])) {
        // Look for Recipe, Restaurant, or other useful types
        for (const item of data["@graph"]) {
          if (
            item["@type"] === "Recipe" ||
            item["@type"] === "Restaurant" ||
            item["@type"] === "LocalBusiness" ||
            item["@type"] === "Product"
          ) {
            return item;
          }
        }
        // Return the first item if no specific type found
        if (data["@graph"].length > 0) {
          return data["@graph"][0];
        }
      }

      // Direct schema object
      if (data["@type"]) {
        return data;
      }
    } catch {
      // Invalid JSON, continue to next match
    }
  }

  return null;
}

// Main function to scrape a website
export async function getWebsiteInfo(url: string): Promise<WebsiteInfo> {
  console.log(`Scraping website: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.error(`Failed to fetch website: ${response.status}`);
      return {
        url,
        title: "Website content",
        description: `Content from ${new URL(url).hostname}`,
      };
    }

    const html = await response.text();

    // Extract metadata
    const meta = extractMetaTags(html);

    // Extract structured data (JSON-LD)
    const structuredData = extractStructuredData(html);

    // Extract text content for AI analysis
    const pageContent = extractTextContent(html);

    // Build the result
    const result: WebsiteInfo = {
      url,
      title: meta.title,
      description: meta.description,
      thumbnailUrl: meta.image,
      siteName: meta.siteName,
      pageContent,
    };

    // Add structured data if found
    if (structuredData) {
      result.structuredData = structuredData;

      // If it's a recipe, extract key info
      if (structuredData["@type"] === "Recipe") {
        const recipe = structuredData as Record<string, unknown>;
        if (!result.title && recipe.name) {
          result.title = recipe.name as string;
        }
        if (!result.description && recipe.description) {
          result.description = recipe.description as string;
        }
        if (!result.thumbnailUrl && recipe.image) {
          // Image can be a string, array, or object
          const image = recipe.image;
          if (typeof image === "string") {
            result.thumbnailUrl = image;
          } else if (Array.isArray(image)) {
            result.thumbnailUrl =
              typeof image[0] === "string" ? image[0] : image[0]?.url;
          } else if (typeof image === "object" && image !== null) {
            result.thumbnailUrl = (image as { url?: string }).url;
          }
        }
      }

      // If it's a restaurant/local business, extract key info
      if (
        structuredData["@type"] === "Restaurant" ||
        structuredData["@type"] === "LocalBusiness"
      ) {
        const business = structuredData as Record<string, unknown>;
        if (!result.title && business.name) {
          result.title = business.name as string;
        }
        if (!result.description && business.description) {
          result.description = business.description as string;
        }
        if (!result.thumbnailUrl && business.image) {
          const image = business.image;
          if (typeof image === "string") {
            result.thumbnailUrl = image;
          } else if (Array.isArray(image)) {
            result.thumbnailUrl =
              typeof image[0] === "string" ? image[0] : image[0]?.url;
          }
        }
      }
    }

    console.log("Website info extracted:", {
      title: result.title?.substring(0, 50),
      hasDescription: !!result.description,
      hasThumbnail: !!result.thumbnailUrl,
      hasStructuredData: !!structuredData,
      contentLength: pageContent?.length,
    });

    return result;
  } catch (error) {
    console.error("Failed to scrape website:", error);
    return {
      url,
      title: "Website content",
      description: `Content from ${new URL(url).hostname}`,
    };
  }
}

// Check if a URL is a Google Maps link
export function isGoogleMapsUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const pathname = new URL(url).pathname.toLowerCase();
    return (
      (hostname.includes("google.com") && pathname.startsWith("/maps")) ||
      hostname === "maps.google.com" ||
      hostname === "maps.app.goo.gl" ||
      (hostname === "goo.gl" && pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

// Parse a Google Maps URL to extract place name and/or coordinates
export function parseGoogleMapsUrl(url: string): {
  placeName?: string;
  coordinates?: { lat: number; lng: number };
  query?: string;
} {
  const result: {
    placeName?: string;
    coordinates?: { lat: number; lng: number };
    query?: string;
  } = {};

  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);

    // Format: /maps/place/Place+Name/... or /maps/place/Place+Name/@lat,lng,...
    const placeMatch = pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      result.placeName = placeMatch[1].replace(/\+/g, " ");
    }

    // Extract coordinates from @lat,lng,zoom pattern
    const coordMatch = pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      result.coordinates = {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
    }

    // Format: ?q=place+name or &query=place+name
    const query =
      parsed.searchParams.get("q") || parsed.searchParams.get("query");
    if (query) {
      result.query = query;
      // If query looks like coordinates, parse them
      const queryCoordMatch = query.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (queryCoordMatch) {
        result.coordinates = {
          lat: parseFloat(queryCoordMatch[1]),
          lng: parseFloat(queryCoordMatch[2]),
        };
      } else if (!result.placeName) {
        result.placeName = query;
      }
    }

    // Format: /maps/search/Place+Name/
    const searchMatch = pathname.match(/\/maps\/search\/([^/@]+)/);
    if (searchMatch && !result.placeName) {
      result.placeName = searchMatch[1].replace(/\+/g, " ");
    }
  } catch {
    // ignore parse errors
  }

  return result;
}

// Check if a URL is a generic website (not social media)
export function isGenericWebsiteUrl(url: string): boolean {
  const socialMediaDomains = [
    "tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
    "instagram.com",
    "instagr.am",
    "facebook.com",
    "fb.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
  ];

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return !socialMediaDomains.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

