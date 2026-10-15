-- Identity runtime may append org-null login evidence for the acting user only.
-- Tenants still cannot read those rows; platform-admin/staff keep full SELECT.
CREATE POLICY "AuditEvent_identity_login" ON "AuditEvent"
  FOR INSERT TO PUBLIC
  WITH CHECK (
    current_setting('app.principal_kind', true) = 'identity'
    AND "organizationId" IS NULL
    AND "entityType" = 'User'
    AND "entityId" = NULLIF(current_setting('app.actor_id', true), '')
    AND "actorId" = NULLIF(current_setting('app.actor_id', true), '')
    AND "action" IN (
      'login.failed',
      'login.password-verified',
      'login.locked',
      'login.unlocked',
      'login.mfa',
      'login.recovery',
      'login.session-revoke'
    )
  );
