import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

// Escapes a value for use as a single-quoted SQL string literal. Sufficient
// for the trusted, locally-sourced (.env) values this script handles — this
// is an admin/deploy script, not a path that touches attacker-controlled input.
function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

// Ensures the `nexa_app` runtime role exists with the password from
// NEXA_APP_DB_PASSWORD and no bypass privileges. Run BEFORE the RLS SQL files,
// which assume the role already exists — a role password is a secret and
// must never live in a source-controlled .sql file.
async function ensureAppRole(client: Client): Promise<void> {
  const password = process.env.NEXA_APP_DB_PASSWORD;
  if (!password) {
    throw new Error("NEXA_APP_DB_PASSWORD must be set to provision the nexa_app database role.");
  }

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexa_app') THEN
        CREATE ROLE nexa_app LOGIN;
      END IF;
    END
    $$;
  `);

  await client.query(
    `ALTER ROLE nexa_app WITH LOGIN PASSWORD '${escapeLiteral(password)}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
  );

  // eslint-disable-next-line no-console
  console.log("Provisioned nexa_app role.");
}

// Applies every SQL file in prisma/rls/, in filename order, using a
// privileged connection (DIRECT_DATABASE_URL — the same owner connection
// used for `prisma migrate deploy`, since creating roles/policies/functions
// requires elevated privileges that the runtime `nexa_app` role must NOT have).
async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_DATABASE_URL (or DATABASE_URL) must be set to apply RLS policies.",
    );
  }

  const rlsDir = join(__dirname, "..", "prisma", "rls");
  const files = readdirSync(rlsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No RLS SQL files found in ${rlsDir}`);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureAppRole(client);
    for (const file of files) {
      const sql = readFileSync(join(rlsDir, file), "utf8");
      // eslint-disable-next-line no-console
      console.log(`Applying RLS policy file: ${file}`);
      await client.query(sql);
    }
    // eslint-disable-next-line no-console
    console.log(`Applied ${files.length} RLS policy file(s) successfully.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Failed to apply RLS policies:", error);
  process.exitCode = 1;
});
