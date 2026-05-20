import { CheckCircle, Circle, Play, XCircle } from 'lucide-react';
import { Button, Panel } from '@/shared/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HostControlsProps {
  /** 현재 유저가 호스트인지 */
  isHost: boolean;
  /** 전원 레디 여부 (호스트 제외) */
  allReady: boolean;
  /** 최소 인원 충족 여부 */
  hasMinPlayers: boolean;
  /** 전원 캐릭터 선택 여부 */
  allCharactersSelected: boolean;
  /** 게임 시작 핸들러 */
  onStartGame: () => void;
  /** 방 닫기 핸들러 */
  onCloseRoom: () => void;
  /** 로딩 상태 */
  isStarting?: boolean;
  /** 시작 실패 메시지 */
  startErrorMessage?: string | null;
  /** 현재 인원 */
  playerCount?: number;
  /** 최소 인원 */
  minPlayers?: number | null;
  /** 준비 완료 인원 */
  readyPlayerCount?: number;
  /** 준비 대상 인원 */
  readyTargetCount?: number;
  /** 캐릭터 선택 완료 인원 */
  selectedCharacterCount?: number;
  /** 캐릭터 선택 대상 인원 */
  characterTargetCount?: number;
}

// ---------------------------------------------------------------------------
// HostControls
// ---------------------------------------------------------------------------

export function HostControls({
  isHost,
  allReady,
  hasMinPlayers,
  allCharactersSelected,
  onStartGame,
  onCloseRoom,
  isStarting = false,
  startErrorMessage,
  playerCount = 0,
  minPlayers,
  readyPlayerCount = 0,
  readyTargetCount = 0,
  selectedCharacterCount = 0,
  characterTargetCount = 0,
}: HostControlsProps) {
  // 호스트가 아니면 렌더링하지 않음
  if (!isHost) return null;

  const canStart = allReady && hasMinPlayers && allCharactersSelected;

  const startChecks = [
    {
      label: minPlayers != null ? `최소 인원 ${minPlayers}명` : '최소 인원 정보',
      detail: minPlayers != null ? `${playerCount}/${minPlayers}` : '테마 정보 없음',
      passed: hasMinPlayers,
    },
    {
      label: '참가자 준비',
      detail: `${readyPlayerCount}/${readyTargetCount}`,
      passed: allReady,
    },
    {
      label: '캐릭터 선택',
      detail: `${selectedCharacterCount}/${characterTargetCount}`,
      passed: allCharactersSelected,
    },
  ];

  return (
    <Panel className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--mmp-color-ink)]">시작 조건</h2>
        <p className="mt-1 text-xs text-[var(--mmp-color-steel)]">
          조건이 모두 충족되면 게임을 시작할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-2">
        {startChecks.map((check) => (
          <div
            key={check.label}
            className="flex items-center justify-between gap-3 rounded-md border border-[var(--mmp-color-hairline)] px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-[var(--mmp-color-charcoal)]">
              {check.passed ? (
                <CheckCircle className="h-4 w-4 text-[var(--mmp-color-success)]" />
              ) : (
                <Circle className="h-4 w-4 text-[var(--mmp-color-muted)]" />
              )}
              {check.label}
            </span>
            <span className="text-xs font-medium text-[var(--mmp-color-steel)]">{check.detail}</span>
          </div>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        leftIcon={<Play className="h-5 w-5" />}
        disabled={isStarting}
        isLoading={isStarting}
        onClick={onStartGame}
        className="w-full"
        aria-describedby={!canStart ? 'host-start-client-checks' : undefined}
      >
        게임 시작
      </Button>

      {!canStart && (
        <p id="host-start-client-checks" className="text-center text-xs text-[var(--mmp-color-steel)]">
          {!hasMinPlayers
            ? '최소 인원이 충족되지 않았습니다.'
            : !allCharactersSelected
              ? '모든 참가자가 캐릭터를 선택해야 시작할 수 있습니다.'
              : '모든 참가자가 준비해야 시작할 수 있습니다.'}
        </p>
      )}

      {startErrorMessage && (
        <p className="text-center text-xs text-[var(--mmp-color-error)]">{startErrorMessage}</p>
      )}

      <Button
        variant="danger"
        size="sm"
        leftIcon={<XCircle className="h-4 w-4" />}
        onClick={onCloseRoom}
        className="w-full"
      >
        방 닫기
      </Button>
    </Panel>
  );
}
