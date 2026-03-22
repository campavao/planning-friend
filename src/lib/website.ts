// Website scraper for extracting content from generic web pages

export interface WebsiteInfo {
  url: string;
  resolvedUrl?: string;
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

// Check if a URL is a Google Maps short link
export function isGoogleMapsShortUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "maps.app.goo.gl" || hostname === "goo.gl";
  } catch {
    return false;
  }
}

// Check if a URL is any Google Maps URL (short or full)
export function isGoogleMapsUrl(url: string): boolean {
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

// Extract place name from a resolved Google Maps URL
// Handles multiple URL patterns:
//   /maps/place/Joe's+Pizza/@40.73,-73.99,...
//   /maps?q=Joe's+Pizza
//   /maps/search/Joe's+Pizza
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

    // Capture the resolved URL after redirects (important for short URLs like maps.app.goo.gl)
    const resolvedUrl = response.url;

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

    // Try to extract place name from the resolved URL (or original if it's a full Maps URL)
    const urlToCheck = resolvedUrl !== url ? resolvedUrl : url;
    const mapsPlaceName = extractGoogleMapsPlaceName(urlToCheck);

    // When a shortened URL redirected, enrich sparse metadata with info
    // from the resolved URL so downstream AI analysis has useful context
    if (resolvedUrl !== url) {
      console.log(`URL redirected: ${url} -> ${resolvedUrl}`);

      // Google Maps: extract the place name from the URL path
      if (mapsPlaceName) {
        console.log(`Google Maps place detected: "${mapsPlaceName}"`);
        if (!meta.title || meta.title === "Google Maps") {
          meta.title = mapsPlaceName;
        }
        if (
          !meta.description ||
          meta.description.startsWith("Find local businesses")
        ) {
          meta.description = `Google Maps link for: ${mapsPlaceName}`;
        }
      }

      // For any shortened link with sparse page content, note the final
      // destination so the AI has something meaningful to search for
      if (!pageContent || pageContent.length < 100) {
        const resolvedHost = new URL(resolvedUrl).hostname;
        if (!meta.title) {
          meta.title = `Content from ${resolvedHost}`;
        }
        if (!meta.description) {
          meta.description = `Redirected to: ${resolvedUrl}`;
        }
      }
    }

    // For Google Maps URLs (short or full), always ensure we pass useful context
    // even if the page content is sparse (Maps is a JS app with minimal HTML)
    if (isGoogleMapsUrl(url) || isGoogleMapsUrl(resolvedUrl)) {
      const effectiveTitle = mapsPlaceName || meta.title;
      if (!effectiveTitle || effectiveTitle === "Google Maps") {
        // No place name extracted - tell downstream to search the original URL
        meta.title = "Google Maps Location";
        meta.description = `Google Maps link (original URL: ${url}). Use Google Search to look up this URL and find the place name, address, and details.`;
      }
      // Mark as Google Maps in siteName so downstream can handle appropriately
      if (!meta.siteName) {
        meta.siteName = "Google Maps";
      }
    }

    // Build the result
    const result: WebsiteInfo = {
      url,
      resolvedUrl: resolvedUrl !== url ? resolvedUrl : undefined,
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

    // If this is a Google Maps URL that failed to fetch, provide useful context
    // so Gemini can still look up the place via Google Search
    if (isGoogleMapsShortUrl(url) || isGoogleMapsUrl(url)) {
      console.log(
        "Google Maps URL failed to fetch, providing search context for AI"
      );
      return {
        url,
        title: "Google Maps Location",
        description: `Google Maps link (original URL: ${url}). The page could not be fetched directly. Use Google Search to look up this URL and find the place name, address, hours, website, and other details.`,
        siteName: "Google Maps",
      };
    }

    return {
      url,
      title: "Website content",
      description: `Content from ${new URL(url).hostname}`,
    };
  }
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

