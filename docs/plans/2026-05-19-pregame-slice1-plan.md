# Pre-game Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the MMP agentic delivery chain. Implementers must not be final reviewers or final validators. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the first #691 slice: lobby/room entry/waiting-room UX and ready/start contract alignment.

**Architecture:** Keep public room discovery and room entry as existing HTTP flows. Use authenticated HTTP mutations as the canonical write path for pre-game ready/start state, then refresh room detail and rely on existing WebSocket/session events where available for live invalidation. Add the minimal room text chat bridge needed for the waiting room to be usable. Defer character selection, friend invite, and voice to later #691 slices.

**Tech Stack:** Go room handler/service/sqlc, React 19, TanStack Query, React Router, Vitest/Testing Library, focused Go tests.

---

## Scope

- [x] Add an authenticated room ready mutation path using `{"is_ready": boolean}`.
- [x] Make host start use `POST /v1/rooms/{id}/start` instead of the stubbed `game.action` path.
- [x] Add backend start gating for minimum players and non-host ready state.
- [x] Make room status labels robust to backend uppercase status values.
- [x] Add minimal waiting-room text chat over the existing authenticated game WebSocket.
- [x] Keep character selection, friend invite, and voice expansion out of this PR except for preserving existing UI hooks.

## Files

- Modify: `apps/server/internal/domain/room/service.go`
- Add: `apps/server/internal/domain/room/service_queries.go`
- Modify: `apps/server/internal/domain/room/handler.go`
- Modify: `apps/server/internal/domain/room/mock_shim_test.go`
- Modify: `apps/server/internal/domain/room/mocks/mock_service.go` if generated mocks are refreshed
- Add: `apps/server/internal/domain/room/ws_chat.go`
- Modify: `apps/server/cmd/server/routes_editor.go`
- Test: `apps/server/internal/domain/room/handler_ready_test.go`
- Test: `apps/server/internal/domain/room/service_pregame_test.go`
- Test: `apps/server/internal/domain/room/ws_chat_test.go`
- Modify: `apps/web/src/features/lobby/api.ts`
- Add: `apps/web/src/features/lobby/roomStatus.ts`
- Modify: `apps/web/src/pages/RoomPage.tsx`
- Modify: `apps/web/src/features/room/components/HostControls.tsx`
- Modify: `apps/web/src/features/room/components/RoomHeader.tsx`
- Modify: `apps/web/src/features/lobby/components/RoomList.tsx`
- Test: `apps/web/src/pages/__tests__/RoomPage.test.tsx`
- Test: `apps/web/src/pages/__tests__/LobbyPage.test.tsx`
- Test: `apps/web/src/features/lobby/api.test.tsx`

## Task 1: Backend Ready Endpoint

- [x] **Step 1: Write failing handler tests**
  - Add tests for `POST /rooms/{id}/ready` success, unauthenticated request, invalid room id, and invalid JSON.
  - Expected before implementation: compile failure because handler/service method is missing.
  - Run: `cd apps/server && go test ./internal/domain/room -run 'TestSetReady'`

- [x] **Step 2: Add service contract**
  - Add `SetReady(ctx, roomID, userID uuid.UUID, ready bool) error` to `Service`.
  - Add a request type equivalent to:
    ```go
    type SetReadyRequest struct {
        IsReady bool `json:"is_ready"`
    }
    ```

- [x] **Step 3: Implement handler**
  - Parse auth user, room id, and JSON body.
  - Call `svc.SetReady`.
  - Return `{"status":"ready_updated"}`.

- [x] **Step 4: Implement service**
  - Lock room with `GetRoomForUpdate`.
  - Reject missing room with `ErrRoomNotFound`.
  - Reject non-`WAITING` room with `ErrRoomNotWaiting`.
  - Verify user is in `room_players`.
  - Persist with `SetPlayerReady`.

- [x] **Step 5: Register route**
  - Add `r.Post("/rooms/{id}/ready", deps.room.SetReady)` in authenticated room routes.

- [x] **Step 6: Verify**
  - Run: `cd apps/server && go test ./internal/domain/room -run 'TestSetReady|TestStartRoom'`

## Task 2: Backend Start Gating

- [x] **Step 1: Write failing service tests**
  - Add tests for `validateStartRoster` or equivalent helper:
    - minimum players not met
    - non-host player not ready
    - host readiness is ignored
    - all non-host players ready passes
  - Expected before implementation: helper is missing or behavior fails.
  - Run: `cd apps/server && go test ./internal/domain/room -run 'TestValidateStart'`

- [x] **Step 2: Implement small validation helper**
  - Inputs: `room`, theme min players, roster rows.
  - Return `apperror.ErrValidation` or `apperror.ErrConflict` with user-readable detail.
  - Do not add character selection checks in this PR.

- [x] **Step 3: Call helper in `StartRoom`**
  - Load theme or min players before `buildGameStartPlayers`.
  - Validate room status, host ownership, minimum players, non-host readiness.
  - Keep existing `game runtime not enabled` behavior for flag-off path.

- [x] **Step 4: Verify**
  - Run: `cd apps/server && go test ./internal/domain/room -run 'TestValidateStart|TestStartRoom|TestMapGameStartPlayers'`

## Task 3: Frontend API Mutations

- [x] **Step 1: Write failing frontend tests**
  - `RoomPage` non-host ready button calls `useSetReady` with server truth.
  - host start button calls `useStartRoom` and shows a failure message on mutation error.
  - Expected before implementation: mocks/functions missing or `game.action` send is called.
  - Run: `pnpm --filter @mmp/web test -- RoomPage.test.tsx`

- [x] **Step 2: Add lobby API mutations**
  - Add `SetReadyRequest` with `is_ready`.
  - Add `useSetReady`.
  - Add `useStartRoom`.
  - Invalidate room detail/list on success.

- [x] **Step 3: Update `RoomPage`**
  - Derive `isReady` from current user’s `room.players`.
  - Use `useSetReady` for ready toggle.
  - Use `useStartRoom` for host start.
  - On start success navigate to `/game/${room.id}`.
  - On mutation error show a Korean `Alert` near host controls.

- [x] **Step 4: Verify**
  - Run: `pnpm --filter @mmp/web test -- RoomPage.test.tsx`

## Task 4: Frontend Status and UX Hardening

- [x] **Step 1: Write failing component/page tests**
  - `RoomList` treats `WAITING` as joinable and labels it `대기 중`.
  - `RoomHeader` treats `WAITING` as `대기 중`.
  - Expected before implementation: uppercase status is shown raw or disables join.
  - Run: `pnpm --filter @mmp/web test -- LobbyPage.test.tsx RoomPage.test.tsx`

- [x] **Step 2: Normalize room status**
  - Add a small feature-local helper if needed.
  - Use it in `RoomList` and `RoomHeader`.

- [x] **Step 3: Improve waiting-room clarity**
  - Keep the existing two-column desktop structure.
  - Show server-driven ready state and host start disabled reason.
  - Do not introduce character/invite/voice controls in this PR.

- [x] **Step 4: Verify**
  - Run: `pnpm --filter @mmp/web test -- LobbyPage.test.tsx RoomPage.test.tsx`

## Task 5: Focused Validation and Review Gate

- [x] **Step 1: Run focused backend tests**
  - `cd apps/server && go test ./internal/domain/room`
  - Final blocker-fix evidence: `cd apps/server && go test ./internal/domain/room ./cmd/server ./internal/ws` passed after adding WS refresh-token rejection and StartRoom status compensation tests.

- [x] **Step 2: Run focused frontend tests**
  - `pnpm --filter @mmp/web test -- RoomPage.test.tsx LobbyPage.test.tsx api.test.tsx`
  - `pnpm --filter @mmp/web typecheck`
  - Evidence after final blocker fixes: 3 files / 14 tests passed; TypeScript `tsc --noEmit` passed.

- [x] **Step 3: Run local quick validation if focused checks pass**
  - `scripts/mmp-local-ci.sh quick`
  - Independent validation runner evidence: quick passed, including server Go tests, web lint/typecheck/test/build, and web test 210 files / 1910 tests passed.
  - Main final evidence after all blocker fixes: `scripts/mmp-local-ci.sh quick` passed. Existing web lint warnings remained warnings only: 40 problems, 0 errors.

- [x] **Step 4: Browser QA**
  - With backend `:8080` and web `:3000`, verify host/player ready/start behavior manually or document why two-account QA could not run.
  - Evidence: Playwright opened `/room/c2c3ffc2-a70e-4cd1-b994-dcbceec0ea6c`, confirmed no render crash, `POST /ready` returned `200`, WebSocket `/ws/game` upgraded with `200`, and lobby chat sent/received `브라우저 채팅 확인` in the room UI.

- [x] **Step 5: Independent review**
  - Frontend reviewer: no blocker.
  - Test coverage reviewer: requested actual `StartRoom` min-player wiring coverage; fixed with `minimum player gate stops before game starter and status update`.
  - Backend reviewer: requested WS refresh-token rejection and StartRoom status/runtime consistency; fixed with JWT extractor token-type check and status transition compensation.
  - Final backend re-review: no blocker; targeted WS JWT and `StartRoom` wiring tests passed.

## Self-review

- [x] Spec coverage: #691 Slice 1 only; character/invite/voice are deliberately excluded.
- [x] No placeholder implementation steps remain.
- [x] Shared contracts are sequentially owned by main Codex or one backend implementer, not parallel writers.
