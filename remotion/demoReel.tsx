// A fully-populated sample reel: powers the Remotion Studio preview and the
// editor before any real reels exist, so the look can be tuned without API keys.
import { Reel } from "../lib/types";

const words = (
  "Anthropic just changed the game for creators. Their new model writes edits and " +
  "plans your content in one shot. I used it to build an entire week of reels in " +
  "twenty minutes. The workflow is simple. Research script generate publish. If you " +
  "want my exact setup comment the word ENGINE and I'll send you the full breakdown."
).split(" ");

const DURATION_MS = 36_000;
const perWord = DURATION_MS / words.length;

export const demoReel: Reel = {
  id: "demo",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: "ready",
  topic: {
    title: "Anthropic's new model for creators",
    angle: "Build a week of content in 20 minutes",
    source: "https://www.anthropic.com/news",
    trendScore: 9,
  },
  hookTitle: "AI JUST REPLACED MY EDITOR",
  script: words.join(" "),
  segments: [
    {
      id: "s1",
      text: "Anthropic just changed the game for creators.",
      startMs: 0,
      endMs: 6000,
      broll: { prompt: "Animated Anthropic logo on dark gradient, subtle glow", style: "logo-animation", provider: "fal", status: "pending" },
    },
    {
      id: "s2",
      text: "Their new model writes, edits and plans your content in one shot.",
      startMs: 6000,
      endMs: 14000,
      broll: { prompt: "Futuristic editing timeline assembling itself, neon UI", style: "ai-video", provider: "runway", status: "pending" },
    },
    {
      id: "s3",
      text: "I used it to build an entire week of reels in twenty minutes.",
      startMs: 14000,
      endMs: 21000,
      broll: { prompt: "Grid of vertical videos populating rapidly on a dark dashboard", style: "ai-video", provider: "fal", status: "pending" },
    },
    {
      id: "s4",
      text: "The workflow is simple: research, script, generate, publish.",
      startMs: 21000,
      endMs: 28000,
      broll: { prompt: "Clean animated flowchart with four glowing steps", style: "ai-image", provider: "fal", status: "pending" },
    },
    {
      id: "s5",
      text: "If you want my exact setup, comment the word ENGINE and I'll send you the full breakdown.",
      startMs: 28000,
      endMs: 36000,
      broll: { prompt: "(full screen CTA)", style: "ai-image", provider: "fal", status: "pending" },
    },
  ],
  captions: words.map((text, i) => ({
    text,
    startMs: Math.round(i * perWord),
    endMs: Math.round((i + 1) * perWord),
  })),
  cta: {
    keyword: "ENGINE",
    spokenLine: "Comment the word ENGINE and I'll send you the full breakdown.",
    docTitle: "Josh's AI Content Engine — Full Breakdown",
  },
  thumbnailPrompt:
    "Confident creator in a neon-lit studio surrounded by floating video frames, purple and amber color grade, bold title text",
  description:
    "AI just replaced my editor — here's the 20-minute weekly content workflow. Comment ENGINE for the full breakdown 🔧",
  hashtags: ["#ai", "#contentcreator", "#aitools", "#reels", "#entrepreneur", "#anthropic", "#aivideo", "#creatoreconomy"],
  publishResults: [],
  durationMs: DURATION_MS,
};
