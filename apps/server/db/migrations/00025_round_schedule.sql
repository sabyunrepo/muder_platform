-- +goose Up
-- Phase 20 PR-2: 단서·장소 라운드 스케줄 컬럼.
-- 라운드 번호는 1 이상의 정수 (NULL 허용 = 범위 무제한).
-- reveal_round/hide_round, from_round/until_round 모두 NULL 가능.

ALTER TABLE theme_clues
  ADD COLUMN reveal_round INT,
  ADD COLUMN hide_round   INT,
  ADD CONSTRAINT theme_clues_reveal_round_positive
    CHECK (reveal_round IS NULL OR reveal_round >= 1),
  ADD CONSTRAINT theme_clues_hide_round_positive
    CHECK (hide_round IS NULL OR hide_round >= 1),
  ADD CONSTRAINT theme_clues_round_order
    CHECK (reveal_round IS NULL OR hide_round IS NULL OR reveal_round <= hide_round);

ALTER TABLE theme_locations
  ADD COLUMN from_round  INT,
  ADD COLUMN until_round INT,
  ADD CONSTRAINT theme_locations_from_round_positive
    CHECK (from_round IS NULL OR from_round >= 1),
  ADD CONSTRAINT theme_locations_until_round_positive
    CHECK (until_round IS NULL OR until_round >= 1),
  ADD CONSTRAINT theme_locations_round_order
    CHECK (from_round IS NULL OR until_round IS NULL OR from_round <= until_round);

-- +goose Down
ALTER TABLE theme_locations
  DROP CONSTRAINT IF EXISTS theme_locations_round_order,
  DROP CONSTRAINT IF EXISTS theme_locations_until_round_positive,
  DROP CONSTRAINT IF EXISTS theme_locations_from_round_positive,
  DROP COLUMN IF EXISTS until_round,
  DROP COLUMN IF EXISTS from_round;

ALTER TABLE theme_clues
  DROP CONSTRAINT IF EXISTS theme_clues_round_order,
  DROP CONSTRAINT IF EXISTS theme_clues_hide_round_positive,
  DROP CONSTRAINT IF EXISTS theme_clues_reveal_round_positive,
  DROP COLUMN IF EXISTS hide_round,
  DROP COLUMN IF EXISTS reveal_round;
