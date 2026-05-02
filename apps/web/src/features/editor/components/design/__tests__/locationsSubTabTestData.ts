export const mockTheme = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test-theme',
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  coin_price: 0,
  status: 'DRAFT' as const,
  config_json: null,
  version: 1,
  created_at: '2026-04-13T00:00:00Z',
};

export const mockMaps = [
  {
    id: 'map-1',
    theme_id: 'theme-1',
    name: '저택 1층',
    image_url: null,
    sort_order: 1,
    created_at: '2026-04-13T00:00:00Z',
  },
  {
    id: 'map-2',
    theme_id: 'theme-1',
    name: '저택 2층',
    image_url: null,
    sort_order: 2,
    created_at: '2026-04-13T00:00:00Z',
  },
];

export const mockLocations = [
  {
    id: 'loc-1',
    theme_id: 'theme-1',
    map_id: 'map-1',
    name: '거실',
    restricted_characters: null,
    image_url: null,
    sort_order: 1,
    created_at: '2026-04-13T00:00:00Z',
  },
  {
    id: 'loc-2',
    theme_id: 'theme-1',
    map_id: 'map-1',
    name: '주방',
    restricted_characters: null,
    image_url: null,
    sort_order: 2,
    created_at: '2026-04-13T00:00:00Z',
  },
  {
    id: 'loc-3',
    theme_id: 'theme-1',
    map_id: 'map-2',
    name: '침실',
    restricted_characters: null,
    image_url: null,
    sort_order: 1,
    created_at: '2026-04-13T00:00:00Z',
  },
];

export const mockClues = [
  {
    id: 'clue-1',
    theme_id: 'theme-1',
    location_id: null,
    name: '단검',
    description: null,
    image_url: null,
    is_common: false,
    level: 1,
    sort_order: 0,
    created_at: '2026-04-13T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
  },
];

export const mockCharacters = [
  {
    id: 'char-1',
    theme_id: 'theme-1',
    name: '홍길동',
    description: null,
    image_url: null,
    is_culprit: false,
    mystery_role: 'detective' as const,
    sort_order: 1,
  },
  {
    id: 'char-2',
    theme_id: 'theme-1',
    name: '김철수',
    description: null,
    image_url: null,
    is_culprit: true,
    mystery_role: 'culprit' as const,
    sort_order: 2,
  },
];
