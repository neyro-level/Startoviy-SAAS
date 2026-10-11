import { describe, expect, it } from "vitest";
import { createProjectInputSchema } from "../src/modules/project-registry/contracts.ts";
import { createUserInputSchema, systemRoleSchema } from "../src/modules/identity-access/contracts.ts";
import { requestMaintenanceInputSchema } from "../src/modules/platform-operations/contracts.ts";
import { assertNoInheritedExecutionArtifacts } from "../scripts/execution-artifact-policy.mjs";

describe("starter admin contracts", () => {
  it("uses neutral system roles", () => {
    expect(systemRoleSchema.options).toEqual(["PLATFORM_ADMIN", "STAFF", "MEMBER"]);
  });

  it("validates project and user inputs", () => {
    expect(createProjectInputSchema.parse({
      organizationId: "org-1",
      slug: "starter",
      name: "Стартовый проект",
    }).status).toBe("ACTIVE");

    expect(createUserInputSchema.parse({
      username: "member_1",
      name: "Member",
      systemRole: "MEMBER",
    }).systemRole).toBe("MEMBER");
  });

  it("keeps maintenance outbox input neutral", () => {
    expect(requestMaintenanceInputSchema.parse({ idempotencyKey: "manual-1" })).toEqual({
      idempotencyKey: "manual-1",
    });
  });

  it("accepts permanent canon and rejects inherited execution inputs", () => {
    expect(() => assertNoInheritedExecutionArtifacts([
      "docs/01_PRD.md", "docs/04_BACKLOG.md", "docs/adr/ADR-015-commercial-template-github-delivery.md",
    ])).not.toThrow();
    for (const file of [
      "docs/MASTER_PLAN.md", "docs/MASTER_PLAN.inventory.json", "MASTER_PLAN_AMS_INPUT.md",
      "backlog/tasks/task-1.md", ".beads/issues.jsonl", ".ams-task-manager/state.json",
      ".local/evidence/snapshot.json", ".release-artifacts/release.tar.gz", "test-results/run.json",
      "docs/execution-snapshot.json", "docs/approval_snapshot.md", "docs/review-snapshot.md",
      "backlog\\tasks\\task-1.md",
    ]) {
      expect(() => assertNoInheritedExecutionArtifacts(["docs/01_PRD.md", file])).toThrow("must not be inherited");
    }
  });
});
