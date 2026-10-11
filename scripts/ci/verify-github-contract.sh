#!/usr/bin/env bash
set -euo pipefail

# This bootstrap belongs only to the disposable GitHub-hosted container.
# Refuse execution on a workstation or production host before system mutation.
test "${GITHUB_ACTIONS:-}" = true
test "${RUNNER_ENVIRONMENT:-}" = github-hosted
test "$(id -u)" = 0
test -f /.dockerenv
node scripts/ci/verify-exact-head.mjs
node scripts/verify-release-runtime.mjs
test "$(pnpm --version)" = 11.5.1

export DEBIAN_FRONTEND=noninteractive NEXT_TELEMETRY_DISABLED=1 APP_ENV=test CI=1
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl python3 python3-venv
install -d /usr/share/postgresql-common/pgdg
curl --fail --silent --show-error https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
. /etc/os-release
printf 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt %s-pgdg main\n' "$VERSION_CODENAME" \
  > /etc/apt/sources.list.d/ams-ci-pgdg.list
apt-get update
apt-get install -y --no-install-recommends postgresql-18

proof_pg_dir="$(mktemp -d /tmp/ams-starter-ci-pg-XXXXXX)"
cleanup() {
  runuser -u postgres -- /usr/lib/postgresql/18/bin/pg_ctl -D "$proof_pg_dir" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$proof_pg_dir"
  rm -f .local/ci/e2e.env
}
trap cleanup EXIT
chown postgres:postgres "$proof_pg_dir"
runuser -u postgres -- /usr/lib/postgresql/18/bin/initdb -D "$proof_pg_dir" --auth=trust --no-locale --encoding=UTF8 -U postgres >/dev/null
runuser -u postgres -- /usr/lib/postgresql/18/bin/pg_ctl -D "$proof_pg_dir" \
  -l "$proof_pg_dir/server.log" -o '-h 127.0.0.1 -p 55438' -w start

export LOCAL_POSTGRES_USER=ams_starter_dev TEST_DATABASE_HOST=127.0.0.1 TEST_DATABASE_PORT=55438
export TEST_DATABASE_USER=ams_starter_test TEST_DATABASE_NAME=ams_starter_test
export TEST_DATABASE_PASSWORD=isolated-ci-test-only
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55438 -U postgres -d postgres \
  -c 'CREATE ROLE ams_starter_test LOGIN CREATEDB'
createdb -h 127.0.0.1 -p 55438 -U postgres -O ams_starter_test ams_starter_test
node scripts/verify-test-database-env.mjs

python3 -m venv /tmp/ams-starter-ci-semgrep
/tmp/ams-starter-ci-semgrep/bin/pip install --no-cache-dir semgrep==1.180.0
export PATH="/tmp/ams-starter-ci-semgrep/bin:$PATH"
pnpm exec playwright install --with-deps chromium

pnpm security:secrets
pnpm verify:quick
pnpm docs:check
pnpm test:unit
pnpm test:security
pnpm verify:rls-coverage
pnpm test:integration
pnpm worker:build
pnpm worker:module-smoke
pnpm build
pnpm derive:smoke

# The e2e runner requires an env file; only synthetic, disposable test values
# go here. Production configuration and repository secrets are never loaded.
mkdir -p .local/ci
umask 077
cat > .local/ci/e2e.env <<'ENV'
APP_ENV=test
LOCAL_POSTGRES_USER=ams_starter_dev
TEST_DATABASE_HOST=127.0.0.1
TEST_DATABASE_PORT=55438
TEST_DATABASE_USER=ams_starter_test
TEST_DATABASE_NAME=ams_starter_test
TEST_DATABASE_PASSWORD=isolated-ci-test-only
BETTER_AUTH_SECRET=e2e-only-secret-at-least-thirty-two-characters
BETTER_AUTH_URL=http://127.0.0.1:3100
ENV
# Integration sets DB variables only in its child. The e2e guard receives its
# original separate development/test identities, not the integration target.
export E2E_ENV_FILE=.local/ci/e2e.env
pnpm test:e2e:run
pnpm security:semgrep
pnpm security:dependencies
node scripts/ci/verify-exact-head.mjs
