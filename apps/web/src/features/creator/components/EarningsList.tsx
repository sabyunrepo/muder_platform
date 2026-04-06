import { useState } from "react";

import { Badge, EmptyState, Pagination, Spinner } from "@/shared/components/ui";
import { useEarnings } from "../api";
import { CREATOR_PAGE_SIZE } from "../constants";

export function EarningsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useEarnings(page);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-slate-400">
        수익 내역을 불러오지 못했습니다.
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return <EmptyState title="수익 내역이 없습니다" />;
  }

  const totalPages = Math.ceil(data.total / CREATOR_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">수익 내역</h1>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-3 text-left text-sm font-medium text-slate-400">
                날짜
              </th>
              <th className="py-3 text-left text-sm font-medium text-slate-400">
                테마명
              </th>
              <th className="py-3 text-right text-sm font-medium text-slate-400">
                총 코인
              </th>
              <th className="py-3 text-right text-sm font-medium text-slate-400">
                제작자 몫 (70%)
              </th>
              <th className="py-3 text-right text-sm font-medium text-slate-400">
                플랫폼 (30%)
              </th>
              <th className="py-3 text-right text-sm font-medium text-slate-400">
                정산 상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {data.data.map((earning) => (
              <tr key={earning.id}>
                <td className="py-3 text-sm text-slate-300">
                  {new Date(earning.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="py-3 text-sm text-slate-200">
                  {earning.theme_title}
                </td>
                <td className="py-3 text-right text-sm text-slate-300">
                  {earning.total_coins.toLocaleString("ko-KR")}
                </td>
                <td className="py-3 text-right text-sm text-amber-400">
                  {earning.creator_share_coins.toLocaleString("ko-KR")}
                </td>
                <td className="py-3 text-right text-sm text-slate-400">
                  {earning.platform_share_coins.toLocaleString("ko-KR")}
                </td>
                <td className="py-3 text-right">
                  <Badge variant={earning.settled ? "success" : "warning"}>
                    {earning.settled ? "정산됨" : "미정산"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
