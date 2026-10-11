import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OptionalModules } from "../src/platform/config/optional-modules.ts";
const mocks = vi.hoisted(() => ({ modules: { platformAdmin: "enabled", outboxPlusQueue: "enabled", pwa: "enabled", outboundHttp: "disabled", objectStorage: "disabled" } as OptionalModules }));
vi.mock("../src/platform/config/project-identity.ts", async (original) => ({ ...await original<typeof import("../src/platform/config/project-identity.ts")>(), optionalModules: mocks.modules }));
// Dialog portals are unrelated to the server-rendered capability description.
vi.mock("../src/modules/identity-access/client.ts", () => ({ LoginDialog: () => null }));
vi.mock("../src/components/marketing/LeadRequestDialog.tsx", () => ({ LeadRequestDialog: () => null }));
import { StartLanding } from "../src/components/marketing/StartLanding.tsx";
beforeEach(() => { mocks.modules.platformAdmin = "enabled"; mocks.modules.outboxPlusQueue = "enabled"; });
describe("public optional capabilities", () => {
  it("renders no unconfigured documentation contact buttons", () => {
    const html = renderToStaticMarkup(<StartLanding loginRequested={false} />);
    expect(html).not.toContain('href="https://example.com/');
    expect(html).not.toContain("Telegram");
    expect(html).not.toContain("Max");
    expect(html).toContain('href="mailto:');
    expect(html).toContain('href="tel:');
  });
  it.each(["enabled", "disabled", "not_applicable"] as const)("shows the selected admin capability (%s)", (state) => {
    mocks.modules.platformAdmin = state;
    const html = renderToStaticMarkup(<StartLanding loginRequested={false} />);
    expect(html.includes("админка")).toBe(state === "enabled");
    expect(html).toContain("Кабинет");
  });
  it.each(["enabled", "disabled", "not_applicable"] as const)("shows the selected queue capability (%s)", (state) => {
    mocks.modules.outboxPlusQueue = state;
    const html = renderToStaticMarkup(<StartLanding loginRequested={false} />);
    expect(html.includes("очередь задач")).toBe(state === "enabled");
    expect(html).toContain("вход, роли, организации");
  });
});
