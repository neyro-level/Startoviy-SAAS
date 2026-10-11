const localStores = new Set([
  "backlog", ".beads", ".ams-task-manager", ".local", ".release-artifacts",
  "test-results", "playwright-report", "coverage",
]);

export function isExecutionArtifact(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized.split("/").some((part) => localStores.has(part)
    || /^MASTER_PLAN(?:[._-]|$)/i.test(part)
    || /^(?:execution[-_]snapshot|approval[-_]snapshot|review[-_]snapshot)(?:[._-]|$)/i.test(part));
}

export function assertNoInheritedExecutionArtifacts(files) {
  const forbidden = files.filter(isExecutionArtifact);
  if (forbidden.length) {
    throw new Error(`Execution artifacts must not be inherited: ${forbidden.sort().join(", ")}`);
  }
}
