import type { ProjectIdentityV2 } from "./identity-contract.ts";

export type OptionalModules = ProjectIdentityV2["derivation"]["optionalModules"];
export type OptionalModule = keyof OptionalModules;

// Only explicit enablement activates a capability. Invalid/unselected values
// fail closed even if called before the full identity validator.
export function isModuleEnabled(modules: Partial<OptionalModules>, name: OptionalModule): boolean {
  return Object.hasOwn(modules, name) && modules[name] === "enabled";
}

export class OptionalModuleDisabledError extends Error {
  readonly code = "OPTIONAL_MODULE_DISABLED";
  readonly module: OptionalModule;
  constructor(module: OptionalModule) {
    super(`Optional module is disabled: ${module}`);
    this.module = module;
    this.name = "OptionalModuleDisabledError";
  }
}

export function requireOptionalModule(modules: Partial<OptionalModules>, name: OptionalModule): void {
  if (!isModuleEnabled(modules, name)) throw new OptionalModuleDisabledError(name);
}
