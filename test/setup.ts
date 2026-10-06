import { applyD1Migrations, env } from "cloudflare:test";

// Runs before every test file. Migrations already applied are skipped, so this
// is cheap after the first file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
