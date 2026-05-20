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
- [ ] Create PR, request Codex review, resolve findings, merge.

Open Decisions:
- Durable offline invite table: excluded from Slice 3.
- Private room access policy: unchanged; invite shares the existing room code/link and join gate remains server-owned.

Validation Notes:
- Focused backend: `cd apps/server && go test -count=1 ./internal/domain/room ./cmd/server`.
- Focused frontend: `pnpm --filter @mmp/web test -- src/features/social/hooks/useSocialSync.test.tsx src/pages/__tests__/RoomPage.test.tsx src/features/lobby/api.test.tsx`.
- Frontend type/lint: `pnpm --filter @mmp/web typecheck`, `pnpm --filter @mmp/web lint` (existing warnings only).
- Browser QA: `127.0.0.1:3000` host room invite, `POST /api/v1/rooms/7b6bb5d7-f98b-4c5c-8d3b-b3062cb69103/invites => 200`, UI displayed `초대 1명 전송, 0명 건너뜀`; temp DB rows cleaned.
- `scripts/mmp-local-ci.sh quick` reached full `go test -race ./...` but failed in existing `internal/domain/flow` testcontainer setup with Docker socket `context deadline exceeded`; changed room package passed.
