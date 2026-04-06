// ---------------------------------------------------------------------------
// Payment Feature Constants
// ---------------------------------------------------------------------------

export type Platform = "WEB" | "MOBILE";

export const PLATFORM = {
  WEB: "WEB",
  MOBILE: "MOBILE",
} as const satisfies Record<Platform, Platform>;

export type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REFUNDED"
  | "FAILED"
  | "CANCELLED";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "대기중",
  CONFIRMED: "완료",
  REFUNDED: "환불됨",
  FAILED: "실패",
  CANCELLED: "취소됨",
};

export const PAYMENT_PAGE_SIZE = 20;
