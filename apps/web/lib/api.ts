export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: normalizeHeaders(init.headers),
    credentials: "include",
  });
}

function normalizeHeaders(headers: HeadersInit | undefined): HeadersInit | undefined {
  if (!headers) return headers;

  const normalized = new Headers(headers);
  if (normalized.get("authorization") === "Bearer cookie-session") {
    normalized.delete("authorization");
  }
  return normalized;
}
