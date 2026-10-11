import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OptionalModules } from "../src/platform/config/optional-modules.ts";
import { isModuleEnabled, requireOptionalModule } from "../src/platform/config/optional-modules.ts";

const mocks = vi.hoisted(() => ({
  modules: { outboxPlusQueue: "enabled", pwa: "enabled", platformAdmin: "enabled", outboundHttp: "disabled", objectStorage: "disabled" } as OptionalModules,
  database: vi.fn(),
}));
vi.mock("../src/platform/config/project-identity.ts", async (original) => {
  const actual = await original<typeof import("../src/platform/config/project-identity.ts")>();
  return { ...actual, optionalModules: mocks.modules, projectIdentity: { ...actual.projectIdentity, derivation: { ...actual.projectIdentity.derivation, optionalModules: mocks.modules } } };
});
vi.mock("../src/platform/database/transaction.ts", async (original) => ({
  ...await original<typeof import("../src/platform/database/transaction.ts")>(),
  runInSystemJobDatabaseTransaction: mocks.database,
}));
vi.mock("../src/platform/actions/define-action.ts", () => ({
  // Exercise the real admin execution gate with a valid authenticated actor.
  // Session validation is the independently verified shared action boundary.
  defineAction: (definition: { execute: (context: unknown) => unknown }) => definition.execute,
}));
vi.mock("../src/modules/identity-access/server.ts", () => ({
  getCurrentCabinetRedirect: async () => null,
  getCurrentPrincipalState: async () => ({ principal: { kind: "platform-admin", userId: "ui-admin", correlationId: "ui-test" } }),
}));
vi.mock("../src/modules/project-registry/server.ts", () => ({ listProjectTreesForUser: async () => [] }));

import { GET as manifestResponse } from "../src/app/manifest.webmanifest/route.ts";
import OfflinePage from "../src/app/offline/page.tsx";
import AdminPage from "../src/app/admin/page.tsx";
import DashboardPage from "../src/app/dashboard/page.tsx";
import { GET as getServiceWorker } from "../src/app/sw.js/route.ts";
import { platformAdminAction } from "../src/app/admin/_actions/platform-admin-action.ts";
import { getPgBoss } from "../src/modules/platform-operations/infrastructure/pg-boss-client.ts";
import { runReliabilityRetention } from "../src/modules/platform-operations/infrastructure/retention-runtime.ts";
import { getOperationalReadiness } from "../src/modules/platform-operations/infrastructure/readiness-runtime.ts";

beforeEach(() => {
  Object.assign(mocks.modules, { outboxPlusQueue: "enabled", pwa: "enabled", platformAdmin: "enabled", outboundHttp: "disabled", objectStorage: "disabled" });
  mocks.database.mockReset();
});

describe("optional capability boundaries", () => {
  it.each(["enabled", "disabled", "not_applicable"] as const)("renders the dashboard admin action only with an enabled module (%s)", async (state) => {
    mocks.modules.platformAdmin = state;
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html.includes("Администрирование")).toBe(state === "enabled");
    expect(/href="\/admin\/organizations\/?"/u.test(html)).toBe(state === "enabled");
  });
  it.each(["outboxPlusQueue", "pwa", "platformAdmin", "outboundHttp", "objectStorage"] as const)("requires explicit own enablement for %s", (name) => {
    expect(isModuleEnabled({ [name]: "enabled" }, name)).toBe(true);
    for (const state of ["disabled", "not_applicable", "unknown", undefined]) {
      const modules = { [name]: state } as Partial<OptionalModules>;
      expect(isModuleEnabled(modules, name)).toBe(false);
      expect(() => requireOptionalModule(modules, name)).toThrow("disabled");
    }
    expect(isModuleEnabled(Object.create({ [name]: "enabled" }), name)).toBe(false);
  });

  it.each(["disabled", "not_applicable"] as const)("closes all PWA entrypoints when %s", (state) => {
    mocks.modules.pwa = state;
    expect(manifestResponse().status).toBe(404);
    expect(() => OfflinePage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(getServiceWorker().status).toBe(404);
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it("serves the private-safe worker source only when enabled", async () => {
    const response = getServiceWorker();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(await response.text()).toContain("isPrivateRequest(url)");
  });

  it.each(["disabled", "not_applicable"] as const)("closes admin routes and denies an authenticated mutation when %s", async (state) => {
    mocks.modules.platformAdmin = state;
    expect(() => AdminPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    const mutate = vi.fn();
    const action = platformAdminAction("projects", mutate);
    expect(() => action({ principal: { kind: "platform-admin", userId: "admin", correlationId: "test" }, input: {} })).toThrow("disabled");
    expect(mutate).not.toHaveBeenCalled();
  });

  it.each(["disabled", "not_applicable"] as const)("refuses active queue/retention and still checks core database readiness when %s", async (state) => {
    mocks.modules.outboxPlusQueue = state;
    await expect(getPgBoss()).rejects.toThrow("disabled");
    await expect(runReliabilityRetention()).rejects.toThrow("disabled");
    expect(mocks.database).not.toHaveBeenCalled();
    mocks.database.mockResolvedValueOnce([]);
    await expect(getOperationalReadiness()).resolves.toMatchObject({ queue: { status: "disabled" }, worker: { status: "disabled" } });
    expect(mocks.database).toHaveBeenCalledOnce();
    mocks.database.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(getOperationalReadiness()).rejects.toThrow("database unavailable");
  });

  it("denies maintenance actions when only outbox is disabled", () => {
    mocks.modules.outboxPlusQueue = "disabled";
    const mutate = vi.fn();
    const action = platformAdminAction("operations", mutate);
    expect(() => action({ principal: { kind: "platform-admin", userId: "admin", correlationId: "test" }, input: {} })).toThrow("disabled");
    expect(mutate).not.toHaveBeenCalled();
  });
});
