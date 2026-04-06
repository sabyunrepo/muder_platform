import { useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { useRefundTheme, type PurchasedTheme } from '../api';
import { isApiHttpError } from '@/lib/api-error';

// ---------------------------------------------------------------------------
// Error code → user message
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  REFUND_EXPIRED: '환불 가능 기간이 만료되었습니다.',
  REFUND_ALREADY_PLAYED: '플레이한 테마는 환불할 수 없습니다.',
  REFUND_LIMIT_EXCEEDED: '환불 횟수 한도를 초과했습니다.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysLeft(refundableUntil: string): number {
  const now = Date.now();
  const until = new Date(refundableUntil).getTime();
  return Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RefundModalProps {
  purchase: PurchasedTheme;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RefundModal({ purchase, isOpen, onClose }: RefundModalProps) {
  const refundMutation = useRefundTheme();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const daysLeft = getDaysLeft(purchase.refundable_until);
  const isExpired = daysLeft <= 0;
  const hasPlayed = purchase.has_played;
  const canRefund = !isExpired && !hasPlayed;

  function handleRefund() {
    setErrorMsg(null);
    refundMutation.mutate(purchase.id, {
      onSuccess: () => {
        toast.success(`"${purchase.theme_title}" 환불이 완료되었습니다.`);
        onClose();
      },
      onError: (err) => {
        const code = isApiHttpError(err) ? err.code : undefined;
        const msg = (code && ERROR_MESSAGES[code]) ?? '환불에 실패했습니다.';
        setErrorMsg(msg);
      },
    });
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>
        취소
      </Button>
      <Button
        variant="danger"
        onClick={handleRefund}
        isLoading={refundMutation.isPending}
        disabled={!canRefund}
        leftIcon={<RotateCcw className="h-4 w-4" />}
      >
        환불하기
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="테마 환불" size="sm" footer={footer}>
      <div className="space-y-4">
        {/* Theme info */}
        <div>
          <p className="text-sm text-slate-400">테마</p>
          <p className="text-base font-semibold text-slate-100">{purchase.theme_title}</p>
        </div>

        {/* Refund details */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">구매 가격</span>
            <span className="font-medium text-amber-400">
              {purchase.coin_price.toLocaleString()} 코인
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">환불 가능 기간</span>
            {isExpired ? (
              <span className="font-medium text-red-400">만료됨</span>
            ) : (
              <span className={`font-medium ${daysLeft <= 3 ? 'text-red-400' : 'text-slate-400'}`}>
                D-{daysLeft}
              </span>
            )}
          </div>
        </div>

        {/* Warnings */}
        {isExpired && (
          <div className="flex items-start gap-2 rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>환불 기간이 만료되었습니다.</span>
          </div>
        )}

        {hasPlayed && !isExpired && (
          <div className="flex items-start gap-2 rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>플레이한 테마는 환불할 수 없습니다.</span>
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
