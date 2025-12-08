import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ContentCategory,
  MealData,
  EventData,
  DateIdeaData,
  GiftIdeaData,
  TravelData,
  DrinkData,
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

const ANALYSIS_PROMPT = `You are an AI assistant that analyzes TikTok videos to extract and categorize content.

Analyze this video and determine what category it belongs to:

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
If the video contains a LIST of items (e.g., "Top 5 restaurants", "3 best gifts", "My favorite spots in NYC"), extract EACH item separately and return them as an array.

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
- description: Summary of what the video is about

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

// Legacy function for backwards compatibility - returns first item only
export async function analyzeSingleItem(
  videoBase64: string,
  videoDescription?: string
): Promise<AnalysisResult> {
  const result = await analyzeVideoWithGemini(videoBase64, videoDescription);
  return result.items[0];
}
