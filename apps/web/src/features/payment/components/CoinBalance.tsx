import { useNavigate } from "react-router";
import { Coins } from "lucide-react";
import { useBalance } from "@/features/coin/api";

// ---------------------------------------------------------------------------
// Nav 삽입용 잔액 위젯
// ---------------------------------------------------------------------------

export function CoinBalance() {
  const navigate = useNavigate();
  const { data: balance } = useBalance();

  const total = balance ? balance.total_coins : 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/shop")}
      className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
      aria-label={`코인 잔액 ${total.toLocaleString("ko-KR")}개, 상점으로 이동`}
    >
      <Coins className="h-4 w-4" />
      <span>{total.toLocaleString("ko-KR")}</span>
    </button>
  );
}
