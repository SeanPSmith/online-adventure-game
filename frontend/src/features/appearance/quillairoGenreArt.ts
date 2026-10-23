/** Initial approved RGBA category fallbacks (all have >=10% clear margins).
 * These are stable fallback illustrations, not generated scene events.
 */
export function genreInkIllustration(title: string, tags: readonly string[] = []): string {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  if (/space|star|orbit|sci.fi|cyber|robot|galaxy|future|alien/.test(text)) return "/art/quillairo-public/living-worlds.png";
  if (/horror|manor|haunt|gothic|shadow|ghost|veil|mystery|occult/.test(text)) return "/art/quillairo-public/auth-journey.png";
  return "/art/quillairo-public/home-vista.png";
}
export function coverCandidateIds(metadata: Record<string, unknown> | undefined): string[] {
  const ids = [metadata?.brief_document_id, metadata?.world_document_id];
  return ids.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id));
}
export function coverArtUrl(id: string): string {
  return `/api/story-art/worlds/${encodeURIComponent(id)}/image`;
}
