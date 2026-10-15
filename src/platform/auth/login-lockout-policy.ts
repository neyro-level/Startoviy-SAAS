export const loginLockoutPolicy = {
  failureLimit: 10,
  lockoutMs: 15 * 60 * 1000,
} as const;

export const loginInvalidPublicError = {
  code: "AUTH_INVALID",
  message: "Не удалось войти. Проверьте логин и пароль.",
} as const;

export type LoginLockoutSnapshot = {
  failedLoginCount: number;
  loginLockedUntil: Date | null;
};

export function isLoginLocked(snapshot: LoginLockoutSnapshot, now: Date): boolean {
  return snapshot.loginLockedUntil !== null && snapshot.loginLockedUntil.getTime() > now.getTime();
}

export function nextLoginFailureSnapshot(snapshot: LoginLockoutSnapshot, now: Date): LoginLockoutSnapshot {
  if (isLoginLocked(snapshot, now)) return snapshot;
  const windowExpired = snapshot.loginLockedUntil !== null && snapshot.loginLockedUntil.getTime() <= now.getTime();
  const failedLoginCount = (windowExpired ? 0 : snapshot.failedLoginCount) + 1;
  return {
    failedLoginCount,
    loginLockedUntil: failedLoginCount >= loginLockoutPolicy.failureLimit
      ? new Date(now.getTime() + loginLockoutPolicy.lockoutMs)
      : null,
  };
}

export function clearedLoginLockoutSnapshot(): LoginLockoutSnapshot {
  return { failedLoginCount: 0, loginLockedUntil: null };
}
