"use client";

import { API_URL } from "./api";

export interface ApiError {
  message: string;
  status: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch {
      // ignore parse errors
    }
    throw { message, status: response.status } as ApiError;
  }
  return response.json() as Promise<T>;
}

// Auth is carried by an httpOnly cookie (set by the API on login). The cookie is
// sent automatically with credentials:"include"; the JWT is never exposed to JS,
// so XSS cannot exfiltrate it.
function getHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

function checkAuth(response: Response): void {
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/";
  }
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      headers: getHeaders(),
      credentials: "include",
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: getHeaders(),
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  /**
   * Upload a .zip file for plugin/theme update.
   * Sends FormData (no explicit Content-Type — browser sets multipart boundary).
   */
  async uploadFile<T>(path: string, file: File, slug?: string): Promise<T> {
    const fd = new FormData();
    fd.append("file", file);
    if (slug) fd.append("slug", slug);

    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },
};
