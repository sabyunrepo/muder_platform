// ---------------------------------------------------------------------------
// Coin Feature Constants
// ---------------------------------------------------------------------------

export type CoinTransactionType =
  | "CHARGE"
  | "PURCHASE"
  | "REFUND"
  | "ADMIN_GRANT"
  | "ADMIN_REVOKE";

export const TRANSACTION_TYPE_LABEL: Record<CoinTransactionType, string> = {
  CHARGE: "충전",
  PURCHASE: "구매",
  REFUND: "환불",
  ADMIN_GRANT: "관리자 지급",
  ADMIN_REVOKE: "관리자 회수",
};

export const COIN_PAGE_SIZE = 20;
