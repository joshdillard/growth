// Daily automation entrypoint — run via cron (e.g. 6am):
//   0 6 * * * cd /path/to/engine && npm run daily
//
// Researches today's topics, scripts the target number of reels, and generates
// assets. With autopilot ON it also renders and publishes; otherwise reels stop
// at "ready" for manual QC in the editor.

import { discoverTopics } from "../lib/pipeline/research";
import { generateScript } from "../lib/pipeline/script";
import { generateAssets } from "../lib/pipeline/assets";
import { publishReel } from "../lib/publish";
import { getSettings, saveReel, getReel } from "../lib/store";
import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";

async function main() {
  const settings = await getSettings();
  console.log(
    `[daily] target=${settings.dailyReelTarget} autopilot=${settings.autopilot}`
  );

  const topics = await discoverTopics(settings.dailyReelTarget);
  console.log(`[daily] ${topics.length} topics discovered`);

  for (const topic of topics) {
    try {
      console.log(`[daily] scripting: ${topic.title}`);
      let reel = await saveReel(await generateScript(topic));

      console.log(`[daily] generating assets for ${reel.id}`);
      reel = await generateAssets(reel);

      if (reel.status !== "ready") {
        console.warn(`[daily] ${reel.id} not ready (${reel.status}), leaving for manual QC`);
        continue;
      }

      if (!settings.autopilot) {
        console.log(`[daily] ${reel.id} ready — awaiting QC in the editor`);
        continue;
      }

      // Autopilot: approve -> render -> publish
      reel.status = "approved";
      await saveReel(reel);

      console.log(`[daily] rendering ${reel.id}`);
      await render(reel.id);

      const fresh = await getReel(reel.id);
      if (fresh?.status === "rendered") {
        console.log(`[daily] publishing ${reel.id} to ${settings.platforms.join(", ")}`);
        fresh.publishResults = await publishReel(fresh, settings.platforms);
        if (fresh.publishResults.some((r) => r.postId)) fresh.status = "published";
        await saveReel(fresh);
      }
    } catch (e) {
      console.error(`[daily] failed for "${topic.title}":`, e);
    }
  }
  console.log("[daily] done");
}

async function render(reelId: string): Promise<void> {
  const reel = await getReel(reelId);
  if (!reel) throw new Error("reel vanished");
  const settings = await getSettings();
  const outDir = path.join(process.cwd(), "data", "assets");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${reelId}.mp4`);
  const propsPath = path.join(outDir, `${reelId}.props.json`);
  await fs.writeFile(propsPath, JSON.stringify({ reel, brand: settings.brand }));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "npx",
      ["remotion", "render", "remotion/index.ts", "ShortReel", outPath, `--props=${propsPath}`],
      { stdio: "inherit" }
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`render exit ${code}`))
    );
  });

  reel.renderedVideoPath = outPath;
  reel.status = "rendered";
  await saveReel(reel);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
