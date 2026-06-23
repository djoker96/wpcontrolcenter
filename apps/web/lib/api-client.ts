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

function getHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("wpcc_token") : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function checkAuth(response: Response): void {
  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("wpcc_token");
    localStorage.removeItem("wpcc_user");
    window.location.href = "/";
  }
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      headers: getHeaders(),
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },

  /**
   * Upload a .zip file for plugin/theme update.
   * Sends FormData (no explicit Content-Type — browser sets multipart boundary).
   */
  async uploadFile<T>(path: string, file: File, slug?: string): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("wpcc_token") : null;
    const fd = new FormData();
    fd.append("file", file);
    if (slug) fd.append("slug", slug);

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: fd,
    });
    checkAuth(response);
    return handleResponse<T>(response);
  },
};
