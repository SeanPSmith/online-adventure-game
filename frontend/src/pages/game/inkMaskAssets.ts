/** Shared decode barrier for the living manuscript's 33 organic alpha textures.
 * Calling `new Image()` without waiting for decode causes intermittent blank/old
 * frame flashes, especially during the slower poetic transition.
 * The single promise survives route switches; no network or game-state calls.
 */
export const INK_MASK_FRAMES = 33;
const MASK_ROOT = "/art/pass64/ink-masks";
export const inkMaskSource = (index: number) =>
  `${MASK_ROOT}/ink-${String(Math.max(0, Math.min(INK_MASK_FRAMES - 1, Math.round(index)))).padStart(2, "0")}.webp`;

// Keep decoded frames referenced while the player uses the book. Otherwise
// browsers under memory pressure may drop textures and flash old frames.
const decodedFrames: HTMLImageElement[] = [];
let preloadPromise: Promise<boolean> | undefined;
export function preloadInkMasks(): Promise<boolean> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.all(Array.from({ length: INK_MASK_FRAMES }, (_, index) => {
    const image = new Image();
    decodedFrames.push(image);
    image.src = inkMaskSource(index);
    if (typeof image.decode === "function") return image.decode();
    return new Promise<void>((resolve, reject) => {
      if (image.complete && image.naturalWidth) return resolve();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Missing ink mask ${index}`));
    });
  })).then(() => true).catch(() => false);
  return preloadPromise;
}

/** Avoid repeatedly invalidating the same CSS mask URL on consecutive RAF ticks. */
export function applyInkMask(element: HTMLElement | null, index: number): void {
  if (!element) return;
  const mask = `url("${inkMaskSource(index)}")`;
  if (element.style.maskImage !== mask) element.style.maskImage = mask;
  if (element.style.webkitMaskImage !== mask) element.style.webkitMaskImage = mask;
}

/** Graceful fallback if any asset fails to decode (never strand blank pages). */
export function clearInkMask(element: HTMLElement | null): void {
  if (!element) return;
  element.style.maskImage = "none";
  element.style.webkitMaskImage = "none";
}
