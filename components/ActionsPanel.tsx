"use client";

// Right panel: pipeline progress, QC actions, and publish controls.

import { useState } from "react";
import { Reel, EngineSettings, Platform } from "@/lib/types";

const PIPELINE_STEPS: { key: string; label: string; done: (r: Reel) => boolean }[] = [
  { key: "script", label: "Script + CTA + captions", done: (r) => !!r.script },
  { key: "avatar", label: "Clone video (HeyGen)", done: (r) => !!r.avatarVideoUrl },
  {
    key: "broll",
    label: "B-roll shots",
    done: (r) => r.segments.length > 0 && r.segments.slice(0, -1).every((s) => s.broll.status === "ready"),
  },
  { key: "thumb", label: "Thumbnail", done: (r) => !!r.thumbnailUrl },
  { key: "doc", label: "CTA Google Doc", done: (r) => !!r.cta.docUrl },
  { key: "render", label: "Final render", done: (r) => !!r.renderedVideoPath },
];

const PLATFORM_ICONS: Record<Platform, string> = {
  instagram: "📸 Instagram",
  facebook: "📘 Facebook",
  youtube: "▶️ YouTube",
  tiktok: "🎵 TikTok",
};

export function ActionsPanel({
  reel,
  settings,
  onChanged,
}: {
  reel: Reel;
  settings: EngineSettings;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>(settings.platforms);

  const act = async (action: string, url?: string, body?: object) => {
    setBusy(action);
    try {
      await fetch(url ?? `/api/reels/${reel.id}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? { action }),
      });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold text-sm mb-3">Pipeline</h3>
        <ul className="space-y-2">
          {PIPELINE_STEPS.map((step) => (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              <span className={step.done(reel) ? "text-emerald-500" : "text-zinc-600"}>
                {step.done(reel) ? "✓" : "○"}
              </span>
              <span className={step.done(reel) ? "text-zinc-300" : "text-zinc-500"}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
        {reel.notes && (
          <p className="text-xs text-red-400 mt-3 border-t border-zinc-800 pt-2">{reel.notes}</p>
        )}
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold text-sm mb-1">Actions</h3>
        <button
          className="btn-primary w-full"
          disabled={busy !== null}
          onClick={() => act("assets")}
        >
          {busy === "assets" ? "Generating…" : "⚙️ Generate assets (clone + B-roll + doc)"}
        </button>
        <button
          className="btn-ghost w-full"
          disabled={busy !== null || reel.status === "generating"}
          onClick={() => act("approve")}
        >
          ✅ Approve (QC sign-off)
        </button>
        <button
          className="btn-ghost w-full"
          disabled={busy !== null || !reel.avatarVideoUrl}
          onClick={() => act("render")}
        >
          {busy === "render" ? "Rendering…" : "🎞️ Render final MP4"}
        </button>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold text-sm mb-1">Publish</h3>
        {(Object.keys(PLATFORM_ICONS) as Platform[]).map((p) => {
          const result = reel.publishResults.find((r) => r.platform === p);
          return (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={platforms.includes(p)}
                onChange={(e) =>
                  setPlatforms(
                    e.target.checked ? [...platforms, p] : platforms.filter((x) => x !== p)
                  )
                }
              />
              <span className="flex-1">{PLATFORM_ICONS[p]}</span>
              {result?.postId && <span className="text-emerald-500 text-xs">posted ✓</span>}
              {result?.error && (
                <span className="text-red-400 text-xs" title={result.error}>failed</span>
              )}
            </label>
          );
        })}
        <button
          className="btn-accent w-full mt-2"
          disabled={busy !== null || reel.status !== "rendered"}
          onClick={() => act("publish", `/api/reels/${reel.id}/publish`, { platforms })}
        >
          {busy === "publish" ? "Publishing…" : "🚀 Publish to selected"}
        </button>
        {reel.status !== "rendered" && reel.status !== "published" && (
          <p className="text-xs text-zinc-600">Render the final MP4 before publishing.</p>
        )}
      </div>

      <div className="card text-xs text-zinc-500 space-y-1">
        <div>Status: <span className="text-zinc-300">{reel.status}</span></div>
        <div>Duration: {Math.round(reel.durationMs / 1000)}s</div>
        <div>Source: <a className="underline" href={reel.topic.source} target="_blank">{reel.topic.source?.slice(0, 40)}…</a></div>
        {reel.avatarVideoUrl && (
          <a className="underline text-brand block" href={reel.avatarVideoUrl} target="_blank">
            Raw clone video →
          </a>
        )}
      </div>
    </div>
  );
}
