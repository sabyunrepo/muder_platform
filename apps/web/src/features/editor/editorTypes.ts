// ---------------------------------------------------------------------------
// Editor-side config_json helpers
// ---------------------------------------------------------------------------

export type {
  EditorConfig,
  LocationDiscoveryConfig,
  LocationConfig as EditorLocationConfig,
} from '@/features/editor/utils/configShape';

export type EditorLocationsConfig = import('@/features/editor/utils/configShape').LocationConfig[];

export {
  readLocationsConfig,
  readLocationDiscoveries,
  readLocationClueIds,
  writeLocationDiscoveries,
  writeLocationClueIds,
} from '@/features/editor/utils/configShape';
