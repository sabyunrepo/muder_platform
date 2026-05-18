import { AlertCircle, CheckCircle2, Plus, Search } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  IconButton,
  Input,
  LoadingState,
  Modal,
  PageShell,
  Panel,
  SectionHeader,
  Select,
  Switch,
  Table,
  Textarea,
  ThemeModeToggle,
  type TableColumn,
} from '@/shared/components/ui';
import { useState } from 'react';

interface PreviewRow {
  id: string;
  name: string;
  state: string;
}

const rows: PreviewRow[] = [
  { id: 'theme-a', name: '저택의 밤', state: '검수 중' },
  { id: 'theme-b', name: '사라진 초대장', state: '공개' },
];

const columns: TableColumn<PreviewRow>[] = [
  { id: 'name', header: '테마', render: (row) => row.name },
  { id: 'state', header: '상태', render: (row) => <Badge variant="info">{row.state}</Badge> },
];

export default function UIKitPreviewPage() {
  const [open, setOpen] = useState(false);

  return (
    <PageShell
      header={
        <SectionHeader
          title="UI Kit Preview"
          description="Design system PR-2 preview surface for light, dark, and mobile screenshot QA."
          action={<ThemeModeToggle />}
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel className="space-y-4">
          <SectionHeader title="Actions" description="Buttons, badges, alerts, and loading states." />
          <div className="flex flex-wrap gap-2">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <IconButton icon={<Search className="h-4 w-4" />} label="검색" variant="secondary" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
          </div>
          <Alert title="저장됨" tone="success" icon={<CheckCircle2 className="h-5 w-5" />}>
            공용 상태 색상은 semantic token을 사용합니다.
          </Alert>
          <Alert title="확인 필요" tone="warning" icon={<AlertCircle className="h-5 w-5" />}>
            페이지별 색상 utility 없이도 경고 상태를 표시합니다.
          </Alert>
          <LoadingState label="컴포넌트 로딩" description="로딩 상태도 같은 표면 규칙을 사용합니다." />
        </Panel>

        <Panel className="space-y-4">
          <SectionHeader title="Form" description="Labels, hints, errors, and binary controls." />
          <Input label="테마명" leftIcon={<Search className="h-4 w-4" />} placeholder="검색" />
          <Select
            label="난이도"
            placeholder="선택"
            options={[
              { value: 'easy', label: '쉬움' },
              { value: 'normal', label: '보통' },
            ]}
          />
          <Textarea label="설명" placeholder="플레이어에게 보이는 설명" />
          <Checkbox label="공개 준비 완료" description="검수 후 공개할 수 있습니다." />
          <Switch label="시스템 알림" description="변경 사항을 운영 채널에 표시합니다." />
          <Input label="필수 입력" error="값을 입력하세요" />
        </Panel>
      </div>

      <Panel className="space-y-4">
        <SectionHeader
          title="Table And Modal"
          description="Empty/loading/error states are covered by component tests."
          action={<Button onClick={() => setOpen(true)}>모달 열기</Button>}
        />
        <Table columns={columns} data={rows} getRowKey={(row) => row.id} />
      </Panel>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="공용 모달"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setOpen(false)}>확인</Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-[var(--mmp-color-charcoal)]">
          Escape, backdrop close, focus return behavior is covered by Modal tests.
        </p>
      </Modal>
    </PageShell>
  );
}
