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
