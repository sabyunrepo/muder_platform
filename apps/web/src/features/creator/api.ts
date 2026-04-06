import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

import { CREATOR_PAGE_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorDashboard {
  total_earnings: number;
  unsettled_earnings: number;
  total_sales: number;
}

export interface DailyStat {
  date: string;
  sales_count: number;
  daily_earnings: number;
}

export interface CreatorEarning {
  id: string;
  theme_id: string;
  theme_title: string;
  total_coins: number;
  creator_share_coins: number;
  platform_share_coins: number;
  settled: boolean;
  created_at: string;
}

export interface Settlement {
  id: string;
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

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const creatorKeys = {
  all: ["creator"] as const,
  dashboard: () => [...creatorKeys.all, "dashboard"] as const,
  themeStats: (themeId: string) =>
    [...creatorKeys.all, "stats", themeId] as const,
  earnings: (page?: number) =>
    [...creatorKeys.all, "earnings", page] as const,
  settlements: (page?: number) =>
    [...creatorKeys.all, "settlements", page] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery<CreatorDashboard>({
    queryKey: creatorKeys.dashboard(),
    queryFn: () => api.get<CreatorDashboard>("/v1/creator/dashboard"),
  });
}

export function useThemeStats(themeId: string, from: string, to: string) {
  return useQuery<DailyStat[]>({
    queryKey: creatorKeys.themeStats(themeId),
    queryFn: () =>
      api.get<DailyStat[]>(
        `/v1/creator/themes/${themeId}/stats?from=${from}&to=${to}`,
      ),
    enabled: !!themeId,
  });
}

export function useEarnings(page = 1, limit = CREATOR_PAGE_SIZE) {
  return useQuery<{ data: CreatorEarning[]; total: number }>({
    queryKey: creatorKeys.earnings(page),
    queryFn: () =>
      api.get<{ data: CreatorEarning[]; total: number }>(
        `/v1/creator/earnings?limit=${limit}&offset=${(page - 1) * limit}`,
      ),
  });
}

export function useSettlements(page = 1, limit = CREATOR_PAGE_SIZE) {
  return useQuery<{ data: Settlement[]; total: number }>({
    queryKey: creatorKeys.settlements(page),
    queryFn: () =>
      api.get<{ data: Settlement[]; total: number }>(
        `/v1/creator/settlements?limit=${limit}&offset=${(page - 1) * limit}`,
      ),
  });
}
