// Asset orchestration for a scripted reel: kicks off the HeyGen clone video,
// generates every B-roll shot and the thumbnail, and creates the CTA Google Doc.
// Designed to be re-runnable: only fills in what's missing/failed.

import { Reel } from "../types";
import { saveReel } from "../store";
import { startAvatarVideo, getAvatarVideoStatus } from "./avatar";
import { generateBroll, generateThumbnail } from "./broll";
import { createCtaDoc } from "./drive";

export async function generateAssets(reel: Reel): Promise<Reel> {
  reel.status = "generating";
  await saveReel(reel);

  const jobs: Promise<void>[] = [];

  // 1. Avatar (clone) video
  if (!reel.avatarVideoUrl) {
    jobs.push(
      (async () => {
        if (!reel.avatarVideoId) {
          reel.avatarVideoId = await startAvatarVideo(reel.script);
          await saveReel(reel);
        }
        // Poll until HeyGen finishes (typically 1-4 min for a 60s clip).
        const deadline = Date.now() + 15 * 60_000;
        while (Date.now() < deadline) {
          const st = await getAvatarVideoStatus(reel.avatarVideoId);
          if (st.status === "completed") {
            reel.avatarVideoUrl = st.videoUrl;
            return;
          }
          if (st.status === "failed") throw new Error(`HeyGen failed: ${st.error}`);
          await new Promise((r) => setTimeout(r, 10_000));
        }
        throw new Error("HeyGen timed out");
      })()
    );
  }

  // 2. B-roll per segment
  for (const segment of reel.segments) {
    if (segment.broll.status === "ready" && segment.broll.assetUrl) continue;
    jobs.push(
      (async () => {
        segment.broll.status = "generating";
        try {
          segment.broll.assetUrl = await generateBroll(segment.broll);
          segment.broll.status = "ready";
        } catch (e) {
          segment.broll.status = "failed";
          console.error(`B-roll failed for segment ${segment.id}:`, e);
        }
      })()
    );
  }

  // 3. Thumbnail
  if (!reel.thumbnailUrl) {
    jobs.push(
      (async () => {
        reel.thumbnailUrl = await generateThumbnail(reel.thumbnailPrompt);
      })()
    );
  }

  // 4. CTA Google Doc (free-info doc with 1:1 booking link)
  if (!reel.cta.docUrl) {
    jobs.push(
      (async () => {
        try {
          reel.cta.docUrl = await createCtaDoc(reel);
        } catch (e) {
          console.error("CTA doc creation failed (continuing without):", e);
        }
      })()
    );
  }

  const results = await Promise.allSettled(jobs);
  const hardFailure = results.some(
    (r, i) => r.status === "rejected" && i === 0 && !reel.avatarVideoUrl
  );
  const brollPending = reel.segments.some((s) => s.broll.status !== "ready");

  reel.status = hardFailure ? "failed" : brollPending ? "scripted" : "ready";
  if (hardFailure) reel.notes = String((results[0] as PromiseRejectedResult).reason);
  return saveReel(reel);
}
