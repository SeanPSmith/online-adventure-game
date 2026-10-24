import { apiFetch } from "./api";

/** Mirrors the server Author Studio gate for navigation only.
 * Server checks remain authoritative for every author read/write.
 */
export function canUseAuthorStudio(permissions?: readonly string[]): boolean {
  return Boolean(permissions && !permissions.includes("author_denied") &&
    (permissions.includes("author") || permissions.includes("admin")));
}

export interface AuthorIdentity {
  authorized: boolean;
  user: {
    user_id: string;
    username: string;
    email: string;
  };
}

export interface AuthorDocument {
  document_id?: string;
  title?: string;
  slug?: string;
  document_kind?: string;
  archived?: boolean;
  [key: string]: unknown;
}

export function getAuthorIdentity() {
  return apiFetch<AuthorIdentity>("/api/author/me");
}

export function listAuthorDocuments() {
  return apiFetch<{ adventures: AuthorDocument[] }>("/api/author/adventures");
}
