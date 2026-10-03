export type SwipeDirection = "up" | "down" | "left" | "right";

export interface SwipePoint {
  x: number;
  y: number;
}

export function swipeDirection(
  start: SwipePoint | null,
  end: SwipePoint,
  threshold = 22,
): SwipeDirection | null {
  if (!start) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
    return null;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "down" : "up";
}
