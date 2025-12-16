import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ContentCategory,
  DateIdeaData,
  DrinkData,
  EventData,
  GiftIdeaData,
  MealData,
  TravelData,
} from "./supabase";

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
- prep_time: Preparation time if mentioned
- cook_time: Cooking time if mentioned
- servings: Number of servings if mentioned

For **event**:
- title: Name of the event
- location: Where the event is taking place
- date: Date of the event if mentioned
- time: Time of the event if mentioned
- requires_reservation: true/false
- requires_ticket: true/false
- ticket_link: URL to buy tickets if mentioned
- description: Brief description of the event
- website: Official website URL (use your knowledge to find the likely URL based on the event/venue name)
- reservation_link: URL to make reservations (OpenTable, Resy, etc.) if applicable

For **date_idea**:
- title: Name of the place or activity
- location: Where it is located (city, address, or general area)
- type: One of "dinner", "activity", "entertainment", "outdoors", "other"
- price_range: One of "$", "$$", "$$$", "$$$$" if you can estimate
- description: Brief description of why it's a good date idea
- website: Official website URL (use your knowledge to find the likely URL based on the venue name)
- menu_link: Link to the menu if it's a restaurant (often /menu on the website)
- reservation_link: URL to make reservations (OpenTable, Resy, etc.) if applicable

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
- website: Official website URL if known
- booking_link: Link to book/reserve if applicable
- price_range: One of "$", "$$", "$$$", "$$$$" if you can estimate
- destination_city: The city name
- destination_country: The country name

For **other**:
- title: Brief description of the content
- description: Summary of what the content is about

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

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  return new GoogleGenerativeAI(apiKey);
}

function parseAnalysisResponse(text: string): MultiItemAnalysisResult {
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

    return {
      isMultiItem: false,
      items: [parsed as AnalysisResult],
    };
  }

  throw new Error("Invalid response structure");
}

export async function analyzeVideoWithGemini(
  videoBase64: string,
  videoDescription?: string
): Promise<MultiItemAnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.5 Flash for video analysis
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Prepare the prompt with optional description context
  let prompt = ANALYSIS_PROMPT;
  if (videoDescription) {
    prompt += `\n\nVideo caption/description from TikTok: "${videoDescription}"`;
  }

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "video/mp4",
          data: videoBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();

    return parseAnalysisResponse(text);
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
  description: string
): Promise<MultiItemAnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.5 Flash for image analysis
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Fetch the thumbnail
  const imageResponse = await fetch(thumbnailUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");

  // Determine mime type from URL or default to jpeg
  const mimeType = thumbnailUrl.includes(".png") ? "image/png" : "image/jpeg";

  const prompt = `${ANALYSIS_PROMPT}

The image is a thumbnail from the TikTok video.
Video caption/description: "${description}"

Based on the thumbnail and description, analyze what this content is about.`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();

    return parseAnalysisResponse(text);
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

// Analyze with just description (last resort when no image/video available)
export async function analyzeWithDescription(
  description: string,
  tiktokUrl: string
): Promise<MultiItemAnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.5 Flash for text-only analysis
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `${ANALYSIS_PROMPT}

I only have the description/caption from a TikTok video. Please analyze it and categorize the content.

TikTok URL: ${tiktokUrl}
Video caption/description: "${description}"

Based on this information, determine what category this content belongs to and extract any relevant details you can infer.`;

  try {
    const result = await model.generateContent([{ text: prompt }]);

    const response = result.response;
    const text = response.text();

    return parseAnalysisResponse(text);
  } catch (error) {
    console.error("Error analyzing with description:", error);

    return {
      isMultiItem: false,
      items: [
        {
          category: "other",
          title: description.slice(0, 50) || "Saved TikTok",
          data: {
            description: description || "Content from TikTok",
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
  }
): Promise<MultiItemAnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.5 Flash for text analysis
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Build context from available data
  let contextInfo = `Website URL: ${url}\n`;
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
- If it's a restaurant, extract location, hours, contact info, and reservation links
- If it's a product, extract the name, price, and purchase link
- Use the structured data if available as it's usually the most accurate source`;

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

          const result = await model.generateContent([
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ]);

          const response = result.response;
          const text = response.text();
          return parseAnalysisResponse(text);
        }
      } catch (imgError) {
        console.log("Failed to include thumbnail in analysis:", imgError);
        // Continue without image
      }
    }

    // Text-only analysis
    const result = await model.generateContent([{ text: prompt }]);
    const response = result.response;
    const text = response.text();

    return parseAnalysisResponse(text);
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
  const genAI = getGeminiClient();

  // Use Gemini 2.5 Flash with Google Search grounding enabled
  // Note: googleSearch is a valid tool but not yet in the TypeScript types
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [
      {
        // Enable Google Search grounding for looking up restaurants, products, etc.
        googleSearch: {},
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  });

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

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();

    console.log("Image analysis response:", text.slice(0, 500));

    return parseAnalysisResponse(text);
  } catch (error) {
    // Check if this is a RECITATION error (content blocked due to similarity to copyrighted content)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("RECITATION")) {
      console.log(
        "RECITATION error detected, retrying with paraphrase-focused prompt..."
      );

      try {
        // Retry with the fallback prompt that emphasizes paraphrasing
        const retryResult = await model.generateContent([
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: fallbackPrompt },
        ]);

        const retryResponse = retryResult.response;
        const retryText = retryResponse.text();

        console.log("Retry analysis response:", retryText.slice(0, 500));

        return parseAnalysisResponse(retryText);
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

// Legacy function for backwards compatibility - returns first item only
export async function analyzeSingleItem(
  videoBase64: string,
  videoDescription?: string
): Promise<AnalysisResult> {
  const result = await analyzeVideoWithGemini(videoBase64, videoDescription);
  return result.items[0];
}
