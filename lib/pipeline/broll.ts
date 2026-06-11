// B-roll generation with a cost ladder:
//  - fal.ai Flux images: ~$0.003-0.03/image (logo cards, concepts, thumbnails)
//  - fal.ai video (Kling/LTX): cheap motion B-roll
//  - Runway Gen-4 Turbo: premium shots where quality matters
// The script step picks a provider per shot; the editor lets you re-roll or swap.

import { BrollShot } from "../types";

// ---------- fal.ai ----------

async function falRun(model: string, input: Record<string, unknown>) {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new Error("FAL_API_KEY is not set");
  // queue + poll: fal's synchronous endpoint times out on video models
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!submit.ok) throw new Error(`fal submit failed ${submit.status}: ${await submit.text()}`);
  const { request_id, status_url, response_url } = await submit.json();

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(status_url ?? `https://queue.fal.run/${model}/requests/${request_id}/status`, {
      headers: { Authorization: `Key ${key}` },
    }).then((r) => r.json());
    if (st.status === "COMPLETED") {
      return fetch(response_url ?? `https://queue.fal.run/${model}/requests/${request_id}`, {
        headers: { Authorization: `Key ${key}` },
      }).then((r) => r.json());
    }
    if (st.status === "FAILED") throw new Error(`fal job failed: ${JSON.stringify(st)}`);
  }
  throw new Error("fal job timed out");
}

export async function generateImage(prompt: string): Promise<string> {
  const out = await falRun("fal-ai/flux/schnell", {
    prompt,
    image_size: { width: 1080, height: 960 }, // top half of a 1080x1920 frame
    num_images: 1,
  });
  return out.images[0].url;
}

export async function generateFalVideo(prompt: string): Promise<string> {
  const out = await falRun("fal-ai/ltx-video", {
    prompt: `${prompt}, vertical framing, cinematic, high detail`,
  });
  return out.video.url;
}

// ---------- Runway ----------

export async function generateRunwayVideo(prompt: string): Promise<string> {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) throw new Error("RUNWAY_API_KEY is not set");
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "X-Runway-Version": "2024-11-06",
  };

  const create = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gen4_turbo",
      promptText: `${prompt}, vertical 9:16, cinematic B-roll, professional grade`,
      ratio: "720:1280",
      duration: 5,
    }),
  });
  if (!create.ok) throw new Error(`Runway create failed ${create.status}: ${await create.text()}`);
  const { id } = await create.json();

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const task = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, { headers }).then(
      (r) => r.json()
    );
    if (task.status === "SUCCEEDED") return task.output[0];
    if (task.status === "FAILED") throw new Error(`Runway task failed: ${task.failure}`);
  }
  throw new Error("Runway task timed out");
}

// ---------- dispatcher ----------

export async function generateBroll(shot: BrollShot): Promise<string> {
  if (shot.style === "ai-image" || shot.style === "logo-animation") {
    // Logo animations: generate a styled still, Remotion animates it (zoom/glow/parallax).
    return generateImage(shot.prompt);
  }
  if (shot.provider === "runway") {
    try {
      return await generateRunwayVideo(shot.prompt);
    } catch (e) {
      console.warn("Runway failed, falling back to fal:", e);
      return generateFalVideo(shot.prompt);
    }
  }
  return generateFalVideo(shot.prompt);
}

export async function generateThumbnail(prompt: string): Promise<string> {
  const out = await falRun("fal-ai/flux/dev", {
    prompt: `${prompt}, vertical 9:16 social media thumbnail, bold text-friendly composition, consistent brand colors, professional`,
    image_size: { width: 1080, height: 1920 },
    num_images: 1,
  });
  return out.images[0].url;
}
