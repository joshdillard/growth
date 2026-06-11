// Multi-platform publishing. Each platform needs the rendered video at a public
// URL (set PUBLIC_BASE_URL to wherever you host the app, or use the included
// /api/media route once deployed).
//
// Thumbnails: YouTube + TikTok support custom thumbnails via API; Instagram
// Reels accepts a cover via thumb_offset or image URL; Facebook Reels uses the
// first frame (no custom-thumb API) — noted per platform below.

import { Reel, Platform, PublishResult } from "./types";

export async function publishReel(reel: Reel, platforms: Platform[]): Promise<PublishResult[]> {
  const videoUrl = publicVideoUrl(reel);
  const caption = buildCaption(reel);

  const results = await Promise.allSettled(
    platforms.map((p) => publishTo(p, reel, videoUrl, caption))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { platform: platforms[i], error: String(r.reason) }
  );
}

function publicVideoUrl(reel: Reel): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error("PUBLIC_BASE_URL is not set (needed so platforms can fetch the video)");
  return `${base}/api/media/${reel.id}/video`;
}

export function buildCaption(reel: Reel): string {
  return `${reel.description}\n\n${reel.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`;
}

async function publishTo(
  platform: Platform,
  reel: Reel,
  videoUrl: string,
  caption: string
): Promise<PublishResult> {
  switch (platform) {
    case "instagram":
      return publishInstagram(reel, videoUrl, caption);
    case "facebook":
      return publishFacebook(reel, videoUrl, caption);
    case "youtube":
      return publishYouTube(reel, videoUrl, caption);
    case "tiktok":
      return publishTikTok(reel, videoUrl, caption);
  }
}

// ---------- Instagram Reels (Graph API) ----------
async function publishInstagram(reel: Reel, videoUrl: string, caption: string): Promise<PublishResult> {
  const token = required("META_ACCESS_TOKEN");
  const igUserId = required("IG_USER_ID");
  const G = "https://graph.facebook.com/v21.0";

  const container = await postForm(`${G}/${igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    ...(reel.thumbnailUrl ? { cover_url: reel.thumbnailUrl } : {}),
    access_token: token,
  });

  // Wait for Meta to ingest the video before publishing the container.
  await waitForContainer(G, container.id, token);

  const published = await postForm(`${G}/${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });

  return { platform: "instagram", postId: published.id, publishedAt: new Date().toISOString() };
}

async function waitForContainer(G: string, containerId: string, token: string) {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const st = await fetch(`${G}/${containerId}?fields=status_code&access_token=${token}`).then((r) => r.json());
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR") throw new Error("IG container processing failed");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("IG container processing timed out");
}

// ---------- Facebook Reels ----------
async function publishFacebook(reel: Reel, videoUrl: string, caption: string): Promise<PublishResult> {
  const token = required("META_ACCESS_TOKEN");
  const pageId = required("FB_PAGE_ID");
  const G = "https://graph.facebook.com/v21.0";

  // file_url upload: Meta pulls the video itself. (FB Reels has no custom
  // thumbnail param — it uses an early frame.)
  const res = await postForm(`${G}/${pageId}/video_reels`, {
    upload_phase: "start",
    access_token: token,
  });
  await postForm(`${G}/${pageId}/video_reels`, {
    video_id: res.video_id,
    upload_phase: "finish",
    video_state: "PUBLISHED",
    description: caption,
    file_url: videoUrl,
    access_token: token,
  });

  return { platform: "facebook", postId: res.video_id, publishedAt: new Date().toISOString() };
}

// ---------- YouTube Shorts ----------
async function publishYouTube(reel: Reel, videoUrl: string, caption: string): Promise<PublishResult> {
  const token = required("YOUTUBE_ACCESS_TOKEN"); // OAuth token w/ youtube.upload scope

  const video = await fetch(videoUrl).then((r) => r.arrayBuffer());
  const metadata = {
    snippet: {
      title: reel.hookTitle.slice(0, 95) + " #Shorts",
      description: caption,
      tags: reel.hashtags.map((h) => h.replace("#", "")),
      categoryId: "28", // Science & Technology
    },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  const boundary = "reel_upload_boundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`
    ),
    Buffer.from(video),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`YouTube upload failed: ${await res.text()}`);
  const data = await res.json();

  // Custom thumbnail
  if (reel.thumbnailUrl) {
    const thumb = await fetch(reel.thumbnailUrl).then((r) => r.arrayBuffer());
    await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${data.id}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
        body: Buffer.from(thumb),
      }
    ).catch((e) => console.warn("Thumbnail set failed (may require channel verification):", e));
  }

  return {
    platform: "youtube",
    postId: data.id,
    url: `https://youtube.com/shorts/${data.id}`,
    publishedAt: new Date().toISOString(),
  };
}

// ---------- TikTok (Content Posting API) ----------
async function publishTikTok(reel: Reel, videoUrl: string, caption: string): Promise<PublishResult> {
  const token = required("TIKTOK_ACCESS_TOKEN");

  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: "PUBLIC_TO_EVERYONE",
        // TikTok picks the cover via video_cover_timestamp_ms; we put the
        // thumbnail-style title card in frame 0 of the render.
        video_cover_timestamp_ms: 0,
      },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
  });
  if (!res.ok) throw new Error(`TikTok init failed: ${await res.text()}`);
  const data = await res.json();
  if (data.error?.code && data.error.code !== "ok") {
    throw new Error(`TikTok error: ${data.error.message}`);
  }

  return {
    platform: "tiktok",
    postId: data.data?.publish_id,
    publishedAt: new Date().toISOString(),
  };
}

// ---------- helpers ----------
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function postForm(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`${url} failed: ${JSON.stringify(data.error || data)}`);
  return data;
}
