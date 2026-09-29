// Applies db/schema.sql to DATABASE_URL, one statement at a time (Neon's
// HTTP driver runs a single statement per query).
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.local or the environment.");
  process.exit(1);
}

const sql = neon(url);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(/;\s*$/m)
  .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log(`ok  ${statement.split("\n")[0]}`);
}
console.log(`Applied ${statements.length} statements.`);
