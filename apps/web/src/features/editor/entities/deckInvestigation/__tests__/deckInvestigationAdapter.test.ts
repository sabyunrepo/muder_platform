import { describe, expect, it } from 'vitest';
import type { ClueResponse, LocationResponse } from '@/features/editor/api/types';
import {
  createDeckInvestigationDraft,
  createInvestigationDeckDraft,
  readDeckInvestigationConfig,
  toDeckInvestigationRuntimeDraft,
  toDeckInvestigationViewModel,
  writeDeckInvestigationConfig,
} from '../deckInvestigationAdapter';

const clue = (id: string, name = id): ClueResponse => ({
  id,
  theme_id: 'theme-1',
  location_id: null,
  name,
  description: null,
  image_url: null,
  is_common: false,
  level: 1,
  sort_order: 0,
  created_at: '2026-05-04T00:00:00Z',
  is_usable: false,
  use_effect: null,
  use_target: null,
  use_consumed: false,
});

const location = (id: string, name: string): LocationResponse => ({
  id,
  theme_id: 'theme-1',
  map_id: 'map-1',
  name,
  restricted_characters: null,
  image_url: null,
  sort_order: 0,
  created_at: '2026-05-04T00:00:00Z',
});

describe('deckInvestigationAdapter', () => {
  it('설정이 없으면 제작자가 바로 이해할 기본 토큰을 제공한다', () => {
    expect(createDeckInvestigationDraft()).toMatchObject({
      tokens: [{ id: 'investigation-token', name: '조사 토큰', defaultAmount: 0 }],
      decks: [],
    });
    expect(readDeckInvestigationConfig(null)).toMatchObject({
      tokens: [{ id: 'investigation-token', name: '조사 토큰' }],
      decks: [],
    });
  });

  it('modules.deck_investigation.config에서 token/deck draft를 읽는다', () => {
    const config = readDeckInvestigationConfig({
      modules: {
        deck_investigation: {
          enabled: true,
          config: {
            tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 2.8 }],
            decks: [{
              id: 'deck-1',
              title: '서재 조사',
              tokenId: 'coin',
              tokenCost: 1,
              drawOrder: 'random',
              access: { locationIds: ['loc-1'], blockedCharacterIds: ['char-2'] },
              cards: [
                { clueId: 'clue-1', delivery: 'public_reveal' },
                { clueId: 'clue-2', delivery: 'unknown' },
              ],
            }],
          },
        },
      },
    });

    expect(config.tokens[0]).toMatchObject({ id: 'coin', name: '동전', defaultAmount: 2 });
    expect(config.decks[0]).toMatchObject({
      id: 'deck-1',
      title: '서재 조사',
      tokenId: 'coin',
      drawOrder: 'random',
      access: expect.objectContaining({ locationIds: ['loc-1'], blockedCharacterIds: ['char-2'] }),
      cards: [
        { clueId: 'clue-1', delivery: 'public_reveal' },
        { clueId: 'clue-2', delivery: 'private_ownership' },
      ],
    });
  });



  it('legacy 배열 값과 ID 문자열은 공백과 중복을 정리해 저장 경계 밖으로 새지 않게 한다', () => {
    const config = readDeckInvestigationConfig({
      modules: {
        deck_investigation: {
          config: {
            tokens: [{ id: ' coin ', name: ' 동전 ', iconLabel: ' 🪙 ' }],
            decks: [{
              id: ' deck-1 ',
              title: ' 공백 정리 ',
              tokenId: ' coin ',
              emptyMessage: ' 비어 있음 ',
              access: { locationIds: [' loc-1 ', 'loc-1', '', 'loc-2'] },
              cards: [{ clueId: ' clue-1 ', delivery: 'view_only' }],
            }],
          },
        },
      },
    });

    expect(config.tokens[0]).toMatchObject({ id: 'coin', name: '동전', iconLabel: '🪙' });
    expect(config.decks[0]).toMatchObject({
      id: 'deck-1',
      title: '공백 정리',
      tokenId: 'coin',
      emptyMessage: '비어 있음',
    });
    expect(config.decks[0].access.locationIds).toEqual(['loc-1', 'loc-2']);
    expect(config.decks[0].cards[0]).toMatchObject({ clueId: 'clue-1', delivery: 'view_only' });
  });

  it('저장할 때 기존 config와 module의 다른 필드를 보존한다', () => {
    const next = writeDeckInvestigationConfig(
      {
        title: '보존',
        modules: {
          deck_investigation: { enabled: true, config: { keep: true, tokens: [] } },
          starting_clue: { enabled: true, config: { startingClues: { char: ['clue'] } } },
        },
      },
      {
        tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 3 }],
        decks: [createInvestigationDeckDraft(0, 'coin')],
      },
    );

    expect(next.title).toBe('보존');
    expect(next.modules).toMatchObject({
      deck_investigation: {
        enabled: true,
        config: {
          keep: true,
          tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 3 }],
          decks: [expect.objectContaining({ tokenId: 'coin' })],
        },
      },
      starting_clue: { enabled: true, config: { startingClues: { char: ['clue'] } } },
    });
  });

  it('ViewModel은 내부 key 대신 제작자용 요약과 경고를 만든다', () => {
    const draft = {
      tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 2 }],
      decks: [{
        ...createInvestigationDeckDraft(0, 'coin'),
        title: '응접실 조사',
        drawOrder: 'random' as const,
        access: { phaseIds: [], locationIds: ['loc-1', 'loc-2', 'loc-3'], blockedCharacterIds: [], requiredClueIds: [] },
        cards: [
          { clueId: 'clue-1', delivery: 'private_ownership' as const },
          { clueId: 'clue-2', delivery: 'public_reveal' as const },
          { clueId: 'missing', delivery: 'view_only' as const },
        ],
      }],
    };

    const vm = toDeckInvestigationViewModel(draft, {
      clues: [clue('clue-1'), clue('clue-2')],
      locations: [location('loc-1', '응접실'), location('loc-2', '서재')],
    });

    expect(vm.deckCountLabel).toBe('조사 덱 1개');
    expect(vm.tokenCountLabel).toBe('토큰 1종');
    expect(vm.decks[0]).toMatchObject({
      title: '응접실 조사',
      tokenLabel: '🪙 동전 1개 소비',
      placementLabel: '응접실, 서재 외 1곳',
      cardCountLabel: '단서 3개',
      drawOrderLabel: '무작위로 지급',
      deliverySummary: '개별 지급 1 · 전체 공개 1 · 보기만 1',
      warningLabels: ['없는 단서 1개가 연결되어 있습니다.'],
    });
  });



  it('위치 일부만 이름을 찾을 수 있어도 숨은 위치 수를 정확히 표시한다', () => {
    const vm = toDeckInvestigationViewModel({
      tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 2 }],
      decks: [{
        ...createInvestigationDeckDraft(0, 'coin'),
        access: { phaseIds: [], locationIds: ['loc-1', 'missing'], blockedCharacterIds: [], requiredClueIds: [] },
      }],
    }, {
      locations: [location('loc-1', '응접실')],
    });

    expect(vm.decks[0].placementLabel).toBe('응접실 외 1곳');
  });



  it('runtime draft는 원본 editor draft의 배열과 카드 객체를 공유하지 않는다', () => {
    const draft = {
      tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 2 }],
      decks: [{
        ...createInvestigationDeckDraft(0, 'coin'),
        access: { phaseIds: ['phase-1'], locationIds: ['loc-1'], blockedCharacterIds: ['char-2'], requiredClueIds: ['clue-key'] },
        cards: [{ clueId: 'clue-1', delivery: 'private_ownership' as const }],
      }],
    };

    const runtime = toDeckInvestigationRuntimeDraft(draft);
    runtime.decks[0].phaseIds.push('phase-mutated');
    runtime.decks[0].cards[0].clueId = 'clue-mutated';

    expect(draft.decks[0].access.phaseIds).toEqual(['phase-1']);
    expect(draft.decks[0].cards[0]).toEqual({ clueId: 'clue-1', delivery: 'private_ownership' });
  });

  it('runtime draft에는 UI label 대신 엔진 판단에 필요한 값만 남긴다', () => {
    const runtime = toDeckInvestigationRuntimeDraft({
      tokens: [{ id: 'coin', name: '동전', iconLabel: '🪙', defaultAmount: 2 }],
      decks: [{
        ...createInvestigationDeckDraft(0, 'coin'),
        access: { phaseIds: ['phase-1'], locationIds: ['loc-1'], blockedCharacterIds: ['char-2'], requiredClueIds: ['clue-key'] },
        cards: [{ clueId: 'clue-1', delivery: 'private_ownership' }],
      }],
    });

    expect(runtime).toEqual({
      tokens: [{ id: 'coin', defaultAmount: 2 }],
      decks: [{
        id: 'deck-1',
        tokenId: 'coin',
        tokenCost: 1,
        drawOrder: 'sequential',
        phaseIds: ['phase-1'],
        locationIds: ['loc-1'],
        blockedCharacterIds: ['char-2'],
        requiredClueIds: ['clue-key'],
        cards: [{ clueId: 'clue-1', delivery: 'private_ownership' }],
        emptyMessage: '더 이상 얻을 단서가 없습니다.',
      }],
    });
  });
});
