"use client";

// Center panel: every manually-editable piece of the reel.
// Fields save on blur; B-roll prompts can be edited and re-rolled per segment.

import { useState } from "react";
import { Reel } from "@/lib/types";

export function EditPanel({
  reel,
  onSave,
  saving,
}: {
  reel: Reel;
  onSave: (updates: Partial<Reel>) => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Edit Reel</h2>
        <span className="text-xs text-zinc-600">{saving ? "Saving…" : "Saved"}</span>
      </div>

      <Field label="Hook Title (animated, first 2s)">
        <BlurInput
          value={reel.hookTitle}
          onCommit={(v) => onSave({ hookTitle: v })}
        />
      </Field>

      <Field label="Script (what the clone says)">
        <BlurTextarea
          value={reel.script}
          rows={6}
          onCommit={(v) => onSave({ script: v })}
        />
        <p className="text-xs text-zinc-600 mt-1">
          Editing the script? Re-run “Generate assets” so the clone re-records it.
        </p>
      </Field>

      <Field label={`B-roll segments (${reel.segments.length})`}>
        <div className="space-y-2">
          {reel.segments.map((seg, i) => (
            <SegmentEditor
              key={seg.id}
              index={i}
              seg={seg}
              isLast={i === reel.segments.length - 1}
              onChange={(updated) => {
                const segments = reel.segments.map((s) => (s.id === seg.id ? updated : s));
                onSave({ segments });
              }}
            />
          ))}
        </div>
      </Field>

      <Field label="CTA keyword (viewers comment this)">
        <BlurInput
          value={reel.cta.keyword}
          onCommit={(v) => onSave({ cta: { ...reel.cta, keyword: v.toUpperCase() } })}
        />
        {reel.cta.docUrl && (
          <a
            href={reel.cta.docUrl}
            target="_blank"
            className="text-xs text-brand underline mt-1 inline-block"
          >
            View CTA Google Doc →
          </a>
        )}
      </Field>

      <Field label="Post description / caption">
        <BlurTextarea
          value={reel.description}
          rows={3}
          onCommit={(v) => onSave({ description: v })}
        />
      </Field>

      <Field label="Hashtags (space-separated)">
        <BlurInput
          value={reel.hashtags.join(" ")}
          onCommit={(v) => onSave({ hashtags: v.split(/\s+/).filter(Boolean) })}
        />
      </Field>

      <Field label="Thumbnail prompt">
        <BlurTextarea
          value={reel.thumbnailPrompt}
          rows={2}
          onCommit={(v) => onSave({ thumbnailPrompt: v, thumbnailUrl: undefined })}
        />
        {reel.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reel.thumbnailUrl}
            alt="thumbnail"
            className="mt-2 w-28 rounded-lg border border-zinc-800"
          />
        )}
      </Field>
    </div>
  );
}

function SegmentEditor({
  index,
  seg,
  isLast,
  onChange,
}: {
  index: number;
  seg: Reel["segments"][number];
  isLast: boolean;
  onChange: (s: Reel["segments"][number]) => void;
}) {
  const statusDot = {
    pending: "bg-zinc-600",
    generating: "bg-purple-500 animate-pulse",
    ready: "bg-emerald-500",
    failed: "bg-red-500",
  }[seg.broll.status];

  return (
    <div className="card !p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          #{index + 1} · {(seg.startMs / 1000).toFixed(1)}s–{(seg.endMs / 1000).toFixed(1)}s
          {isLast && <span className="ml-2 text-brand-accent">★ full-screen CTA</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          {seg.broll.status} · {seg.broll.provider}
        </span>
      </div>
      <p className="text-sm text-zinc-300 italic">“{seg.text}”</p>
      {!isLast && (
        <>
          <BlurTextarea
            value={seg.broll.prompt}
            rows={2}
            onCommit={(v) =>
              onChange({ ...seg, broll: { ...seg.broll, prompt: v, status: "pending", assetUrl: undefined } })
            }
          />
          <div className="flex items-center gap-2">
            <BlurInput
              value={seg.broll.assetUrl ?? ""}
              placeholder="…or paste a manual asset URL"
              onCommit={(v) =>
                v && onChange({ ...seg, broll: { ...seg.broll, assetUrl: v, status: "ready", provider: "manual" } })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function BlurInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  return (
    <input
      className="input"
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
    />
  );
}

function BlurTextarea({
  value,
  rows,
  onCommit,
}: {
  value: string;
  rows: number;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <textarea
      className="input resize-y"
      rows={rows}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
    />
  );
}
