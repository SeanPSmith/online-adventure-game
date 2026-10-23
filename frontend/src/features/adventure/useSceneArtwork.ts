import { useCallback, useEffect, useState } from "react";

/**
 * Optional scene-art status polling. Game state remains authoritative in
 * AdventurePage/useLiveAdventure; illustration failures never affect a turn.
 * No additional socket connection or scene-generation request is created.
 */
export function useSceneArtwork(roomCode: string, sceneId: string, enabled: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setImageUrl(null);
    if (!enabled || !roomCode || !sceneId) return;

    let disposed = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const check = async () => {
      if (disposed) return;
      attempts += 1;
      try {
        const url = `/api/story-art/rooms/${encodeURIComponent(roomCode)}/scenes/${encodeURIComponent(sceneId)}/status`;
        const response = await fetch(url, { credentials: "same-origin", signal: controller.signal });
        if (disposed) return;
        if (response.ok) {
          const state: { status: string; image_url?: string | null } = await response.json();
          if (disposed) return;
          if (state.status === "ready" && state.image_url) {
            setImageUrl(state.image_url);
            return;
          }
          if (state.status === "failed") return;
        }
      } catch {
        // Art is optional. Network/auth/provider errors never block the story.
      }
      if (!disposed && attempts < 36) timer = setTimeout(check, 5000);
    };
    void check();
    return () => {
      disposed = true;
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [roomCode, sceneId, enabled]);

  const onImageError = useCallback(() => setImageUrl(null), []);
  return { imageUrl, onImageError };
}
