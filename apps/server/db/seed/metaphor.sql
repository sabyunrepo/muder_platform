-- Metaphor 6P Seed Data
-- Run: psql $DATABASE_URL -f db/seed/metaphor.sql
--
-- Note: is_usable/use_effect/use_target/use_consumed columns require migration 00020_clue_items.sql
-- (feat/clue-item-system). Run that migration before executing this seed.

DO $$
DECLARE
  theme_id    UUID;
  map_id      UUID;
  loc_study   UUID;
  loc_living  UUID;
  loc_garden  UUID;
  loc_basement UUID;
  creator     UUID;
BEGIN
  -- 시드용 첫 번째 유저를 creator로 사용
  SELECT id INTO creator FROM users ORDER BY created_at LIMIT 1;
  IF creator IS NULL THEN
    RAISE EXCEPTION '유저가 없습니다. 먼저 유저를 생성하세요.';
  END IF;

  -- ── 테마 ─────────────────────────────────────────────────────────────────
  INSERT INTO themes (
    title, slug, description,
    min_players, max_players, duration_min,
    price, coin_price, status,
    creator_id
  ) VALUES (
    '메타포', 'metaphor', '13단계 머더미스터리 — 밀담, 아이템, 투표',
    6, 6, 120,
    0, 0, 'PUBLISHED',
    creator
  ) RETURNING id INTO theme_id;

  -- ── 캐릭터 ───────────────────────────────────────────────────────────────
  INSERT INTO theme_characters (theme_id, name, description, is_culprit, sort_order) VALUES
    (theme_id, '저스티스', '냉철한 판단력을 가진 전직 판사. 누구보다 법과 원칙을 중시한다.', FALSE, 0),
    (theme_id, '블레이즈',  '위험을 두려워하지 않는 용감한 소방관. 강한 정의감의 소유자.',    FALSE, 1),
    (theme_id, '미러',     '사람의 내면을 꿰뚫어 보는 심리상담사. 거짓말을 본능적으로 감지한다.', FALSE, 2),
    (theme_id, '섀도우',   '화려한 겉모습 뒤에 비밀을 숨긴 사업가. 이 사건의 범인.',          TRUE,  3),
    (theme_id, '벨벳',     '스캔들로 얼룩진 과거를 가진 인기 가수. 모두에게 사랑받고 싶어한다.', FALSE, 4),
    (theme_id, '아이언',   '전쟁의 상처를 안고 살아가는 전직 군인. 과묵하지만 믿을 수 있다.',   FALSE, 5);

  -- ── 맵 ───────────────────────────────────────────────────────────────────
  INSERT INTO theme_maps (theme_id, name, sort_order)
  VALUES (theme_id, '저택', 0)
  RETURNING id INTO map_id;

  -- ── 장소 ─────────────────────────────────────────────────────────────────
  INSERT INTO theme_locations (theme_id, map_id, name, sort_order)
  VALUES (theme_id, map_id, '서재', 0) RETURNING id INTO loc_study;

  INSERT INTO theme_locations (theme_id, map_id, name, sort_order)
  VALUES (theme_id, map_id, '거실', 1) RETURNING id INTO loc_living;

  INSERT INTO theme_locations (theme_id, map_id, name, sort_order)
  VALUES (theme_id, map_id, '정원', 2) RETURNING id INTO loc_garden;

  INSERT INTO theme_locations (theme_id, map_id, name, sort_order)
  VALUES (theme_id, map_id, '지하실', 3) RETURNING id INTO loc_basement;

  -- ── 단서 (일반) ───────────────────────────────────────────────────────────
  -- 서재
  INSERT INTO theme_clues (theme_id, location_id, name, description, level, clue_type, sort_order) VALUES
    (theme_id, loc_study, '찢긴 편지',
     '반쯤 찢긴 편지. 읽을 수 있는 부분에는 "…당신이 알면 모든 것이 끝난다…"라고 적혀 있다.',
     1, 'normal', 0),
    (theme_id, loc_study, '숨겨진 일기장',
     '책상 서랍 안쪽에 숨겨진 가죽 표지 일기장. 최근 3개월간의 비밀 거래가 기록되어 있다.',
     2, 'normal', 1);

  -- 거실
  INSERT INTO theme_clues (theme_id, location_id, name, description, level, clue_type, sort_order) VALUES
    (theme_id, loc_living, '깨진 유리잔',
     '카펫 위에 흩어진 크리스탈 유리잔 조각. 사건 직전 격렬한 다툼이 있었음을 암시한다.',
     1, 'normal', 0),
    (theme_id, loc_living, '혈흔 묻은 손수건',
     '소파 쿠션 아래 감춰진 고급 손수건. 한쪽 귀퉁이에 이니셜 "S"가 수놓여 있다.',
     2, 'normal', 1);

  -- 정원
  INSERT INTO theme_clues (theme_id, location_id, name, description, level, clue_type, sort_order) VALUES
    (theme_id, loc_garden, '발자국',
     '정원 흙 위에 찍힌 선명한 발자국. 방향은 지하실 입구를 향하고 있다.',
     1, 'normal', 0),
    (theme_id, loc_garden, '버려진 장갑',
     '장미 덤불 사이에서 발견된 가죽 장갑 한 짝. 내부에 흙과 함께 작은 열쇠가 들어 있다.',
     2, 'normal', 1);

  -- 지하실
  INSERT INTO theme_clues (theme_id, location_id, name, description, level, clue_type, sort_order) VALUES
    (theme_id, loc_basement, '잠긴 상자',
     '낡은 목재 상자. 자물쇠가 잠겨 있어 열 수 없지만, 흔들면 무언가 딸그락거린다.',
     1, 'normal', 0),
    (theme_id, loc_basement, '녹음기',
     '테이프가 반쯤 감긴 소형 녹음기. 재생하면 사건 당일 밤 나눈 대화가 들린다.',
     2, 'normal', 1);

  -- ── 아이템 단서 (is_usable=true) ─────────────────────────────────────────
  -- 주: 아래 컬럼은 migration 00020_clue_items.sql 필요
  INSERT INTO theme_clues (
    theme_id, location_id,
    name, description,
    level, clue_type,
    is_usable, use_effect, use_target, use_consumed,
    sort_order
  ) VALUES
    (theme_id, NULL,
     '투시경',
     '특수 렌즈가 달린 낡은 투시경. 사용하면 상대방의 단서 목록 중 하나를 몰래 확인할 수 있다.',
     1, 'item',
     TRUE, 'peek', 'player', TRUE,
     100),
    (theme_id, NULL,
     '진실의 거울',
     '손에 쥐면 차갑게 느껴지는 작은 거울. 사용하면 지목한 플레이어의 단서 한 장을 볼 수 있다.',
     1, 'item',
     TRUE, 'peek', 'player', TRUE,
     101);

  -- ── 콘텐츠 ───────────────────────────────────────────────────────────────
  INSERT INTO theme_contents (theme_id, key, body) VALUES
    (theme_id, 'story', E'# 메타포 — 사건의 배경\n\n고요한 교외 저택에서 열린 동창 모임.\n여섯 명의 오랜 친구들이 오랜만에 한자리에 모였지만,\n밤이 깊어갈수록 오래된 비밀과 거짓말이 수면 위로 떠오른다.\n\n새벽 두 시, 저택 서재에서 한 사람이 쓰러진 채 발견된다.\n범인은 지금 이 자리에 있다.\n\n당신은 진실을 밝힐 수 있는가?'),
    (theme_id, 'rules', E'# 게임 규칙\n\n1. **조사 단계**: 각 조사 라운드마다 최대 4장의 단서를 열람할 수 있습니다.\n2. **밀담**: 다른 플레이어와 1:1로 귓속말을 나눌 수 있습니다.\n3. **아이템**: 특수 아이템을 사용해 상대방의 단서를 몰래 확인하세요.\n4. **투표**: 2차 토의 후 범인을 지목하는 비밀 투표를 진행합니다.\n5. **히든 미션**: 각 캐릭터에게는 숨겨진 개인 미션이 있습니다. 성공 여부는 엔딩에서 공개됩니다.'),
    (theme_id, 'role:justice', E'# 저스티스 — 비밀\n\n당신은 이 사건과 연관된 과거 판결을 은폐하고 있습니다.\n섀도우가 그 판결 기록을 가지고 있다는 사실을 알고 있으며,\n그것이 세상에 드러나면 당신의 모든 것이 끝납니다.\n\n**히든 미션**: 게임이 끝날 때까지 자신의 과거 판결을 들키지 마세요.'),
    (theme_id, 'role:blaze', E'# 블레이즈 — 비밀\n\n당신은 사건 당일 밤 저택 근처에 있었지만, 그 이유를 말할 수 없습니다.\n누군가를 보호하기 위해 알리바이를 거짓으로 꾸며놓았습니다.\n\n**히든 미션**: 진짜 알리바이를 끝까지 숨기면서 범인을 찾아내세요.'),
    (theme_id, 'role:mirror', E'# 미러 — 비밀\n\n당신은 피해자의 마지막 상담 기록을 가지고 있습니다.\n그 내용은 직업 윤리상 공개할 수 없지만, 범인을 특정하는 결정적 단서가 담겨 있습니다.\n\n**히든 미션**: 상담 기록을 직접 공개하지 않고 다른 플레이어가 진실에 도달하도록 유도하세요.'),
    (theme_id, 'role:shadow', E'# 섀도우 — 비밀\n\n당신이 범인입니다. 피해자는 당신의 불법 거래를 알고 있었고, 그것을 폭로하려 했습니다.\n모든 증거를 이미 처리했다고 생각하지만, 하나가 남아 있습니다.\n\n**히든 미션**: 투표에서 과반수 이상의 의심을 다른 플레이어에게 돌리세요.'),
    (theme_id, 'role:velvet', E'# 벨벳 — 비밀\n\n당신은 피해자와 오래된 연인 관계였습니다. 결별 후에도 연락이 이어졌으며,\n사건 당일 밤 피해자에게서 마지막 메시지를 받았습니다.\n\n**히든 미션**: 두 사람의 관계를 끝까지 숨기되, 메시지 내용의 단서를 활용해 범인을 밝혀내세요.'),
    (theme_id, 'role:iron', E'# 아이언 — 비밀\n\n당신은 과거 섀도우의 의뢰로 일한 적이 있습니다. 그 일이 이번 사건과 연관됐을 수도 있습니다.\n진실을 알고 있지만, 자신도 연루될까 두려워 침묵하고 있습니다.\n\n**히든 미션**: 자신의 과거 연루 사실을 감추면서 결정적인 순간에 진실의 편에 서세요.');

END $$;
