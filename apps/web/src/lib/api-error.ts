import type { ApiError } from "@mmp/shared";

/**
 * ApiHttpError wraps an RFC 9457 ApiError as a throwable Error.
 * Used by the API client and caught by TanStack Query / ErrorBoundary.
 */
export class ApiHttpError extends Error {
  public readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.detail);
    this.name = "ApiHttpError";
    this.apiError = apiError;
    // Ensure instanceof works across module boundaries
    Object.setPrototypeOf(this, ApiHttpError.prototype);
  }

  get status(): number {
    return this.apiError.status;
  }

  get code(): string | undefined {
    return this.apiError.code;
  }

  get traceId(): string | undefined {
    return this.apiError.trace_id;
  }

  get requestId(): string | undefined {
    return this.apiError.request_id;
  }

  get severity(): ApiError["severity"] {
    return this.apiError.severity;
  }

  get retryable(): boolean | undefined {
    return this.apiError.retryable;
  }

  get userAction(): string | undefined {
    return this.apiError.user_action;
  }
}

/** Type guard for ApiError shape. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "title" in value &&
    typeof (value as ApiError).status === "number"
  );
}

/** Type guard for ApiHttpError instances. */
export function isApiHttpError(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError;
}
