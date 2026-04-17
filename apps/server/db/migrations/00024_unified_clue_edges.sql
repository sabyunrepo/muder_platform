-- +goose Up
-- Phase 20 PR-4: clue_relations → clue_edge_groups + clue_edge_members 통합 스키마.
--
-- 기존 clue_relations (source-target-mode pair)는 CRAFT(조합) 동작을 표현할 수
-- 없어 AUTO/CRAFT 트리거를 지원하는 group 기반 스키마로 재설계한다.
-- 개발 단계이며 실데이터가 없어 이관 없이 drop 후 재생성한다 (design.md 결정 3).
--
-- 한 group = "target을 해금시키는 한 묶음의 source 조합".
-- * trigger='AUTO': mode=AND 또는 OR (기존 clue_relations 호환 의미)
-- * trigger='CRAFT': mode=AND만 허용 (CRAFT+OR는 의미 중복, CHECK로 차단)

DROP TABLE IF EXISTS clue_relations;

CREATE TABLE clue_edge_groups (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id   UUID        NOT NULL REFERENCES themes(id)      ON DELETE CASCADE,
    target_id  UUID        NOT NULL REFERENCES theme_clues(id) ON DELETE CASCADE,
    trigger    VARCHAR(10) NOT NULL DEFAULT 'AUTO',
    mode       VARCHAR(10) NOT NULL DEFAULT 'AND',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT clue_edge_groups_trigger_valid
        CHECK (trigger IN ('AUTO', 'CRAFT')),
    CONSTRAINT clue_edge_groups_mode_valid
        CHECK (mode IN ('AND', 'OR')),
    CONSTRAINT clue_edge_groups_craft_requires_and
        CHECK (trigger <> 'CRAFT' OR mode = 'AND')
);
CREATE INDEX idx_clue_edge_groups_theme  ON clue_edge_groups(theme_id);
CREATE INDEX idx_clue_edge_groups_target ON clue_edge_groups(target_id);

CREATE TABLE clue_edge_members (
    group_id   UUID NOT NULL REFERENCES clue_edge_groups(id) ON DELETE CASCADE,
    source_id  UUID NOT NULL REFERENCES theme_clues(id)      ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, source_id)
);
CREATE INDEX idx_clue_edge_members_source ON clue_edge_members(source_id);

-- +goose Down
DROP TABLE IF EXISTS clue_edge_members;
DROP TABLE IF EXISTS clue_edge_groups;

-- 기존 clue_relations를 재생성 (00022와 동일 구조)
CREATE TABLE clue_relations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    source_id   UUID NOT NULL REFERENCES theme_clues(id) ON DELETE CASCADE,
    target_id   UUID NOT NULL REFERENCES theme_clues(id) ON DELETE CASCADE,
    mode        VARCHAR(10) NOT NULL DEFAULT 'AND' CHECK (mode IN ('AND', 'OR')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(theme_id, source_id, target_id)
);
CREATE INDEX idx_clue_relations_theme ON clue_relations(theme_id);
