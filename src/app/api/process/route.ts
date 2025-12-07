import { NextRequest, NextResponse } from 'next/server';
import { getTikTokVideoAsBase64, getTikTokVideoInfo } from '@/lib/tiktok';
import { analyzeVideoWithGemini, analyzeWithThumbnail } from '@/lib/gemini';
import { saveContent } from '@/lib/supabase';

interface ProcessRequest {
  tiktokUrl: string;
  userId: string;
  phoneNumber: string;
}

// Maximum video size to process with full video analysis (20MB)
const MAX_VIDEO_SIZE_FOR_FULL_ANALYSIS = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { tiktokUrl, userId, phoneNumber } = body;

    if (!tiktokUrl || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`Processing TikTok URL for user ${userId}: ${tiktokUrl}`);

    // Step 1: Get video info from TikTok
    let videoInfo;
    try {
      videoInfo = await getTikTokVideoInfo(tiktokUrl);
      console.log('Video info retrieved:', {
        thumbnailUrl: videoInfo.thumbnailUrl,
        description: videoInfo.description?.substring(0, 100),
      });
    } catch (error) {
      console.error('Failed to get video info:', error);
      return NextResponse.json(
        { error: 'Failed to fetch TikTok video' },
        { status: 500 }
      );
    }

    // Step 2: Analyze the video
    let analysisResult;
    
    // Try full video analysis first, fall back to thumbnail if video is too large
    try {
      console.log('Attempting full video analysis...');
      const videoData = await getTikTokVideoAsBase64(tiktokUrl);
      
      // Check video size
      const videoSizeBytes = (videoData.base64.length * 3) / 4; // Approximate size from base64
      
      if (videoSizeBytes > MAX_VIDEO_SIZE_FOR_FULL_ANALYSIS) {
        console.log(`Video too large (${Math.round(videoSizeBytes / 1024 / 1024)}MB), using thumbnail analysis`);
        analysisResult = await analyzeWithThumbnail(
          videoInfo.thumbnailUrl,
          videoInfo.description
        );
      } else {
        analysisResult = await analyzeVideoWithGemini(
          videoData.base64,
          videoInfo.description
        );
      }
    } catch (error) {
      console.error('Full video analysis failed, falling back to thumbnail:', error);
      // Fall back to thumbnail analysis
      analysisResult = await analyzeWithThumbnail(
        videoInfo.thumbnailUrl,
        videoInfo.description
      );
    }

    console.log('Analysis result:', {
      category: analysisResult.category,
      title: analysisResult.title,
    });

    // Step 3: Save to database
    const savedContent = await saveContent({
      user_id: userId,
      tiktok_url: tiktokUrl,
      category: analysisResult.category,
      title: analysisResult.title,
      data: analysisResult.data,
      thumbnail_url: videoInfo.thumbnailUrl,
    });

    console.log(`Content saved with ID: ${savedContent.id}`);

    return NextResponse.json({
      success: true,
      content: savedContent,
    });
  } catch (error) {
    console.error('Error processing TikTok video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

