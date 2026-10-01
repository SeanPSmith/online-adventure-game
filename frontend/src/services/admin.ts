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
