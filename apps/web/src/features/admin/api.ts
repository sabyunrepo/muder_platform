import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { coinKeys } from "@/features/coin/api";

import { ADMIN_PAGE_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminSettlement {
  id: string;
  creator_id: string;
  creator_nickname: string;
  period_start: string;
  period_end: string;
  total_coins: number;
  total_krw: number;
  tax_type: "INDIVIDUAL" | "BUSINESS";
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
  status: "CALCULATED" | "APPROVED" | "PAID_OUT" | "CANCELLED";
  approved_at: string | null;
  paid_out_at: string | null;
  created_at: string;
}

export interface RevenueStats {
  total_revenue_krw: number;
  total_coins_sold: number;
  total_payouts_krw: number;
  pending_payouts_krw: number;
}

export interface AdminCoinPackage {
  id: string;
  platform: "WEB" | "MOBILE";
  name: string;
  price_krw: number;
  base_coins: number;
  bonus_coins: number;
  total_coins: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const adminKeys = {
  all: ["admin"] as const,
  settlements: (status?: string, page?: number) =>
    [...adminKeys.all, "settlements", status, page] as const,
  revenue: () => [...adminKeys.all, "revenue"] as const,
  packages: () => [...adminKeys.all, "packages"] as const,
};

// ---------------------------------------------------------------------------
// Settlement Queries
// ---------------------------------------------------------------------------

export function useAdminSettlements(
  status?: string,
  page = 1,
  limit = ADMIN_PAGE_SIZE,
) {
  return useQuery<{ data: AdminSettlement[]; total: number }>({
    queryKey: adminKeys.settlements(status, page),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((page - 1) * limit),
      });
      if (status) params.set("status", status);
      return api.get<{ data: AdminSettlement[]; total: number }>(
        `/v1/admin/settlements?${params}`,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Settlement Mutations
// ---------------------------------------------------------------------------

export function useApproveSettlement() {
  return useMutation<void, Error, string>({
    mutationFn: (settlementId) =>
      api.postVoid(`/v1/admin/settlements/${settlementId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.settlements() });
    },
  });
}

export function usePayoutSettlement() {
  return useMutation<void, Error, string>({
    mutationFn: (settlementId) =>
      api.postVoid(`/v1/admin/settlements/${settlementId}/payout`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.settlements() });
    },
  });
}

export function useCancelSettlement() {
  return useMutation<void, Error, string>({
    mutationFn: (settlementId) =>
      api.postVoid(`/v1/admin/settlements/${settlementId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.settlements() });
    },
  });
}

export function useRunSettlement() {
  return useMutation<void, Error, { period_start: string; period_end: string }>(
    {
      mutationFn: (body) =>
        api.postVoid("/v1/admin/settlements/run", body),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: adminKeys.settlements() });
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Revenue Queries
// ---------------------------------------------------------------------------

export function useAdminRevenue() {
  return useQuery<RevenueStats>({
    queryKey: adminKeys.revenue(),
    queryFn: () => api.get<RevenueStats>("/v1/admin/revenue"),
  });
}

// ---------------------------------------------------------------------------
// Coin Grant Mutation
// ---------------------------------------------------------------------------

export function useGrantCoins() {
  return useMutation<
    void,
    Error,
    { user_id: string; base_amount: number; bonus_amount: number; reason: string }
  >({
    mutationFn: (body) => api.postVoid("/v1/admin/coins/grant", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coinKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Package Mutations
// ---------------------------------------------------------------------------

export function useCreatePackage() {
  return useMutation<
    AdminCoinPackage,
    Error,
    Omit<AdminCoinPackage, "id" | "total_coins" | "created_at" | "updated_at">
  >({
    mutationFn: (body) =>
      api.post<AdminCoinPackage>("/v1/admin/packages", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.packages() });
    },
  });
}

export function useUpdatePackage() {
  return useMutation<
    AdminCoinPackage,
    Error,
    { id: string; data: Partial<Omit<AdminCoinPackage, "id" | "created_at" | "updated_at">> }
  >({
    mutationFn: ({ id, data }) =>
      api.patch<AdminCoinPackage>(`/v1/admin/packages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.packages() });
    },
  });
}
