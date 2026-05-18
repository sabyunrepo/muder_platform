import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Modal, Button, Input, Panel, Select, Switch } from '@/shared/components/ui';
import { useThemes, useCreateRoom } from '../api';
import type { ThemeSummary } from '../api';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 테마 목록에서 미리 선택한 경우 */
  selectedTheme?: ThemeSummary | null;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  selectedTheme,
}: CreateRoomModalProps) {
  const navigate = useNavigate();
  const { data: themes } = useThemes({ limit: 100 });
  const createRoom = useCreateRoom();

  const [themeId, setThemeId] = useState(selectedTheme?.id ?? '');
  const [isPrivate, setIsPrivate] = useState(false);

  // 선택된 테마 정보
  const currentTheme =
    selectedTheme?.id === themeId
      ? selectedTheme
      : themes?.find((t) => t.id === themeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeId) return;

    createRoom.mutate(
      { theme_id: themeId, is_private: isPrivate },
      {
        onSuccess: (data) => {
          onClose();
          navigate(`/room/${data.id}`);
        },
      },
    );
  };

  // selectedTheme이 바뀌면 반영
  useEffect(() => {
    if (selectedTheme?.id) {
      setThemeId(selectedTheme.id);
    }
  }, [selectedTheme?.id]);

  const themeOptions = (themes ?? []).map((t) => ({
    value: t.id,
    label: `${t.title} (${t.min_players}-${t.max_players}명)`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="방 만들기"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="submit"
            form="create-room-form"
            isLoading={createRoom.isPending}
            disabled={!themeId}
          >
            생성
          </Button>
        </>
      }
    >
      <form id="create-room-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 테마 선택 */}
        {selectedTheme ? (
          <Panel padding="sm" className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--mmp-color-steel)]">테마</label>
            <p className="text-sm text-[var(--mmp-color-ink)]">{selectedTheme.title}</p>
          </Panel>
        ) : (
          <Select
            label="테마"
            placeholder="테마를 선택하세요"
            options={themeOptions}
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
          />
        )}

        {/* 인원 정보 (테마 기준 읽기 전용) */}
        {currentTheme && (
          <Input
            label="최대 인원"
            value={`${currentTheme.min_players} - ${currentTheme.max_players}명`}
            readOnly
          />
        )}

        {/* 비공개 토글 */}
        <Switch
          label="비공개 방"
          checked={isPrivate}
          onChange={(event) => setIsPrivate(event.target.checked)}
        />
      </form>
    </Modal>
  );
}
