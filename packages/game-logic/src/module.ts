import type { ModuleConfig } from "@mmp/shared";

/** Validate that a module config has required fields. */
export function isValidModuleConfig(config: unknown): config is ModuleConfig {
  if (typeof config !== "object" || config === null) return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c["id"] === "string" &&
    typeof c["name"] === "string" &&
    typeof c["version"] === "string" &&
    typeof c["enabled"] === "boolean" &&
    typeof c["settings"] === "object" &&
    c["settings"] !== null
  );
}

/** Get only enabled modules from a list. */
export function getEnabledModules(modules: ModuleConfig[]): ModuleConfig[] {
  return modules.filter((m) => m.enabled);
}

/** Find a module by ID. */
export function findModule(
  modules: ModuleConfig[],
  id: string,
): ModuleConfig | undefined {
  return modules.find((m) => m.id === id);
}

/** Get a typed setting value from a module config. */
export function getModuleSetting<T>(
  config: ModuleConfig,
  key: string,
  defaultValue: T,
): T {
  const value = config.settings[key];
  if (value === undefined) return defaultValue;

  // Runtime type check: ensure the stored value matches the expected type
  if (typeof value !== typeof defaultValue) {
    return defaultValue;
  }

  return value as T;
}
