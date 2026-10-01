import type { ComponentType } from "react";

export type ArcadeCategory =
  | "reflex"
  | "action"
  | "puzzle"
  | "movement"
  | "sport"
  | "timing"
  | "strategy";

export interface ArcadeGameProps {
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
  turnNumber: number;
  playMode: "solo" | "coop";
}

export interface ArcadeGameDefinition {
  id: string;
  title: string;
  category: ArcadeCategory;
  description: string;
  supportsSolo: boolean;
  supportsCoop: boolean;
  supportsTouch: boolean;
  controls: string;
  live: boolean;
  component: ComponentType<ArcadeGameProps>;
}
