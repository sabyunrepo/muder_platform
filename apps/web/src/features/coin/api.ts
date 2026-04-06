import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

import { COIN_PAGE_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoinBalance {
  base_coins: number;
  bonus_coins: number;
  total_coins: number;
}

export interface CoinTransaction {
  id: number;
  type: "CHARGE" | "PURCHASE" | "REFUND" | "ADMIN_GRANT" | "ADMIN_REVOKE";
  base_amount: number;
  bonus_amount: number;
  balance_after_base: number;
  balance_after_bonus: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface ThemePurchase {
  id: string;
  theme_id: string;
  coin_price: number;
  base_coins_used: number;
  bonus_coins_used: number;
  refundable_until: string;
  has_played: boolean;
  created_at: string;
}

export interface PurchasedTheme {
  id: string;
  theme_id: string;
  theme_title: string;
  theme_slug: string;
  coin_price: number;
  status: "COMPLETED" | "REFUNDED";
  has_played: boolean;
  refundable_until: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const coinKeys = {
  all: ["coins"] as const,
  balance: () => [...coinKeys.all, "balance"] as const,
  transactions: (type?: string, page?: number) =>
    [...coinKeys.all, "transactions", type, page] as const,
  purchased: (page?: number) => [...coinKeys.all, "purchased", page] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBalance() {
  return useQuery<CoinBalance>({
    queryKey: coinKeys.balance(),
    queryFn: () => api.get<CoinBalance>("/v1/coins/balance"),
  });
}

export function useTransactions(
  type?: string,
  page = 1,
  limit = COIN_PAGE_SIZE,
) {
  return useQuery<{ data: CoinTransaction[]; total: number }>({
    queryKey: coinKeys.transactions(type, page),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((page - 1) * limit),
      });
      if (type) params.set("type", type);
      return api.get<{ data: CoinTransaction[]; total: number }>(
        `/v1/coins/transactions?${params}`,
      );
    },
  });
}

export function usePurchasedThemes(page = 1, limit = COIN_PAGE_SIZE) {
  return useQuery<{ data: PurchasedTheme[]; total: number }>({
    queryKey: coinKeys.purchased(page),
    queryFn: () =>
      api.get<{ data: PurchasedTheme[]; total: number }>(
        `/v1/coins/purchased-themes?limit=${limit}&offset=${(page - 1) * limit}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function usePurchaseTheme() {
  return useMutation<ThemePurchase, Error, string>({
    mutationFn: (themeId) =>
      api.post<ThemePurchase>("/v1/coins/purchase-theme", {
        theme_id: themeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coinKeys.all });
    },
  });
}

export function useRefundTheme() {
  return useMutation<void, Error, string>({
    mutationFn: (purchaseId) =>
      api.postVoid("/v1/coins/refund-theme", { purchase_id: purchaseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coinKeys.all });
    },
  });
}
