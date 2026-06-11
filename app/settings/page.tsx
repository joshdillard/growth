"use client";

// Engine settings: autopilot, daily target, platforms, voice profile, branding.

import { useEffect, useState } from "react";
import { EngineSettings, Platform } from "@/lib/types";

const ALL_PLATFORMS: Platform[] = ["instagram", "facebook", "youtube", "tiktok"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<EngineSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  if (!settings) return <main className="p-10 text-zinc-500">Loading…</main>;

  const save = async (updates: Partial<EngineSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Engine Settings</h2>
        {saved && <span className="text-xs text-emerald-500">Saved ✓</span>}
      </div>

      <div className="card space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Autopilot</div>
            <div className="text-xs text-zinc-500">
              Skip manual QC: approve, render, and publish automatically after assets generate.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.autopilot}
            onChange={(e) => save({ autopilot: e.target.checked })}
          />
        </label>

        <div>
          <label className="label">Daily reel target (3–7)</label>
          <input
            type="number"
            min={1}
            max={7}
            className="input w-24"
            value={settings.dailyReelTarget}
            onChange={(e) => save({ dailyReelTarget: Number(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Platforms</label>
          <div className="flex gap-4">
            {ALL_PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={settings.platforms.includes(p)}
                  onChange={(e) =>
                    save({
                      platforms: e.target.checked
                        ? [...settings.platforms, p]
                        : settings.platforms.filter((x) => x !== p),
                    })
                  }
                />
                {p}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <label className="label">Voice profile (how scripts sound like you)</label>
        <textarea
          className="input resize-y"
          rows={6}
          defaultValue={settings.voiceProfile}
          onBlur={(e) => save({ voiceProfile: e.target.value })}
        />
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold text-sm">Branding</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Primary color</label>
            <input
              type="color"
              value={settings.brand.primaryColor}
              onChange={(e) => save({ brand: { ...settings.brand, primaryColor: e.target.value } })}
            />
          </div>
          <div>
            <label className="label">Accent color</label>
            <input
              type="color"
              value={settings.brand.accentColor}
              onChange={(e) => save({ brand: { ...settings.brand, accentColor: e.target.value } })}
            />
          </div>
        </div>
        <div>
          <label className="label">Caption style</label>
          <select
            className="input w-auto"
            value={settings.brand.captionStyle}
            onChange={(e) =>
              save({
                brand: {
                  ...settings.brand,
                  captionStyle: e.target.value as EngineSettings["brand"]["captionStyle"],
                },
              })
            }
          >
            <option value="bold-pop">Bold Pop (uppercase, word highlight)</option>
            <option value="karaoke">Karaoke (word-by-word color fill)</option>
            <option value="clean-lower">Clean Lower (boxed, sentence case)</option>
          </select>
        </div>
      </div>
    </main>
  );
}
