import type { SocialPlatform } from "@/lib/social-media";
import type { Content } from "@/lib/db/types";

export type ProcessPlatform = SocialPlatform | "image";

export interface ProcessInput {
  contentId: string;
  tiktokUrl?: string;
  socialUrl?: string;
  platform?: ProcessPlatform;
  userId: string;
  phoneNumber: string;
  messageText?: string;
  mmsMedia?: {
    urls: string[];
    types: string[];
  };
}

export interface ProcessSuccessSingle {
  success: true;
  content: Content;
}

export interface ProcessSuccessMulti {
  success: true;
  multiItem: true;
  contents: Content[];
}

export type ProcessSuccess = ProcessSuccessSingle | ProcessSuccessMulti;

export interface ProcessError {
  success?: false;
  error: string;
}

export type ProcessResult = ProcessSuccess | ProcessError;
