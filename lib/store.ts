// Minimal JSON-file persistence. Single-user personal tool: no DB server needed.
// Reels live in data/reels.json, settings in data/settings.json.

import { promises as fs } from "fs";
import path from "path";
import { Reel, EngineSettings } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const REELS_FILE = path.join(DATA_DIR, "reels.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export const DEFAULT_SETTINGS: EngineSettings = {
  autopilot: false,
  dailyReelTarget: 3,
  platforms: ["instagram", "facebook", "youtube", "tiktok"],
  voiceProfile:
    "Josh Dillard: energetic, direct, no-fluff. Talks to creators and entrepreneurs " +
    "like a friend who's two steps ahead on AI. Short punchy sentences. Curious, " +
    "optimistic, occasionally funny. Always practical — every reel leaves the viewer " +
    "with something they can use today.",
  brand: {
    primaryColor: "#7C3AED",
    accentColor: "#F59E0B",
    captionStyle: "bold-pop",
    fontFamily: "Inter",
  },
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function listReels(): Promise<Reel[]> {
  try {
    const raw = await fs.readFile(REELS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getReel(id: string): Promise<Reel | undefined> {
  const reels = await listReels();
  return reels.find((r) => r.id === id);
}

export async function saveReel(reel: Reel): Promise<Reel> {
  await ensureDataDir();
  const reels = await listReels();
  const idx = reels.findIndex((r) => r.id === reel.id);
  reel.updatedAt = new Date().toISOString();
  if (idx >= 0) reels[idx] = reel;
  else reels.unshift(reel);
  await fs.writeFile(REELS_FILE, JSON.stringify(reels, null, 2));
  return reel;
}

export async function deleteReel(id: string): Promise<void> {
  const reels = await listReels();
  await fs.writeFile(
    REELS_FILE,
    JSON.stringify(reels.filter((r) => r.id !== id), null, 2)
  );
}

export async function getSettings(): Promise<EngineSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: EngineSettings): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function newId(): string {
  return `reel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
