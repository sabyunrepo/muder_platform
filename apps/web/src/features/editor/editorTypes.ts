// ---------------------------------------------------------------------------
// Editor-side config_json helpers
// ---------------------------------------------------------------------------

export type {
  EditorConfig,
  LocationConfig as EditorLocationConfig,
} from '@/features/editor/utils/configShape';

export type EditorLocationsConfig = import('@/features/editor/utils/configShape').LocationConfig[];

export {
  readLocationsConfig,
  readLocationClueIds,
  writeLocationClueIds,
} from '@/features/editor/utils/configShape';
