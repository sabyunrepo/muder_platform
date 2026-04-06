import { useState } from 'react';
import { ShoppingBag, RotateCcw } from 'lucide-react';

import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { Pagination } from '@/shared/components/ui/Pagination';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Spinner } from '@/shared/components/ui/Spinner';
import { usePurchasedThemes, type PurchasedTheme } from '../api';
import { COIN_PAGE_SIZE } from '../constants';
import { RefundModal } from './RefundModal';
import { formatDate } from '@/shared/utils/format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canRefund(purchase: PurchasedTheme): boolean {
  if (purchase.status !== 'COMPLETED') return false;
  if (purchase.has_played) return false;
  const now = Date.now();
  const until = new Date(purchase.refundable_until).getTime();
  return until > now;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PurchasedThemes() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePurchasedThemes(page, COIN_PAGE_SIZE);
  const [refundTarget, setRefundTarget] = useState<PurchasedTheme | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const purchases = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / COIN_PAGE_SIZE);

  if (purchases.length === 0 && page === 1) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-10 w-10" />}
        title="구매한 테마가 없습니다"
        description="로비에서 마음에 드는 테마를 구매해보세요."
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {purchases.map((purchase) => (
          <Card key={purchase.id} className="flex flex-col gap-3">
            {/* Header: title + status badge */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-100 truncate">
                {purchase.theme_title}
              </h3>
              {purchase.status === 'REFUNDED' ? (
                <Badge variant="default">환불됨</Badge>
              ) : (
                <Badge variant="success">구매</Badge>
              )}
            </div>

            {/* Meta */}
            <div className="space-y-1 text-sm text-slate-400">
              <div className="flex items-center justify-between">
                <span>구매일</span>
                <span>{formatDate(purchase.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>가격</span>
                <span className="text-amber-400">
                  {purchase.coin_price.toLocaleString()} 코인
                </span>
              </div>
            </div>

            {/* Refund button */}
            {purchase.status === 'COMPLETED' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!canRefund(purchase)}
                onClick={() => setRefundTarget(purchase)}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                className={!canRefund(purchase) ? 'opacity-50 cursor-not-allowed' : ''}
              >
                환불
              </Button>
            )}
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Refund modal */}
      {refundTarget && (
        <RefundModal
          purchase={refundTarget}
          isOpen={!!refundTarget}
          onClose={() => setRefundTarget(null)}
        />
      )}
    </>
  );
}
