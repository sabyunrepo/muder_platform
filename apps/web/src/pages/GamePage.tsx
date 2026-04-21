import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, Navigate } from "react-router";
import { GamePhase } from "@mmp/shared";
import type { WsEventType } from "@mmp/shared";
import { WsClientState } from "@mmp/ws-client";
import { MessageSquare, AlertTriangle, Target } from "lucide-react";

import { Spinner, Button } from "@/shared/components/ui";
import { useWsClient } from "@/hooks/useWsClient";
import { useGameSync } from "@/hooks/useGameSync";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { selectPhase, selectIsGameActive } from "@/stores/gameSelectors";

import {
  VotingPanel,
  AccusationPanel,
  CluePanel,
  ExplorationPanel,
  NetworkOverlay,
  ReadingPanel,
  HiddenMissionCard,
  MissionResultOverlay,
  TradeCluePanel,
  TradeRequestNotification,
} from "@/features/game/components";
import { AudioProvider } from "@/features/audio/AudioProvider";
import { GameErrorBoundary } from "@/components/error";

// ---------------------------------------------------------------------------
// 다른 에이전트가 생성 중인 컴포넌트 (lazy import)
// ---------------------------------------------------------------------------

const GameHUD = lazy(() =>
  import("@/features/game/components/GameHUD").then((m) => ({
    default: m.GameHUD,
  })),
);
const PhaseTransition = lazy(() =>
  import("@/features/game/components/PhaseTransition").then((m) => ({
    default: m.PhaseTransition,
  })),
);
const GameChat = lazy(() =>
  import("@/features/game/components/GameChat").then((m) => ({
    default: m.GameChat,
  })),
);

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

function GamePage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const [isChatOpen, setIsChatOpen] = useState(false);

  // sessionId 없으면 리다이렉트
  if (!sessionId) {
    return <Navigate to="/lobby" replace />;
  }

  return <GamePageInner sessionId={sessionId} isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />;
}

// ---------------------------------------------------------------------------
// 내부 컴포넌트 (hooks 조건부 호출 방지를 위해 분리)
// ---------------------------------------------------------------------------

interface GamePageInnerProps {
  sessionId: string;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

function GamePageInner({ sessionId, isChatOpen, setIsChatOpen }: GamePageInnerProps) {
  // WS 연결 + 스토어 동기화
  const { send, state: wsState } = useWsClient({
    endpoint: "game",
    sessionId,
  });
  useGameSync();

  const [isMissionOpen, setIsMissionOpen] = useState(false);

  // unmount 시 게임/모듈 스토어 정리
  // PR-8 (F-react-6): resetGame이 내부에서 clearBySessionId를 호출하므로
  // 모듈 스토어는 자동 정리된다. 별도 clearModuleStores 호출 불필요.
  // T4 판정 (Phase 19 PR-7): useEffect cleanup에서 .getState()를 사용하는 것은
  // 의도적 패턴이다. unmount 시점에는 React 렌더 사이클 외부이므로 selector
  // 바인딩이 불가하고, .getState()가 올바른 접근법이다. refactor 불필요.
  useEffect(() => {
    return () => {
      useGameStore.getState().resetGame();
    };
  }, [sessionId]);

  const phase = useGameStore(selectPhase);
  const isGameActive = useGameStore(selectIsGameActive);

  // 단서 교환 요청 알림 (게임 활성화 중 항상 감지)
  // 연결 중 로딩
  if (wsState === WsClientState.CONNECTING) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">게임 서버에 연결 중...</p>
      </div>
    );
  }

  // 연결 실패
  if (wsState === WsClientState.DISCONNECTED) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <p className="text-sm text-slate-300">서버 연결이 끊어졌습니다</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          다시 연결
        </Button>
      </div>
    );
  }

  // 사이드바에 채팅을 보여줄 페이즈
  const showSidebarChat =
    phase === GamePhase.INVESTIGATION || phase === GamePhase.VOTING;

  return (
    <AudioProvider>
    <GameErrorBoundary>
    <NetworkOverlay />
    {/* 단서 교환 요청 알림 수신기 (게임 활성화 중 항상 마운트) */}
    {isGameActive && <TradeRequestNotification send={send} />}
    {/* 미션 결과 오버레이 (RESULT 페이즈) */}
    {phase === GamePhase.RESULT && <MissionResultOverlay />}
    {/* 미션 카드 모달 (게임 활성화 중) */}
    {isMissionOpen && isGameActive && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md">
          <HiddenMissionCard send={send} />
          <button
            type="button"
            onClick={() => setIsMissionOpen(false)}
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            닫기
          </button>
        </div>
      </div>
    )}
    <div className="flex h-screen flex-col bg-slate-950">
      {/* 상단: GameHUD */}
      <Suspense fallback={null}>
        <GameHUD />
      </Suspense>

      {/* 미션 토글 버튼 (게임 활성화 중, RESULT 제외) */}
      {isGameActive && phase !== GamePhase.RESULT && (
        <div className="flex justify-end border-b border-slate-800 bg-slate-900/80 px-4 py-1.5">
          <button
            type="button"
            onClick={() => setIsMissionOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-amber-400"
          >
            <Target className="h-4 w-4" />
            비밀 임무
          </button>
        </div>
      )}

      {/* 페이즈 전환 오버레이 */}
      <Suspense fallback={null}>
        <PhaseTransition />
      </Suspense>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 메인 영역 */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PhaseContent
            phase={phase}
            isGameActive={isGameActive}
            send={send}
          />
        </main>

        {/* 사이드바: 채팅 (데스크탑, investigation/voting 페이즈) */}
        {showSidebarChat && (
          <aside className="hidden w-80 border-l border-slate-800 lg:block">
            <Suspense fallback={null}>
              <GameChat send={send} />
            </Suspense>
          </aside>
        )}
      </div>

      {/* 모바일: 채팅 토글 버튼 + 하단 패널 */}
      {showSidebarChat && (
        <div className="lg:hidden">
          {isChatOpen && (
            <div className="h-64 border-t border-slate-800">
              <Suspense fallback={null}>
                <GameChat send={send} />
              </Suspense>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="flex w-full items-center justify-center gap-2 border-t border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
          >
            <MessageSquare className="h-4 w-4" />
            {isChatOpen ? "채팅 닫기" : "채팅 열기"}
          </button>
        </div>
      )}
    </div>
    </GameErrorBoundary>
    </AudioProvider>
  );
}

// ---------------------------------------------------------------------------
// Phase별 조건부 렌더링
// ---------------------------------------------------------------------------

interface PhaseContentProps {
  phase: GamePhase | null;
  isGameActive: boolean;
  send: (type: WsEventType, payload: unknown) => void;
}

function PhaseContent({ phase, isGameActive, send }: PhaseContentProps) {
  // 게임 미시작
  if (!isGameActive || !phase) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">게임 상태를 불러오는 중...</p>
      </div>
    );
  }

  switch (phase) {
    case GamePhase.LOBBY:
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-200">게임 시작 대기 중...</p>
            <p className="mt-2 text-sm text-slate-400">호스트가 게임을 시작하면 자동으로 진행됩니다</p>
          </div>
        </div>
      );

    case GamePhase.INTRO:
      return <ReadingPanel send={send} />;

    case GamePhase.INVESTIGATION:
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExplorationPanel send={send} moduleId="location_exploration" />
          <div className="space-y-4">
            <CluePanel />
            <TradeCluePanel send={send} />
          </div>
        </div>
      );

    case GamePhase.DISCUSSION:
      return (
        <div className="h-full">
          <Suspense fallback={null}>
            <GameChat send={send} fullWidth />
          </Suspense>
        </div>
      );

    case GamePhase.VOTING:
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <VotingPanel send={send} moduleId="voting" />
          <AccusationPanel send={send} moduleId="accusation" />
        </div>
      );

    case GamePhase.REVEAL:
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-200">결과 공개</p>
            <p className="mt-2 text-sm text-slate-400">
              투표 결과와 진실이 밝혀집니다...
            </p>
          </div>
        </div>
      );

    case GamePhase.RESULT:
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-200">게임 종료</p>
            <p className="mt-2 text-sm text-slate-400">
              최종 결과를 확인하세요
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default GamePage;
