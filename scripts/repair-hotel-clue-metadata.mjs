#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const THEME_ID = 'c4a4b5ac-51c3-41c9-872e-d701d44ceee7';
const DEFAULT_CONTAINER = 'muder_platform-postgres-1';
const DB_USER = 'mmp';
const DB_NAME = 'mmf';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const sourcePath = process.argv.find((arg) => arg.startsWith('--source='))
  ?.slice('--source='.length) ?? 'apps/server/tmp/hotel-clue-repair/hotel-clue-inspector-data.json';
const container = process.argv.find((arg) => arg.startsWith('--container='))
  ?.slice('--container='.length) ?? DEFAULT_CONTAINER;

function runPsql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: sql, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`psql failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function safeIdPart(value) {
  const clean = String(value).trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'item';
}

function locationClueDeckId(locationId, clueId) {
  return `location-clue-${safeIdPart(locationId)}-${safeIdPart(clueId)}`;
}

function readSourceClues() {
  const rows = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(rows) || rows.length !== 69) {
    throw new Error(`expected 69 source clues, got ${Array.isArray(rows) ? rows.length : typeof rows}`);
  }
  return rows.map((row) => {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const apTag = tags.find((tag) => /^AP\+\d+$/.test(tag));
    return {
      sourceIndex: Number(row.index),
      sourceName: String(row.name ?? ''),
      sourceLocation: String(row.location ?? ''),
      isPublic: tags.includes('공개'),
      ap: apTag ? Number(apTag.slice(3)) : 0,
    };
  });
}

function readDbState() {
  const cluesSql = `
WITH cfg AS (
  SELECT config_json
  FROM themes
  WHERE id = ${sqlLiteral(THEME_ID)}::uuid
),
placement AS (
  SELECT
    elem->>'id' AS location_id,
    jsonb_array_elements_text(jsonb_path_query_array(elem, '$.locationClueConfig.clueIds[*]')) AS clue_id
  FROM cfg, jsonb_array_elements(cfg.config_json->'locations') elem
),
effective AS (
  SELECT
    c.id::text AS id,
    c.sort_order + 1 AS source_index,
    c.name AS current_name,
    c.is_common AS is_common,
    c.is_usable AS is_usable,
    COALESCE(c.use_effect, '') AS use_effect,
    COALESCE(c.use_target, '') AS use_target,
    c.use_consumed AS use_consumed,
    COALESCE(c.location_id::text, p.location_id) AS location_id,
    COALESCE(db_loc.name, cfg_loc.name) AS location_name
  FROM theme_clues c
  LEFT JOIN placement p ON p.clue_id = c.id::text
  LEFT JOIN theme_locations db_loc ON db_loc.id = c.location_id
  LEFT JOIN theme_locations cfg_loc ON cfg_loc.id::text = p.location_id
  WHERE c.theme_id = ${sqlLiteral(THEME_ID)}::uuid
)
SELECT COALESCE(jsonb_agg(to_jsonb(effective) ORDER BY source_index), '[]'::jsonb)::text
FROM effective;
`;
  const configSql = `
SELECT config_json::text
FROM themes
WHERE id = ${sqlLiteral(THEME_ID)}::uuid;
`;
  const clues = JSON.parse(runPsql(cluesSql));
  const configJson = JSON.parse(runPsql(configSql));
  if (clues.length !== 69) throw new Error(`expected 69 db clues, got ${clues.length}`);
  return { clues, configJson };
}

function buildNextConfig(configJson, plannedRows) {
  const next = structuredClone(configJson ?? {});
  next.modules = next.modules && typeof next.modules === 'object' && !Array.isArray(next.modules)
    ? next.modules
    : {};

  const clueInteraction = next.modules.clue_interaction && typeof next.modules.clue_interaction === 'object'
    ? next.modules.clue_interaction
    : {};
  clueInteraction.enabled = true;
  clueInteraction.config = clueInteraction.config && typeof clueInteraction.config === 'object'
    ? clueInteraction.config
    : {};
  clueInteraction.config.itemEffects = Object.fromEntries(
    plannedRows
      .filter((row) => row.ap > 0)
      .map((row) => [
        row.id,
        {
          effect: 'kill',
          target: 'player',
          consume: true,
          attackPower: row.ap,
          defensePower: row.ap,
        },
      ]),
  );
  next.modules.clue_interaction = clueInteraction;

  const deckInvestigation = next.modules.deck_investigation && typeof next.modules.deck_investigation === 'object'
    ? next.modules.deck_investigation
    : {};
  deckInvestigation.enabled = true;
  deckInvestigation.config = deckInvestigation.config && typeof deckInvestigation.config === 'object'
    ? deckInvestigation.config
    : {};
  const tokens = Array.isArray(deckInvestigation.config.tokens) && deckInvestigation.config.tokens.length > 0
    ? deckInvestigation.config.tokens
    : [{ id: 'investigation-token', name: '조사권', iconLabel: '권', defaultAmount: 0 }];
  const fallbackTokenId = tokens[0]?.id ?? 'investigation-token';
  deckInvestigation.config.tokens = tokens;
  deckInvestigation.config.decks = plannedRows.map((row, index) => ({
    id: locationClueDeckId(row.locationId, row.id),
    title: `${row.nextName} - ${row.sourceName || row.currentName} 조사`,
    description: '',
    tokenId: row.isPublic ? '' : fallbackTokenId,
    tokenCost: row.isPublic ? 0 : 1,
    drawOrder: 'sequential',
    emptyMessage: '더 이상 얻을 단서가 없습니다.',
    access: {
      phaseIds: [],
      locationIds: [row.locationId],
      blockedCharacterIds: [],
      requiredClueIds: [],
    },
    cards: [{ clueId: row.id, delivery: 'private_ownership' }],
    sortOrder: index,
  }));
  next.modules.deck_investigation = deckInvestigation;
  return next;
}

function buildPlan(sourceRows, dbState) {
  const sourceByIndex = new Map(sourceRows.map((row) => [row.sourceIndex, row]));
  const plannedRows = dbState.clues.map((clue) => {
    const source = sourceByIndex.get(Number(clue.source_index));
    if (!source) throw new Error(`missing source row for db sort index ${clue.source_index}`);
    if (!clue.location_id || !clue.location_name) {
      throw new Error(`missing placement for clue ${clue.source_index} ${clue.current_name}`);
    }
    return {
      id: clue.id,
      sourceIndex: Number(clue.source_index),
      sourceName: source.sourceName,
      currentName: clue.current_name,
      nextName: clue.location_name,
      sourceLocation: source.sourceLocation,
      locationId: clue.location_id,
      locationName: clue.location_name,
      isPublic: source.isPublic,
      ap: source.ap,
      currentIsCommon: Boolean(clue.is_common),
      currentIsUsable: Boolean(clue.is_usable),
      currentUseEffect: clue.use_effect,
    };
  });
  return {
    plannedRows,
    nextConfig: buildNextConfig(dbState.configJson, plannedRows),
  };
}

function printSummary(plannedRows) {
  const nameChanges = plannedRows.filter((row) => row.currentName !== row.nextName);
  const publicRows = plannedRows.filter((row) => row.isPublic);
  const weaponRows = plannedRows.filter((row) => row.ap > 0);
  const privateRows = plannedRows.filter((row) => !row.isPublic);
  const currentCommon = plannedRows.filter((row) => row.currentIsCommon).length;
  const currentUsable = plannedRows.filter((row) => row.currentIsUsable).length;

  console.log(`mode=${apply ? 'apply' : 'dry-run'}`);
  console.log(`source=${sourcePath}`);
  console.log(`theme=${THEME_ID}`);
  console.log(`total=${plannedRows.length}`);
  console.log(`name_changes=${nameChanges.length}`);
  console.log(`public_target=${publicRows.length}`);
  console.log(`private_or_weapon_target=${privateRows.length}`);
  console.log(`weapon_target=${weaponRows.length}`);
  console.log(`current_common=${currentCommon}`);
  console.log(`current_usable=${currentUsable}`);
  console.log('');
  console.log('weapon_rows:');
  for (const row of weaponRows) {
    console.log(`  #${row.sourceIndex} ${row.currentName} -> ${row.nextName} AP+${row.ap}`);
  }
  console.log('');
  console.log('public_rows:');
  console.log(publicRows.map((row) => `#${row.sourceIndex}:${row.nextName}`).join(', '));
}

function applyPlan(plannedRows, nextConfig) {
  const updates = plannedRows.map((row) => `
UPDATE theme_clues
SET
  location_id = ${sqlLiteral(row.locationId)}::uuid,
  name = ${sqlLiteral(row.nextName)},
  is_common = ${row.isPublic ? 'TRUE' : 'FALSE'},
  is_usable = ${row.ap > 0 ? 'TRUE' : 'FALSE'},
  use_effect = ${row.ap > 0 ? sqlLiteral('kill') : 'NULL'},
  use_target = ${row.ap > 0 ? sqlLiteral('player') : 'NULL'},
  use_consumed = ${row.ap > 0 ? 'TRUE' : 'FALSE'}
WHERE id = ${sqlLiteral(row.id)}::uuid;
`).join('\n');
  const sql = `
BEGIN;
${updates}
UPDATE themes
SET config_json = ${sqlJson(nextConfig)}, version = version + 1, updated_at = NOW()
WHERE id = ${sqlLiteral(THEME_ID)}::uuid;
COMMIT;
`;
  runPsql(sql);
}

const sourceRows = readSourceClues();
const dbState = readDbState();
const { plannedRows, nextConfig } = buildPlan(sourceRows, dbState);
printSummary(plannedRows);

if (apply) {
  applyPlan(plannedRows, nextConfig);
  console.log('');
  console.log('applied=true');
} else {
  console.log('');
  console.log('applied=false');
  console.log('rerun with --apply to write changes');
}
