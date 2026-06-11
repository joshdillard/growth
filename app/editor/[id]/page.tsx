"use client";

// The editor: left = live Remotion preview (the exact composition that renders),
// center = manual controls (title, script, captions, B-roll, CTA, description),
// right = pipeline status + actions + publish targets.

import { use, useCallback, useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { ShortReel, FPS } from "@/remotion/ShortReel";
import { Reel, EngineSettings } from "@/lib/types";
import { EditPanel } from "@/components/EditPanel";
import { ActionsPanel } from "@/components/ActionsPanel";

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reel, setReel] = useState<Reel | null>(null);
  const [settings, setSettings] = useState<EngineSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [r, s] = await Promise.all([
      fetch(`/api/reels/${id}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    if (!r.error) setReel(r);
    setSettings(s);
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000); // pick up async asset/render progress
    return () => clearInterval(t);
  }, [refresh]);

  const save = async (updates: Partial<Reel>) => {
    if (!reel) return;
    setSaving(true);
    setReel({ ...reel, ...updates }); // optimistic
    try {
      const res = await fetch(`/api/reels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setReel(await res.json());
    } finally {
      setSaving(false);
    }
  };

  if (!reel || !settings) {
    return <main className="p-10 text-zinc-500">Loading reel…</main>;
  }

  const durationInFrames = Math.max(Math.ceil((reel.durationMs / 1000) * FPS), FPS);

  return (
    <main className="grid grid-cols-[380px_1fr_320px] gap-4 p-4 h-[calc(100vh-57px)]">
      {/* LEFT: live preview */}
      <section className="flex flex-col items-center">
        <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-brand/10">
          <Player
            component={ShortReel}
            inputProps={{ reel, brand: settings.brand }}
            durationInFrames={durationInFrames}
            fps={FPS}
            compositionWidth={1080}
            compositionHeight={1920}
            controls
            loop
            style={{ width: 340, height: 605 }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Live preview = the exact Remotion composition used for the final render.
          <br />
          Top: B-roll · Middle: captions · Bottom: clone · End: full-screen CTA
        </p>
      </section>

      {/* CENTER: manual edit controls */}
      <section className="overflow-y-auto pr-2">
        <EditPanel reel={reel} onSave={save} saving={saving} />
      </section>

      {/* RIGHT: pipeline + actions */}
      <section className="overflow-y-auto">
        <ActionsPanel reel={reel} settings={settings} onChanged={refresh} />
      </section>
    </main>
  );
}
