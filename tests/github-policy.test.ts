import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateGithubPolicy } from "../scripts/ci/verify-github-policy.mjs";

const runtime = { nodeVersion: "24.20.0", packageManager: "pnpm@11.5.1" };
const current = () => JSON.parse(readFileSync(".github/workflows/ci.yml", "utf8"));

describe("GitHub commercial consumer", () => {
  it("accepts the actual frozen-runtime exact-head consumer", () => {
    expect(() => validateGithubPolicy(JSON.stringify(current()), runtime)).not.toThrow();
  });

  it("rejects unsafe events, elevated token, inherited secrets and extra executable jobs", () => {
    for (const mutate of [
      (w: ReturnType<typeof current>) => { w.on.pull_request_target = {}; },
      (w: ReturnType<typeof current>) => { w.permissions.contents = "write"; },
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].secrets = "inherit"; },
      (w: ReturnType<typeof current>) => { w.jobs.deploy = { "runs-on": "self-hosted" }; },
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].if = "false"; },
    ]) {
      const candidate = current();
      mutate(candidate);
      expect(() => validateGithubPolicy(JSON.stringify(candidate), runtime)).toThrow();
    }
  });

  it("rejects mutable references, merge-ref proof, altered bootstrap and runtime drift", () => {
    for (const mutate of [
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].uses = w.jobs["commercial-gate"].uses.replace(/@[a-f0-9]{40}$/u, "@main"); },
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].with.expected_sha = "${{ github.sha }}"; },
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].with.command = "true"; },
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].with.node_version = "24"; },
      (w: ReturnType<typeof current>) => { w.jobs["commercial-gate"].with.environment_json = '{"DATABASE_HOST":"production"}'; },
    ]) {
      const candidate = current();
      mutate(candidate);
      expect(() => validateGithubPolicy(JSON.stringify(candidate), runtime)).toThrow();
    }
  });
});
