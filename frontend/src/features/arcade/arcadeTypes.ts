import type { ComponentType } from "react";

export type ArcadeCategory =
  | "reflex"
  | "action"
  | "puzzle"
  | "movement"
  | "sport"
  | "timing"
  | "strategy"
  | "racing";

export type ArcadeScoreFeedbackMode = "overlay" | "compact";

export type ArcadeMultiplayerStyle =
  | "simultaneous"
  | "alternating"
  | "score_duel";

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
  multiplayerStyle: ArcadeMultiplayerStyle;
  controls: string;
  live: boolean;
  component: ComponentType<ArcadeGameProps>;
  /**
   * Shared score feedback is injected by Arcade Lab / intermission hosts unless
   * the cabinet already owns richer contextual feedback (MISS, WAR, BUST, etc.).
   */
  managesFeedback?: boolean;
  feedbackMode?: ArcadeScoreFeedbackMode;
}
