import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { coinKeys } from "@/features/coin/api";

import { PAYMENT_PAGE_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoinPackage {
  id: string;
  platform: "WEB" | "MOBILE";
  name: string;
  price_krw: number;
  base_coins: number;
  bonus_coins: number;
  total_coins: number;
}

export interface PaymentResponse {
  id: string;
  package_id: string;
  payment_key: string | null;
  status: "PENDING" | "CONFIRMED" | "REFUNDED" | "FAILED" | "CANCELLED";
  amount_krw: number;
  base_coins: number;
  bonus_coins: number;
  confirmed_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const paymentKeys = {
  all: ["payments"] as const,
  packages: (platform: string) =>
    [...paymentKeys.all, "packages", platform] as const,
  history: (page: number) =>
    [...paymentKeys.all, "history", page] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePackages(platform = "WEB") {
  return useQuery<CoinPackage[]>({
    queryKey: paymentKeys.packages(platform),
    queryFn: () =>
      api.get<CoinPackage[]>(
        `/v1/payments/packages?platform=${platform}`,
      ),
  });
}

export function usePaymentHistory(page = 1, limit = PAYMENT_PAGE_SIZE) {
  return useQuery<{ data: PaymentResponse[]; total: number }>({
    queryKey: paymentKeys.history(page),
    queryFn: () =>
      api.get<{ data: PaymentResponse[]; total: number }>(
        `/v1/payments/history?limit=${limit}&offset=${(page - 1) * limit}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePayment() {
  return useMutation<
    PaymentResponse,
    Error,
    { package_id: string; idempotency_key: string }
  >({
    mutationFn: (body) =>
      api.post<PaymentResponse>("/v1/payments/create", body),
  });
}

export function useConfirmPayment() {
  return useMutation<
    PaymentResponse,
    Error,
    { payment_id: string; payment_key: string }
  >({
    mutationFn: (body) =>
      api.post<PaymentResponse>("/v1/payments/confirm", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: coinKeys.all });
    },
  });
}
