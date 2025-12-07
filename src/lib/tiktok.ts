// TikTok video downloader using RapidAPI
// Uses the "TikTok Video No Watermark" API

interface TikTokVideoInfo {
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  author: string;
}

interface RapidAPIResponse {
  code: number;
  msg: string;
  data?: {
    play: string;
    cover: string;
    title: string;
    author: {
      nickname: string;
    };
  };
}

// Resolve short URLs to full URLs
async function resolveShortUrl(url: string): Promise<string> {
  // Check if it's a short URL
  if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com') || url.includes('/t/')) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
      });
      return response.url;
    } catch {
      // If HEAD fails, try GET
      const response = await fetch(url, {
        redirect: 'follow',
      });
      return response.url;
    }
  }
  return url;
}

// Extract video ID from TikTok URL
function extractVideoId(url: string): string | null {
  // Try to match /video/ID pattern
  const videoMatch = url.match(/\/video\/(\d+)/);
  if (videoMatch) {
    return videoMatch[1];
  }
  
  return null;
}

export async function getTikTokVideoInfo(tiktokUrl: string): Promise<TikTokVideoInfo> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  
  if (!rapidApiKey) {
    throw new Error('Missing RAPIDAPI_KEY environment variable');
  }

  // Resolve short URLs first
  const resolvedUrl = await resolveShortUrl(tiktokUrl);
  console.log(`Resolved URL: ${resolvedUrl}`);

  // Use RapidAPI TikTok downloader
  const response = await fetch(
    `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(resolvedUrl)}&hd=1`,
    {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`RapidAPI request failed: ${response.status} ${response.statusText}`);
  }

  const data: RapidAPIResponse = await response.json();

  if (data.code !== 0 || !data.data) {
    throw new Error(`Failed to get video info: ${data.msg}`);
  }

  return {
    videoUrl: data.data.play,
    thumbnailUrl: data.data.cover,
    description: data.data.title || '',
    author: data.data.author?.nickname || '',
  };
}

export async function downloadTikTokVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Alternative: Get video as base64 for AI processing
export async function getTikTokVideoAsBase64(tiktokUrl: string): Promise<{
  base64: string;
  thumbnailUrl: string;
  description: string;
}> {
  const videoInfo = await getTikTokVideoInfo(tiktokUrl);
  const videoBuffer = await downloadTikTokVideo(videoInfo.videoUrl);
  
  return {
    base64: videoBuffer.toString('base64'),
    thumbnailUrl: videoInfo.thumbnailUrl,
    description: videoInfo.description,
  };
}

