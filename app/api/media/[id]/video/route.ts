// Serves the rendered MP4 so social platforms can pull it by URL.
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import { getReel } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const reel = await getReel((await params).id);
  if (!reel?.renderedVideoPath || !existsSync(reel.renderedVideoPath)) {
    return NextResponse.json({ error: "video not rendered" }, { status: 404 });
  }
  const stat = statSync(reel.renderedVideoPath);
  const stream = Readable.toWeb(createReadStream(reel.renderedVideoPath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
    },
  });
}
