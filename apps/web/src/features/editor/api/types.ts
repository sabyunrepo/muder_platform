// ---------------------------------------------------------------------------
// Editor API — shared types
// ---------------------------------------------------------------------------

export type ThemeStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'UNPUBLISHED'
  | 'SUSPENDED';

export interface EditorThemeSummary {
  id: string;
  title: string;
  status: ThemeStatus;
  min_players: number;
  max_players: number;
  coin_price: number;
  version: number;
  created_at: string;
}

export interface EditorThemeResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  min_players: number;
  max_players: number;
  duration_min: number;
  price: number;
  coin_price: number;
  status: ThemeStatus;
  config_json: Record<string, unknown> | null;
  version: number;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface EditorCharacterResponse {
  id: string;
  theme_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_culprit: boolean;
  mystery_role: MysteryRole;
  sort_order: number;
  is_playable: boolean;
  show_in_intro: boolean;
  can_speak_in_reading: boolean;
  is_voting_candidate: boolean;
}

export type MysteryRole = 'suspect' | 'culprit' | 'accomplice' | 'detective';

export interface CreateThemeRequest {
  title: string;
  description?: string;
  cover_image?: string;
  min_players: number;
  max_players: number;
  duration_min: number;
  price?: number;
  coin_price?: number;
}

export interface UpdateThemeRequest {
  title: string;
  description?: string;
  cover_image?: string;
  min_players: number;
  max_players: number;
  duration_min: number;
  price: number;
  coin_price: number;
}

export interface CreateCharacterRequest {
  name: string;
  description?: string;
  image_url?: string;
  is_culprit?: boolean;
  mystery_role?: MysteryRole;
  sort_order?: number;
  is_playable?: boolean;
  show_in_intro?: boolean;
  can_speak_in_reading?: boolean;
  is_voting_candidate?: boolean;
}

export interface UpdateCharacterRequest {
  name?: string;
  description?: string;
  image_url?: string;
  is_culprit?: boolean;
  mystery_role?: MysteryRole;
  sort_order?: number;
  is_playable?: boolean;
  show_in_intro?: boolean;
  can_speak_in_reading?: boolean;
  is_voting_candidate?: boolean;
}

export interface CreateClueRequest {
  name: string;
  description?: string;
  image_url?: string;
  level?: number;
  is_common?: boolean;
  sort_order?: number;
  location_id?: string;
  is_usable?: boolean;
  use_effect?: string;
  use_target?: string;
  use_consumed?: boolean;
  reveal_round?: number | null;
  hide_round?: number | null;
}

export interface UpdateClueRequest {
  name?: string;
  description?: string;
  image_url?: string;
  level?: number;
  is_common?: boolean;
  sort_order?: number;
  location_id?: string;
  is_usable?: boolean;
  use_effect?: string;
  use_target?: string;
  use_consumed?: boolean;
  reveal_round?: number | null;
  hide_round?: number | null;
}

// ---------------------------------------------------------------------------
// Maps / Locations / Clues / Contents / Validation types
// ---------------------------------------------------------------------------

export interface MapResponse {
  id: string;
  theme_id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface CreateMapRequest {
  name: string;
  image_url?: string;
  sort_order?: number;
}

export interface LocationResponse {
  id: string;
  theme_id: string;
  map_id: string;
  name: string;
  restricted_characters: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  from_round?: number | null;
  until_round?: number | null;
}

export interface ClueResponse {
  id: string;
  theme_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  is_common: boolean;
  level: number;
  sort_order: number;
  created_at: string;
  is_usable: boolean;
  use_effect: string | null;
  use_target: string | null;
  use_consumed: boolean;
  reveal_round?: number | null;
  hide_round?: number | null;
}

export interface ContentResponse {
  id: string;
  theme_id: string;
  key: string;
  body: string;
  updated_at: string;
}

export type RoleSheetFormat = 'markdown' | 'pdf' | 'images';

export interface RoleSheetMarkdown {
  body: string;
}

export interface RoleSheetPDF {
  media_id: string;
}

export interface RoleSheetImages {
  image_urls: string[];
}

export interface RoleSheetResponse {
  character_id: string;
  theme_id: string;
  format: RoleSheetFormat;
  markdown?: RoleSheetMarkdown;
  pdf?: RoleSheetPDF;
  images?: RoleSheetImages;
  updated_at?: string | null;
}

export type UpsertRoleSheetRequest =
  | {
      format: 'markdown';
      markdown: RoleSheetMarkdown;
    }
  | {
      format: 'pdf';
      pdf: RoleSheetPDF;
    }
  | {
      format: 'images';
      images: RoleSheetImages;
    };

export interface ValidationResponse {
  valid: boolean;
  errors: string[];
  stats: {
    characters: number;
    maps: number;
    locations: number;
    clues: number;
  };
}

export type JSONSchema = import('@/features/editor/templateApi').JSONSchemaProperty;

export interface ModuleSchemasResponse {
  schemas: Record<string, JSONSchema>;
}
