import {
  createInvestigationDeckDraft,
  type DeckInvestigationConfigDraft,
  type InvestigationDeckDraft,
  type InvestigationTokenDraft,
} from './deckInvestigationAdapter';

export type InvestigationCostDraft =
  | { mode: 'free' }
  | { mode: 'token'; tokenId: string; tokenCost: number };

const DEFAULT_TOKEN_ID = 'investigation-token';
const LOCATION_CLUE_DECK_PREFIX = 'location-clue';

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

export function readLocationClueInvestigationCost(
  draft: DeckInvestigationConfigDraft,
  locationId: string,
  clueId: string,
): InvestigationCostDraft {
  const deck = draft.decks.find((item) => item.id === buildLocationClueDeckId(locationId, clueId));
  if (!deck || deck.tokenCost <= 0) return { mode: 'free' };
  return { mode: 'token', tokenId: deck.tokenId, tokenCost: deck.tokenCost };
}

export function writeLocationClueInvestigationCost(
  draft: DeckInvestigationConfigDraft,
  params: {
    locationId: string;
    locationName: string;
    clueId: string;
    clueName: string;
    requiredClueIds: string[];
    cost: InvestigationCostDraft;
  },
): DeckInvestigationConfigDraft {
  const deckId = buildLocationClueDeckId(params.locationId, params.clueId);
  if (params.cost.mode === 'free') {
    return { ...draft, decks: draft.decks.filter((deck) => deck.id !== deckId) };
  }

  const fallbackTokenId = draft.tokens[0]?.id ?? DEFAULT_TOKEN_ID;
  const tokenId = params.cost.tokenId || fallbackTokenId;
  const tokenCost = Math.max(1, Math.floor(params.cost.tokenCost));
  const existingDeck = draft.decks.find((deck) => deck.id === deckId);
  const nextDeck = {
    ...createInvestigationDeckDraft(draft.decks.length, tokenId),
    ...(existingDeck ?? {}),
    id: deckId,
    title: `${params.locationName} - ${params.clueName} 조사`,
    tokenId,
    tokenCost,
    drawOrder: 'sequential',
    access: {
      phaseIds: [],
      locationIds: [params.locationId],
      blockedCharacterIds: [],
      requiredClueIds: stringList(params.requiredClueIds).filter((id) => id !== params.clueId),
    },
    cards: [{ clueId: params.clueId, delivery: 'private_ownership' }],
  } satisfies InvestigationDeckDraft;

  return {
    ...draft,
    decks: existingDeck
      ? draft.decks.map((deck) => (deck.id === deckId ? nextDeck : deck))
      : [...draft.decks, nextDeck],
  };
}

export function removeLocationClueInvestigationCost(
  draft: DeckInvestigationConfigDraft,
  locationId: string,
  clueId: string,
): DeckInvestigationConfigDraft {
  const deckId = buildLocationClueDeckId(locationId, clueId);
  return { ...draft, decks: draft.decks.filter((deck) => deck.id !== deckId) };
}

export function syncLocationClueInvestigationRequirements(
  draft: DeckInvestigationConfigDraft,
  locationId: string,
  clueId: string,
  requiredClueIds: string[],
): DeckInvestigationConfigDraft {
  const deckId = buildLocationClueDeckId(locationId, clueId);
  return {
    ...draft,
    decks: draft.decks.map((deck) =>
      deck.id === deckId
        ? {
            ...deck,
            access: {
              ...deck.access,
              requiredClueIds: stringList(requiredClueIds).filter((id) => id !== clueId),
            },
          }
        : deck,
    ),
  };
}

export function formatInvestigationCostLabel(
  cost: InvestigationCostDraft,
  tokens: InvestigationTokenDraft[],
): string {
  if (cost.mode === 'free') return '무료 조사';
  const token = tokens.find((item) => item.id === cost.tokenId);
  const tokenName = token ? `${token.iconLabel} ${token.name}` : '조사권 미선택';
  return `${tokenName} ${Math.max(1, Math.floor(cost.tokenCost))}개 필요`;
}

function buildLocationClueDeckId(locationId: string, clueId: string): string {
  return `${LOCATION_CLUE_DECK_PREFIX}-${safeIdPart(locationId)}-${safeIdPart(clueId)}`;
}

function safeIdPart(value: string): string {
  const clean = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'item';
}
