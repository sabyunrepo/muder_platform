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
