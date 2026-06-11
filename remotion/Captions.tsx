// Animated captions rendered in the band between B-roll and clone.
// Words appear in groups of 3-4; the active word pops and gets the accent color.
import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { CaptionWord } from "../lib/types";

const GROUP_SIZE = 4;

export const Captions: React.FC<{
  words: CaptionWord[];
  fps: number;
  style: "bold-pop" | "karaoke" | "clean-lower";
  primaryColor: string;
  accentColor: string;
  verticalPosition?: number; // % from top; default centers on the seam
}> = ({ words, fps, style, primaryColor, accentColor, verticalPosition = 50 }) => {
  const frame = useCurrentFrame();
  const nowMs = (frame / fps) * 1000;

  const activeIdx = words.findIndex((w) => nowMs >= w.startMs && nowMs < w.endMs);
  if (activeIdx === -1) return null;

  const groupStart = Math.floor(activeIdx / GROUP_SIZE) * GROUP_SIZE;
  const group = words.slice(groupStart, groupStart + GROUP_SIZE);
  const groupStartFrame = (group[0].startMs / 1000) * fps;
  const entrance = spring({
    frame: frame - groupStartFrame,
    fps,
    config: { damping: 14, stiffness: 220 },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: `${verticalPosition}%`,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        transform: `translateY(-50%) scale(${interpolate(entrance, [0, 1], [0.85, 1])})`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "center",
          maxWidth: "90%",
          padding: "18px 28px",
          borderRadius: 20,
          background: style === "clean-lower" ? "rgba(0,0,0,0.55)" : "transparent",
        }}
      >
        {group.map((w, i) => {
          const isActive = groupStart + i === activeIdx;
          const isPast = nowMs >= w.endMs;
          return (
            <span
              key={`${groupStart}-${i}`}
              style={{
                fontSize: 64,
                fontWeight: 900,
                textTransform: style === "bold-pop" ? "uppercase" : "none",
                color: isActive ? accentColor : "white",
                opacity: isPast || isActive ? 1 : 0.65,
                transform: isActive ? "scale(1.12)" : "scale(1)",
                transition: "transform 80ms",
                WebkitTextStroke: "8px black",
                paintOrder: "stroke fill",
                textShadow: isActive
                  ? `0 0 40px ${accentColor}88`
                  : "0 4px 24px rgba(0,0,0,0.9)",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
