import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectIdentityProvider } from "../src/components/identity/ProjectIdentityProvider.tsx";
import { publicProjectIdentity } from "../src/platform/config/project-identity.ts";
// SSR does not mount portals. Expose the drawer body to verify its real label
// consumers; the existing Sheet owns opening, focus and keyboard behavior.
vi.mock("../src/components/ui/sheet.tsx", () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  return { Sheet: wrapper, SheetContent: wrapper, SheetHeader: wrapper, SheetTitle: wrapper, SheetDescription: wrapper };
});
import { MobileDrawer } from "../src/components/shell/MobileDrawer.tsx";
describe("mobile identity", () => {
  it("renders the selected product labels in the navigation drawer", () => {
    const identity = { ...publicProjectIdentity, brandMark: "CUSTOM & MARK", brandWordmark: "CUSTOM WORDMARK" };
    const html = renderToStaticMarkup(createElement(ProjectIdentityProvider, { identity, children: createElement(MobileDrawer, { sections: [], currentPath: "/dashboard/" }) }));
    expect(html).toContain("CUSTOM &amp; MARK");
    expect(html).toContain("CUSTOM WORDMARK");
    expect(html).toContain("Открыть навигацию");
    expect(html).not.toContain(">АМС<");
    expect(html).not.toContain(">СТАРТ<");
  });
});
