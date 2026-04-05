import type { ApiError } from "@mmp/shared";

import { ApiHttpError, isApiError } from "@/lib/api-error";

const BASE_URL = "/api";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

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

  /** 토큰 갱신이 불필요한 경로 */
  private static readonly SKIP_REFRESH_PATHS = [
    "/v1/auth/refresh",
    "/v1/auth/callback",
  ];

  private async tryRefresh(): Promise<boolean> {
    // 동시 요청 dedupe
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        // 동적 import 대신 직접 store 접근 (순환 의존 방지)
        const { useAuthStore } = await import("@/stores/authStore");
        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        if (!refreshToken) {
          logout();
          return false;
        }

        const res = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) {
          logout();
          return false;
        }

        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        return true;
      } catch {
        const { useAuthStore } = await import("@/stores/authStore");
        useAuthStore.getState().logout();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async rawFetch(
    path: string,
    options: RequestOptions = {},
    isRetry = false,
  ): Promise<Response> {
    const { body, headers: customHeaders, ...rest } = options;

    const headers = new Headers(customHeaders);
    if (body) {
      headers.set("Content-Type", "application/json");
    }

    // Authorization 헤더 자동 설정
    if (!headers.has("Authorization")) {
      const { useAuthStore } = await import("@/stores/authStore");
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...rest,
        headers,
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiHttpError({
        status: 0,
        type: "about:blank",
        title: "Network Error",
        detail: "서버에 연결할 수 없습니다. 네트워크를 확인해주세요.",
        code: "NETWORK_ERROR",
      });
    }

    // 401 자동 토큰 갱신 (무한루프 방지: 재시도 아닐 때 + refresh/callback 경로 제외)
    if (
      response.status === 401 &&
      !isRetry &&
      !ApiClient.SKIP_REFRESH_PATHS.some((p) => path.startsWith(p))
    ) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.rawFetch(path, options, true);
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const apiError: ApiError = isApiError(body)
        ? body
        : {
            status: response.status,
            type: "about:blank",
            title: response.statusText,
            detail: "예기치 않은 오류가 발생했습니다.",
            code: "INTERNAL_ERROR",
          };
      throw new ApiHttpError(apiError);
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
