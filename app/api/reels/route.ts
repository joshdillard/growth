import { NextRequest, NextResponse } from "next/server";
import { listReels, saveReel } from "@/lib/store";
import { discoverTopics } from "@/lib/pipeline/research";
import { generateScript } from "@/lib/pipeline/script";

export async function GET() {
  return NextResponse.json(await listReels());
}

// POST /api/reels { count?: number, topic?: TopicIdea }
// With a topic: script just that one. Without: research + script `count` new reels.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.topic) {
    const reel = await saveReel(await generateScript(body.topic));
    return NextResponse.json([reel]);
  }

  const count = Math.min(Number(body.count) || 3, 7);
  const topics = await discoverTopics(count);
  const reels = [];
  for (const topic of topics) {
    try {
      reels.push(await saveReel(await generateScript(topic)));
    } catch (e) {
      console.error(`Scripting failed for "${topic.title}":`, e);
    }
  }
  return NextResponse.json(reels);
}
