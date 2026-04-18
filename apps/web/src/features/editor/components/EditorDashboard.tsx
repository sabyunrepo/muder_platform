import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Trash2, Users, Clock, BookOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Modal,
  Badge,
  EmptyState,
  Spinner,
} from "@/shared/components/ui";
import {
  useEditorThemes,
  useCreateTheme,
  useDeleteTheme,
} from "@/features/editor/api";
import type { CreateThemeRequest, EditorThemeSummary } from "@/features/editor/api";
import { STATUS_LABEL, STATUS_COLOR } from "@/features/editor/constants";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// CreateThemeForm (Modal 내부)
// ---------------------------------------------------------------------------

interface CreateThemeFormProps {
  onSubmit: (data: CreateThemeRequest) => void;
  isLoading: boolean;
  onCancel: () => void;
}

function CreateThemeForm({ onSubmit, isLoading, onCancel }: CreateThemeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minPlayers, setMinPlayers] = useState("4");
  const [maxPlayers, setMaxPlayers] = useState("6");
  const [durationMin, setDurationMin] = useState("90");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "테마 제목을 입력해주세요";
    const min = Number(minPlayers);
    const max = Number(maxPlayers);
    const dur = Number(durationMin);
    if (!Number.isInteger(min) || min < 2 || min > 20) next.minPlayers = "2~20명 사이로 입력해주세요";
    if (!Number.isInteger(max) || max < min || max > 20) next.maxPlayers = "최소 인원보다 크고 20명 이하여야 합니다";
    if (!Number.isInteger(dur) || dur < 10 || dur > 300) next.durationMin = "10~300분 사이로 입력해주세요";
    if (price && (Number.isNaN(Number(price)) || Number(price) < 0))
      next.price = "올바른 가격을 입력해주세요";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateThemeRequest = {
      title: title.trim(),
      min_players: Number(minPlayers),
      max_players: Number(maxPlayers),
      duration_min: Number(durationMin),
    };
    if (description.trim()) data.description = description.trim();
    if (price) data.price = Number(price);

    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="테마 제목"
        placeholder="예: 어둠 속의 살인"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        autoFocus
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">설명</label>
        <textarea
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
          rows={3}
          placeholder="테마에 대한 간단한 설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="최소 인원"
          type="number"
          min={2}
          value={minPlayers}
          onChange={(e) => setMinPlayers(e.target.value)}
          error={errors.minPlayers}
        />
        <Input
          label="최대 인원"
          type="number"
          min={2}
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(e.target.value)}
          error={errors.maxPlayers}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="플레이 시간 (분)"
          type="number"
          min={10}
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value)}
          error={errors.durationMin}
        />
        <Input
          label="가격 (원, 선택)"
          type="number"
          min={0}
          placeholder="무료"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
        />
      </div>
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          취소
        </Button>
        <Button type="submit" isLoading={isLoading}>
          생성
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ThemeCard
// ---------------------------------------------------------------------------

interface ThemeCardProps {
  theme: EditorThemeSummary;
  onNavigate: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function ThemeCard({ theme, onNavigate, onDelete, isDeleting }: ThemeCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <Card
        hoverable
        onClick={() => onNavigate(theme.id)}
        className="flex flex-col gap-3"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-slate-100 line-clamp-1">
            {theme.title}
          </h3>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[theme.status]}`}>
            {STATUS_LABEL[theme.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {theme.min_players}~{theme.max_players}명
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            v{theme.version}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(theme.created_at)}
          </span>
        </div>
        {theme.status === "DRAFT" && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
              aria-label="테마 삭제"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirm(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="테마 삭제"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={isDeleting}>
              취소
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={() => onDelete(theme.id)}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{theme.title}</span> 테마를
          삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// EditorDashboard
// ---------------------------------------------------------------------------

export function EditorDashboard() {
  const navigate = useNavigate();
  const { data: themes, isLoading, isError } = useEditorThemes();
  const createTheme = useCreateTheme();
  const deleteTheme = useDeleteTheme();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreate(data: CreateThemeRequest) {
    createTheme.mutate(data, {
      onSuccess: (created) => {
        toast.success("테마가 생성되었습니다");
        setIsCreateOpen(false);
        navigate(`/editor/${created.id}`);
      },
      onError: (err) => {
        toast.error(err.message || "테마 생성에 실패했습니다");
      },
    });
  }

  function handleDelete(themeId: string) {
    setDeletingId(themeId);
    deleteTheme.mutate(themeId, {
      onSuccess: () => {
        toast.success("테마가 삭제되었습니다");
        setDeletingId(null);
      },
      onError: (err) => {
        toast.error(err.message || "테마 삭제에 실패했습니다");
        setDeletingId(null);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-red-400">테마 목록을 불러오는 데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">테마 에디터</h1>
          <p className="mt-1 text-sm text-slate-400">
            머더미스터리 테마를 만들고 관리하세요
          </p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setIsCreateOpen(true)}
        >
          새 테마 만들기
        </Button>
      </div>

      {!themes || themes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title="아직 테마가 없습니다"
          description="첫 번째 테마를 만들어 보세요"
          action={
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              새 테마 만들기
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onNavigate={(id) => navigate(`/editor/${id}`)}
              onDelete={handleDelete}
              isDeleting={deletingId === theme.id && deleteTheme.isPending}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="새 테마 만들기"
      >
        <CreateThemeForm
          onSubmit={handleCreate}
          isLoading={createTheme.isPending}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}
