import { apiFetch } from "./api";

export interface Character {
  character_id: string;
  owner_user_id: string;
  name: string;
  bio: string;
  archetype: string;
  appearance: Record<string, string>;
  created_at: string;
  updated_at: string;
  level: number;
  experience: number;
  unspent_stat_points: number;
  unspent_skill_points: number;
  unspent_talent_points: number;
  talents: string[];
  progression_version: number;
  advancement_history: Record<string, unknown>[];
  max_health: number;
  health: number;
  is_alive: boolean;
  death_record: Record<string, unknown> | null;
  hero_status: "active" | "retired" | "buried";
  retired_at: string | null;
  buried_at: string | null;
  epitaph: string;
  rest_recovered_at: string | null;
  effects: Array<Record<string, unknown>>;
  xp_current: number;
  xp_level_floor: number;
  xp_next_level: number;
  xp_into_level: number;
  xp_needed_for_next_level: number;
  xp_level_span: number;
  xp_progress_percent: number;
  xp_level_multiplier: number;
  stats: Record<string, number>;
  skills: Record<string, number>;
  inventory: string[];
}

export interface CharacterListResponse {
  characters: Character[];
}

export interface TalentDefinition {
  id: string;
  label: string;
  description: string;
  min_level: number;
  stat_modifiers: Record<string, number>;
  skill_modifiers: Record<string, number>;
}

export interface CreationRules {
  stat_point_budget: number;
  skill_point_budget: number;
  stat_min: number;
  stat_max: number;
  skill_min: number;
  skill_max: number;
  advancement_stat_cap: number;
  advancement_skill_cap: number;
  skill_points_per_level: number;
  talent_points_start_level: number;
  talent_point_interval: number;
  talents: TalentDefinition[];
  stats: { id: string; label: string; description: string }[];
  skills: { id: string; label: string; stat: string; description: string }[];
}

export interface ArchivedNarrationClip {
  clip_id: string;
  turn_number: number;
  position: number;
  kind: "story" | "choice";
  voice: string;
}

export function listArchivedNarration(historyId: string) {
  return apiFetch<{ clips: ArchivedNarrationClip[] }>(
    `/api/narration/archive/${encodeURIComponent(historyId)}`,
  );
}

export function archivedNarrationUrl(historyId: string, clipId: string): string {
  const base = import.meta.env.VITE_API_BASE ?? "";
  return `${base}/api/narration/archive/${encodeURIComponent(historyId)}/${encodeURIComponent(clipId)}`;
}

export interface CompletedStoryPlayer {
  character_id: string;
  character_name: string;
  is_host: boolean;
}

export interface CompletedStory {
  history_id: string;
  room_code: string;
  adventure_id: string;
  adventure_title: string;
  ending_label: string;
  turn_count: number;
  final_scene_title: string;
  final_resolution: string;
  recap: string;
  completed_at: string;
  story_state: {
    resolved_threads: unknown[];
    closed_opportunities: unknown[];
  };
  director_usage: {
    requests: number;
    total_tokens: number;
  };
  players: CompletedStoryPlayer[];
}

export function listCharacters() {
  return apiFetch<CharacterListResponse>("/api/characters");
}

export function getCreationRules() {
  return apiFetch<CreationRules>("/api/characters/creation-rules");
}

export function createCharacter(
  name: string,
  bio: string,
  stats: Record<string, number>,
  skills: Record<string, number>,
  archetype = "",
  appearance: AppearanceAnswers | Record<string, string> = {},
) {
  return apiFetch<Character>("/api/characters", {
    method: "POST",
    body: JSON.stringify({ name, bio, stats, skills, archetype, appearance }),
  });
}

export function getCharacter(characterId: string) {
  return apiFetch<Character>(`/api/characters/${encodeURIComponent(characterId)}`);
}

export function advanceCharacter(
  characterId: string,
  stats: Record<string, number>,
  skills: Record<string, number>,
  talents: string[] = [],
) {
  return apiFetch<Character>(
    `/api/characters/${encodeURIComponent(characterId)}/advance`,
    {
      method: "POST",
      body: JSON.stringify({ stats, skills, talents }),
    },
  );
}

export function updateCharacterProfile(characterId: string, bio: string) {
  return apiFetch<Character>(
    `/api/characters/${encodeURIComponent(characterId)}/profile`,
    {
      method: "PATCH",
      body: JSON.stringify({ bio }),
    },
  );
}

export function listCharacterStories(characterId: string) {
  return apiFetch<{ stories: CompletedStory[] }>(
    `/api/characters/${encodeURIComponent(characterId)}/stories`,
  );
}


export interface HeroMemorial {
  character_id: string;
  name: string;
  level: number;
  experience: number;
  epitaph: string;
  cause: string;
  buried_at: string;
}

export function listGraveyard() {
  return apiFetch<{ memorials: HeroMemorial[] }>("/api/characters/graveyard");
}

export function setHeroDisposition(characterId: string, action: "retire" | "restore" | "bury", epitaph = "") {
  return apiFetch<Character>(`/api/characters/${encodeURIComponent(characterId)}/disposition`, {
    method: "POST",
    body: JSON.stringify({ action, epitaph }),
  });
}

export function deleteCharacter(characterId: string) {
  return apiFetch<{ message: string }>(`/api/characters/${encodeURIComponent(characterId)}`, {
    method: "DELETE",
  });
}

export interface AppearanceAnswers {
  species: string; gender: string; age: string; height: string; weight: string;
  build: string; face: string; skin: string; hair: string; attire: string;
  origin: string; calling: string; disposition: string; motivation: string;
  defining_detail: string;
}
export interface HeroPortraitBook {
  attempts_used: number;
  max_attempts: number;
  selected_attempt: number | null;
  candidates: {attempt: number; url: string}[];
}
export function proposeHeroBiography(name: string, appearance: AppearanceAnswers, stats: Record<string, number>, skills: Record<string, number>) {
  return apiFetch<{bio: string}>("/api/characters/creation-proposal", {
    method: "POST", body: JSON.stringify({name, appearance, stats, skills}),
  });
}
export function getHeroPortraits(heroId: string) {
  return apiFetch<HeroPortraitBook>(`/api/characters/${encodeURIComponent(heroId)}/portraits`);
}
export function generateHeroPortrait(heroId: string) {
  return apiFetch<HeroPortraitBook>(`/api/characters/${encodeURIComponent(heroId)}/portrait/generate`, {method: "POST"});
}
export function chooseHeroPortrait(heroId: string, attempt: number) {
  return apiFetch<HeroPortraitBook>(`/api/characters/${encodeURIComponent(heroId)}/portrait/select`, {
    method: "POST", body: JSON.stringify({attempt}),
  });
}
