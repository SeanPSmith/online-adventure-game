import { apiFetch } from "./api";

export interface User {
  user_id: string;
  email: string;
  username: string;
  created_at: string;
  is_active: boolean;
  permissions: string[];
}

export interface AuthResponse {
  authenticated: boolean;
  user: User | null;
}

export interface SecurityStatus {
  provider: string;
  active_sessions: number;
  current_session_id: string;
  current_session_created_at: string;
  current_session_last_seen_at: string;
  current_session_expires_at: string;
}

const ACCOUNT_WRITE_HEADERS = {
  "X-TOT-Account-Request": "1",
};

export function getCurrentUser() {
  return apiFetch<AuthResponse>("/api/auth/me");
}

export function login(identifier: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function register(email: string, username: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function updateProfile(email: string, username: string, currentPassword: string) {
  return apiFetch<AuthResponse>("/api/auth/profile", {
    method: "PATCH",
    headers: ACCOUNT_WRITE_HEADERS,
    body: JSON.stringify({
      email,
      username,
      current_password: currentPassword,
    }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ message: string }>("/api/auth/password", {
    method: "POST",
    headers: ACCOUNT_WRITE_HEADERS,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export function getSecurityStatus() {
  return apiFetch<SecurityStatus>("/api/auth/security");
}

export function logoutOtherSessions() {
  return apiFetch<{ message: string; revoked_sessions: number }>(
    "/api/auth/sessions/logout-others",
    {
      method: "POST",
      headers: ACCOUNT_WRITE_HEADERS,
    },
  );
}

export function deleteAccount(currentPassword: string, confirmation: string) {
  return apiFetch<{ message: string }>("/api/auth/account", {
    method: "DELETE",
    headers: ACCOUNT_WRITE_HEADERS,
    body: JSON.stringify({
      current_password: currentPassword,
      confirmation,
    }),
  });
}
