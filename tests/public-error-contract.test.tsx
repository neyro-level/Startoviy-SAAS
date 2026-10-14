import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootError from "../src/app/error.tsx";
import AdminResourceError from "../src/app/admin/[resource]/error.tsx";
import { toSafePublicError } from "../src/platform/http/error-envelope.ts";

const correlationId = "00000000-0000-4000-8000-000000000000";
const fallback = {
  code: "PROVIDER_UNAVAILABLE",
  message: "Сервис временно недоступен.",
  correlationId,
};

describe("safe public error contract", () => {
  it("hides SQL, URLs and secrets while keeping a correlation id", () => {
    const leaked = new Error("SELECT password FROM users WHERE token=abc postgres://owner:hunter2@db/app");
    const envelope = toSafePublicError(leaked, fallback);
    expect(envelope.error.correlationId).toBe(correlationId);
    expect(envelope.error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(JSON.stringify(envelope)).not.toMatch(/SELECT|hunter2|postgres:\/\//i);
    expect(envelope.error.message).toBe(fallback.message);
  });

  it("does not copy an upstream provider body into the public envelope", () => {
    const envelope = toSafePublicError(
      { code: "UPSTREAM", message: "Bearer super-secret-token-1111" },
      fallback,
    );
    expect(envelope.error.message).not.toContain("super-secret-token-1111");
    expect(envelope.error.message).toContain("код обращения");
  });

  it("hides generic URL userinfo instead of copying the provider message", () => {
    const envelope = toSafePublicError(
      { code: "UPSTREAM", message: "https://owner:hunter2@example.test/path" },
      fallback,
    );
    expect(JSON.stringify(envelope)).not.toContain("hunter2");
    expect(envelope.error.message).toContain("код обращения");
  });

  it("renders application and admin error views without a stack", () => {
    const root = renderToStaticMarkup(
      <RootError error={new Error("postgres://owner:hunter2@db/app")} reset={() => undefined} />,
    );
    const admin = renderToStaticMarkup(
      <AdminResourceError error={Object.assign(new Error("postgres://owner:hunter2@db/app\n    at Object.query"), { name: "InternalSecretError" })} reset={() => undefined} />,
    );
    expect(root).toContain("APPLICATION_ERROR");
    expect(root).not.toMatch(/postgres:\/\/|at Object/);
    expect(admin).toContain("Не удалось загрузить раздел администрирования");
    expect(admin).not.toMatch(/postgres:\/\/|hunter2|at Object|InternalSecretError/);
  });
});
