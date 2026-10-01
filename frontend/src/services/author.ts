import { apiFetch } from "./api";

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
