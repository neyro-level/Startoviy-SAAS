import { types } from "node:util";
import { REDACTED_VALUE, sensitiveValues, type SensitiveValueRegistry } from "./sensitive-values.ts";

const sensitiveKey = /password|passwd|secret|token|authorization|cookie|api[_-]?key|credential|connection[_-]?string|database[_-]?url|otp|backup[_-]?code|recovery|email|phone|username|rawbody|safeerrorbody/iu;
const url = /[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/giu;
const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/giu;
const namedValue = /(["']?(?:password|passwd|token|secret|authorization|cookie|api[_-]?key|otp|totp|email|phone)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu;
const bearer = /\bBearer\s+[^\s,;"']+/giu;
const phone = /\+\d[\d ().-]{6,}\d/gu;
const reserved = new Set(["__proto__", "prototype", "constructor", "hasOwnProperty"]);
const priorities = new Set(["code", "correlationId", "traceId", "event", "level", "message"]);

export function redactSensitiveText(value: string, registry: SensitiveValueRegistry = sensitiveValues): string {
  if (value.length > 8192) return "[LOG_TEXT_TOO_LARGE]";
  return registry.redact(value)
    .replace(url, "[REDACTED_URL]")
    .replace(email, REDACTED_VALUE)
    .replace(namedValue, (_whole, prefix: string) => `${prefix}${REDACTED_VALUE}`)
    .replace(bearer, "Bearer [REDACTED]")
    .replace(phone, REDACTED_VALUE);
}

export function sanitizeLogValue(value: unknown, registry: SensitiveValueRegistry = sensitiveValues): unknown {
  const seen = new WeakSet<object>();
  let nodes = 0;
  let characters = 0;
  const text = (input: string) => {
    const redacted = redactSensitiveText(input, registry);
    characters += redacted.length;
    return characters > 16384 ? "[LOG_BUDGET_EXCEEDED]" : redacted;
  };
  function visit(input: unknown, depth: number): unknown {
    if (++nodes > 256 || depth > 8) return "[LOG_BUDGET_EXCEEDED]";
    if (typeof input === "string") return text(input);
    if (input === null || typeof input === "boolean" || typeof input === "number" || input === undefined) return input;
    if (typeof input === "bigint") return text(input.toString());
    if (typeof input !== "object" || types.isProxy(input)) return REDACTED_VALUE;
    if (seen.has(input)) return "[Circular]";
    seen.add(input);
    try {
      if (types.isDate(input)) return Date.prototype.toISOString.call(input);
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (types.isNativeError(input)) {
        const field = (key: string) => descriptors[key] && "value" in descriptors[key] ? descriptors[key].value : undefined;
        return {
          type: typeof field("name") === "string" ? text(field("name")) : "Error",
          code: typeof field("code") === "string" ? text(field("code")) : undefined,
          message: typeof field("message") === "string" ? text(field("message")) : REDACTED_VALUE,
          stack: typeof field("stack") === "string" ? text(field("stack")) : undefined,
          cause: descriptors.cause
            ? ("value" in descriptors.cause ? visit(descriptors.cause.value, depth + 1) : REDACTED_VALUE)
            : undefined,
        };
      }
      if (Array.isArray(input)) {
        const output = [];
        for (let index = 0; index < Math.min(input.length, 64); index += 1) {
          const descriptor = descriptors[index];
          output.push(descriptor && "value" in descriptor ? visit(descriptor.value, depth + 1) : REDACTED_VALUE);
        }
        if (input.length > 64) output.push("[LOG_ENTRIES_TRUNCATED]");
        return output;
      }
      if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) return REDACTED_VALUE;
      const output: Record<string, unknown> = {};
      const keys = Object.keys(descriptors).filter((key) => descriptors[key].enumerable && !reserved.has(key));
      keys.sort((a, b) => Number(priorities.has(b)) - Number(priorities.has(a)));
      for (const key of keys.slice(0, 64)) {
        const safeKey = key.length > 128 ? "[LOG_KEY_TOO_LARGE]" : text(key);
        const descriptor = descriptors[key];
        output[safeKey] = sensitiveKey.test(key) || !("value" in descriptor) ? REDACTED_VALUE : visit(descriptor.value, depth + 1);
      }
      if (keys.length > 64) output.logEntriesTruncated = true;
      return output;
    } catch {
      return REDACTED_VALUE;
    } finally {
      seen.delete(input);
    }
  }
  return visit(value, 0);
}

export function sanitizeLogRecord(value: unknown): Record<string, unknown> {
  const safe = sanitizeLogValue(value);
  return safe && typeof safe === "object" && !Array.isArray(safe) ? safe as Record<string, unknown> : { detail: safe };
}

export function sanitizeLogLine(line: string): string {
  if (line.length > 65536) return '{"level":"warn","code":"LOG_ENTRY_REDACTED","message":"Log entry exceeded safety budget"}\n';
  try {
    return `${JSON.stringify(sanitizeLogRecord(JSON.parse(line)))}\n`;
  } catch {
    return '{"level":"warn","code":"LOG_ENTRY_REDACTED","message":"Log entry unavailable"}\n';
  }
}
