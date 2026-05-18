import { useRef, useState } from 'react';
import { Coins, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, Button, Modal, Panel } from '@/shared/components/ui';
import { useCreatePayment, useConfirmPayment } from '@/features/payment/api';
import type { CoinPackage } from '@/features/payment/api';

// ---------------------------------------------------------------------------
// 결제 플로우 모달
// ---------------------------------------------------------------------------

type Step = 'confirm' | 'processing' | 'success' | 'error';

export interface PaymentModalProps {
  pkg: CoinPackage;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentModal({ pkg, isOpen, onClose }: PaymentModalProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const paymentInFlightRef = useRef(false);

  const createPayment = useCreatePayment();
  const confirmPayment = useConfirmPayment();
  const isPaymentPending = createPayment.isPending || confirmPayment.isPending || step === 'processing';

  async function handlePay() {
    if (step !== 'confirm' || isPaymentPending || paymentInFlightRef.current) {
      return;
    }

    paymentInFlightRef.current = true;
    setStep('processing');
    setErrorMessage('');

    try {
      // 1) 결제 생성
      const idempotencyKey = crypto.randomUUID();
      const payment = await createPayment.mutateAsync({
        package_id: pkg.id,
        idempotency_key: idempotencyKey,
      });

      // 2) Mock 결제 확인 (실제 PG 연동 시 콜백으로 교체)
      await confirmPayment.mutateAsync({
        payment_id: payment.id,
        payment_key: payment.payment_key ?? idempotencyKey,
      });

      setStep('success');
      toast.success(`${pkg.total_coins.toLocaleString('ko-KR')} 코인이 충전되었습니다!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.';
      setErrorMessage(message);
      setStep('error');
    } finally {
      paymentInFlightRef.current = false;
    }
  }

  function handleClose() {
    paymentInFlightRef.current = false;
    setStep('confirm');
    setErrorMessage('');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="결제 확인" size="sm">
      {/* 패키지 정보 */}
      <Panel className="mb-6" padding="md">
        <p className="text-base font-semibold text-[var(--mmp-color-ink)]">{pkg.name}</p>
        <div className="mt-2 flex items-center gap-2">
          <Coins className="h-5 w-5 text-[var(--mmp-color-primary)]" />
          <span className="text-lg font-bold text-[var(--mmp-color-primary)]">
            {pkg.total_coins.toLocaleString('ko-KR')} 코인
          </span>
        </div>
        {pkg.bonus_coins > 0 && (
          <p className="mt-1 text-sm text-[var(--mmp-color-steel)]">
            기본 {pkg.base_coins.toLocaleString('ko-KR')} + 보너스{' '}
            {pkg.bonus_coins.toLocaleString('ko-KR')}
          </p>
        )}
        <p className="mt-3 text-xl font-bold text-[var(--mmp-color-ink)]">
          {pkg.price_krw.toLocaleString('ko-KR')}원
        </p>
      </Panel>

      {/* 상태별 콘텐츠 */}
      {step === 'confirm' && (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            취소
          </Button>
          <Button onClick={handlePay} disabled={isPaymentPending} className="flex-1">
            결제하기
          </Button>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Button isLoading disabled className="w-full">
            결제 처리 중...
          </Button>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle className="h-12 w-12 text-[var(--mmp-color-success)]" />
          <p className="text-center text-base font-medium text-[var(--mmp-color-ink)]">
            결제가 완료되었습니다!
          </p>
          <p className="text-sm text-[var(--mmp-color-steel)]">
            {pkg.total_coins.toLocaleString('ko-KR')} 코인이 충전되었습니다.
          </p>
          <Button onClick={handleClose} className="mt-2 w-full">
            확인
          </Button>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <AlertCircle className="h-12 w-12 text-[var(--mmp-color-error)]" />
          <Alert variant="error" title="결제 처리 실패" description={errorMessage} />
          <div className="flex w-full gap-3">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              닫기
            </Button>
            <Button
              onClick={() => {
                setStep('confirm');
                setErrorMessage('');
              }}
              className="flex-1"
            >
              다시 시도
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
