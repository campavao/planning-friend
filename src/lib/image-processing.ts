// Image processing module for MMS images
// Handles downloading from Twilio and extracting EXIF metadata

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExifParser = require("exif-parser");

export interface ExifData {
  latitude?: number;
  longitude?: number;
  dateTaken?: Date;
  make?: string; // Camera/phone manufacturer
  model?: string; // Camera/phone model
  orientation?: number;
}

export interface ImageInfo {
  buffer: Buffer;
  base64: string;
  mimeType: string;
  exif: ExifData;
  locationString?: string; // Human-readable location if GPS data available
}

// Download image from Twilio MMS URL
// Twilio MMS URLs require Basic Auth with Account SID and Auth Token
export async function downloadTwilioImage(
  mediaUrl: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error("Missing Twilio credentials for MMS download");
    return null;
  }

  try {
    // Twilio MMS URLs require Basic Auth
    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString(
      "base64"
    );

    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to download Twilio MMS: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      mimeType: contentType,
    };
  } catch (error) {
    console.error("Error downloading Twilio MMS:", error);
    return null;
  }
}

// Extract EXIF data from image buffer
export function extractExifData(imageBuffer: Buffer): ExifData {
  const exifData: ExifData = {};

  try {
    const parser = ExifParser.create(imageBuffer);
    const result = parser.parse();

    // Extract GPS coordinates
    if (result.tags?.GPSLatitude && result.tags?.GPSLongitude) {
      exifData.latitude = result.tags.GPSLatitude;
      exifData.longitude = result.tags.GPSLongitude;
    }

    // Extract date taken
    if (result.tags?.DateTimeOriginal) {
      // EXIF dates are in seconds since epoch
      exifData.dateTaken = new Date(result.tags.DateTimeOriginal * 1000);
    } else if (result.tags?.CreateDate) {
      exifData.dateTaken = new Date(result.tags.CreateDate * 1000);
    }

    // Extract device info
    if (result.tags?.Make) {
      exifData.make = result.tags.Make;
    }
    if (result.tags?.Model) {
      exifData.model = result.tags.Model;
    }
    if (result.tags?.Orientation) {
      exifData.orientation = result.tags.Orientation;
    }

    console.log("Extracted EXIF data:", {
      hasGPS: !!(exifData.latitude && exifData.longitude),
      hasDate: !!exifData.dateTaken,
      device: exifData.make ? `${exifData.make} ${exifData.model}` : "Unknown",
    });
  } catch (error) {
    // EXIF parsing can fail for various reasons (no EXIF, corrupted, etc.)
    console.log("Could not extract EXIF data:", error);
  }

  return exifData;
}

// Convert GPS coordinates to a readable location string
// Uses a simple format: "latitude, longitude" which can be used with mapping APIs
export function formatGpsCoordinates(
  latitude: number,
  longitude: number
): string {
  // Format as decimal degrees with 6 decimal places
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);

  // Determine N/S and E/W
  const latDir = latitude >= 0 ? "N" : "S";
  const lngDir = longitude >= 0 ? "E" : "W";

  return `${Math.abs(parseFloat(lat))}°${latDir}, ${Math.abs(
    parseFloat(lng)
  )}°${lngDir}`;
}

// Get a Google Maps URL for the coordinates
export function getGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

// Process a Twilio MMS image - download, extract EXIF, prepare for analysis
export async function processMmsImage(
  mediaUrl: string
): Promise<ImageInfo | null> {
  console.log(`Processing MMS image: ${mediaUrl}`);

  // Download the image
  const downloaded = await downloadTwilioImage(mediaUrl);
  if (!downloaded) {
    console.error("Failed to download MMS image");
    return null;
  }

  const { buffer, mimeType } = downloaded;

  // Extract EXIF data
  const exif = extractExifData(buffer);

  // Create location string if GPS data available
  let locationString: string | undefined;
  if (exif.latitude && exif.longitude) {
    locationString = formatGpsCoordinates(exif.latitude, exif.longitude);
    console.log(`Image has GPS location: ${locationString}`);
  }

  // Convert to base64 for Gemini
  const base64 = buffer.toString("base64");

  return {
    buffer,
    base64,
    mimeType,
    exif,
    locationString,
  };
}

// Download a regular image URL (non-Twilio)
export async function downloadImage(
  imageUrl: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      mimeType: contentType,
    };
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

