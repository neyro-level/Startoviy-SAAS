import { format } from "node:util";
import pino from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";
import { sanitizeLogLine, sanitizeLogRecord, sanitizeLogValue } from "../security/sensitive-redaction.ts";

const REDACTION_PATHS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "cookies",
  "headers.authorization",
  "headers.cookie",
  "headers.set-cookie",
  "headers['x-api-key']",
  "headers['x-auth-token']",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "req.headers['x-auth-token']",
  "request.headers.authorization",
  "request.headers.cookie",
  "request.headers['x-api-key']",
  "request.headers['x-auth-token']",
  "response.headers.set-cookie",
  "res.headers.set-cookie",
  "db.password",
  "db.connectionString",
  "databaseUrl",
  "DATABASE_URL",
  "env.DATABASE_URL",
  "env.DATABASE_PASSWORD",
  "env.BETTER_AUTH_SECRET",
  "payload.password",
  "payload.token",
  "payload.authorization",
  "payload.cookie",
  "payload.apiKey",
  "payload.secret",
  "payload.email",
  "payload.phone",
  "payload.contact",
  "payload.username",
  "payload.headers.authorization",
  "payload.headers.cookie",
  "payload.headers.set-cookie",
  "payload.headers['x-api-key']",
  "payload.headers['x-auth-token']",
  "payload.user.email",
  "payload.user.phone",
  "payload.user.password",
  "payload.user.token",
  "payload.user.secret",
  "payload.actor.email",
  "payload.actor.phone",
  "payload.actor.token",
  "payload.actor.secret",
  "user.email",
  "user.phone",
  "user.password",
  "user.token",
  "user.secret",
  "actor.email",
  "actor.phone",
  "actor.token",
  "actor.secret",
  "safeErrorBody",
  "rawBody",
  "pii.email",
  "pii.phone",
] as const;

function createOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL?.trim() || "info",
    base: undefined,
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
      bindings: sanitizeLogRecord,
    },
    hooks: {
      logMethod(args, method) {
        const list = args.slice(0, 16);
        const merging = list[0] !== null && typeof list[0] === "object" ? list[0] : undefined;
        const messageArgs = merging === undefined ? list : list.slice(1);
        if (typeof messageArgs[0] === "string" && messageArgs.length > 1) {
          const formatted = sanitizeLogValue(format(...(messageArgs as [string, ...unknown[]])));
          method.apply(this, (merging === undefined ? [formatted] : [sanitizeLogValue(merging), formatted]) as Parameters<typeof method>);
          return;
        }
        method.apply(this, list.map((argument) => sanitizeLogValue(argument)) as Parameters<typeof method>);
      },
      // Child bindings are serialized once by Pino. Recheck the final line so
      // values registered after child creation are still protected.
      streamWrite: sanitizeLogLine,
    },
    redact: {
      paths: [...REDACTION_PATHS],
      censor: "[REDACTED]",
    },
  };
}

const rootLogger = pino(createOptions());

export function createLogger(
  bindings?: Record<string, string | number | boolean | null>,
  destination?: DestinationStream,
): Logger {
  const logger = destination ? pino(createOptions(), destination) : rootLogger;
  return bindings ? logger.child(bindings) : logger;
}

export function getLogger(bindings?: Record<string, string | number | boolean | null>): Logger {
  return bindings ? rootLogger.child(bindings) : rootLogger;
}
