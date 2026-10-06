import { apiFetch } from "./api";

export interface ArcadePublicationEntry {
  game_id: string;
  is_live: boolean;
  updated_by?: string;
  updated_at?: string;
}

export interface ArcadeCatalogResponse {
  games: ArcadePublicationEntry[];
}

const adminHeaders = {
  "X-TOT-Admin-Request": "1",
};

export function getArcadeCatalog() {
  return apiFetch<ArcadeCatalogResponse>("/api/arcade/catalog");
}

export function setArcadeGameLive(gameId: string, isLive: boolean) {
  return apiFetch<{ game: ArcadePublicationEntry }>(
    `/api/arcade/admin/games/${encodeURIComponent(gameId)}`,
    {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ is_live: isLive }),
    },
  );
}
