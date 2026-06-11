// The reel composition:
//   0-2s     animated viral hook title over the opening frame
//   body     split screen — B-roll (top half) / clone (bottom half) — with
//            animated captions in the center band
//   CTA      zoom transition: clone scales up to full screen for the call to action
import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Reel, EngineSettings } from "../lib/types";
import { Captions } from "./Captions";

export const FPS = 30;

export type ShortReelProps = {
  reel: Reel;
  brand: EngineSettings["brand"];
};

const msToFrames = (ms: number) => Math.round((ms / 1000) * FPS);

export const ShortReel: React.FC<ShortReelProps> = ({ reel, brand }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // CTA = the last segment: clone goes full screen.
  const ctaSegment = reel.segments[reel.segments.length - 1];
  const ctaStart = ctaSegment ? msToFrames(ctaSegment.startMs) : durationInFrames;
  const transitionLen = Math.round(FPS * 0.6);

  // Zoom transition: the bottom-half clone window grows to fill the frame.
  const zoom = spring({
    frame: frame - (ctaStart - transitionLen),
    fps: FPS,
    config: { damping: 18, stiffness: 90 },
    durationInFrames: transitionLen,
  });
  const avatarTop = interpolate(zoom, [0, 1], [50, 0]); // % from top
  const avatarHeight = interpolate(zoom, [0, 1], [50, 100]); // % of frame
  const avatarScale = interpolate(zoom, [0, 1], [1, 1.0]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B0F", fontFamily: brand.fontFamily }}>
      {/* ---- B-roll, top half (fades out as the CTA zoom takes over) ---- */}
      <AbsoluteFill
        style={{
          height: "50%",
          overflow: "hidden",
          opacity: interpolate(zoom, [0, 0.6], [1, 0]),
        }}
      >
        {reel.segments.map((seg) => (
          <Sequence
            key={seg.id}
            from={msToFrames(seg.startMs)}
            durationInFrames={msToFrames(seg.endMs - seg.startMs)}
          >
            <BrollShotView
              url={seg.broll.assetUrl}
              style={seg.broll.style}
              accent={brand.accentColor}
            />
          </Sequence>
        ))}
      </AbsoluteFill>

      {/* ---- Clone, bottom half -> full screen at CTA ---- */}
      <div
        style={{
          position: "absolute",
          top: `${avatarTop}%`,
          left: 0,
          width: "100%",
          height: `${avatarHeight}%`,
          overflow: "hidden",
          transform: `scale(${avatarScale})`,
        }}
      >
        {reel.avatarVideoUrl ? (
          <OffthreadVideo
            src={reel.avatarVideoUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <AvatarPlaceholder color={brand.primaryColor} />
        )}
      </div>

      {/* ---- Animated captions, center band (hidden during full-screen CTA) ---- */}
      <div style={{ opacity: interpolate(zoom, [0, 0.5], [1, 0]) }}>
        <Captions
          words={reel.captions}
          fps={FPS}
          style={brand.captionStyle}
          primaryColor={brand.primaryColor}
          accentColor={brand.accentColor}
        />
      </div>

      {/* ---- CTA captions move to lower third on the full-screen avatar ---- */}
      {zoom > 0.5 && (
        <Captions
          words={reel.captions}
          fps={FPS}
          style={brand.captionStyle}
          primaryColor={brand.primaryColor}
          accentColor={brand.accentColor}
          verticalPosition={78}
        />
      )}

      {/* ---- Hook title, first 2 seconds ---- */}
      <Sequence durationInFrames={FPS * 2}>
        <HookTitle title={reel.hookTitle} primary={brand.primaryColor} accent={brand.accentColor} />
      </Sequence>

      {/* ---- CTA keyword badge ---- */}
      {zoom > 0.8 && (
        <KeywordBadge keyword={reel.cta.keyword} accent={brand.accentColor} />
      )}
    </AbsoluteFill>
  );
};

const BrollShotView: React.FC<{
  url?: string;
  style: string;
  accent: string;
}> = ({ url, style, accent }) => {
  const frame = useCurrentFrame();
  // Ken Burns drift on stills / logo cards so nothing ever feels static.
  const drift = interpolate(frame, [0, 150], [1.0, 1.12]);

  if (!url) {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, #1a1a24, ${accent}22)`,
          alignItems: "center",
          justifyContent: "center",
          color: "#555",
          fontSize: 36,
        }}
      >
        B-roll generating…
      </AbsoluteFill>
    );
  }

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  if (isVideo) {
    return (
      <OffthreadVideo
        src={url}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return (
    <Img
      src={url}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `scale(${drift})`,
        ...(style === "logo-animation"
          ? { filter: `drop-shadow(0 0 60px ${accent}66)` }
          : {}),
      }}
    />
  );
};

const HookTitle: React.FC<{ title: string; primary: string; accent: string }> = ({
  title,
  primary,
  accent,
}) => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 200 } });
  const exit = interpolate(frame, [FPS * 1.6, FPS * 2], [1, 0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: exit }}>
      <div
        style={{
          transform: `scale(${pop}) rotate(${interpolate(pop, [0, 1], [-6, -2])}deg)`,
          background: `linear-gradient(135deg, ${primary}, ${accent})`,
          padding: "36px 56px",
          borderRadius: 28,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          maxWidth: "85%",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
            textTransform: "uppercase",
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const KeywordBadge: React.FC<{ keyword: string; accent: string }> = ({ keyword, accent }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 6) * 0.04;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 140,
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${pulse})`,
          background: accent,
          color: "#000",
          fontSize: 54,
          fontWeight: 900,
          padding: "20px 48px",
          borderRadius: 999,
          boxShadow: `0 0 60px ${accent}aa`,
        }}
      >
        COMMENT “{keyword}”
      </div>
    </div>
  );
};

const AvatarPlaceholder: React.FC<{ color: string }> = ({ color }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 50% 30%, ${color}33, #0B0B0F)`,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div style={{ fontSize: 120 }}>🎙️</div>
    <div style={{ color: "#888", fontSize: 32, marginTop: 16 }}>Clone video pending</div>
  </AbsoluteFill>
);
