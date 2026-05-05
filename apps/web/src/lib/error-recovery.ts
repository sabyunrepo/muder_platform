import type { ApiError } from "@mmp/shared";

export type RecoverySurface = "redirect-login" | "toast";

export type RecoveryAction =
  | "fix-input"
  | "login"
  | "request-access"
  | "refresh"
  | "reload-or-merge"
  | "review-references"
  | "retry"
  | "retry-later"
  | "contact-support"
  | "none";

export interface ErrorRecoveryStrategy {
  surface: RecoverySurface;
  action: RecoveryAction;
  retryable: boolean;
  duration: number;
  capture: boolean;
}

const DEFAULT_TOAST_DURATION_MS = 5000;
const LOW_SEVERITY_DURATION_MS = 4000;
const HIGH_SEVERITY_DURATION_MS = 8000;

const ACTION_ALIASES: Record<string, RecoveryAction> = {
  fix_input: "fix-input",
  login: "login",
  request_access: "request-access",
  refresh: "refresh",
  reload_or_merge: "reload-or-merge",
  review_references: "review-references",
  retry: "retry",
  retry_later: "retry-later",
  contact_support: "contact-support",
  none: "none",
};

const CODE_ACTIONS: Record<string, RecoveryAction> = {
  AUTH_TOKEN_EXPIRED: "login",
  AUTH_TOKEN_INVALID: "login",
  AUTH_TOKEN_MISSING: "login",
  EDITOR_CONFIG_VERSION_MISMATCH: "reload-or-merge",
  MEDIA_REFERENCE_IN_USE: "review-references",
  SERVICE_UNAVAILABLE: "retry-later",
  TIMEOUT: "retry",
  VALIDATION_ERROR: "fix-input",
};

export function getErrorRecoveryStrategy(error: ApiError): ErrorRecoveryStrategy {
  const action = getRecoveryAction(error);
  const retryable = error.retryable ?? isImplicitlyRetryable(error);
  const capture = error.status >= 500 || error.severity === "critical";

  return {
    surface: action === "login" || error.status === 401 ? "redirect-login" : "toast",
    action,
    retryable,
    duration: getToastDuration(error),
    capture,
  };
}

export function shouldRetryApiError(error: ApiError, failureCount: number): boolean {
  if (failureCount >= 1) {
    return false;
  }

  const strategy = getErrorRecoveryStrategy(error);
  if (strategy.surface === "redirect-login" || strategy.action === "request-access") {
    return false;
  }

  return strategy.retryable;
}

export function getRecoveryAction(error: ApiError): RecoveryAction {
  const explicit = error.user_action?.trim();
  if (explicit && ACTION_ALIASES[explicit]) {
    return ACTION_ALIASES[explicit];
  }

  if (error.code && CODE_ACTIONS[error.code]) {
    return CODE_ACTIONS[error.code];
  }

  if (error.status === 401) {
    return "login";
  }
  if (error.status === 403) {
    return "request-access";
  }
  if (error.status === 408) {
    return "retry";
  }
  if (error.status === 409) {
    return "refresh";
  }
  if (error.status === 429) {
    return "retry-later";
  }
  if (error.status >= 500) {
    return "retry-later";
  }
  if (error.status >= 400) {
    return "fix-input";
  }
  return "none";
}

function getToastDuration(error: ApiError): number {
  if (error.status >= 500 || error.severity === "critical") {
    return Infinity;
  }
  if (error.severity === "high") {
    return HIGH_SEVERITY_DURATION_MS;
  }
  if (error.severity === "low") {
    return LOW_SEVERITY_DURATION_MS;
  }
  return DEFAULT_TOAST_DURATION_MS;
}

function isImplicitlyRetryable(error: ApiError): boolean {
  return error.status >= 500 || error.status === 408 || error.code === "TIMEOUT";
}
