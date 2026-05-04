import type { ClueResponse, LocationResponse } from '@/features/editor/api/types';
import {
  readModuleConfig,
  writeModuleConfig,
  type EditorConfig,
} from '@/features/editor/utils/configShape';

export const DECK_INVESTIGATION_MODULE_ID = 'deck_investigation';

export type DeckDrawOrder = 'sequential' | 'random';
export type DeckCardDelivery = 'private_ownership' | 'public_reveal' | 'view_only';

export interface InvestigationTokenDraft {
  id: string;
  name: string;
  iconLabel: string;
  defaultAmount: number;
}

export interface InvestigationDeckCardDraft {
  clueId: string;
  delivery: DeckCardDelivery;
}

export interface InvestigationDeckAccessDraft {
  phaseIds: string[];
  locationIds: string[];
  blockedCharacterIds: string[];
  requiredClueIds: string[];
}

export interface InvestigationDeckDraft {
  id: string;
  title: string;
  description: string;
  tokenId: string;
  tokenCost: number;
  drawOrder: DeckDrawOrder;
  emptyMessage: string;
  access: InvestigationDeckAccessDraft;
  cards: InvestigationDeckCardDraft[];
}

export interface DeckInvestigationConfigDraft {
  tokens: InvestigationTokenDraft[];
  decks: InvestigationDeckDraft[];
}

export interface DeckInvestigationViewModel {
  deckCountLabel: string;
  tokenCountLabel: string;
  warnings: string[];
  decks: InvestigationDeckViewModel[];
}

export interface InvestigationDeckViewModel {
  id: string;
  title: string;
  tokenLabel: string;
  placementLabel: string;
  cardCountLabel: string;
  drawOrderLabel: string;
  deliverySummary: string;
  warningLabels: string[];
}

export interface DeckInvestigationRuntimeDraft {
  tokens: Array<{ id: string; defaultAmount: number }>;
  decks: Array<{
    id: string;
    tokenId: string;
    tokenCost: number;
    drawOrder: DeckDrawOrder;
    phaseIds: string[];
    locationIds: string[];
    blockedCharacterIds: string[];
    requiredClueIds: string[];
    cards: InvestigationDeckCardDraft[];
    emptyMessage: string;
  }>;
}

const DEFAULT_TOKEN: InvestigationTokenDraft = {
  id: 'investigation-token',
  name: '조사 토큰',
  iconLabel: '🔎',
  defaultAmount: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function readDelivery(value: unknown): DeckCardDelivery {
  if (value === 'public_reveal' || value === 'view_only') return value;
  return 'private_ownership';
}

function readDrawOrder(value: unknown): DeckDrawOrder {
  return value === 'random' ? 'random' : 'sequential';
}

function normalizeToken(value: unknown, index: number): InvestigationTokenDraft | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === 'string' ? value.id.trim() : '';
  const rawName = typeof value.name === 'string' ? value.name.trim() : '';
  const rawIconLabel = typeof value.iconLabel === 'string' ? value.iconLabel.trim() : '';
  const defaultAmount = typeof value.defaultAmount === 'number' && Number.isFinite(value.defaultAmount)
    ? Math.max(0, Math.floor(value.defaultAmount))
    : 0;
  return {
    id: rawId || `token-${index + 1}`,
    name: rawName || '조사 토큰',
    iconLabel: rawIconLabel || '🔎',
    defaultAmount,
  };
}

function normalizeCard(value: unknown): InvestigationDeckCardDraft | null {
  if (!isRecord(value) || typeof value.clueId !== 'string') return null;
  const clueId = value.clueId.trim();
  if (!clueId) return null;
  return { clueId, delivery: readDelivery(value.delivery) };
}

function normalizeAccess(value: unknown): InvestigationDeckAccessDraft {
  const record = isRecord(value) ? value : {};
  return {
    phaseIds: stringList(record.phaseIds),
    locationIds: stringList(record.locationIds),
    blockedCharacterIds: stringList(record.blockedCharacterIds),
    requiredClueIds: stringList(record.requiredClueIds),
  };
}

function normalizeDeck(value: unknown, index: number, fallbackTokenId: string): InvestigationDeckDraft | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === 'string' ? value.id.trim() : '';
  const rawTitle = typeof value.title === 'string' ? value.title.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const rawTokenId = typeof value.tokenId === 'string' ? value.tokenId.trim() : '';
  const id = rawId || `deck-${index + 1}`;
  const title = rawTitle || '새 조사 덱';
  const tokenId = rawTokenId || fallbackTokenId;
  const tokenCost = typeof value.tokenCost === 'number' && Number.isFinite(value.tokenCost)
    ? Math.max(0, Math.floor(value.tokenCost))
    : 1;
  const rawEmptyMessage = typeof value.emptyMessage === 'string' ? value.emptyMessage.trim() : '';
  const emptyMessage = rawEmptyMessage || '더 이상 얻을 단서가 없습니다.';
  const cards = Array.isArray(value.cards)
    ? value.cards.map(normalizeCard).filter((card): card is InvestigationDeckCardDraft => !!card)
    : [];
  return {
    id,
    title,
    description,
    tokenId,
    tokenCost,
    drawOrder: readDrawOrder(value.drawOrder),
    emptyMessage,
    access: normalizeAccess(value.access),
    cards,
  };
}

export function createDeckInvestigationDraft(): DeckInvestigationConfigDraft {
  return {
    tokens: [{ ...DEFAULT_TOKEN }],
    decks: [],
  };
}

export function createInvestigationDeckDraft(index = 0, tokenId = DEFAULT_TOKEN.id): InvestigationDeckDraft {
  return {
    id: `deck-${index + 1}`,
    title: '새 조사 덱',
    description: '',
    tokenId,
    tokenCost: 1,
    drawOrder: 'sequential',
    emptyMessage: '더 이상 얻을 단서가 없습니다.',
    access: { phaseIds: [], locationIds: [], blockedCharacterIds: [], requiredClueIds: [] },
    cards: [],
  };
}

export function readDeckInvestigationConfig(
  configJson: EditorConfig | null | undefined,
): DeckInvestigationConfigDraft {
  const moduleConfig = readModuleConfig(configJson, DECK_INVESTIGATION_MODULE_ID);
  const tokens = Array.isArray(moduleConfig.tokens)
    ? moduleConfig.tokens.map(normalizeToken).filter((token): token is InvestigationTokenDraft => !!token)
    : [];
  const effectiveTokens = tokens.length > 0 ? tokens : [{ ...DEFAULT_TOKEN }];
  const fallbackTokenId = effectiveTokens[0]?.id ?? DEFAULT_TOKEN.id;
  const decks = Array.isArray(moduleConfig.decks)
    ? moduleConfig.decks.map((deck, index) => normalizeDeck(deck, index, fallbackTokenId)).filter((deck): deck is InvestigationDeckDraft => !!deck)
    : [];
  return { tokens: effectiveTokens, decks };
}

export function writeDeckInvestigationConfig(
  configJson: EditorConfig | null | undefined,
  draft: DeckInvestigationConfigDraft,
): EditorConfig {
  const current = readModuleConfig(configJson, DECK_INVESTIGATION_MODULE_ID);
  return writeModuleConfig(configJson, DECK_INVESTIGATION_MODULE_ID, {
    ...current,
    tokens: draft.tokens,
    decks: draft.decks,
  });
}

export function toDeckInvestigationRuntimeDraft(
  draft: DeckInvestigationConfigDraft,
): DeckInvestigationRuntimeDraft {
  return {
    tokens: draft.tokens.map((token) => ({ id: token.id, defaultAmount: token.defaultAmount })),
    decks: draft.decks.map((deck) => ({
      id: deck.id,
      tokenId: deck.tokenId,
      tokenCost: deck.tokenCost,
      drawOrder: deck.drawOrder,
      phaseIds: [...deck.access.phaseIds],
      locationIds: [...deck.access.locationIds],
      blockedCharacterIds: [...deck.access.blockedCharacterIds],
      requiredClueIds: [...deck.access.requiredClueIds],
      cards: deck.cards.map((card) => ({ ...card })),
      emptyMessage: deck.emptyMessage,
    })),
  };
}

export function toDeckInvestigationViewModel(
  draft: DeckInvestigationConfigDraft,
  options: { clues?: ClueResponse[]; locations?: LocationResponse[] } = {},
): DeckInvestigationViewModel {
  const tokenById = new Map(draft.tokens.map((token) => [token.id, token]));
  const clueIds = new Set((options.clues ?? []).map((clue) => clue.id));
  const locationById = new Map((options.locations ?? []).map((location) => [location.id, location]));
  const warnings: string[] = [];
  const decks = draft.decks.map((deck) => {
    const deckWarnings = buildDeckWarnings(deck, tokenById, clueIds);
    warnings.push(...deckWarnings.map((warning) => `${deck.title}: ${warning}`));
    return {
      id: deck.id,
      title: deck.title,
      tokenLabel: formatTokenLabel(deck, tokenById.get(deck.tokenId)),
      placementLabel: formatPlacementLabel(deck.access.locationIds, locationById),
      cardCountLabel: `단서 ${deck.cards.length}개`,
      drawOrderLabel: deck.drawOrder === 'random' ? '무작위로 지급' : '위에서부터 지급',
      deliverySummary: formatDeliverySummary(deck.cards),
      warningLabels: deckWarnings,
    };
  });
  return {
    deckCountLabel: `조사 덱 ${draft.decks.length}개`,
    tokenCountLabel: `토큰 ${draft.tokens.length}종`,
    warnings,
    decks,
  };
}

function buildDeckWarnings(
  deck: InvestigationDeckDraft,
  tokenById: Map<string, InvestigationTokenDraft>,
  clueIds: Set<string>,
): string[] {
  const warnings: string[] = [];
  if (!tokenById.has(deck.tokenId)) warnings.push('소비 토큰을 선택해야 합니다.');
  if (deck.cards.length === 0) warnings.push('덱에 지급할 단서를 추가해야 합니다.');
  const missingClueCount = deck.cards.filter((card) => !clueIds.has(card.clueId)).length;
  if (clueIds.size > 0 && missingClueCount > 0) warnings.push(`없는 단서 ${missingClueCount}개가 연결되어 있습니다.`);
  if (deck.tokenCost < 0) warnings.push('소비 토큰 수는 0 이상이어야 합니다.');
  return warnings;
}

function formatTokenLabel(deck: InvestigationDeckDraft, token?: InvestigationTokenDraft): string {
  const tokenName = token ? `${token.iconLabel} ${token.name}` : '토큰 미선택';
  return `${tokenName} ${deck.tokenCost}개 소비`;
}

function formatPlacementLabel(
  locationIds: string[],
  locationById: Map<string, LocationResponse>,
): string {
  if (locationIds.length === 0) return '모든 배치 위치에서 실행 가능';
  const names = locationIds.map((id) => locationById.get(id)?.name).filter((name): name is string => !!name);
  const shownCount = names.length;
  if (shownCount === 0) return `${locationIds.length}개 위치에 배치`;
  if (shownCount <= 2 && shownCount === locationIds.length) return names.join(', ');
  const displayedCount = Math.min(2, shownCount);
  return `${names.slice(0, displayedCount).join(', ')} 외 ${locationIds.length - displayedCount}곳`;
}

function formatDeliverySummary(cards: InvestigationDeckCardDraft[]): string {
  if (cards.length === 0) return '지급 단서 없음';
  const counts = cards.reduce<Record<DeckCardDelivery, number>>(
    (acc, card) => ({ ...acc, [card.delivery]: acc[card.delivery] + 1 }),
    { private_ownership: 0, public_reveal: 0, view_only: 0 },
  );
  return [
    counts.private_ownership > 0 ? `개별 지급 ${counts.private_ownership}` : null,
    counts.public_reveal > 0 ? `전체 공개 ${counts.public_reveal}` : null,
    counts.view_only > 0 ? `보기만 ${counts.view_only}` : null,
  ].filter(Boolean).join(' · ');
}
