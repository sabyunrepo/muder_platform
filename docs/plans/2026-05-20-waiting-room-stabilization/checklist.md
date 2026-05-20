# Waiting Room Stabilization

Issue: #706
Seed: `.git/mmp-workflow/seeds/issue-706.json`

## Goal

Make the pre-game waiting room usable before game start:

- LiveKit uses the real provider when root `.env` contains LiveKit values.
- Character selection only exposes playable characters.
- Playable character images render in the waiting room.

## Scope

- [ ] Explicitly pass `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to the server container in `docker-compose.yml`.
- [ ] Avoid whole-file `env_file: .env` injection.
- [ ] Verify waiting-room `/api/v1/voice/token` returns a non-empty `livekit_url` when LiveKit env exists.
- [ ] Filter public theme characters to playable characters only.
- [ ] Preserve editor-side NPC visibility.
- [ ] Resolve character `image_media_id` to public `image_url` for playable characters.
- [ ] Keep `CharacterSelectionPanel` as an `image_url` consumer with a safe fallback.
- [ ] Preserve ready/start/chat and both `room_id` and `session_id` voice token paths.

## Out Of Scope

- [ ] Whisper expansion.
- [ ] Voice moderation or push-to-talk.
- [ ] Durable voice preferences.
- [ ] NPC management UI redesign.
- [ ] Media upload/storage pipeline redesign.
- [ ] Friend invite UX implementation.

## Agent Plan

- [ ] Backend lane owns `docker-compose.yml`, voice env/provider verification, public character filtering, and media URL resolve.
- [ ] Frontend lane owns `CharacterSelectionPanel`, `RoomPage`, and lobby API type updates after the backend contract is fixed.
- [ ] Validation lane owns focused commands and browser evidence only.
- [ ] Reviewer lanes independently review backend, frontend, and coverage after the final implementation fix.

## Stop Conditions

- [ ] A lane needs to expose LiveKit secrets in logs, PR text, or frontend code.
- [ ] A lane proposes `env_file: .env` whole-file injection.
- [ ] Editor APIs stop showing NPC/non-playable characters.
- [ ] Existing gameplay `session_id` voice token path regresses.
- [ ] Multiple lanes need to edit the same shared contract file at once.
- [ ] Final validation or review has not rerun after the last fix.

## Coverage Plan

- [ ] Backend voice tests cover configured LiveKit token response and existing session token compatibility.
- [ ] Backend theme tests cover playable-only public character listing.
- [ ] Backend media/character tests cover `image_media_id` to `image_url` resolution and missing-media fallback.
- [ ] Frontend tests cover image rendering, fallback, and NPC absence in the character selection surface.
- [ ] Browser QA covers voice token network response, image render, NPC absence, ready/start/chat smoke.

## Validation Commands

- [ ] `cd apps/server && go test -count=1 ./internal/domain/theme ./internal/domain/voice ./internal/domain/room ./cmd/server`
- [ ] `pnpm --filter @mmp/web test -- src/features/room/components/__tests__/CharacterSelectionPanel.test.tsx src/pages/__tests__/RoomPage.test.tsx`
- [ ] `pnpm --filter @mmp/web typecheck`
- [ ] `scripts/mmp-local-ci.sh quick`

