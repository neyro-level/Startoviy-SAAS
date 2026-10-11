import { describe, expect, it, vi } from "vitest";
vi.mock("../src/platform/config/project-identity.ts", async (original) => {
  const actual = await original<typeof import("../src/platform/config/project-identity.ts")>();
  return { ...actual, publicProjectIdentity: { ...actual.publicProjectIdentity, productName: "Synthetic Independent Product" } };
});
import { metadata } from "../src/app/terms/page.tsx";
describe("derived terms metadata", () => {
  it("identifies the selected product without a starter provider claim", () => {
    expect(metadata.description).toContain("Synthetic Independent Product");
    expect(metadata.description).not.toContain("АМС");
    expect(metadata.alternates).toMatchObject({ canonical: "/terms/" });
  });
});
