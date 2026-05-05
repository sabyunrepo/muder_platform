/** Standard API response envelope. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

/** RFC 9457 Problem Details for HTTP APIs. */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  errors?: FieldError[];
  params?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
  request_id?: string;
  correlation_id?: string;
  timestamp?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  retryable?: boolean;
  user_action?: string;
  trace_id?: string;
  debug?: {
    internal?: string;
    stack?: string;
  };
}

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

/** Paginated list response. */
export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
