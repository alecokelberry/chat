// Backs up the D1 database: `pnpm db:export` (live) or `pnpm db:export
// --local`. Writes one .sql file of data only into backups/ (ignored, never
// committed), named for its source and time.
//
// `wrangler d1 export` refuses a whole database that holds a virtual table
// (Search's FTS5 index), so this asks D1 for its tables and exports each
// real one by name. It leaves out, by rule rather than by name: virtual
// tables and their shadow tables (named `<virtual table>_…`), SQLite's and
// Cloudflare's own tables, and d1_migrations. The schema isn't in the file
// either: a restore makes it with `wrangler d1 migrations apply`, and as
// the rows go back in, the triggers rebuild Search's index (README.md).
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"

const DATABASE = "chat"
const where = process.argv.includes("--local") === true ? "--local" : "--remote"

const wrangler = (args) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  })

const [{ results: tables }] = JSON.parse(
  wrangler([
    "d1",
    "execute",
    DATABASE,
    where,
    "--json",
    "--command",
    "SELECT name, sql FROM sqlite_master WHERE type = 'table'",
  ])
)

const names = tables.map(({ name }) => String(name))
const virtual = tables
  .filter(
    ({ sql }) => typeof sql === "string" && /^CREATE VIRTUAL TABLE/i.test(sql)
  )
  .map(({ name }) => String(name))
const skipped = new Set(
  names.filter(
    (name) =>
      /^(sqlite_|_cf_)/.test(name) ||
      name === "d1_migrations" ||
      virtual.some((table) => name === table || name.startsWith(`${table}_`))
  )
)
const real = names.filter((name) => !skipped.has(name))

mkdirSync("backups", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const output = `backups/${DATABASE}-${where.slice(2)}-${stamp}.sql`
wrangler([
  "d1",
  "export",
  DATABASE,
  where,
  "--no-schema",
  ...real.flatMap((name) => ["--table", name]),
  "--output",
  output,
  ...(where === "--remote" ? ["--skip-confirmation"] : []),
])
console.log(`Backed up ${real.length} tables to ${output}`)
