import { describe, expect, it } from "vitest";
import {
  clearedLoginLockoutSnapshot,
  isLoginLocked,
  loginLockoutPolicy,
  nextLoginFailureSnapshot,
} from "../src/platform/auth/login-lockout-policy.ts";

const start = new Date("2026-10-14T12:00:00.000Z");

describe("account login lockout policy", () => {
  it("locks after the failure limit and does not extend a live lock", () => {
    let snapshot = clearedLoginLockoutSnapshot();
    for (let index = 0; index < loginLockoutPolicy.failureLimit - 1; index += 1) {
      snapshot = nextLoginFailureSnapshot(snapshot, start);
      expect(isLoginLocked(snapshot, start)).toBe(false);
    }
    snapshot = nextLoginFailureSnapshot(snapshot, start);
    expect(snapshot.failedLoginCount).toBe(loginLockoutPolicy.failureLimit);
    expect(isLoginLocked(snapshot, start)).toBe(true);
    const lockedUntil = snapshot.loginLockedUntil?.getTime();
    expect(lockedUntil).toBe(start.getTime() + loginLockoutPolicy.lockoutMs);
    const parallel = nextLoginFailureSnapshot(snapshot, new Date(start.getTime() + 60_000));
    expect(parallel.failedLoginCount).toBe(loginLockoutPolicy.failureLimit);
    expect(parallel.loginLockedUntil?.getTime()).toBe(lockedUntil);
  });

  it("resets after the window expires instead of creating a permanent lock", () => {
    const locked = nextLoginFailureSnapshot(
      { failedLoginCount: loginLockoutPolicy.failureLimit - 1, loginLockedUntil: null },
      start,
    );
    const afterExpiry = new Date(start.getTime() + loginLockoutPolicy.lockoutMs + 1);
    expect(isLoginLocked(locked, afterExpiry)).toBe(false);
    const next = nextLoginFailureSnapshot(locked, afterExpiry);
    expect(next.failedLoginCount).toBe(1);
    expect(next.loginLockedUntil).toBeNull();
  });
});
