// ---------------------------------------------------------------------------
// Creator Feature Constants
// ---------------------------------------------------------------------------

export type SettlementStatus =
  | "CALCULATED"
  | "APPROVED"
  | "PAID_OUT"
  | "CANCELLED";

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  CALCULATED: "정산 완료",
  APPROVED: "승인됨",
  PAID_OUT: "지급 완료",
  CANCELLED: "취소됨",
};

export type TaxType = "INDIVIDUAL" | "BUSINESS";

export const TAX_TYPE_LABEL: Record<TaxType, string> = {
  INDIVIDUAL: "개인",
  BUSINESS: "사업자",
};

export const CREATOR_PAGE_SIZE = 20;
