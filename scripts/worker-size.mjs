// Fails when the built Worker is too big for the free plan, which allows
// 3 MB gzipped. It asks Wrangler for a dry run of the last `vite build`
// (nothing is uploaded) and reads the "gzip: N KiB" Wrangler prints, the
// same number Cloudflare checks. The limit sits below 3 MB (3,072 KiB) to
// leave warning room; raising it is a choice, with the reason in the commit.
import { execFileSync } from "node:child_process"

const LIMIT_KIB = 1280

const output = execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "deploy",
    "--dry-run",
    "--outdir",
    ".wrangler/size",
    "-c",
    "dist/server/wrangler.json",
  ],
  { encoding: "utf8" }
)
const match = /Total Upload: [\d.]+ KiB \/ gzip: ([\d.]+) KiB/.exec(output)
if (match === null) {
  console.error("Could not find the gzip size in Wrangler's output:\n" + output)
  process.exit(1)
}
const size = Number(match[1])
console.log(
  `Worker: ${size} KiB gzipped (limit ${LIMIT_KIB} KiB, free plan 3,072 KiB)`
)
if (size > LIMIT_KIB) {
  console.error(
    "The Worker is too big. Find what grew, or raise the limit on purpose."
  )
  process.exit(1)
}
