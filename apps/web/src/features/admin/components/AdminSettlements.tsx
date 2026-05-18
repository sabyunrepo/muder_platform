import { useState } from 'react';
import { toast } from 'sonner';
import { Play, CheckCircle, Banknote, XCircle } from 'lucide-react';
import {
  Button,
  Badge,
  LoadingState,
  Pagination,
  Select,
  Card,
  Input,
  Modal,
  SectionHeader,
  Table,
  type TableColumn,
} from '@/shared/components/ui';
import {
  useAdminSettlements,
  useApproveSettlement,
  usePayoutSettlement,
  useCancelSettlement,
  useRunSettlement,
} from '@/features/admin/api';
import type { AdminSettlement } from '@/features/admin/api';
import { ADMIN_PAGE_SIZE } from '@/features/admin/constants';
import { formatKRW } from '@/shared/utils/format';

// ---------------------------------------------------------------------------
// 상태 뱃지 매핑
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  AdminSettlement['status'],
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  CALCULATED: { label: '산출', variant: 'info' },
  APPROVED: { label: '승인', variant: 'warning' },
  PAID_OUT: { label: '지급 완료', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'danger' },
};

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'CALCULATED', label: '산출' },
  { value: 'APPROVED', label: '승인' },
  { value: 'PAID_OUT', label: '지급 완료' },
  { value: 'CANCELLED', label: '취소' },
];

// ---------------------------------------------------------------------------
// 금액 포맷
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

// ---------------------------------------------------------------------------
// AdminSettlements
// ---------------------------------------------------------------------------

export function AdminSettlements() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const { data, isLoading, isError, refetch } = useAdminSettlements(status || undefined, page);

  const approveMutation = useApproveSettlement();
  const payoutMutation = usePayoutSettlement();
  const cancelMutation = useCancelSettlement();
  const runMutation = useRunSettlement();

  const settlements = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  // 상태 필터 변경
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value);
    setPage(1);
  };

  // 승인
  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => toast.success('정산이 승인되었습니다.'),
      onError: (err) => toast.error(`승인 실패: ${err.message}`),
    });
  };

  // 지급 완료
  const handlePayout = (id: string) => {
    payoutMutation.mutate(id, {
      onSuccess: () => toast.success('지급 완료 처리되었습니다.'),
      onError: (err) => toast.error(`지급 실패: ${err.message}`),
    });
  };

  // 취소
  const handleCancel = (id: string) => {
    cancelMutation.mutate(id, {
      onSuccess: () => toast.success('정산이 취소되었습니다.'),
      onError: (err) => toast.error(`취소 실패: ${err.message}`),
    });
  };

  // 수동 정산 실행
  const handleRunSettlement = () => {
    if (!periodStart || !periodEnd) {
      toast.error('기간을 입력해주세요.');
      return;
    }
    runMutation.mutate(
      { period_start: periodStart, period_end: periodEnd },
      {
        onSuccess: () => {
          toast.success('정산이 실행되었습니다.');
          setRunModalOpen(false);
          setPeriodStart('');
          setPeriodEnd('');
        },
        onError: (err) => toast.error(`정산 실행 실패: ${err.message}`),
      }
    );
  };
  const columns: TableColumn<AdminSettlement>[] = [
    {
      id: 'creator',
      header: '제작자',
      render: (s) => (
        <span className="font-medium text-[var(--mmp-color-ink)]">{s.creator_nickname}</span>
      ),
    },
    {
      id: 'period',
      header: '기간',
      render: (s) => `${s.period_start.slice(0, 10)} ~ ${s.period_end.slice(0, 10)}`,
    },
    { id: 'coins', header: '코인', align: 'right', render: (s) => formatNumber(s.total_coins) },
    { id: 'total', header: '금액', align: 'right', render: (s) => formatKRW(s.total_krw) },
    { id: 'tax', header: '세금', align: 'right', render: (s) => formatKRW(s.tax_amount) },
    {
      id: 'net',
      header: '실지급액',
      align: 'right',
      render: (s) => (
        <span className="font-medium text-[var(--mmp-color-ink)]">{formatKRW(s.net_amount)}</span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      render: (s) => {
        const badge = STATUS_BADGE[s.status];
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      id: 'actions',
      header: '액션',
      render: (s) => (
        <div className="flex flex-wrap gap-2">
          {s.status === 'CALCULATED' && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
              isLoading={approveMutation.isPending}
              onClick={() => handleApprove(s.id)}
            >
              승인
            </Button>
          )}
          {s.status === 'APPROVED' && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Banknote className="h-3.5 w-3.5" />}
              isLoading={payoutMutation.isPending}
              onClick={() => handlePayout(s.id)}
            >
              지급
            </Button>
          )}
          {(s.status === 'CALCULATED' || s.status === 'APPROVED') && (
            <Button
              size="sm"
              variant="danger"
              leftIcon={<XCircle className="h-3.5 w-3.5" />}
              isLoading={cancelMutation.isPending}
              onClick={() => handleCancel(s.id)}
            >
              취소
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="정산 관리" />
        <Button
          variant="primary"
          leftIcon={<Play className="h-4 w-4" />}
          onClick={() => setRunModalOpen(true)}
        >
          수동 정산 실행
        </Button>
      </div>

      {/* 필터 */}
      <div className="max-w-xs">
        <Select
          label="상태 필터"
          options={STATUS_OPTIONS}
          value={status}
          onChange={handleStatusChange}
        />
      </div>

      {/* 테이블 */}
      {isLoading && <LoadingState label="정산 목록을 불러오는 중" className="py-16" />}

      {isError && (
        <Card className="text-center">
          <p className="text-sm text-[var(--mmp-color-error)]">정산 목록을 불러오지 못했습니다.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            재시도
          </Button>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          <Table
            columns={columns}
            data={settlements}
            getRowKey={(s) => s.id}
            emptyTitle="정산 내역이 없습니다"
          />

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* 수동 정산 실행 모달 */}
      <Modal
        isOpen={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        title="수동 정산 실행"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRunModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              isLoading={runMutation.isPending}
              onClick={handleRunSettlement}
            >
              실행
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="시작일"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
          <Input
            label="종료일"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
