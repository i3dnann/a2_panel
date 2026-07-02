import type { AuthUser } from "../types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export function getToken(): string | null {
  return localStorage.getItem("a2_panel_token");
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem("a2_panel_token", token);
  else localStorage.removeItem("a2_panel_token");
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("content-type") && options.body) headers.set("content-type", "application/json");
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("a2-session-expired"));
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body ? String(body.error) : response.statusText;
    throw new Error(message);
  }

  return body as T;
}

export async function downloadApi(path: string, filename: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(response.statusText);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
