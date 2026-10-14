import { describe, expect, it, vi } from "vitest";
import { disposeNativeProofCluster, nativeProofPostgresEligible } from "../scripts/native-proof-postgres.mjs";

describe("owned native PostgreSQL backend eligibility", () => {
  it("requires the complete executable toolchain before selecting native", () => {
    for (const missing of ["initdb", "pg_ctl", "postgres", "psql"]) {
      expect(nativeProofPostgresEligible({ env: {}, rootUser: false, insideContainer: false, hasTool: (file: string) => !file.endsWith(`/${missing}`) })).toBe(false);
    }
    expect(nativeProofPostgresEligible({ env: {}, rootUser: false, insideContainer: false, hasTool: () => true })).toBe(true);
  });
  it("requires every hosted-container condition for root and otherwise permits Docker fallback", () => {
    const hosted = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted" };
    const cases: Array<[Record<string, string>, boolean]> = [[{}, false], [hosted, false], [{ GITHUB_ACTIONS: "true" }, true], [{ RUNNER_ENVIRONMENT: "github-hosted" }, true]];
    for (const [env, insideContainer] of cases) {
      expect(nativeProofPostgresEligible({ env, rootUser: true, insideContainer, hasTool: () => true })).toBe(false);
    }
    expect(nativeProofPostgresEligible({ env: hosted, rootUser: true, insideContainer: true, hasTool: () => true })).toBe(true);
  });
  it("removes the cluster directory only after shutdown is confirmed", async () => {
    const removeDirectory = vi.fn();
    const stopCluster = vi.fn(async () => { running = false; });
    let running = true;
    await disposeNativeProofCluster({ pidExists: () => running, stopCluster, removeDirectory });
    expect(stopCluster).toHaveBeenCalledOnce();
    expect(removeDirectory).toHaveBeenCalledOnce();
    running = true;
    stopCluster.mockRejectedValueOnce(new Error("pg_ctl stop failed"));
    removeDirectory.mockClear();
    await expect(disposeNativeProofCluster({ pidExists: () => running, stopCluster, removeDirectory })).rejects.toThrow("pg_ctl stop failed");
    expect(removeDirectory).not.toHaveBeenCalled();
    stopCluster.mockResolvedValueOnce(undefined);
    await expect(disposeNativeProofCluster({ pidExists: () => true, stopCluster, removeDirectory })).rejects.toThrow("still running");
    expect(removeDirectory).not.toHaveBeenCalled();
  });
});
