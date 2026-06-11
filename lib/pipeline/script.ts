// Turns a topic into everything the reel needs in ONE structured Claude call:
// hook title, script in Josh's voice, timed segments with B-roll prompts,
// CTA keyword + spoken line, post description, hashtags, thumbnail prompt.

import { askClaudeJSON } from "../anthropic";
import { getSettings, newId } from "../store";
import { Reel, TopicIdea, ScriptSegment } from "../types";

interface GeneratedScript {
  hookTitle: string;
  script: string;
  durationSeconds: number;
  segments: {
    text: string;
    startSeconds: number;
    endSeconds: number;
    brollPrompt: string;
    brollStyle: "ai-video" | "ai-image" | "logo-animation";
  }[];
  cta: { keyword: string; spokenLine: string; docTitle: string };
  description: string;
  hashtags: string[];
  thumbnailPrompt: string;
}

export async function generateScript(topic: TopicIdea): Promise<Reel> {
  const settings = await getSettings();

  const g = await askClaudeJSON<GeneratedScript>(
    `You are the script engine for Josh Dillard's short-form content machine.

VOICE PROFILE:
${settings.voiceProfile}

TOPIC: ${topic.title}
ANGLE: ${topic.angle || "pick the most engaging angle"}
SOURCE: ${topic.source}

Write a 30-60 second vertical reel script. Structure:
1. A viral hook title (max 7 words, shown as animated text in the first 2 seconds).
2. The script itself: hook line first, then 3-5 tight value beats, then the CTA line.
3. Split the script into 4-7 segments. For EACH segment write a B-roll prompt — a vivid,
   specific AI image/video generation prompt that a professional editor would choose for
   that exact line (e.g. talking about Anthropic -> "animated Anthropic logo on dark
   gradient, subtle glow"; talking about music -> "cinematic shot of musician playing
   keyboard in neon-lit studio"). Choose brollStyle: "logo-animation" for brand/product
   mentions, "ai-video" for dynamic scenes, "ai-image" for concepts/diagrams.
4. The CTA: the last segment is ALWAYS a call to action where Josh goes full screen and
   says something like "If you want [the tools I used / my full breakdown of X], comment
   the word [KEYWORD] and I'll send it to you." Pick a short, memorable, topic-relevant
   keyword in CAPS.
5. A post description (2-3 lines, engaging, restates the CTA keyword) and 8-12 hashtags
   mixing broad (#ai) and niche tags.
6. A thumbnail prompt: consistent branding — Josh-style confident creator in an
   environment matching the topic, bold ${settings.brand.primaryColor} and
   ${settings.brand.accentColor} color grading, big readable text of the hook title.

Estimate realistic spoken timing (~150 words/minute) for startSeconds/endSeconds.

Return JSON: { hookTitle, script, durationSeconds, segments: [{ text, startSeconds,
endSeconds, brollPrompt, brollStyle }], cta: { keyword, spokenLine, docTitle },
description, hashtags, thumbnailPrompt }`,
    { maxTokens: 4000 }
  );

  const segments: ScriptSegment[] = g.segments.map((s) => ({
    id: newId(),
    text: s.text,
    startMs: Math.round(s.startSeconds * 1000),
    endMs: Math.round(s.endSeconds * 1000),
    broll: {
      prompt: s.brollPrompt,
      style: s.brollStyle,
      provider: s.brollStyle === "ai-video" ? "runway" : "fal",
      status: "pending",
    },
  }));

  const now = new Date().toISOString();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: "scripted",
    topic,
    hookTitle: g.hookTitle,
    script: g.script,
    segments,
    captions: estimateCaptions(g.script, g.durationSeconds * 1000),
    cta: g.cta,
    thumbnailPrompt: g.thumbnailPrompt,
    description: g.description,
    hashtags: g.hashtags,
    publishResults: [],
    durationMs: Math.round(g.durationSeconds * 1000),
  };
}

// Even word spacing as a placeholder; replaced with real word timings from the
// avatar audio (via transcription alignment) once the HeyGen video is in.
function estimateCaptions(script: string, durationMs: number) {
  const words = script.split(/\s+/).filter(Boolean);
  const per = durationMs / words.length;
  return words.map((text, i) => ({
    text,
    startMs: Math.round(i * per),
    endMs: Math.round((i + 1) * per),
  }));
}
