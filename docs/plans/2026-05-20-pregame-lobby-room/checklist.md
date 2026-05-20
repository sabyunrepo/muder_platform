# Issue #691 Pregame Lobby/Room Workflow

## Slice 3: Room Invites

Scope:
- Existing room code/link sharing remains the canonical invite entry.
- Hosts can invite accepted friends from the waiting room.
- Online invitees receive a social WebSocket `room:invite` event with the room code and room route.
- Offline durable notification storage is excluded from this slice; add a follow-up only if product requires invite history.

Coverage Plan:
- Backend handler: auth required, invalid room ID, request decode, service delegation.
- Backend service: inviter must be participant, room must be `WAITING`, target must be accepted friend, blocked/already-in-room/notification-disabled targets are skipped, notifier result is reflected.
- Frontend API/UI: room link copy, friend picker states, successful/partial invite status.
- Social sync: `room:invite` shows a toast with join action and does not break existing friend/chat events.
- Browser QA: host invites a friend or simulated social event opens `/room/:id` or code join path.

Checklist:
- [x] Diagnose stalled workflow and avoid stale sub-agent close path.
- [x] Merge Slice 2 character selection/start gate PR.
- [x] Start Slice 3 branch from latest `main`.
- [x] Run read-only parallel coordinator for invite architecture.
- [x] Implement backend invite API and validation.
- [x] Wire room invite notifier to social WebSocket hub.
- [x] Implement frontend room link copy and friend invite picker.
- [x] Handle incoming `room:invite` event in social sync.
- [x] Add focused tests.
- [x] Run focused validation and browser QA.
- [x] Create PR, request Codex review, resolve findings, merge.

Open Decisions:
- Durable offline invite table: excluded from Slice 3.
- Private room access policy: unchanged; invite shares the existing room code/link and join gate remains server-owned.

Validation Notes:
- Focused backend: `cd apps/server && go test -count=1 ./internal/domain/room ./cmd/server`.
- Focused frontend: `pnpm --filter @mmp/web test -- src/features/social/hooks/useSocialSync.test.tsx src/pages/__tests__/RoomPage.test.tsx src/features/lobby/api.test.tsx`.
- Frontend type/lint: `pnpm --filter @mmp/web typecheck`, `pnpm --filter @mmp/web lint` (existing warnings only).
- Browser QA: `127.0.0.1:3000` host room invite, `POST /api/v1/rooms/7b6bb5d7-f98b-4c5c-8d3b-b3062cb69103/invites => 200`, UI displayed `초대 1명 전송, 0명 건너뜀`; temp DB rows cleaned.
- `scripts/mmp-local-ci.sh quick` reached full `go test -race ./...` but failed in existing `internal/domain/flow` testcontainer setup with Docker socket `context deadline exceeded`; changed room package passed.

## Slice 4: Waiting Room Voice

Scope:
- Keep the existing in-game voice session flow compatible with `session_id`.
- Add a waiting-room voice token path based on `room_id` and server-owned room participant checks.
- Surface a usable waiting-room voice panel before game start, including join/leave, mic mute, speaker mute, connection state, and cleanup on leave/start navigation.
- Exclude durable voice preferences, channel moderation, and push-to-talk from this slice.

Coverage Plan:
- Backend voice service: exactly one target (`session_id` or `room_id`), room UUID validation, waiting-room status gate, room participant authorization, unsupported whisper rejection, session compatibility path, provider failure handling.
- Frontend voice API/hook: target-based token request while preserving existing `getToken(sessionId, ...)` compatibility, LiveKit mic toggle side effect, room cleanup.
- Room page UI: waiting-room voice panel renders with the current room ID and invokes manual connect through `useVoiceConnection`.
- Focused validation: `go test` for voice service, RoomPage component test, frontend typecheck/lint, and browser smoke where local services allow it.

Checklist:
- [x] Start Slice 4 branch from latest `main`.
- [x] Run read-only coordinator for waiting-room voice architecture.
- [x] Add backend `room_id` token contract and authorization tests.
- [x] Add target-based frontend voice API/hook path.
- [x] Add waiting-room voice panel to `RoomPage`.
- [x] Run focused validation.
- [x] Run independent review agents and resolve findings.
- [ ] Create PR, request Codex review, resolve findings, merge.

Open Decisions:
- Waiting-room voice only supports the main room channel in this slice; whisper remains session-only.
- LiveKit room naming uses `room-{roomID}-main` for pregame voice and keeps existing `session-{sessionID}-...` names for gameplay.
- Issued LiveKit tokens are checked at request time; immediate token revocation on later room status changes is outside this slice.

Validation Notes:
- Focused backend: `cd apps/server && go test -count=1 ./internal/domain/voice ./internal/domain/room ./cmd/server`.
- Focused frontend: `pnpm --filter @mmp/web test -- src/hooks/__tests__/useVoiceConnection.test.ts src/pages/__tests__/RoomPage.test.tsx`.
- Frontend type/lint: `pnpm --filter @mmp/web typecheck`, `pnpm --filter @mmp/web lint` (existing 39 warnings only).
- Browser QA: `127.0.0.1:3000/room/a3cb2e27-6894-4b7d-9fbd-8206bda5ce26` rendered the voice panel; clicking `입장` sent `POST /api/v1/voice/token => 200` with `room_name=room-a3cb2e27-6894-4b7d-9fbd-8206bda5ce26-main`; mock voice provider left `livekit_url` empty, so UI correctly showed `연결 실패`. Temp room/user rows cleaned.
- Independent review: backend and security reviewers found no blocker; frontend reviewer found a stale manual-connect race, fixed with a connection generation guard and covered by `useVoiceConnection` test.
