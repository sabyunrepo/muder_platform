# Waiting Room Stabilization

Issue: #706
Seed: `.git/mmp-workflow/seeds/issue-706.json`

## Goal

Make the pre-game waiting room usable before game start:

- LiveKit uses the real provider when root `.env` contains LiveKit values.
- Character selection only exposes playable characters.
- Playable character images render in the waiting room.

## Scope

- [x] Explicitly pass `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to the server container in `docker-compose.yml`.
- [x] Avoid whole-file `env_file: .env` injection.
- [x] Verify waiting-room `/api/v1/voice/token` returns a non-empty `livekit_url` when LiveKit env exists.
- [x] Filter public theme characters to playable characters only.
- [x] Preserve editor-side NPC visibility.
- [x] Resolve character `image_media_id` to public `image_url` for playable characters when the storage object exists.
- [x] Fall back safely when `image_media_id` points to missing storage objects.
- [x] Keep `CharacterSelectionPanel` as an `image_url` consumer with a safe fallback.
- [x] Preserve ready/start/chat and both `room_id` and `session_id` voice token paths.

## Out Of Scope

- [x] Confirmed excluded: Whisper expansion.
- [x] Confirmed excluded: Voice moderation or push-to-talk.
- [x] Confirmed excluded: Durable voice preferences.
- [x] Confirmed excluded: NPC management UI redesign.
- [x] Confirmed excluded: Media upload/storage pipeline redesign.
- [x] Confirmed excluded: Friend invite UX implementation.

## Agent Plan

- [x] Backend lane owns `docker-compose.yml`, voice env/provider verification, public character filtering, and media URL resolve.
- [x] Frontend lane owns `CharacterSelectionPanel`, `RoomPage`, and lobby API type updates after the backend contract is fixed.
- [x] Validation lane owns focused commands and browser evidence only.
- [x] Reviewer lanes independently review backend, frontend, and coverage after the final implementation fix.

## Stop Conditions

- [x] No lane exposed LiveKit secrets in logs, PR text, or frontend code.
- [x] No lane proposed `env_file: .env` whole-file injection.
- [x] Editor APIs keep showing NPC/non-playable characters.
- [x] Existing gameplay `session_id` voice token path did not regress in focused tests.
- [x] No multiple lanes edited the same shared contract file at once.
- [x] Final validation and review reran after the last fix.

## Coverage Plan

- [x] Backend voice tests cover configured LiveKit token response and existing session token compatibility.
- [x] Backend theme tests cover playable-only public character listing.
- [x] Backend media/character tests cover `image_media_id` to `image_url` resolution and missing-media fallback.
- [x] Frontend tests cover image rendering, fallback, and NPC absence in the character selection surface.
- [x] Browser QA covers voice token network response, character image/fallback behavior, NPC absence, and chat/voice smoke.

## Validation Commands

- [x] `cd apps/server && go test -count=1 ./internal/domain/theme ./internal/domain/voice ./internal/domain/room ./cmd/server`
- [x] `pnpm --filter @mmp/web test -- src/features/room/components/__tests__/CharacterSelectionPanel.test.tsx src/pages/__tests__/RoomPage.test.tsx`
- [x] `pnpm --filter @mmp/web typecheck`
- [x] `scripts/mmp-local-ci.sh quick`
