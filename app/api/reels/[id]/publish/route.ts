import { NextRequest, NextResponse } from "next/server";
import { getReel, saveReel, getSettings } from "@/lib/store";
import { publishReel } from "@/lib/publish";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const reel = await getReel((await params).id);
  if (!reel) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (reel.status !== "rendered" && reel.status !== "published") {
    return NextResponse.json(
      { error: `reel must be rendered first (status: ${reel.status})` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  const platforms = body.platforms ?? settings.platforms;

  const results = await publishReel(reel, platforms);
  reel.publishResults = [
    ...reel.publishResults.filter((r) => !platforms.includes(r.platform)),
    ...results,
  ];
  if (results.some((r) => r.postId)) reel.status = "published";
  return NextResponse.json(await saveReel(reel));
}
