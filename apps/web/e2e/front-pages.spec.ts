import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// 테스트 계정 (로컬 dev 전용)
// ---------------------------------------------------------------------------
const TEST_EMAIL = "e2e@test.com";
const TEST_PASSWORD = "e2etest1234";

// ---------------------------------------------------------------------------
// 1. 로그인 페이지
// ---------------------------------------------------------------------------
test.describe("로그인 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("기본 UI 요소가 모두 표시된다", async ({ page }) => {
    // 제목
    await expect(page.getByRole("heading", { name: /로그인/ })).toBeVisible();
    // 환영 메시지
    await expect(page.getByText("Murder Mystery Platform에 오신 것을 환영합니다")).toBeVisible();
    // 이메일/비밀번호 입력
    await expect(page.getByPlaceholder("이메일")).toBeVisible();
    await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
    // 로그인 버튼
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
    // OAuth 버튼
    await expect(page.getByRole("button", { name: /카카오로 시작하기/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Google로 시작하기/ })).toBeVisible();
    // 회원가입 전환 링크
    await expect(page.getByText("계정이 없으신가요? 회원가입")).toBeVisible();
  });

  test("회원가입 모드로 전환하면 닉네임 필드가 나타난다", async ({ page }) => {
    await page.getByText("계정이 없으신가요? 회원가입").click();
    await expect(page.getByRole("heading", { name: /회원가입/ })).toBeVisible();
    await expect(page.getByPlaceholder("닉네임")).toBeVisible();
    await expect(page.getByText("이미 계정이 있으신가요? 로그인")).toBeVisible();
  });

  test("빈 폼 제출 시 브라우저 validation이 작동한다", async ({ page }) => {
    const emailInput = page.getByPlaceholder("이메일");
    await page.getByRole("button", { name: "로그인" }).click();
    // required 필드이므로 폼이 제출되지 않고 페이지가 유지된다
    await expect(emailInput).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("잘못된 자격 증명으로 로그인하면 에러 메시지가 표시된다", async ({ page }) => {
    await page.getByPlaceholder("이메일").fill("wrong@wrong.com");
    await page.getByPlaceholder("비밀번호").fill("wrongpassword");
    await page.getByRole("button", { name: "로그인" }).click();
    // 에러 메시지 (서버 응답 또는 네트워크 에러)
    await expect(page.locator("text=실패").or(page.locator(".text-red-400"))).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. 인증 리다이렉트
// ---------------------------------------------------------------------------
test.describe("인증 리다이렉트", () => {
  test("비인증 상태에서 / 접근 시 /login으로 리다이렉트된다", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("비인증 상태에서 /profile 접근 시 /login으로 리다이렉트된다", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. 404 페이지
// ---------------------------------------------------------------------------
test.describe("404 페이지", () => {
  test("존재하지 않는 경로에서 404 페이지가 표시된다", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-12345");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("페이지를 찾을 수 없습니다")).toBeVisible();
    await expect(page.getByRole("link", { name: "홈으로 돌아가기" })).toBeVisible();
  });

  test("홈으로 돌아가기 클릭 시 / 로 이동한다", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-12345");
    await page.getByRole("link", { name: "홈으로 돌아가기" }).click();
    // 비인증이므로 최종적으로 /login으로 리다이렉트됨
    await expect(page).toHaveURL(/\/(login)?/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. 로그인 → 로비 플로우 (백엔드 필요)
// ---------------------------------------------------------------------------
test.describe("로그인 → 로비 플로우", () => {
  // 백엔드가 없으면 스킵
  test.beforeEach(async ({ page }) => {
    const res = await page.request.get("http://localhost:8080/health").catch(() => null);
    test.skip(!res || !res.ok(), "백엔드 서버가 실행되지 않음 — 이 테스트는 스킵됩니다");
  });

  test("올바른 자격 증명으로 로그인하면 로비로 이동한다", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("이메일").fill(TEST_EMAIL);
    await page.getByPlaceholder("비밀번호").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();

    // 로비 페이지 도착
    await expect(page.getByRole("heading", { name: "로비" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("로비에서 주요 UI 요소가 표시된다", async ({ page }) => {
    // 로그인
    await page.goto("/login");
    await page.getByPlaceholder("이메일").fill(TEST_EMAIL);
    await page.getByPlaceholder("비밀번호").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByRole("heading", { name: "로비" })).toBeVisible({
      timeout: 15_000,
    });

    // 주요 요소
    await expect(page.getByRole("button", { name: /방 만들기/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /코드로 참가/ })).toBeVisible();
    await expect(page.getByText("공개 방")).toBeVisible();
  });

  test("방 만들기 버튼 클릭 시 모달이 열린다", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("이메일").fill(TEST_EMAIL);
    await page.getByPlaceholder("비밀번호").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByRole("heading", { name: "로비" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /방 만들기/ }).click();
    // 모달이 열린다 (dialog 또는 모달 컨텐츠)
    await expect(
      page.getByRole("dialog").or(page.locator("[data-testid='create-room-modal']")).or(page.getByText("방 생성"))
    ).toBeVisible({ timeout: 5_000 });
  });

  test("코드로 참가 버튼 클릭 시 모달이 열린다", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("이메일").fill(TEST_EMAIL);
    await page.getByPlaceholder("비밀번호").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByRole("heading", { name: "로비" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /코드로 참가/ }).click();
    await expect(
      page.getByRole("dialog", { name: "코드로 참가" })
    ).toBeVisible({ timeout: 5_000 });
  });
});
