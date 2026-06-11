"use client";

// Queue dashboard: every reel in the pipeline, newest first, grouped by status.
// "Research new reels" kicks off discovery+scripting for today's batch.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Reel, ReelStatus } from "@/lib/types";

const STATUS_META: Record<ReelStatus, { label: string; color: string }> = {
  idea: { label: "Idea", color: "bg-zinc-600" },
  scripted: { label: "Scripted", color: "bg-blue-600" },
  generating: { label: "Generating assets", color: "bg-purple-600" },
  ready: { label: "Ready for QC", color: "bg-amber-500" },
  approved: { label: "Approved", color: "bg-emerald-600" },
  rendered: { label: "Rendered", color: "bg-teal-600" },
  published: { label: "Published", color: "bg-green-700" },
  failed: { label: "Failed", color: "bg-red-700" },
};

export default function QueuePage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(3);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/reels");
    setReels(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const research = async () => {
    setBusy(true);
    try {
      await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Production Queue</h2>
          <p className="text-sm text-zinc-500">
            {reels.length} reels · {reels.filter((r) => r.status === "ready").length} awaiting QC ·{" "}
            {reels.filter((r) => r.status === "published").length} published
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n} reels</option>
            ))}
          </select>
          <button className="btn-primary" onClick={research} disabled={busy}>
            {busy ? "Researching…" : "🔍 Research new reels"}
          </button>
        </div>
      </div>

      {reels.length === 0 && (
        <div className="card text-center py-16 text-zinc-500">
          No reels yet. Hit <span className="text-brand font-medium">Research new reels</span> to
          scrape today&apos;s AI / creator / entrepreneur news and generate scripts.
        </div>
      )}

      <div className="space-y-3">
        {reels.map((reel) => {
          const meta = STATUS_META[reel.status];
          return (
            <Link
              key={reel.id}
              href={`/editor/${reel.id}`}
              className="card flex items-center gap-4 hover:border-brand transition-colors"
            >
              <div className="w-14 h-24 rounded-lg bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center text-2xl">
                {reel.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reel.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  "🎬"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{reel.hookTitle || reel.topic.title}</div>
                <div className="text-sm text-zinc-500 truncate">{reel.topic.title}</div>
                <div className="text-xs text-zinc-600 mt-1">
                  CTA: <span className="text-brand-accent font-mono">{reel.cta?.keyword}</span> ·{" "}
                  {Math.round(reel.durationMs / 1000)}s · {new Date(reel.createdAt).toLocaleString()}
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full text-white ${meta.color}`}>
                {meta.label}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
