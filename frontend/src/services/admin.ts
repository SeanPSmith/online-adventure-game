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


export interface AdminUsageSnapshot {
  generated_at: string;
  period_key: string;
  guardrails: {
    global_daily_budget_usd: number;
    global_daily_request_limit: number;
    default_playtester_budget_usd: number;
    default_playtester_request_limit: number;
  };
  today: { requests: number; estimated_cost_usd: number };
  month: {
    requests: number;
    failed_requests: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    average_latency_ms: number;
  };
  top_users: Array<{
    user_id: string;
    username: string;
    requests: number;
    failed_requests: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
  }>;
  operations: Array<{
    operation: string;
    model: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    average_latency_ms: number;
  }>;
}

export function getAdminUsage() {
  return apiFetch<AdminUsageSnapshot>("/api/auth/admin/usage");
}

export function setUserEntitlement(
  userId: string,
  payload: {
    plan_id: string;
    monthly_budget_usd: number;
    monthly_request_limit: number;
    is_unlimited: boolean;
  },
) {
  return apiFetch<{ updated_by: string; entitlement: unknown; usage: unknown }>(
    `/api/auth/admin/users/${encodeURIComponent(userId)}/entitlement`,
    {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify(payload),
    },
  );
}

export interface OperationsRoom {
 room_code: string; adventure_id: string; adventure_title: string; play_mode: string;
 turn_number: number; state: string; online_count: number; player_count: number; started: boolean; pending_qte: boolean;
 players: Array<{user_id: string; hero_name: string; is_online: boolean; is_host: boolean}>;
}
export interface OperationsSnapshot {
 generated_at: string; period_key: string; ai_paused: boolean;
 metrics: {retry_calls: number; retry_call_share: number | null; requests: number; failed: number; repairs: number; pending: number; average_latency_ms: number; failure_rate: number; repair_call_share: number; reserved_today_usd: number};
 lifecycle: {started_retained: number; active: number; lobbies: number; completed: number; abandoned: number};
 qte: {resolved: number; timed_out: number; timeout_rate: number | null};
 adventures: Array<{adventure_id: string | null; room_code: string | null; requests: number; input_tokens: number; output_tokens: number; estimated_cost_usd: number; reserved_usd: number; failed: number}>;
 failures: Array<{event_id: string; occurred_at: string; room_code: string | null; adventure_id: string | null; user_id: string; operation: string; model: string; error_type: string; latency_ms: number}>;
 actions: Array<{event_id: string; occurred_at: string; actor_id: string; actor_label?: string; target_label?: string; action: string; target_id: string; details: Record<string, unknown>}>;
 rooms: OperationsRoom[];
}
export function getOperations() {return apiFetch<OperationsSnapshot>("/api/auth/admin/operations");}
export function setAIPause(paused: boolean) {return apiFetch("/api/auth/admin/ai-pause", {method: "PUT", headers: adminHeaders, body: JSON.stringify({paused})});}
export function setAccountActive(userId: string, enabled: boolean) {return apiFetch(`/api/auth/admin/users/${encodeURIComponent(userId)}/active`, {method: "PUT", headers: adminHeaders, body: JSON.stringify({enabled})});}
export function terminateRoom(roomCode: string, confirmation: string) {return apiFetch(`/api/auth/admin/rooms/${encodeURIComponent(roomCode)}/terminate`, {method: "POST", headers: adminHeaders, body: JSON.stringify({confirmation})});}
