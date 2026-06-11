import React from "react";
import { Composition } from "remotion";
import { ShortReel, ShortReelProps, FPS } from "./ShortReel";
import { demoReel } from "./demoReel";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ShortReel"
      component={ShortReel}
      durationInFrames={Math.ceil((demoReel.durationMs / 1000) * FPS) + FPS * 4}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ reel: demoReel, brand: demoBrand } satisfies ShortReelProps}
      calculateMetadata={({ props }) => ({
        durationInFrames:
          Math.ceil((props.reel.durationMs / 1000) * FPS) + FPS * 4,
      })}
    />
  );
};

export const demoBrand = {
  primaryColor: "#7C3AED",
  accentColor: "#F59E0B",
  captionStyle: "bold-pop" as const,
  fontFamily: "Inter",
};
