import "server-only";

export const REDACTED_VALUE = "[REDACTED]";

export class SensitiveValueRegistry {
  #values = new Set<string>();
  readonly capacity: number;
  readonly maxValueBytes: number;

  constructor(capacity = 512, maxValueBytes = 16384) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 512
      || !Number.isInteger(maxValueBytes) || maxValueBytes < 4 || maxValueBytes > 16384) {
      throw new Error("SECRET_REGISTRY_INVALID");
    }
    this.capacity = capacity;
    this.maxValueBytes = maxValueBytes;
  }

  remember(value: string): void {
    // Very short strings cannot be globally redacted without destroying useful
    // operational text. Such credentials fail closed at resolution instead.
    if (value.length < 4 || Buffer.byteLength(value) > this.maxValueBytes
      || (!this.#values.has(value) && this.#values.size >= this.capacity)) {
      throw new Error("SECRET_UNAVAILABLE");
    }
    this.#values.add(value);
  }

  redact(value: string): string {
    let result = value;
    for (const secret of [...this.#values].sort((a, b) => b.length - a.length)) {
      result = result.split(secret).join(REDACTED_VALUE);
    }
    return result;
  }

  get size(): number {
    return this.#values.size;
  }
}

// No eviction/TTL: a still-valid rotated value must remain protected until
// process restart. Bounded admission fails closed rather than forgetting it.
export const sensitiveValues = new SensitiveValueRegistry();
