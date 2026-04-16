-- E2E test seed: minimal published theme for apps/web/e2e/*.spec.ts scenarios.
-- Idempotent (safe to re-run). Expects e2e@test.com to exist (Seed E2E user step).
--
-- Run: psql $DATABASE_URL -f apps/server/db/seed/e2e-themes.sql

DO $$
DECLARE
  e2e_user   UUID;
  theme_uuid UUID;
BEGIN
  SELECT id INTO e2e_user FROM users WHERE email = 'e2e@test.com' LIMIT 1;
  IF e2e_user IS NULL THEN
    RAISE EXCEPTION 'e2e@test.com not found — Seed E2E user step must run first';
  END IF;

  -- Theme — idempotent via slug UNIQUE
  INSERT INTO themes (
    creator_id, title, slug, description,
    min_players, max_players, duration_min,
    price, status, published_at
  ) VALUES (
    e2e_user, 'E2E Test Theme', 'e2e-test-theme',
    'Minimal fixture for Playwright E2E — do not edit',
    4, 8, 60, 0, 'PUBLISHED', NOW()
  ) ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO theme_uuid FROM themes WHERE slug = 'e2e-test-theme';

  -- 4 characters (matches min_players=4). Skip if already seeded.
  IF NOT EXISTS (SELECT 1 FROM theme_characters WHERE theme_id = theme_uuid) THEN
    INSERT INTO theme_characters (theme_id, name, description, is_culprit, sort_order) VALUES
      (theme_uuid, 'Player One',   'E2E fixture character 1', FALSE, 0),
      (theme_uuid, 'Player Two',   'E2E fixture character 2', FALSE, 1),
      (theme_uuid, 'Player Three', 'E2E fixture character 3', FALSE, 2),
      (theme_uuid, 'Culprit',      'E2E fixture culprit',     TRUE,  3);
  END IF;
END $$;
