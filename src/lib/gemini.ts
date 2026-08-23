import { GoogleGenAI, type Part } from "@google/genai";
import type {
  ContentCategory,
  DateIdeaData,
  DrinkData,
  EventData,
  GiftIdeaData,
  MealData,
  TravelData,
} from "./supabase";
import { GEMINI_MODEL } from "./gemini-model";
import { readPlants } from "./plants";
import { RECIPE_EFFORTS, SPICE_LEVELS } from "./schemas/content";

export interface AnalysisResult {
  category: ContentCategory;
  title: string;
  data:
    | MealData
    | EventData
    | DateIdeaData
    | GiftIdeaData
    | TravelData
    | DrinkData
    | Record<string, unknown>;
  suggested_tags?: string[];
}

export interface MultiItemAnalysisResult {
  items: AnalysisResult[];
  isMultiItem: boolean;
}

const ANALYSIS_PROMPT = `You are an AI assistant that analyzes content (videos, images, or web pages) to extract and categorize useful information.

Analyze this content and determine what category it belongs to:

1. **meal** - A recipe, cooking tutorial, or FOOD-related content (not drinks/beverages)
2. **drink** - A cocktail, mocktail, smoothie, coffee drink, or any BEVERAGE recipe
3. **event** - An event, festival, concert, show, or time-limited happening
4. **date_idea** - A date night idea, place to visit, restaurant recommendation, or activity suggestion
5. **gift_idea** - A product, item, or gift recommendation that could be purchased
6. **travel** - Content about a place/destination that appears to be travel/tourism related (famous landmarks, tourist attractions, vacation spots, international destinations)
7. **other** - Content that doesn't fit the above categories

**IMPORTANT - drink vs meal distinction:**
- If the content is primarily about making a BEVERAGE (cocktail, smoothie, coffee, tea, etc.), categorize it as **drink**
- If the content is primarily about FOOD (even if drinks are mentioned), categorize it as **meal**

**IMPORTANT - Multi-Item Detection:**
If the content contains a LIST of items (e.g., "Top 5 restaurants", "3 best gifts", "My favorite spots in NYC"), extract EACH item separately and return them as an array.

**IMPORTANT - Website Content:**
When analyzing a website/webpage:
- For RECIPE pages: Extract full ingredients list (with quantities), step-by-step instructions, prep/cook times, and servings. This is the PRIMARY source - prefer data from the page over inferences.
- For RESTAURANT pages: Extract the location/address, hours, phone number, reservation links (OpenTable, Resy, etc.), menu links, and cuisine type.
- For PRODUCT pages: Extract the product name, price, purchase link, and description.
- Look for structured data (Schema.org/JSON-LD) in the provided content for accurate information.

Based on the category, extract the relevant information:

For **meal**:
- title: Name of the dish/recipe
- recipe: Step-by-step cooking instructions (array of strings)
- ingredients: List of ingredients with quantities if mentioned (array of strings)
- equipment: Appliances, pots, bowls and utensils needed (array of strings, e.g. ["Slow cooker", "Spatula", "Small bowl"]). Only what the cook must have on hand — do not list the ingredients again.
- prep_time: Preparation time if mentioned
- cook_time: Cooking time if mentioned
- servings: Number of servings if mentioned
- effort: One of "easy", "medium", "hard" — how demanding the recipe is to make
- spice: One of "none", "mild", "medium", "hot" — how spicy the finished dish is
- plants: See the PLANTS section below

For **drink**, also extract:
- equipment: Glassware, shakers and tools needed (array of strings)

**PLANTS (meal only):**
List the distinct plants the recipe contains. This feeds a dietary-diversity
score, so the rules are about botanical identity, not about how the ingredient
is written on the label.

Each entry is an object:
- source: the plant the ingredient comes from, lowercase and singular (e.g. "wheat", "soybean", "garlic")
- name: what the recipe actually calls it, if different from the source (e.g. "egg noodles")
- category: exactly one of "vegetable", "fruit", "whole_grain", "legume", "nut", "seed"

Rules, in order of importance:
1. Resolve every ingredient to its SOURCE PLANT. Egg noodles, bread, pasta and
   plain flour are all source "wheat". Tofu and edamame are both "soybean".
2. One ingredient can yield MORE THAN ONE plant. Soy sauce is made from
   soybeans and wheat, so it produces two entries: source "soybean" and source
   "wheat".
3. Two ingredients can collapse to ONE plant. A recipe with both soy sauce and
   egg noodles lists wheat only once — do not repeat a source.
4. Do NOT include herbs or spices. Basil, oregano, cinnamon, pepper, chilli
   flakes and similar seasonings are excluded entirely, and there is no
   category for them.
5. Do NOT include anything that is not a plant: meat, fish, eggs, dairy, honey,
   salt and water.
6. Do NOT include EXTRACTS pressed, refined or brewed out of a plant, even
   though they are named after one. Cooking oils (olive, sesame, sunflower,
   canola), vinegars, refined sugar, syrups, and anything fermented or
   distilled into alcohol (wine, champagne, beer, cider, spirits) all carry a
   plant's name without carrying the plant. Sesame seeds count; sesame oil does
   not. Olives count; olive oil does not. Grapes count; champagne and wine
   vinegar do not.
7. Varieties of the same plant share a source. Red onion and yellow onion are
   both source "onion".

Example — for a slow cooker honey garlic chicken noodle recipe using soy sauce,
brown sugar, garlic, scallions, sesame oil, chicken thighs and egg noodles:
[
  {"source": "soybean", "name": "soy sauce", "category": "legume"},
  {"source": "wheat", "name": "egg noodles", "category": "whole_grain"},
  {"source": "garlic", "category": "vegetable"},
  {"source": "scallion", "category": "vegetable"}
]
(Chicken is not a plant. Brown sugar and sesame oil are extracts, not whole
foods — toasted sesame SEEDS would have counted. The wheat in the soy sauce is
the same wheat as the noodles, so it appears once.)

For **event**:
- title: Name of the event
- location: Where the event is taking place
- date: Date of the event if mentioned
- time: Time of the event if mentioned
- requires_reservation: true/false
- requires_ticket: true/false
- ticket_link: URL to buy tickets if mentioned
- description: Brief description of the event
- website: Official website URL. Find it, do not guess it — see LINKS below.
- reservation_link: URL to make reservations (OpenTable, Resy, etc.) if applicable
- image_url: A photo URL of the venue/event (use Google Search to find one if not available in the page content)

For **date_idea**:
- title: Name of the place or activity
- location: Where it is located (full address if possible, otherwise city or general area)
- type: One of "dinner", "activity", "entertainment", "outdoors", "other"
- price_range: One of "$", "$$", "$$$", "$$$$" if you can estimate
- description: Brief description of why it's a good date idea
- website: Official website URL. Find it, do not guess it — see LINKS below.
- menu_link: Link to the menu if it's a restaurant (use Google Search to find it - often /menu on the restaurant's website, or on services like Yelp)
- reservation_link: URL to make reservations if applicable (search for the business on OpenTable, Resy, etc.)
- image_url: A photo URL of the place (use Google Search to find one if not available in the page content)

For **gift_idea**:
- title: Name of the product/item
- name: Full product name
- cost: Price or price range if mentioned (e.g., "$29.99" or "$20-50")
- purchase_link: Direct link to purchase if mentioned
- amazon_link: Amazon search URL for the product (construct as: https://www.amazon.com/s?k=PRODUCT+NAME)
- description: Brief description of the product and why it makes a good gift

For **drink**:
- title: Name of the drink/cocktail
- recipe: Step-by-step instructions to make the drink (array of strings)
- ingredients: List of ingredients with quantities (array of strings)
- type: One of "cocktail", "mocktail", "coffee", "smoothie", "wine", "beer", "other"
- prep_time: How long it takes to make
- description: Brief description of the drink
- difficulty: One of "easy", "medium", "hard"

For **travel**:
- title: Name of the place/attraction
- location: Where it is located (city, country)
- type: One of "restaurant", "attraction", "hotel", "activity", "other"
- description: Brief description of why it's worth visiting
- website: Official website URL. Find it, do not guess it — see LINKS below.
- booking_link: Link to book/reserve if applicable
- price_range: One of "$", "$$", "$$$", "$$$$" if you can estimate
- destination_city: The city name
- destination_country: The country name
- image_url: A photo URL of the place (use Google Search to find one if not available in the page content)

For **other**:
- title: Brief description of the content
- description: Summary of what the content is about

**LINKS — where a URL is allowed to come from:**

Write a URL into website, ticket_link, menu_link, reservation_link,
booking_link or purchase_link only if you have actually seen it. "Seen it"
means one of:
- it is written in the caption, on a slide, or in the page content
- it is the link in the creator's profile/bio
- it appeared in a Google Search result you ran

**Never build a URL out of the name.** A festival called "The Great American
Lobster Fest" is not evidence that lobsterfest.com exists — that guess reads as
a real answer and lands the reader on a dead domain, which is worse than the
field being empty. If you cannot find the link, leave the field out entirely.

amazon_link is the one exception: it is a search URL, built on purpose.

**Tags (for ALL categories):**
Also suggest 2-5 relevant tags for each item. Choose from these common tags or suggest similar ones:
- Meal tags: quick, slow-cooker, breakfast, lunch, dinner, appetizer, dessert, snack, healthy, comfort-food, vegetarian, vegan, gluten-free, meal-prep, one-pot, grilling, baking, no-cook
- Event tags: free, outdoor, indoor, family-friendly, 21+, music, art, sports, seasonal, holiday, weekend
- Date/Activity tags: romantic, adventurous, budget, splurge, outdoor, indoor, foodie, cultural, active, relaxing
- Gift tags: budget, splurge, tech, fashion, home, personalized, experience, practical
- General tags: seasonal, party, date-night, weeknight, special-occasion, trending

**Response Format:**

For a SINGLE item, respond with:
{
  "isMultiItem": false,
  "items": [{
    "category": "meal" | "event" | "date_idea" | "gift_idea" | "other",
    "title": "string",
    "data": { ... category-specific fields ... },
    "suggested_tags": ["tag1", "tag2", "tag3"]
  }]
}

For MULTIPLE items (lists, top 5s, etc.), respond with:
{
  "isMultiItem": true,
  "items": [
    { "category": "...", "title": "Item 1", "data": { ... }, "suggested_tags": ["tag1", "tag2"] },
    { "category": "...", "title": "Item 2", "data": { ... }, "suggested_tags": ["tag1", "tag2"] },
    ...
  ]
}

Respond ONLY with valid JSON. If you cannot determine the content, use category "other".`;

const MODEL = GEMINI_MODEL;

/** Google Search grounding. Without it, every "look it up" in the prompt above
 *  is an instruction the model cannot follow, so it answers from memory
 *  instead — which is how a festival acquired a website that does not
 *  resolve. */
const GROUNDED = { tools: [{ googleSearch: {} }] };

/** What we know about where a post came from, past its own caption. */
export interface SourceContext {
  /** The post's own URL. */
  sourceUrl?: string;
  /** The creator, as the platform reported them — a handle or a display name. */
  author?: string;
  /** How to name the platform in the prompt: "TikTok", "Instagram". */
  platform?: string;
}

/**
 * Tell the model to go and read the account behind the post.
 *
 * A reel's caption is a sentence and some hashtags. The details that make the
 * item useful — the official site, the run of dates, the address — live on the
 * profile that posted it, usually as the single link in its bio. Nothing was
 * ever asking for them: the media paths had no search tool at all, so the model
 * filled `website` from its own priors and invented domains.
 *
 * Returns "" when we know nothing about the source, so the prompt does not grow
 * a section listing what it does not have.
 */
function sourceResearchBlock(source?: SourceContext): string {
  const known = [
    source?.platform && `Platform: ${source.platform}`,
    source?.author && `Posted by: ${source.author}`,
    source?.sourceUrl && `Post URL: ${source.sourceUrl}`,
  ].filter(Boolean);

  if (known.length === 0) return "";

  return `

**RESEARCH THE ACCOUNT BEHIND THIS POST.**
${known.join("\n")}

Before you fill in any link or detail, use Google Search to find the profile
that posted this and read what it says about itself. The bio, and the one link
in it, are where a creator or a venue puts the thing this post is advertising —
it is nearly always more accurate than the caption, and it is the difference
between the real site and a plausible-looking guess.

Search for the handle, and for the event or business name alongside it. Use what
you find for: the official website, dates, the venue and its address, ticket and
reservation links.

If searching turns up nothing, leave the field out. An absent website is a
smaller problem than a wrong one.`;
}

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Clean the model's `data` blob before it is stored.
 *
 * Nothing downstream re-validates an extraction — PATCH validates edits, but a
 * fresh extraction is written straight to the column. So the enums and the
 * plant list are checked here, at the boundary, rather than trusting that the
 * prompt was obeyed. A field the model got wrong is dropped, not corrected:
 * a missing spice level renders as nothing, while an invented one would render
 * as a confident lie.
 */
export function normalizeExtractedData(
  category: ContentCategory,
  data: unknown
): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};

  const next = { ...(data as Record<string, unknown>) };

  if (category === "meal") {
    if (!(RECIPE_EFFORTS as readonly unknown[]).includes(next.effort)) {
      delete next.effort;
    }
    if (!(SPICE_LEVELS as readonly unknown[]).includes(next.spice)) {
      delete next.spice;
    }

    // readPlants drops anything malformed and dedupes on source, so a model
    // that emitted "herb_spice", a bare string, or wheat twice still leaves a
    // correct list behind.
    if ("plants" in next) {
      const plants = readPlants(next.plants);
      if (plants.length > 0) next.plants = plants;
      else delete next.plants;
    }
  }

  return next;
}

export function parseAnalysisResponse(text: string): MultiItemAnalysisResult {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Handle new multi-item format
  if (parsed.items && Array.isArray(parsed.items)) {
    const validCategories: ContentCategory[] = [
      "meal",
      "drink",
      "event",
      "date_idea",
      "gift_idea",
      "travel",
      "other",
    ];

    const validatedItems = parsed.items.map((item: AnalysisResult) => {
      if (!validCategories.includes(item.category)) {
        item.category = "other";
      }
      item.data = normalizeExtractedData(item.category, item.data);
      return item;
    });

    return {
      isMultiItem: parsed.isMultiItem || validatedItems.length > 1,
      items: validatedItems,
    };
  }

  // Handle legacy single-item format
  if (parsed.category && parsed.title) {
    const validCategories: ContentCategory[] = [
      "meal",
      "drink",
      "event",
      "date_idea",
      "gift_idea",
      "travel",
      "other",
    ];

    if (!validCategories.includes(parsed.category)) {
      parsed.category = "other";
    }

    parsed.data = normalizeExtractedData(parsed.category, parsed.data);

    return {
      isMultiItem: false,
      items: [parsed as AnalysisResult],
    };
  }

  throw new Error("Invalid response structure");
}

export async function analyzeVideoWithGemini(
  videoBase64: string,
  videoDescription?: string,
  source?: SourceContext
): Promise<MultiItemAnalysisResult> {
  const ai = getGeminiClient();

  // Prepare the prompt with optional description context
  let prompt = ANALYSIS_PROMPT;
  if (videoDescription) {
    prompt += `\n\nVideo caption/description: "${videoDescription}"`;
  }
  prompt += sourceResearchBlock(source);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          inlineData: {
            mimeType: "video/mp4",
            data: videoBase64,
          },
        },
        { text: prompt },
      ],
      config: GROUNDED,
    });

    return parseAnalysisResponse(response.text!);
  } catch (error) {
    console.error("Error analyzing video with Gemini:", error);

    // Return a fallback result
    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: "Unable to analyze video",
          data: {
            description: videoDescription || "Video analysis failed",
          },
        },
      ],
    };
  }
}

// Analyze with just the thumbnail and description (faster, cheaper)
export async function analyzeWithThumbnail(
  thumbnailUrl: string,
  description: string,
  source?: SourceContext
): Promise<MultiItemAnalysisResult> {
  const ai = getGeminiClient();

  // Fetch the thumbnail
  const imageResponse = await fetch(thumbnailUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");

  // Determine mime type from URL or default to jpeg
  const mimeType = thumbnailUrl.includes(".png") ? "image/png" : "image/jpeg";

  const prompt = `${ANALYSIS_PROMPT}

The image is a thumbnail from the source video or post.
Caption/description: "${description}"

Based on the thumbnail and description, analyze what this content is about.${sourceResearchBlock(
    source
  )}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
      config: GROUNDED,
    });

    return parseAnalysisResponse(response.text!);
  } catch (error) {
    console.error("Error analyzing with thumbnail:", error);

    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: "Unable to analyze content",
          data: {
            description: description || "Analysis failed",
          },
        },
      ],
    };
  }
}

/**
 * Analyze a slideshow — a post whose content is a sequence of images.
 *
 * Not the same job as analyzeWithThumbnail, which reads one cover image and
 * leans on the caption. Here the images *are* the post: a slideshow recipe puts
 * its ingredients on one card and its steps on the next, so the text has to be
 * read off the pictures and stitched back into order. Captions on these posts
 * are frequently nothing but hashtags, so there is often no prose to fall back
 * on at all.
 *
 * Sent in order and numbered, because "add the eggs" means something different
 * on card two than on card six.
 */
export async function analyzeWithImages(
  imageUrls: string[],
  description: string,
  imageHeaders?: Record<string, string>,
  source?: SourceContext
): Promise<MultiItemAnalysisResult> {
  const ai = getGeminiClient();

  const images = await Promise.all(
    imageUrls.map(async (url) => {
      const response = await fetch(url, { headers: imageHeaders });
      if (!response.ok) {
        throw new Error(`Failed to fetch slideshow image: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      return {
        inlineData: {
          mimeType: url.includes(".png") ? "image/png" : "image/jpeg",
          data: Buffer.from(buffer).toString("base64"),
        },
      };
    })
  );

  const prompt = `${ANALYSIS_PROMPT}

The ${images.length} images are the slides of a single post, in order.
Caption/description: "${description}"

Treat the slides as one piece of content, not as ${images.length} separate items.

**Read the text in the images.** On these posts almost everything is written on
the slides rather than in the caption — the caption is often only hashtags, or
empty. Transcribe what you see and use it to fill the fields, in slide order:
ingredients on one card and steps on the next belong to the same recipe.

**The last slide is usually the call to action.** Check every slide, and the
last one especially, for:
- a website or URL, including bare ones written without https://
- an @handle, or a "link in bio"
- a venue or business name, and a street address

Put a URL in a link field rather than in the description, so it renders as a
link. **A plain business or brand URL goes in \`website\`** — that is the field
for it, and it is the usual case: a post that simply puts its domain on the
last slide is not offering tickets or a menu. Use the more specific field only
when the link really is one: ticket_link, menu_link, reservation_link,
purchase_link, booking_link.

Normalise a bare domain to a full https:// URL — "MixedChicago.com" written on
a slide becomes "https://mixedchicago.com".

For location, prefer the specific venue written on the slides — "Mixed Mediums,
Chicago" — over the city alone. A bare city name is the least useful answer and
should only be used when nothing more specific appears anywhere.${sourceResearchBlock(
    source
  )}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [...images, { text: prompt }],
      config: GROUNDED,
    });

    return parseAnalysisResponse(response.text!);
  } catch (error) {
    console.error("Error analyzing slideshow images:", error);

    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: "Unable to analyze content",
          data: {
            description: description || "Analysis failed",
          },
        },
      ],
    };
  }
}

// Analyze with just description (last resort when no image/video available)
export async function analyzeWithDescription(
  description: string,
  sourceUrl: string,
  source?: SourceContext
): Promise<MultiItemAnalysisResult> {
  const ai = getGeminiClient();

  const prompt = `${ANALYSIS_PROMPT}

I only have the description/caption from a saved video or post. Please analyze it and categorize the content.

Source URL: ${sourceUrl}
Caption/description: "${description}"

Based on this information, determine what category this content belongs to and extract any relevant details you can infer.${sourceResearchBlock(
    { sourceUrl, ...source }
  )}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: GROUNDED,
    });

    return parseAnalysisResponse(response.text!);
  } catch (error) {
    console.error("Error analyzing with description:", error);

    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: description.slice(0, 50) || "Saved item",
          data: {
            description: description || "Saved content",
          },
        },
      ],
    };
  }
}

// Analyze a webpage with its content and structured data
export async function analyzeWebpage(
  pageContent: string,
  url: string,
  options?: {
    thumbnailUrl?: string;
    structuredData?: Record<string, unknown>;
    description?: string;
    siteName?: string;
    resolvedUrl?: string;
  }
): Promise<MultiItemAnalysisResult> {
  const ai = getGeminiClient();

  // Build context from available data
  let contextInfo = `Website URL: ${url}\n`;
  if (options?.resolvedUrl) {
    contextInfo += `Resolved URL (after redirects): ${options.resolvedUrl}\n`;
  }
  if (options?.siteName) {
    contextInfo += `Site name: ${options.siteName}\n`;
  }
  if (options?.description) {
    contextInfo += `Page description: ${options.description}\n`;
  }
  if (options?.structuredData) {
    contextInfo += `\nStructured data (JSON-LD/Schema.org):\n${JSON.stringify(
      options.structuredData,
      null,
      2
    )}\n`;
  }

  const prompt = `${ANALYSIS_PROMPT}

I'm providing content from a website. Analyze it and extract the relevant information.

${contextInfo}

Page content (text extracted from HTML):
"""
${pageContent}
"""

Based on this website content, determine what category it belongs to and extract all relevant details. Pay special attention to:
- If it's a recipe page, extract the FULL recipe with ALL ingredients and ALL steps
- If it's a restaurant or place, extract location, hours, contact info, website, menu links, and reservation links
- If it's a product, extract the name, price, and purchase link
- Use the structured data if available as it's usually the most accurate source
- **If the page content above is sparse, generic, or appears to be from a JavaScript app that didn't render properly (e.g. Google Maps, Yelp, Airbnb), you MUST use Google Search to look up the business/place name and find ALL of the following:**
  - The business's own website URL (not the Google Maps or Yelp link)
  - A photo/image URL of the location
  - Menu link (for restaurants)
  - Reservation link (check OpenTable, Resy, or the restaurant's own site)
  - Full address, phone number, hours, cuisine type, price range`;

  // Google Search grounding lets Gemini look up details when page content is thin
  // (e.g. JS-heavy SPAs like Google Maps, Yelp, Airbnb that don't yield
  // useful content from simple HTML fetching)
  const config = {
    tools: [{ googleSearch: {} }],
  };

  try {
    // If we have a thumbnail, include it
    if (options?.thumbnailUrl) {
      try {
        const imageResponse = await fetch(options.thumbnailUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString("base64");
          const mimeType = options.thumbnailUrl.includes(".png")
            ? "image/png"
            : "image/jpeg";

          const response = await ai.models.generateContent({
            model: MODEL,
            contents: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
            config,
          });

          return parseAnalysisResponse(response.text!);
        }
      } catch (imgError) {
        console.log("Failed to include thumbnail in analysis:", imgError);
        // Continue without image
      }
    }

    // Text-only analysis
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config,
    });

    return parseAnalysisResponse(response.text!);
  } catch (error) {
    console.error("Error analyzing webpage with Gemini:", error);

    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: options?.description?.slice(0, 50) || "Website content",
          data: {
            description:
              options?.description || `Content from ${new URL(url).hostname}`,
          },
        },
      ],
    };
  }
}

// Specialized prompt for analyzing photos/screenshots with Google Search
const IMAGE_ANALYSIS_PROMPT = `You are an AI assistant that analyzes photos and screenshots to extract useful information.
You have access to Google Search to look up additional details about what you see.

**IMPORTANT**: When extracting recipe information, PARAPHRASE the instructions in your own words. Do NOT copy text verbatim. Summarize and reword the steps while preserving the essential cooking technique and order.

Analyze this image and determine what it contains:

1. **Recipe Screenshot** - A photo or screenshot of a recipe (from a website, book, or handwritten)
2. **Restaurant Photo** - A photo taken at or of a restaurant, cafe, bar, or food establishment
3. **Product Photo** - A photo of a product or item that could be purchased
4. **Food Photo** - A photo of a dish/meal (not a recipe, just the food itself)
5. **Other** - Something else

Based on what you identify:

**For Recipe Screenshots:**
- Identify the dish name
- List the ingredients you can see (paraphrase, don't copy exactly)
- REWRITE the cooking instructions in your own words - summarize each step
- Use Google Search to find more details about this recipe if helpful
- Category: "meal" or "drink" depending on content

**For Restaurant Photos:**
- Identify the restaurant name from any visible signage, menus, or context
- If GPS coordinates are provided, use them to help identify the location
- Use Google Search to find: address, phone, website, hours, reservation links (OpenTable, Resy, etc.)
- Look for menu links and any notable dishes
- Category: "date_idea" (type: "dinner")

**For Product Photos:**
- Identify the product name and brand
- Use Google Search to find: price, where to buy, product details
- Construct an Amazon search link
- Category: "gift_idea"

**For Food Photos:**
- Try to identify what dish this is
- Use Google Search to find a recipe for this dish
- Extract recipe details if found (in your own words)
- Category: "meal" or "drink"

${ANALYSIS_PROMPT.split("Based on the category")[1]}`;

// Analyze an image (photo/screenshot) with Google Search grounding
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  options?: {
    gpsCoordinates?: { latitude: number; longitude: number };
    locationString?: string;
    dateTaken?: Date;
    messageText?: string; // Any text sent with the image
  }
): Promise<MultiItemAnalysisResult> {
  const ai = getGeminiClient();

  // Build context from available metadata
  let contextInfo = "";
  if (options?.gpsCoordinates) {
    contextInfo += `\n**GPS Location:** ${options.gpsCoordinates.latitude}, ${options.gpsCoordinates.longitude}`;
    if (options.locationString) {
      contextInfo += ` (${options.locationString})`;
    }
    contextInfo +=
      "\nUse this location to help identify restaurants or places in the photo.";
  }
  if (options?.dateTaken) {
    contextInfo += `\n**Photo taken:** ${options.dateTaken.toISOString()}`;
  }
  if (options?.messageText) {
    contextInfo += `\n**User's message:** "${options.messageText}"`;
  }

  const prompt = `${IMAGE_ANALYSIS_PROMPT}
${contextInfo ? `\n**Additional Context:**${contextInfo}` : ""}

Analyze this image and use Google Search to find relevant details. Return your analysis as JSON.`;

  // Fallback prompt for when RECITATION error occurs - emphasizes heavy paraphrasing
  const fallbackPrompt = `Analyze this image. If it's a recipe, identify the dish name and describe:
1. What ingredients are needed (list them generally, don't copy exact measurements)
2. Summarize the cooking technique in 3-5 simple steps using your own words

If it's a restaurant, identify it and search for its details.
If it's a product, identify it and search for where to buy it.

IMPORTANT: Use your own words to describe everything. Do not reproduce any text verbatim.
${contextInfo ? `\n**Context:**${contextInfo}` : ""}

Return as JSON with this format:
{
  "isMultiItem": false,
  "items": [{
    "category": "meal" | "drink" | "date_idea" | "gift_idea" | "other",
    "title": "Name of dish/restaurant/product",
    "data": { ... relevant fields ... },
    "suggested_tags": ["tag1", "tag2"]
  }]
}`;

  const imagePart: Part = {
    inlineData: {
      mimeType,
      data: imageBase64,
    },
  };

  const config = {
    tools: [{ googleSearch: {} }],
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [imagePart, { text: prompt }],
      config,
    });

    console.log("Image analysis response:", response.text?.slice(0, 500));

    return parseAnalysisResponse(response.text!);
  } catch (error) {
    // Check if this is a RECITATION error (content blocked due to similarity to copyrighted content)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("RECITATION")) {
      console.log(
        "RECITATION error detected, retrying with paraphrase-focused prompt..."
      );

      try {
        // Retry with the fallback prompt that emphasizes paraphrasing
        const retryResponse = await ai.models.generateContent({
          model: MODEL,
          contents: [imagePart, { text: fallbackPrompt }],
          config,
        });

        console.log(
          "Retry analysis response:",
          retryResponse.text?.slice(0, 500)
        );

        return parseAnalysisResponse(retryResponse.text!);
      } catch (retryError) {
        console.error("Retry also failed:", retryError);
      }
    }

    console.error("Error analyzing image with Gemini:", error);

    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: "Photo",
          data: {
            description: options?.messageText || "Photo analysis failed",
          },
        },
      ],
    };
  }
}

/**
 * The plant-extraction rules, sliced out of the analysis prompt rather than
 * copied, so the derive-only path in derive-attributes.ts shares exactly one
 * definition. These rules have already been wrong twice — herbs and spices
 * leaking in, then alcohol — and two drifting copies would be worse than one
 * imperfect one.
 *
 * Throws at module load if the markers move, which is a build-time failure
 * rather than a silently empty prompt section.
 */
export const PLANT_RULES = (() => {
  const start = ANALYSIS_PROMPT.indexOf("**PLANTS (meal only):**");
  const end = ANALYSIS_PROMPT.indexOf("For **event**:");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      "PLANT_RULES: markers not found in ANALYSIS_PROMPT — the prompt was restructured"
    );
  }
  return ANALYSIS_PROMPT.slice(start, end).trimEnd();
})();
