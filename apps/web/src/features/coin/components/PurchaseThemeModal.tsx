import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Coins, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { useBalance, usePurchaseTheme } from '../api';
import { isApiHttpError } from '@/lib/api-error';

// ---------------------------------------------------------------------------
// Error code → user message
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  PURCHASE_ALREADY_OWNED: '이미 구매한 테마입니다.',
  PURCHASE_SELF_THEME: '자신이 만든 테마는 구매할 수 없습니다.',
  COIN_INSUFFICIENT: '코인이 부족합니다.',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PurchaseThemeModalProps {
  themeId: string;
  themeTitle: string;
  coinPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PurchaseThemeModal({
  themeId,
  themeTitle,
  coinPrice,
  isOpen,
  onClose,
}: PurchaseThemeModalProps) {
  const navigate = useNavigate();
  const { data: balance } = useBalance();
  const purchaseMutation = usePurchaseTheme();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalCoins = balance?.total_coins ?? 0;
  const bonusCoins = balance?.bonus_coins ?? 0;
  const isInsufficient = totalCoins < coinPrice;

  // Bonus-first depletion preview
  const bonusUsed = Math.min(bonusCoins, coinPrice);
  const baseUsed = coinPrice - bonusUsed;

  function handlePurchase() {
    setErrorMsg(null);
    purchaseMutation.mutate(themeId, {
      onSuccess: () => {
        toast.success(`"${themeTitle}" 구매가 완료되었습니다.`);
        onClose();
      },
      onError: (err) => {
        const code = isApiHttpError(err) ? err.code : undefined;
        const msg = (code && ERROR_MESSAGES[code]) ?? '구매에 실패했습니다.';
        setErrorMsg(msg);
      },
    });
  }

  const footer = isInsufficient ? (
    <Button variant="primary" onClick={() => navigate('/shop')}>
      코인 부족 &mdash; 충전하기
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        취소
      </Button>
      <Button
        variant="primary"
        onClick={handlePurchase}
        isLoading={purchaseMutation.isPending}
        leftIcon={<Coins className="h-4 w-4" />}
      >
        구매하기
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="테마 구매" size="sm" footer={footer}>
      <div className="space-y-4">
        {/* Theme info */}
        <div>
          <p className="text-sm text-slate-400">테마</p>
          <p className="text-base font-semibold text-slate-100">{themeTitle}</p>
        </div>

        {/* Price */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">가격</span>
            <span className="font-medium text-amber-400">{coinPrice.toLocaleString()} 코인</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">보유 코인</span>
            <span className={`font-medium ${isInsufficient ? 'text-red-400' : 'text-slate-100'}`}>
              {totalCoins.toLocaleString()} 코인
            </span>
          </div>

          {!isInsufficient && (
            <>
              <hr className="border-slate-700" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">보너스 코인 사용</span>
                <span className="text-slate-300">{bonusUsed.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">기본 코인 사용</span>
                <span className="text-slate-300">{baseUsed.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Insufficient warning */}
        {isInsufficient && (
          <div className="flex items-start gap-2 rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>코인이 부족합니다. 충전 후 다시 시도해주세요.</span>
          </div>
        )}

        {/* Error from server */}
        {errorMsg && (
          <p className="text-sm text-red-400">{errorMsg}</p>
        )}
      </div>
    </Modal>
  );
}
