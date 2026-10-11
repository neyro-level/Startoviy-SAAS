import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { validateGithubPolicy } from "../scripts/ci/verify-github-policy.mjs";

const profile = JSON.parse(readFileSync("starter.identity.json", "utf8")).derivation.deliveryProfile;
const gate = `${profile.toLowerCase()}-gate`;
const runtime = {
  profile,
  nodeVersion: "24.20.0", packageManager: "pnpm@11.5.1",
  vendorWorkflow: readFileSync(".github/workflows/ams-verify.yml", "utf8"),
  vendorLock: JSON.parse(readFileSync(".github/workflows/ams-verify.yml.lock.json", "utf8")),
};
const current = () => parse(readFileSync(".github/workflows/ci.yml", "utf8"));

describe("GitHub delivery consumer", () => {
  it("accepts the actual frozen-runtime exact-head consumer", () => {
    expect(() => validateGithubPolicy(JSON.stringify(current()), runtime)).not.toThrow();
  });

  it("binds the declared profile to its exact required context without lowering checks", () => {
    const candidate = current();
    candidate.name = "Starter critical verification";
    candidate.jobs = { "critical-gate": candidate.jobs[gate] };
    expect(() => validateGithubPolicy(JSON.stringify(candidate), { ...runtime, profile: "CRITICAL" })).not.toThrow();
    expect(() => validateGithubPolicy(JSON.stringify(candidate), { ...runtime, profile: "COMMERCIAL" })).toThrow();
    expect(() => validateGithubPolicy(JSON.stringify(candidate), { ...runtime, profile: "EXPERIMENT" })).toThrow();
  });

  it("rejects duplicate permission keys instead of silently accepting an override", () => {
    const source = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(() => validateGithubPolicy(`${source}\npermissions: {contents: write}\n`, runtime)).toThrow();
  });

  it("rejects unsafe events, elevated token, inherited secrets and extra executable jobs", () => {
    for (const mutate of [
      (w: ReturnType<typeof current>) => { w.on.pull_request_target = {}; },
      (w: ReturnType<typeof current>) => { w.permissions.contents = "write"; },
      (w: ReturnType<typeof current>) => { w.jobs[gate].secrets = "inherit"; },
      (w: ReturnType<typeof current>) => { w.jobs.deploy = { "runs-on": "self-hosted" }; },
      (w: ReturnType<typeof current>) => { w.jobs[gate].if = "false"; },
    ]) {
      const candidate = current();
      mutate(candidate);
      expect(() => validateGithubPolicy(JSON.stringify(candidate), runtime)).toThrow();
    }
  });

  it("rejects mutable references, merge-ref proof, altered bootstrap and runtime drift", () => {
    for (const mutate of [
      (w: ReturnType<typeof current>) => { w.jobs[gate].uses = "neyro-level/AMS_DELIVERY_CORE/.github/workflows/verify.yml@main"; },
      (w: ReturnType<typeof current>) => { w.jobs[gate].with.expected_sha = "${{ github.sha }}"; },
      (w: ReturnType<typeof current>) => { w.jobs[gate].with.command = "true"; },
      (w: ReturnType<typeof current>) => { w.jobs[gate].with.node_version = "24"; },
      (w: ReturnType<typeof current>) => { w.jobs[gate].with.environment_json = '{"DATABASE_HOST":"production"}'; },
    ]) {
      const candidate = current();
      mutate(candidate);
      expect(() => validateGithubPolicy(JSON.stringify(candidate), runtime)).toThrow();
    }
  });

  it("rejects altered vendor bytes and forged provenance before accepting a local workflow", () => {
    expect(() => validateGithubPolicy(JSON.stringify(current()), {
      ...runtime, vendorWorkflow: runtime.vendorWorkflow.replace("if: always()", "if: false"),
    })).toThrow(/provenance/u);
    expect(() => validateGithubPolicy(JSON.stringify(current()), {
      ...runtime, vendorLock: { ...runtime.vendorLock, source_sha: "b".repeat(40) },
    })).toThrow(/provenance/u);
  });
});
