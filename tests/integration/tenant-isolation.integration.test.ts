import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readTestDatabaseTarget } from "../../scripts/verify-test-database-env.mjs";

const target = readTestDatabaseTarget(process.env, { allowApplicationTarget: true });
const runtimeRole = "ams_start_web";
let fixtureClient: pg.Client;
let runtimeClient: pg.Client;
let organizationA: string;
let organizationB: string;
let projectA: string;
let projectB: string;

function createClient() {
  return new pg.Client({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    ssl: target.sslmode === "require",
  });
}

async function inTenantContext<T>(organizationId: string, execute: () => Promise<T>): Promise<T> {
  await runtimeClient.query("begin");
  try {
    await runtimeClient.query("select set_config('app.principal_kind', $1, true)", ["tenant-user"]);
    await runtimeClient.query("select set_config('app.actor_id', $1, true)", ["tenant-test-user"]);
    await runtimeClient.query("select set_config('app.organization_id', $1, true)", [organizationId]);
    await runtimeClient.query("select set_config('app.correlation_id', $1, true)", ["e03-tenant-isolation"]);
    const result = await execute();
    await runtimeClient.query("commit");
    return result;
  } catch (error) {
    await runtimeClient.query("rollback");
    throw error;
  }
}

describe("PostgreSQL tenant isolation", () => {
  beforeAll(async () => {
    fixtureClient = createClient();
    runtimeClient = createClient();
    await fixtureClient.connect();
    await runtimeClient.connect();
    await runtimeClient.query(`set role ${runtimeRole}`);

    const orgA = await fixtureClient.query(
      "insert into \"Organization\" (\"id\", \"name\", \"slug\", \"updatedAt\") values ($1, $2, $3, now()) returning \"id\"",
      ["e03-org-a", "E03 Organization A", "e03-org-a"],
    );
    const orgB = await fixtureClient.query(
      "insert into \"Organization\" (\"id\", \"name\", \"slug\", \"updatedAt\") values ($1, $2, $3, now()) returning \"id\"",
      ["e03-org-b", "E03 Organization B", "e03-org-b"],
    );
    organizationA = orgA.rows[0].id;
    organizationB = orgB.rows[0].id;
    const projects = await Promise.all([
      fixtureClient.query(
        "insert into \"Project\" (\"id\", \"organizationId\", \"slug\", \"name\", \"status\", \"updatedAt\") values ($1, $2, $3, $4, 'ACTIVE', now()) returning \"id\"",
        ["e03-project-a", organizationA, "e03-project-a", "E03 Project A"],
      ),
      fixtureClient.query(
        "insert into \"Project\" (\"id\", \"organizationId\", \"slug\", \"name\", \"status\", \"updatedAt\") values ($1, $2, $3, $4, 'ACTIVE', now()) returning \"id\"",
        ["e03-project-b", organizationB, "e03-project-b", "E03 Project B"],
      ),
    ]);
    projectA = projects[0].rows[0].id;
    projectB = projects[1].rows[0].id;
  });

  afterAll(async () => {
    await runtimeClient.end();
    await fixtureClient.end();
  });

  it("defaults to deny without transaction-local tenant context", async () => {
    const result = await runtimeClient.query("select \"id\" from \"Project\" order by \"id\"");
    expect(result.rows).toEqual([]);
  });

  it("allows only the selected tenant and clears context on commit", async () => {
    const result = await inTenantContext(organizationA, () =>
      runtimeClient.query("select \"id\" from \"Project\" order by \"id\""),
    );
    expect(result.rows.map((row) => row.id)).toEqual([projectA]);
    const [{ organization_id: organizationIdAfterCommit }] = (
      await runtimeClient.query("select current_setting('app.organization_id', true) as organization_id")
    ).rows;
    expect(organizationIdAfterCommit).toBeFalsy();
  });

  it("silently rejects cross-tenant reads and writes under RLS", async () => {
    const result = await inTenantContext(organizationA, () =>
      runtimeClient.query("update \"Project\" set \"name\" = $1 where \"id\" = $2", ["must not write", projectB]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("rejects a cross-tenant relation at the database constraint", async () => {
    await expect(
      fixtureClient.query(
        "insert into \"Notification\" (\"id\", \"organizationId\", \"projectId\", \"category\", \"severity\", \"visibility\", \"title\", \"message\", \"sourceType\", \"dedupKey\", \"occurredAt\") values ($1, $2, $3, 'PROJECT', 'INFO', 'PLATFORM_TEAM', 'E03', 'cross tenant', 'test', $4, now())",
        ["e03-cross-tenant-notification", organizationA, projectB, "e03-cross-tenant-notification"],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("keeps runtime identities non-owner and unable to bypass RLS", async () => {
    const { rows } = await fixtureClient.query(
      "select rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls from pg_roles where rolname = any($1::text[]) order by rolname",
      [["ams_start_backup", "ams_start_migrator", "ams_start_web", "ams_start_worker"]],
    );
    expect(rows).toHaveLength(4);
    for (const role of rows) {
      expect(role.rolcanlogin).toBe(true);
      expect(role.rolsuper).toBe(false);
      expect(role.rolcreaterole).toBe(false);
      expect(role.rolbypassrls).toBe(false);
    }
  });

  it("gives each runtime role only the tables required by its contract", async () => {
    const webTables = [
      "User", "Session", "Account", "Verification", "TwoFactor", "RateLimit",
      "AccountSetupToken", "PlatformRecoveryToken",
    ];
    const [{ web_auth_tables: webAuthTables, web_runtime_heartbeat: webRuntimeHeartbeat, worker_user_table: workerUserTable, worker_runtime_heartbeat: workerRuntimeHeartbeat }] = (
      await fixtureClient.query(
        `select
          bool_and(has_table_privilege('ams_start_web', format('%I', table_name), 'SELECT, INSERT, UPDATE, DELETE')) as web_auth_tables,
          has_table_privilege('ams_start_web', '"RuntimeHeartbeat"', 'SELECT') as web_runtime_heartbeat,
          has_table_privilege('ams_start_worker', '"User"', 'SELECT') as worker_user_table,
          has_table_privilege('ams_start_worker', '"RuntimeHeartbeat"', 'SELECT, INSERT, UPDATE, DELETE') as worker_runtime_heartbeat
        from unnest($1::text[]) as table_name`,
        [webTables],
      )
    ).rows;

    expect(webAuthTables).toBe(true);
    expect(webRuntimeHeartbeat).toBe(true);
    expect(workerUserTable).toBe(false);
    expect(workerRuntimeHeartbeat).toBe(true);
  });
});
