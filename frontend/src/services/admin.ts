import { ApiError, apiFetch } from "./api";
import type { User } from "./auth";

export interface AdminUserListResponse {
  users: User[];
}

export interface AdminAuthorAccessResponse {
  updated_by: string;
  user: User | null;
}

export interface ContentImportReport {
  ok: boolean;
  imported_by_user_id: string;
  authors_resolved: string[];
  ownership_map: Record<string, string>;
  restart_required: boolean;
  documents: { inserted: number; skipped: number };
  versions: { inserted: number; skipped: number };
  generated_adventures: { inserted: number; skipped: number };
}

export interface ContentImportConflictDetail {
  message?: string;
  missing_usernames?: string[];
  conflicts?: string[];
}

const adminHeaders = {
  "X-TOT-Admin-Request": "1",
};

export function listUsers(search = "") {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiFetch<AdminUserListResponse>(`/api/auth/admin/users${suffix}`);
}

export function setAuthorAccess(userId: string, enabled: boolean) {
  return apiFetch<AdminAuthorAccessResponse>(
    `/api/auth/admin/users/${encodeURIComponent(userId)}/author-access`,
    {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ enabled }),
    },
  );
}

export function importAuthorContent(
  bundle: unknown,
  authorMap: Record<string, string>,
) {
  return apiFetch<ContentImportReport>("/api/auth/admin/content/import", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ bundle, author_map: authorMap }),
  });
}

export function contentImportErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Content import failed.";
  }

  const detail = error.detail as ContentImportConflictDetail | undefined;
  if (!detail || typeof detail !== "object") return error.message;

  const lines: string[] = [];
  if (detail.message) lines.push(detail.message);
  if (detail.missing_usernames?.length) {
    lines.push(`Missing cloud accounts: ${detail.missing_usernames.join(", ")}`);
  }
  if (detail.conflicts?.length) {
    lines.push(...detail.conflicts);
  }

  return lines.length ? lines.join(" ") : error.message;
}

export interface AdminAnalyticsPlayer {
  user_id: string;
  username: string;
  hero_name: string;
  is_host: boolean;
  is_online: boolean;
}

export interface AdminAnalyticsLiveRoom {
  room_code: string;
  play_mode: string;
  player_count: number;
  online_count: number;
  adventure_id: string;
  adventure_title: string;
  turn_number: number;
  state: string;
  players: AdminAnalyticsPlayer[];
}

export interface AdminAnalyticsSnapshot {
  generated_at: string;
  live: {
    rooms: number;
    online_players: number;
    resolved_turns_in_live_rooms: number;
    solo_rooms: number;
    coop_rooms: number;
    rooms_detail: AdminAnalyticsLiveRoom[];
  };
  accounts: {
    registered_users: number;
    active_accounts: number;
    authors: number;
    recently_active_users: number;
    recent_auth_sessions: number;
    recent_window_minutes: number;
    players_with_completed_history: number;
  };
  totals: {
    adventures_completed: number;
    turns_completed: number;
    average_turns: number;
    generated_adventures: number;
    approved_generated_adventures: number;
  };
  popular_adventures: Array<{
    adventure_id: string;
    adventure_title: string;
    completions: number;
    turns: number;
    average_turns: number;
    last_completed_at: string;
  }>;
  top_players: Array<{
    user_id: string;
    username: string;
    adventures_completed: number;
    turns_played: number;
    checks_total: number;
    checks_succeeded: number;
    critical_successes: number;
    intermission_wins: number;
    last_completed_at: string;
  }>;
  recent_completions: Array<{
    history_id: string;
    adventure_title: string;
    ending_label: string;
    turn_count: number;
    completed_at: string;
    heroes: string;
  }>;
  daily_activity: Array<{
    day: string;
    adventures: number;
    turns: number;
  }>;
}

export function getAdminAnalytics() {
  return apiFetch<AdminAnalyticsSnapshot>("/api/auth/admin/analytics");
}

export interface AdminProjectDocumentationSection {
  id: string;
  title: string;
  content: string;
}

export interface AdminProjectDocumentation {
  title: string;
  filename: string;
  updated_at: string;
  intro: string;
  content: string;
  sections: AdminProjectDocumentationSection[];
}

export function getAdminProjectDocumentation() {
  return apiFetch<AdminProjectDocumentation>("/api/auth/admin/project-docs");
}
