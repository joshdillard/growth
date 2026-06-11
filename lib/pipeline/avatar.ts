// HeyGen avatar generation: send the script, get back a talking-clone video.
// Swappable: implement the same two functions against any provider
// (Hedra, D-ID, or a self-hosted open-source lipsync model) to cut costs.

const HEYGEN_API = "https://api.heygen.com";

function headers() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY is not set");
  return { "X-Api-Key": key, "Content-Type": "application/json" };
}

// Kick off generation; returns the HeyGen video id for polling.
export async function startAvatarVideo(script: string): Promise<string> {
  const avatarId = process.env.HEYGEN_AVATAR_ID;
  const voiceId = process.env.HEYGEN_VOICE_ID;
  if (!avatarId || !voiceId) {
    throw new Error(
      "Set HEYGEN_AVATAR_ID and HEYGEN_VOICE_ID (create your clone at app.heygen.com, then list ids via GET /v2/avatars and /v2/voices)"
    );
  }

  const res = await fetch(`${HEYGEN_API}/v2/video/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: script, voice_id: voiceId, speed: 1.05 },
          background: { type: "color", value: "#0B0B0F" },
        },
      ],
      dimension: { width: 1080, height: 1920 },
    }),
  });

  if (!res.ok) throw new Error(`HeyGen generate failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.video_id;
}

export async function getAvatarVideoStatus(
  videoId: string
): Promise<{ status: "processing" | "completed" | "failed"; videoUrl?: string; error?: string }> {
  const res = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`HeyGen status failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const s = data.data.status;
  if (s === "completed") return { status: "completed", videoUrl: data.data.video_url };
  if (s === "failed") return { status: "failed", error: data.data.error?.message };
  return { status: "processing" };
}
