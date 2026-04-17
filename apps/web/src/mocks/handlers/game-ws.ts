/**
 * Phase 18.8 PR-3 — Game WebSocket route factory (Playwright `routeWebSocket`).
 *
 * 게임 WS endpoint(`/ws/game?token=...`) 를 stubbed CI 에서 가로채 role 별 차등
 * payload 와 whisper(귓속말) frame 을 송신한다.
 *
 * 서버 SSOT 참조:
 *  - WS envelope: `packages/shared/src/ws/types.ts` (`{ type, payload, ts, seq }`)
 *  - GameState: `packages/shared/src/game/types.ts` (`GameState`, `Player`)
 *  - Redaction 의도: `apps/server/internal/session/snapshot_redaction_test.go`
 *    (서버는 player 별 envelope 을 따로 dispatch — 클라가 받는 SESSION_STATE 에는
 *    자기 데이터만 들어 있다는 가정)
 *
 * 설계 결정:
 *  - 본인 player 의 role 만 채우고 나머지는 null (서버 redaction SSOT 와 일치).
 *  - secret_card UI 컴포넌트는 frontend 에 아직 없으므로 MODULE_STATE payload
 *    로 전송, spec 측 collector 가 frame 자체를 검증.
 *  - whisper 는 INVESTIGATION 페이즈 사이드바에서 마운트되는 `WhisperPanel`
 *    DOM 으로 검증 가능 — sender→me 매칭 시에만 ws.send 수행.
 */
import type { Page, WebSocketRoute } from "@playwright/test";
import { WsEventType } from "@mmp/shared";
import type { GameState, Player } from "@mmp/shared";
import { E2E_USER } from "./auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GameRole = "murderer" | "detective" | "normal";

export interface SecretCardPayload {
  contents: string;
  role_card: string;
}

export interface GameWsRouteOptions {
  myPlayerId?: string;
  initialPhase?: GameState["phase"];
  partySize?: number;
}

export interface WhisperRouteOptions {
  senderId: string;
  receiverId: string;
  /** 이 page 의 user. receiverId 와 같으면 DOM 노출되어야 한다. */
  myPlayerId: string;
  text?: string;
  senderNickname?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_ID = "00000000-0000-0000-0000-0000000005e2";
const SECRET_REDACTED = "???";
const SECRET_FULL =
  "당신은 22:14 에 비밀 통로로 들어가 피해자에게 칼을 휘둘렀다.";
const ROLE_CARD: Record<GameRole, string> = {
  murderer: "당신은 살인자입니다.",
  detective: "당신은 탐정입니다. 추리를 통해 진범을 밝히세요.",
  normal: "당신은 일반 시민입니다.",
};

const nowMs = (): number => Date.now();

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildPlayer(
  id: string,
  nickname: string,
  role: Player["role"],
  isHost: boolean,
): Player {
  return { id, nickname, role, isAlive: true, isHost, isReady: true, connectedAt: nowMs() };
}

function buildSessionState(opts: Required<GameWsRouteOptions>, role: GameRole): GameState {
  // Phase 18.8 follow-up (#6 monitor): detective 도 현재는 normal 과 동일한
  // SECRET_REDACTED ("???") 마스킹 정책. 서버가 향후 "탐정에게는 단서 일부
  // 공개" 같은 차등 redaction 을 도입하면 본 mock 도 정렬해야 한다 (drift
  // 모니터). game-redaction-stubbed.spec.ts 의 detective 시나리오로 회귀
  // 가드 가능.
  const myRoleEnum: Player["role"] =
    role === "murderer" ? "murderer" : role === "detective" ? "detective" : "civilian";
  const players: Player[] = [
    buildPlayer(opts.myPlayerId, E2E_USER.nickname, myRoleEnum, true),
  ];
  for (let i = 1; i < opts.partySize; i++) {
    // 타 플레이어 role 은 redact (null).
    players.push(buildPlayer(`00000000-0000-0000-0000-00000000000${i}`, `게스트${i}`, null, false));
  }
  return {
    sessionId: SESSION_ID,
    phase: opts.initialPhase,
    players,
    modules: [],
    round: 1,
    phaseDeadline: null,
    createdAt: nowMs(),
  };
}

function buildSecretCard(role: GameRole): SecretCardPayload {
  return {
    contents: role === "murderer" ? SECRET_FULL : SECRET_REDACTED,
    role_card: ROLE_CARD[role],
  };
}

/**
 * Envelope factory — `seqCounter` 는 각 핸들러 invocation 별 closure 에 격리된다.
 * 모듈 레벨 mutable 을 피해 Playwright worker 내 테스트 간 누적/race 를 방지.
 */
function makeEnvelopeFactory(): <T>(
  type: string,
  payload: T,
) => { type: string; payload: T; ts: number; seq: number } {
  let seqCounter = 0;
  return <T>(type: string, payload: T) => ({
    type,
    payload,
    ts: nowMs(),
    seq: ++seqCounter,
  });
}

// ---------------------------------------------------------------------------
// Public — routeWebSocket handlers
// ---------------------------------------------------------------------------

/**
 * `page.routeWebSocket("**\/ws/game**", createGameWsRoute("murderer"))` 처럼 사용.
 * connection 직후 GAME_START → SESSION_STATE → MODULE_STATE 순으로 frame 송신.
 */
export function createGameWsRoute(
  role: GameRole,
  optionsIn: GameWsRouteOptions = {},
): (ws: WebSocketRoute) => void {
  const opts: Required<GameWsRouteOptions> = {
    myPlayerId: optionsIn.myPlayerId ?? E2E_USER.id,
    initialPhase: optionsIn.initialPhase ?? "investigation",
    partySize: optionsIn.partySize ?? 4,
  };
  return (ws: WebSocketRoute): void => {
    const envelope = makeEnvelopeFactory();
    const state = buildSessionState(opts, role);
    const secret = buildSecretCard(role);
    queueMicrotask(() => {
      ws.send(JSON.stringify(envelope(WsEventType.GAME_START, { state, ts: nowMs() })));
      ws.send(JSON.stringify(envelope(WsEventType.SESSION_STATE, { state, ts: nowMs() })));
      ws.send(
        JSON.stringify(
          envelope(WsEventType.MODULE_STATE, {
            moduleId: "secret_card",
            data: secret as Record<string, unknown>,
            ts: nowMs(),
          }),
        ),
      );
    });
    ws.onMessage(() => {
      // client→server frame 은 drop (PING 등). stubbed CI 는 send-side 만 검증.
    });
  };
}

/**
 * Whisper push helper — receiver 가 myPlayerId 와 같을 때만 ws.send 수행.
 */
export function createWhisperRoute(opts: WhisperRouteOptions): (ws: WebSocketRoute) => void {
  return (ws: WebSocketRoute): void => {
    const envelope = makeEnvelopeFactory();
    queueMicrotask(() => {
      if (opts.receiverId !== opts.myPlayerId) return;
      ws.send(
        JSON.stringify(
          envelope(WsEventType.CHAT_WHISPER, {
            sender: opts.senderId,
            nickname: opts.senderNickname ?? "수상한사람",
            targetId: opts.receiverId,
            text: opts.text ?? "비밀 단서를 알려드립니다.",
            ts: nowMs(),
          }),
        ),
      );
    });
    ws.onMessage(() => {
      /* noop */
    });
  };
}

/** base game route + (선택적) whisper route 합성. */
export function composeGameWsRoute(
  role: GameRole,
  whisper: WhisperRouteOptions | null,
  options: GameWsRouteOptions = {},
): (ws: WebSocketRoute) => void {
  const baseHandler = createGameWsRoute(role, options);
  const whisperHandler = whisper ? createWhisperRoute(whisper) : null;
  return (ws: WebSocketRoute): void => {
    baseHandler(ws);
    if (whisperHandler) whisperHandler(ws);
  };
}

/** spec 편의 — page 에 game WS route install. */
export async function installGameWsRoute(
  page: Page,
  role: GameRole,
  whisper: WhisperRouteOptions | null = null,
  options: GameWsRouteOptions = {},
): Promise<void> {
  await page.routeWebSocket(/\/ws\/game(\?|$)/, composeGameWsRoute(role, whisper, options));
}
