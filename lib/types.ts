// Core domain types for the Dillard AI Short Content Engine.

export type ReelStatus =
  | "idea" // topic researched, not yet scripted
  | "scripted" // script + captions + CTA generated, awaiting assets
  | "generating" // avatar/B-roll/thumbnail generation in flight
  | "ready" // all assets in, awaiting QC
  | "approved" // signed off (manually or via autopilot)
  | "rendered" // final MP4 produced by Remotion
  | "published" // pushed to all platforms
  | "failed";

export type Platform = "instagram" | "facebook" | "youtube" | "tiktok";

export interface TopicIdea {
  title: string;
  angle: string;
  source: string; // URL or feed the idea came from
  trendScore: number; // 1-10, how hot/timely this is
}

export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface ScriptSegment {
  id: string;
  text: string; // what the clone says during this segment
  startMs: number;
  endMs: number;
  broll: BrollShot;
}

export interface BrollShot {
  prompt: string; // generation prompt describing the visual
  style: "ai-video" | "ai-image" | "logo-animation" | "screen-recording";
  provider: "runway" | "fal" | "manual";
  assetUrl?: string; // populated once generated (or manually swapped)
  status: "pending" | "generating" | "ready" | "failed";
}

export interface CallToAction {
  keyword: string; // the word viewers comment, e.g. "TOOLS"
  spokenLine: string; // what the clone says at the end
  docTitle: string;
  docUrl?: string; // Google Doc with the free info + 1:1 booking link
}

export interface PublishResult {
  platform: Platform;
  postId?: string;
  url?: string;
  error?: string;
  publishedAt?: string;
}

export interface Reel {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReelStatus;
  topic: TopicIdea;
  hookTitle: string; // animated title shown in the first ~2s
  script: string; // full script text, in Josh's voice
  segments: ScriptSegment[];
  captions: CaptionWord[];
  cta: CallToAction;
  avatarVideoUrl?: string; // HeyGen output
  avatarVideoId?: string; // HeyGen job id for polling
  thumbnailUrl?: string;
  thumbnailPrompt: string;
  description: string; // post caption/description text
  hashtags: string[];
  renderedVideoPath?: string;
  publishResults: PublishResult[];
  durationMs: number;
  notes?: string;
}

export interface EngineSettings {
  autopilot: boolean; // approve + publish without manual QC
  dailyReelTarget: number; // 3-7
  platforms: Platform[];
  voiceProfile: string; // freeform description of Josh's voice/tone
  brand: {
    primaryColor: string;
    accentColor: string;
    captionStyle: "bold-pop" | "karaoke" | "clean-lower";
    fontFamily: string;
  };
}
