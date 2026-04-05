import type { ApiError } from "@mmp/shared";

const BASE_URL = "/api";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.rawFetch(path, options);

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  private async rawFetch(
    path: string,
    options: RequestOptions = {},
  ): Promise<Response> {
    const { body, headers: customHeaders, ...rest } = options;

    const headers = new Headers(customHeaders);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...rest,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        status: response.status,
        type: "about:blank",
        title: response.statusText,
        detail: "An unexpected error occurred",
      }));
      throw error;
    }

    return response;
  }

  /** Send a request that expects no response body. */
  async requestVoid(
    path: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.rawFetch(path, options);
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  deleteVoid(path: string, options?: RequestOptions): Promise<void> {
    return this.requestVoid(path, { ...options, method: "DELETE" });
  }

  postVoid(path: string, body?: unknown, options?: RequestOptions): Promise<void> {
    return this.requestVoid(path, { ...options, method: "POST", body });
  }

  putVoid(path: string, body?: unknown, options?: RequestOptions): Promise<void> {
    return this.requestVoid(path, { ...options, method: "PUT", body });
  }

  patchVoid(path: string, body?: unknown, options?: RequestOptions): Promise<void> {
    return this.requestVoid(path, { ...options, method: "PATCH", body });
  }
}

export type { ApiError };
export const api = new ApiClient(BASE_URL);
