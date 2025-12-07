import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ContentCategory,
  MealData,
  EventData,
  DateIdeaData,
} from "./supabase";

interface AnalysisResult {
  category: ContentCategory;
  title: string;
  data: MealData | EventData | DateIdeaData | Record<string, unknown>;
}

const ANALYSIS_PROMPT = `You are an AI assistant that analyzes TikTok videos to extract and categorize content.

Analyze this video and determine what category it belongs to:

1. **meal** - A recipe, cooking tutorial, or food-related content
2. **event** - An event, festival, concert, show, or time-limited happening
3. **date_idea** - A date night idea, place to visit, restaurant recommendation, or activity suggestion
4. **other** - Content that doesn't fit the above categories

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

For **date_idea**:
- title: Name of the place or activity
- location: Where it is located (city, address, or general area)
- type: One of "dinner", "activity", "entertainment", "outdoors", "other"
- price_range: One of "$", "$$", "$$$", "$$$$" if you can estimate
- description: Brief description of why it's a good date idea

For **other**:
- title: Brief description of the content
- description: Summary of what the video is about

Respond ONLY with valid JSON in this exact format:
{
  "category": "meal" | "event" | "date_idea" | "other",
  "title": "string",
  "data": { ... category-specific fields ... }
}

If you cannot determine the content or the video is unclear, use category "other" and provide your best guess.`;

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  return new GoogleGenerativeAI(apiKey);
}

export async function analyzeVideoWithGemini(
  videoBase64: string,
  videoDescription?: string
): Promise<AnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.0 Flash for video analysis (supports video files)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

    // Validate the response
    if (!parsed.category || !parsed.title || !parsed.data) {
      throw new Error("Invalid response structure");
    }

    // Ensure category is valid
    const validCategories: ContentCategory[] = [
      "meal",
      "event",
      "date_idea",
      "other",
    ];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = "other";
    }

    return parsed;
  } catch (error) {
    console.error("Error analyzing video with Gemini:", error);

    // Return a fallback result
    return {
      category: "other",
      title: "Unable to analyze video",
      data: {
        description: videoDescription || "Video analysis failed",
      },
    };
  }
}

// Analyze with just the thumbnail and description (faster, cheaper)
export async function analyzeWithThumbnail(
  thumbnailUrl: string,
  description: string
): Promise<AnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.0 Flash for image analysis
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

    // Validate the response
    if (!parsed.category || !parsed.title || !parsed.data) {
      throw new Error("Invalid response structure");
    }

    // Ensure category is valid
    const validCategories: ContentCategory[] = [
      "meal",
      "event",
      "date_idea",
      "other",
    ];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = "other";
    }

    return parsed;
  } catch (error) {
    console.error("Error analyzing with thumbnail:", error);

    return {
      category: "other",
      title: "Unable to analyze content",
      data: {
        description: description || "Analysis failed",
      },
    };
  }
}

// Analyze with just description (last resort when no image/video available)
export async function analyzeWithDescription(
  description: string,
  tiktokUrl: string
): Promise<AnalysisResult> {
  const genAI = getGeminiClient();

  // Use Gemini 2.0 Flash for text-only analysis
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `${ANALYSIS_PROMPT}

I only have the description/caption from a TikTok video. Please analyze it and categorize the content.

TikTok URL: ${tiktokUrl}
Video caption/description: "${description}"

Based on this information, determine what category this content belongs to and extract any relevant details you can infer.`;

  try {
    const result = await model.generateContent([{ text: prompt }]);

    const response = result.response;
    const text = response.text();

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

    // Validate the response
    if (!parsed.category || !parsed.title || !parsed.data) {
      throw new Error("Invalid response structure");
    }

    // Ensure category is valid
    const validCategories: ContentCategory[] = [
      "meal",
      "event",
      "date_idea",
      "other",
    ];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = "other";
    }

    return parsed;
  } catch (error) {
    console.error("Error analyzing with description:", error);

    return {
      category: "other",
      title: description.slice(0, 50) || "Saved TikTok",
      data: {
        description: description || "Content from TikTok",
      },
    };
  }
}
