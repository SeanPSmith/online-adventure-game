/** Lightweight visual sentence tracking, not forced audio alignment.
 *  The audio chunks are unchanged, preserving the shared S3 cache and prefetch.
 *  Timeline positions are approximate (weighted by text length within a chunk).
 */
export interface SpokenSentence { paragraph: number; text: string; start: number; end: number; }

export function spokenText(text: string): string {
  return text.replace(/\*\*|__|`|^#{1,6}\s/gm, "").replace(/\s+/g, " ").trim();
}

/** Keep paragraph breaks for display and whitespace at sentence boundaries. */
export function splitSentencesForDisplay(text: string): { paragraph: number; text: string }[] {
  const result: { paragraph: number; text: string }[] = [];
  text.split(/\n{2,}/).filter(Boolean).forEach((paragraph, paragraphIndex) => {
    // A pause-inducing punctuation mark followed by whitespace ends a visual sentence.
    // Abbreviations may split early; this is presentation-only, not an audio edit.
    const pieces = paragraph.match(/.*?[.!?]+(?:["'”’])?(?=\s|$)\s*|.+$/gs) ?? [paragraph];
    for (const part of pieces) if (part.trim()) result.push({ paragraph: paragraphIndex, text: part });
  });
  return result;
}

export function visualSentenceRanges(text: string): SpokenSentence[] {
  let cursor = 0;
  return splitSentencesForDisplay(text).map((sentence) => {
    const trimmed = spokenText(sentence.text);
    const start = cursor;
    cursor += trimmed.length;
    const end = cursor;
    cursor += 1; // The normalizer joins whitespace (including paragraph breaks) to one space.
    return { ...sentence, start, end };
  });
}

/** A passage index and normalized playback position choose the approximately spoken sentence.
 *  Mismatched text or out-of-range cues are ignored; never show stale old-scene cues.
 */
export function estimateSentenceIndex(
  sceneText: string, chunks: readonly string[], cue: { index: number; text: string; progress: number } | null,
): number | null {
  if (!cue || cue.index < 0 || cue.index >= chunks.length || chunks[cue.index] !== cue.text) return null;
  if (!Number.isFinite(cue.progress)) return null;
  const full = spokenText(sceneText);
  const reconstructed = chunks.join(" ");
  if (full !== reconstructed) return null;
  const ranges = visualSentenceRanges(sceneText);
  if (!ranges.length) return null;
  const start = chunks.slice(0, cue.index).reduce((sum, chunk) => sum + chunk.length + 1, 0);
  const position = start + Math.max(0, Math.min(1, cue.progress)) * chunks[cue.index].length;
  const index = ranges.findIndex((r) => position < r.end + 0.5);
  return index < 0 ? ranges.length - 1 : index;
}
