// PostToolUse: oxfmt + oxlint --fix on the one file just edited. Fast and local;
// remaining lint errors go back to the agent (exit 2). Never touches .env*.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
let file
try {
  file = JSON.parse(readFileSync(0, "utf8")).tool_input?.file_path
} catch {
  process.exit(0)
}
if (
  !file ||
  !existsSync(file) ||
  /(^|\/)\.env/.test(file) ||
  file.includes("node_modules") ||
  // What lint ignores: docs, Claude's own files, local output.
  /\/(docs|\.claude|artifacts)\//.test(file)
)
  process.exit(0)
const bin = (b) => join(root, "node_modules/.bin", b)
if (
  /\.(ts|tsx|js|mjs|cjs|jsx|css|json|md)$/.test(file) &&
  existsSync(bin("oxfmt"))
) {
  try {
    execFileSync(bin("oxfmt"), [file], { cwd: root, stdio: "ignore" })
  } catch {}
}
if (!/\.(ts|tsx|js|mjs|jsx)$/.test(file) || !existsSync(bin("oxlint")))
  process.exit(0)
try {
  execFileSync(bin("oxlint"), ["--fix", "--quiet", file], {
    cwd: root,
    stdio: "pipe",
  })
} catch (e) {
  process.stderr.write(
    `oxlint: ${relative(root, file)}\n${String(e.stdout || "").slice(0, 4000)}`
  )
  process.exit(2)
}
