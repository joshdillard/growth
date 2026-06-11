// Run a pipeline stage for one reel.
// POST /api/reels/:id/pipeline { action: "assets" | "render" | "approve" }
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { getReel, saveReel } from "@/lib/store";
import { generateAssets } from "@/lib/pipeline/assets";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const reel = await getReel((await params).id);
  if (!reel) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { action } = await req.json();

  switch (action) {
    case "assets": {
      // Long-running (minutes): fire and forget; the UI polls reel status.
      generateAssets(reel).catch((e) => console.error("assets pipeline:", e));
      return NextResponse.json({ ok: true, started: true });
    }

    case "approve": {
      reel.status = "approved";
      return NextResponse.json(await saveReel(reel));
    }

    case "render": {
      const outDir = path.join(process.cwd(), "data", "assets");
      const outPath = path.join(outDir, `${reel.id}.mp4`);
      const propsPath = path.join(outDir, `${reel.id}.props.json`);
      const fs = await import("fs/promises");
      await fs.mkdir(outDir, { recursive: true });
      const { getSettings } = await import("@/lib/store");
      const settings = await getSettings();
      await fs.writeFile(propsPath, JSON.stringify({ reel, brand: settings.brand }));

      const child = spawn(
        "npx",
        ["remotion", "render", "remotion/index.ts", "ShortReel", outPath, `--props=${propsPath}`],
        { cwd: process.cwd(), stdio: "inherit" }
      );
      child.on("exit", async (code) => {
        const fresh = await getReel(reel.id);
        if (!fresh) return;
        if (code === 0) {
          fresh.renderedVideoPath = outPath;
          fresh.status = "rendered";
        } else {
          fresh.status = "failed";
          fresh.notes = `Remotion render exited with code ${code}`;
        }
        await saveReel(fresh);
      });
      return NextResponse.json({ ok: true, started: true });
    }

    default:
      return NextResponse.json({ error: `unknown action ${action}` }, { status: 400 });
  }
}
