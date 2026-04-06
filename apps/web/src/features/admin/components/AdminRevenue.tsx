import { Coins, Banknote, CheckCircle, FileText } from "lucide-react";
import { Card, Spinner } from "@/shared/components/ui";
import { useAdminRevenue } from "@/features/admin/api";

// ---------------------------------------------------------------------------
// 포맷 헬퍼
// ---------------------------------------------------------------------------

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

// ---------------------------------------------------------------------------
// 카드 데이터
// ---------------------------------------------------------------------------

interface StatCard {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const STAT_CARDS: StatCard[] = [
  { label: "총 판매 코인", icon: Coins, color: "text-amber-400" },
  { label: "총 매출", icon: Banknote, color: "text-emerald-400" },
  { label: "지급 완료액", icon: CheckCircle, color: "text-blue-400" },
  { label: "미지급 잔액", icon: FileText, color: "text-rose-400" },
];

// ---------------------------------------------------------------------------
// AdminRevenue
// ---------------------------------------------------------------------------

export function AdminRevenue() {
  const { data, isLoading, isError, refetch } = useAdminRevenue();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="text-center">
        <p className="text-sm text-red-400">매출 정보를 불러오지 못했습니다.</p>
        <button
          type="button"
          className="mt-3 text-sm text-amber-500 hover:text-amber-400"
          onClick={() => refetch()}
        >
          재시도
        </button>
      </Card>
    );
  }

  const values = [
    formatNumber(data.total_coins_sold),
    formatKRW(data.total_revenue_krw),
    formatKRW(data.total_payouts_krw),
    formatKRW(data.pending_payouts_krw),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">플랫폼 매출</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((card, i) => (
          <Card key={card.label}>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 ${card.color}`}
              >
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-400">{card.label}</p>
                <p className="text-xl font-bold text-slate-100">{values[i]}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
