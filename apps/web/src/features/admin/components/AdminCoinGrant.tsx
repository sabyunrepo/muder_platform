import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button, Input, Card } from "@/shared/components/ui";
import { useGrantCoins } from "@/features/admin/api";

// ---------------------------------------------------------------------------
// AdminCoinGrant
// ---------------------------------------------------------------------------

export function AdminCoinGrant() {
  const [userId, setUserId] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [reason, setReason] = useState("");

  const grantMutation = useGrantCoins();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const base = Number(baseAmount);
    const bonus = Number(bonusAmount);

    if (!userId.trim()) {
      toast.error("유저 ID를 입력해주세요.");
      return;
    }
    if (Number.isNaN(base) || base < 0) {
      toast.error("유효한 기본 코인 수량을 입력해주세요.");
      return;
    }
    if (Number.isNaN(bonus) || bonus < 0) {
      toast.error("유효한 보너스 코인 수량을 입력해주세요.");
      return;
    }
    if (base === 0 && bonus === 0) {
      toast.error("지급할 코인 수량을 입력해주세요.");
      return;
    }
    if (!reason.trim()) {
      toast.error("사유를 입력해주세요.");
      return;
    }

    grantMutation.mutate(
      {
        user_id: userId.trim(),
        base_amount: base,
        bonus_amount: bonus,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success("코인이 지급되었습니다.");
          setUserId("");
          setBaseAmount("");
          setBonusAmount("");
          setReason("");
        },
        onError: (err) => toast.error(`지급 실패: ${err.message}`),
      },
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">코인 수동 지급</h1>

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="유저 ID"
            placeholder="지급 대상 유저 ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <Input
            label="기본 코인"
            type="number"
            min={0}
            placeholder="0"
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
          />
          <Input
            label="보너스 코인"
            type="number"
            min={0}
            placeholder="0"
            value={bonusAmount}
            onChange={(e) => setBonusAmount(e.target.value)}
          />
          <Input
            label="사유"
            placeholder="지급 사유를 입력하세요"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            isLoading={grantMutation.isPending}
            leftIcon={<Send className="h-4 w-4" />}
          >
            코인 지급
          </Button>
        </form>
      </Card>
    </div>
  );
}
