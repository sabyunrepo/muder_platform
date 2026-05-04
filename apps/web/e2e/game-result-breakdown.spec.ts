import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { WsEventType } from "@mmp/shared";
import type { GameState, Player } from "@mmp/shared";
import { E2E_USER, handlers } from "../src/mocks/handlers";
import { installMswRoutes } from "./helpers/msw-route";
import { BASE, login } from "./helpers/common";

const SESSION_ID = "00000000-0000-0000-0000-0000000249e2";
const GAME_URL = `${BASE}/game/${SESSION_ID}`;

function nowMs(): number {
  return Date.now();
}

function envelope<T>(type: string, payload: T): { type: string; payload: T; ts: number; seq: number } {
  return { type, payload, ts: nowMs(), seq: Math.floor(Math.random() * 100_000) };
}

function player(id: string, nickname: string): Player {
  return {
    id,
    nickname,
    role: "civilian",
    isAlive: true,
    isHost: id === E2E_USER.id,
    isReady: true,
    connectedAt: nowMs(),
  };
}

function resultState(): GameState {
  return {
    sessionId: SESSION_ID,
    phase: "result",
    players: [player(E2E_USER.id, E2E_USER.nickname), player("p2", "강도윤")],
    modules: [],
    round: 4,
    phaseDeadline: null,
    createdAt: nowMs(),
  };
}

function installResultWsRoute(page: Page) {
  return page.routeWebSocket(/\/ws\/game(\?|$)/, (ws: WebSocketRoute) => {
    const state = resultState();
    queueMicrotask(() => {
      ws.send(JSON.stringify(envelope(WsEventType.GAME_START, { state, ts: nowMs() })));
      ws.send(JSON.stringify(envelope(WsEventType.SESSION_STATE, { state, ts: nowMs() })));
      ws.send(JSON.stringify(envelope(WsEventType.MODULE_STATE, {
        moduleId: "voting",
        data: {
          lastResult: {
            results: { [E2E_USER.id]: 3, p2: 1 },
            winner: E2E_USER.id,
            outcome: "winner",
            round: 1,
            totalVotes: 4,
            eligibleVoters: 4,
            participationPct: 100,
          },
        },
        ts: nowMs(),
      })));
      ws.send(JSON.stringify(envelope(WsEventType.MODULE_STATE, {
        moduleId: "ending_branch",
        data: {
          result: {
            selectedEnding: "진실의 밤",
            matchedPriority: 1,
            myScore: 3,
          },
        },
        ts: nowMs(),
      })));
    });
    ws.onMessage(() => {
      // Stubbed result screen spec only verifies server-to-client sync.
    });
  });
}

test.describe("Game result breakdown", () => {
  test.beforeEach(async ({ page }) => {
    await installMswRoutes(page, handlers);
  });

  test("RESULT 페이즈에서 결말과 투표 breakdown을 보여준다", async ({ page }) => {
    await installResultWsRoute(page);
    await login(page);
    await page.goto(GAME_URL);

    await expect(page.getByText("진실의 밤")).toBeVisible();
    await expect(page.getByText("내 결말 점수 3점")).toBeVisible();
    await expect(page.getByText("1라운드 투표 결과")).toBeVisible();
    await expect(page.getByText(`${E2E_USER.nickname}에게 가장 많은 표가 모였어요.`)).toBeVisible();
    await expect(page.getByText("총 4표")).toBeVisible();
    await expect(page.getByText("참여율 100%")).toBeVisible();
  });
});
