# Local Development

**Status:** Active extension. Local-runtime procedure detail for the architecture
contract; it does not define production topology.

Native PostgreSQL18 is the local default; use the host's own checkout/runtime.
Windows-native PostgreSQL is supported by the existing procedure; Docker/WSL
is not a mandatory local mode. The current local-postgres command verifies a
running owned loopback `_dev` database/role; it does not install/start a server.
Its stop command deliberately leaves the shared service running. Provision
native PostgreSQL separately before those checks; no production target.

Suggested local names:

- database: `ams_start_dev`;
- test database: `ams_start_test`;
- local role: `ams_start_local`;
- test role: `ams_start_test`.

Start:

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm dev
```

Optional managed launcher:

```bash
pnpm dev:db:status
pnpm dev:start
```

Direct `pnpm dev`: `http://127.0.0.1:3000`.
Managed `pnpm dev:start`: `http://127.0.0.1:3001`, requires .env.local and the
already running local database; health/service check prevents replacing an
unrelated occupied process. Complete DATABASE/auth inputs follow
[ENVIRONMENT](../ENVIRONMENT.md); migrations/bootstrap are explicit commands
against that owned local target. Bootstrap is transitional until complete
setup/MFA flow, not proof of production provisioning.
`pnpm test:integration` uses separate TEST_DATABASE inputs and destructive
safety preflight; never reuse development/production database or credentials.
 Open `/dashboard/` for private shell after login.
