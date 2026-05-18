import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';
import {
  Button,
  Badge,
  Checkbox,
  LoadingState,
  Modal,
  Input,
  SectionHeader,
  Select,
  Table,
  type TableColumn,
} from '@/shared/components/ui';
import { usePackages } from '@/features/payment/api';
import { useCreatePackage, useUpdatePackage } from '@/features/admin/api';
import type { AdminCoinPackage } from '@/features/admin/api';
import { formatKRW } from '@/shared/utils/format';

// ---------------------------------------------------------------------------
// 패키지 폼 상태
// ---------------------------------------------------------------------------

interface PackageFormState {
  platform: 'WEB' | 'MOBILE';
  name: string;
  price_krw: string;
  base_coins: string;
  bonus_coins: string;
  sort_order: string;
  is_active: boolean;
}

const EMPTY_FORM: PackageFormState = {
  platform: 'WEB',
  name: '',
  price_krw: '',
  base_coins: '',
  bonus_coins: '',
  sort_order: '0',
  is_active: true,
};

function toForm(pkg: AdminCoinPackage): PackageFormState {
  return {
    platform: pkg.platform,
    name: pkg.name,
    price_krw: String(pkg.price_krw),
    base_coins: String(pkg.base_coins),
    bonus_coins: String(pkg.bonus_coins),
    sort_order: String(pkg.sort_order),
    is_active: pkg.is_active,
  };
}

const PLATFORM_OPTIONS = [
  { value: 'WEB', label: 'WEB' },
  { value: 'MOBILE', label: 'MOBILE' },
];

// ---------------------------------------------------------------------------
// 금액 포맷
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

// ---------------------------------------------------------------------------
// AdminPackages
// ---------------------------------------------------------------------------

export function AdminPackages() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);

  const { data: webPackages, isLoading: webLoading } = usePackages('WEB');
  const { data: mobilePackages, isLoading: mobileLoading } = usePackages('MOBILE');

  const createMutation = useCreatePackage();
  const updateMutation = useUpdatePackage();

  const isLoading = webLoading || mobileLoading;
  // Admin API returns full AdminCoinPackage fields; cast once at data level.
  const allPackages = [
    ...((webPackages ?? []) as unknown as AdminCoinPackage[]),
    ...((mobilePackages ?? []) as unknown as AdminCoinPackage[]),
  ].sort((a, b) => a.sort_order - b.sort_order);

  // 모달 열기: 추가
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  // 모달 열기: 수정
  const openEdit = (pkg: AdminCoinPackage) => {
    setEditingId(pkg.id);
    setForm(toForm(pkg));
    setModalOpen(true);
  };

  // 폼 변경
  const updateField = <K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 저장
  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('패키지 이름을 입력해주세요.');
      return;
    }

    const priceKrw = Number(form.price_krw);
    const baseCoins = Number(form.base_coins);
    const bonusCoins = Number(form.bonus_coins);
    const sortOrder = Number(form.sort_order);

    if (Number.isNaN(priceKrw) || priceKrw <= 0) {
      toast.error('유효한 가격을 입력해주세요.');
      return;
    }
    if (Number.isNaN(baseCoins) || baseCoins < 0) {
      toast.error('유효한 기본 코인 수량을 입력해주세요.');
      return;
    }
    if (Number.isNaN(bonusCoins) || bonusCoins < 0) {
      toast.error('유효한 보너스 코인 수량을 입력해주세요.');
      return;
    }
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      toast.error('유효한 정렬 순서를 입력해주세요.');
      return;
    }

    if (editingId) {
      // 수정
      updateMutation.mutate(
        {
          id: editingId,
          data: {
            platform: form.platform,
            name: form.name.trim(),
            price_krw: priceKrw,
            base_coins: baseCoins,
            bonus_coins: bonusCoins,
            sort_order: sortOrder,
            is_active: form.is_active,
          },
        },
        {
          onSuccess: () => {
            toast.success('패키지가 수정되었습니다.');
            setModalOpen(false);
          },
          onError: (err) => toast.error(`수정 실패: ${err.message}`),
        }
      );
    } else {
      // 추가
      createMutation.mutate(
        {
          platform: form.platform,
          name: form.name.trim(),
          price_krw: priceKrw,
          base_coins: baseCoins,
          bonus_coins: bonusCoins,
          sort_order: sortOrder,
          is_active: form.is_active,
        },
        {
          onSuccess: () => {
            toast.success('패키지가 추가되었습니다.');
            setModalOpen(false);
          },
          onError: (err) => toast.error(`추가 실패: ${err.message}`),
        }
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const columns: TableColumn<AdminCoinPackage>[] = [
    {
      id: 'platform',
      header: '플랫폼',
      render: (pkg) => (
        <Badge variant={pkg.platform === 'WEB' ? 'info' : 'warning'}>{pkg.platform}</Badge>
      ),
    },
    {
      id: 'name',
      header: '이름',
      render: (pkg) => <span className="font-medium text-[var(--mmp-color-ink)]">{pkg.name}</span>,
    },
    { id: 'price', header: '가격', align: 'right', render: (pkg) => formatKRW(pkg.price_krw) },
    { id: 'base', header: '기본', align: 'right', render: (pkg) => formatNumber(pkg.base_coins) },
    {
      id: 'bonus',
      header: '보너스',
      align: 'right',
      render: (pkg) => formatNumber(pkg.bonus_coins),
    },
    {
      id: 'total',
      header: '합계',
      align: 'right',
      render: (pkg) => (
        <span className="font-medium text-[var(--mmp-color-ink)]">
          {formatNumber(pkg.total_coins)}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      render: (pkg) => (
        <Badge variant={pkg.is_active ? 'success' : 'danger'}>
          {pkg.is_active ? '활성' : '비활성'}
        </Badge>
      ),
    },
    { id: 'order', header: '순서', render: (pkg) => pkg.sort_order },
    {
      id: 'actions',
      header: '액션',
      render: (pkg) => (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Pencil className="h-3.5 w-3.5" />}
          onClick={() => openEdit(pkg)}
        >
          수정
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="패키지 관리" />
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          패키지 추가
        </Button>
      </div>

      {/* 테이블 */}
      {isLoading && <LoadingState label="패키지를 불러오는 중" className="py-16" />}

      {!isLoading && (
        <Table
          columns={columns}
          data={allPackages}
          getRowKey={(pkg) => pkg.id}
          emptyTitle="등록된 패키지가 없습니다"
        />
      )}

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? '패키지 수정' : '패키지 추가'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button variant="primary" isLoading={isSaving} onClick={handleSave}>
              {editingId ? '수정' : '추가'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="플랫폼"
            options={PLATFORM_OPTIONS}
            value={form.platform}
            onChange={(e) => updateField('platform', e.target.value as 'WEB' | 'MOBILE')}
          />
          <Input
            label="패키지 이름"
            placeholder="예: 100 코인 팩"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
          <Input
            label="가격 (원)"
            type="number"
            min={0}
            placeholder="0"
            value={form.price_krw}
            onChange={(e) => updateField('price_krw', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="기본 코인"
              type="number"
              min={0}
              placeholder="0"
              value={form.base_coins}
              onChange={(e) => updateField('base_coins', e.target.value)}
            />
            <Input
              label="보너스 코인"
              type="number"
              min={0}
              placeholder="0"
              value={form.bonus_coins}
              onChange={(e) => updateField('bonus_coins', e.target.value)}
            />
          </div>
          <Input
            label="정렬 순서"
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => updateField('sort_order', e.target.value)}
          />
          <Checkbox
            label="활성 상태"
            checked={form.is_active}
            onChange={(e) => updateField('is_active', e.target.checked)}
          />
        </div>
      </Modal>
    </div>
  );
}
