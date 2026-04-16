/**
 * game-redaction-stubbed — Phase 18.8 PR-3
 *
 * `game-redaction.spec.ts` 는 `PLAYWRIGHT_BACKEND` env gate 로 stubbed CI 에서
 * 전체 skip. 본 spec 은 동일한 redaction 시나리오 4종을 MSW(HTTP) +
 * `page.routeWebSocket`(WS) 로 stubbed CI 에서도 통과시키는 복제본이다.
 *
 * 시나리오:
 *  1) murderer payload — `secret_card.contents` 실제 값이 클라가 받은 frame 에 포함
 *  2) civilian/normal payload — `secret_card.contents` 가 "???" 로 마스킹
 *  3) whisper sender→me 매칭 — DOM(WhisperPanel) 에 메시지 노출
 *  4) whisper sender→other 비매칭 — DOM 에 메시지 미노출
 *
 * 검증 전략 (PR 스펙 결정):
 *  - secret_card UI 컴포넌트가 frontend 에 아직 없으므로 (1)(2) 는 클라가
 *    수신한 WS frame 자체를 collector 로 잡아 검증. server stubbed payload 가
 *    role-conditional 로 정확히 만들어졌는가를 SSOT 로 둠.
 *  - whisper 는 INVESTIGATION phase 에서 마운트되는 `WhisperPanel` 의 DOM
 *    텍스트로 검증.
 *
 * 본 spec 은 backend 미실행을 전제 — `PLAYWRIGHT_BACKEND` 가 set 되어 있어도
 * MSW + routeWebSocket 이 우선 적용되어 동일하게 동작한다.
 */
import { test, expect, type Page } from "@playwright/test";
import { handlers, installGameWsRoute, E2E_USER } from "../src/mocks/handlers";
import { installMswRoutes } from "./helpers/msw-route";
import { login, BASE } from "./helpers/common";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_ID = "00000000-0000-0000-0000-0000000005e2";
const GAME_URL = `${BASE}/game/${SESSION_ID}`;
const WHISPER_TEXT = "범인은 라운지 뒤편 비밀 통로에 있다.";
const SENDER_NICKNAME = "수상한사람";
const OTHER_PLAYER_ID = "00000000-0000-0000-0000-000000000099";

// SESSION_STATE / MODULE_STATE / GAME_START envelope 수신을 일정 시간 기다린다.
const FRAME_WAIT_MS = 1_500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CapturedFrame {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Playwright `page.on("websocket")` 로 server→client frame 을 모은다.
 * 반드시 `page.goto` 이전에 등록해야 첫 frame 까지 잡힌다.
 */
function collectServerFrames(page: Page): CapturedFrame[] {
  const frames: CapturedFrame[] = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => {
      if (typeof frame.payload !== "string") return;
      try {
        const parsed = JSON.parse(frame.payload) as CapturedFrame;
        if (parsed && typeof parsed.type === "string") frames.push(parsed);
      } catch {
        // 비-JSON frame 은 무시.
      }
    });
  });
  return frames;
}

async function waitForFrame(
  frames: CapturedFrame[],
  type: string,
  timeoutMs: number = FRAME_WAIT_MS,
): Promise<CapturedFrame> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = frames.find((f) => f.type === type);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`waitForFrame timeout: type=${type} (got ${frames.map((f) => f.type).join(",")})`);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Game Redaction (stubbed) — MSW + routeWebSocket", () => {
  test.beforeEach(async ({ page }) => {
    await installMswRoutes(page, handlers);
  });

  // -------------------------------------------------------------------------
  // 1. Murderer role — secret_card.contents 에 실제 값 노출
  // -------------------------------------------------------------------------

  test("murderer 역할은 secret_card 에 실제 비밀 텍스트를 받는다", async ({ page }) => {
    await installGameWsRoute(page, "murderer");
    const frames = collectServerFrames(page);

    await login(page);
    await page.goto(GAME_URL);

    const moduleFrame = await waitForFrame(frames, "module:state");
    const data = moduleFrame.payload?.data as { contents?: string } | undefined;
    expect(data?.contents).toBeDefined();
    expect(data?.contents).not.toBe("???");
    expect(data?.contents?.length).toBeGreaterThan(10);
  });

  // -------------------------------------------------------------------------
  // 2. Normal/civilian role — secret_card.contents 마스킹
  // -------------------------------------------------------------------------

  test("normal 역할은 secret_card.contents 가 '???' 로 마스킹된다", async ({ page }) => {
    await installGameWsRoute(page, "normal");
    const frames = collectServerFrames(page);

    await login(page);
    await page.goto(GAME_URL);

    const moduleFrame = await waitForFrame(frames, "module:state");
    const data = moduleFrame.payload?.data as { contents?: string } | undefined;
    expect(data?.contents).toBe("???");
  });

  // -------------------------------------------------------------------------
  // 3. Whisper 수신자 매칭 — DOM 노출
  // -------------------------------------------------------------------------

  test("귓속말 수신자가 본인이면 채팅 패널 귓속말 탭에 메시지가 노출된다", async ({
    page,
  }) => {
    await installGameWsRoute(page, "normal", {
      senderId: OTHER_PLAYER_ID,
      receiverId: E2E_USER.id, // === myPlayerId → mock 이 ws.send 수행
      myPlayerId: E2E_USER.id,
      text: WHISPER_TEXT,
      senderNickname: SENDER_NICKNAME,
    });

    await login(page);
    await page.goto(GAME_URL);

    // GameChat 사이드바는 INVESTIGATION 페이즈 + lg 뷰포트(1280px) 에서 마운트.
    // 기본 탭이 "all" 이므로 "귓속말" 탭으로 전환해야 수신된 frame 이 노출된다.
    const whisperTab = page.getByRole("button", { name: "귓속말" });
    await expect(whisperTab.first()).toBeVisible({ timeout: 5_000 });
    await whisperTab.first().click();

    await expect(page.getByText(WHISPER_TEXT)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(SENDER_NICKNAME).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Whisper 수신자 비매칭 — DOM 미노출
  // -------------------------------------------------------------------------

  test("귓속말 수신자가 타인이면 채팅 패널 귓속말 탭이 비어 있다", async ({ page }) => {
    await installGameWsRoute(page, "normal", {
      senderId: OTHER_PLAYER_ID,
      receiverId: OTHER_PLAYER_ID, // !== myPlayerId → mock 이 send 자체를 skip
      myPlayerId: E2E_USER.id,
      text: WHISPER_TEXT,
      senderNickname: SENDER_NICKNAME,
    });

    await login(page);
    await page.goto(GAME_URL);

    const whisperTab = page.getByRole("button", { name: "귓속말" });
    await expect(whisperTab.first()).toBeVisible({ timeout: 5_000 });
    await whisperTab.first().click();

    // GameChat 의 빈 메시지 텍스트.
    await expect(page.getByText("아직 메시지가 없습니다.")).toBeVisible({
      timeout: 3_000,
    });
    // 비밀 텍스트는 절대 DOM 에 나타나지 않아야 한다.
    await expect(page.getByText(WHISPER_TEXT)).toHaveCount(0);
  });
});
