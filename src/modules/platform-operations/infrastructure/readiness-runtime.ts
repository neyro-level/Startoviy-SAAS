import { OutboxStatus } from "../../../generated/prisma/client.ts";
import { optionalModules } from "../../../platform/config/project-identity.ts";
import { isModuleEnabled } from "../../../platform/config/optional-modules.ts";
import { runInSystemJobDatabaseTransaction } from "../../../platform/database/transaction.ts";
import { OUTBOX_WORKER_RUNTIME } from "./runtime-heartbeat.ts";

export interface WorkerHeartbeatHealth {
  status: "healthy" | "stale" | "unknown" | "disabled";
  lastHeartbeatAt: string | null;
}

export interface QueueHealth {
  status: "healthy" | "degraded" | "disabled";
  pending: number;
  processing: number;
  deadLetter: number;
}

export interface OperationalReadiness {
  queue: QueueHealth;
  worker: WorkerHeartbeatHealth;
}

export const WORKER_HEARTBEAT_STALE_MS = 3 * 60 * 1000;

export function toWorkerStatus(lastHeartbeatAt: Date | null, now: Date) {
  if (!lastHeartbeatAt) return "unknown" as const;
  return now.getTime() - lastHeartbeatAt.getTime() <= WORKER_HEARTBEAT_STALE_MS
    ? "healthy"
    : "stale";
}

export async function getOperationalReadiness(now = new Date()): Promise<OperationalReadiness> {
  if (!isModuleEnabled(optionalModules, "outboxPlusQueue")) {
    // Core database readiness still has to succeed; disabled is not a probe PASS.
    await runInSystemJobDatabaseTransaction({ jobName: "operations-readiness", correlationId: `readiness-${now.getTime()}` },
      (transaction) => transaction.$queryRaw`SELECT 1`);
    return { queue: { status: "disabled", pending: 0, processing: 0, deadLetter: 0 }, worker: { status: "disabled", lastHeartbeatAt: null } };
  }
  const [pending, processing, deadLetter, latestHeartbeat] =
    await runInSystemJobDatabaseTransaction(
      {
        jobName: "operations-readiness",
        correlationId: `readiness-${now.getTime()}`,
      },
      (transaction) =>
        Promise.all([
          transaction.outboxEvent.count({ where: { status: OutboxStatus.PENDING } }),
          transaction.outboxEvent.count({ where: { status: OutboxStatus.PROCESSING } }),
          transaction.outboxEvent.count({ where: { status: OutboxStatus.DEAD_LETTER } }),
          transaction.runtimeHeartbeat.findFirst({
            where: { runtime: OUTBOX_WORKER_RUNTIME },
            orderBy: { heartbeatAt: "desc" },
            select: { heartbeatAt: true },
          }),
        ]),
    );

  const lastHeartbeatDate = latestHeartbeat?.heartbeatAt ?? null;

  return {
    queue: {
      status: deadLetter > 0 ? "degraded" : "healthy",
      pending,
      processing,
      deadLetter,
    },
    worker: {
      status: toWorkerStatus(lastHeartbeatDate, now),
      lastHeartbeatAt: lastHeartbeatDate?.toISOString() ?? null,
    },
  };
}
