#!/usr/bin/env node
/**
 * @fileoverview Copies the built sandboxed invoice processor next to its
 * TypeScript source so the e2e suite can register and run it for real.
 *
 * `SandboxedBootstrapService` resolves the processor file relative to
 * `import.meta.url` of the *module that registers it* (see the library's
 * `registerSandboxed` contract). In production that module is the compiled
 * `dist/workers/sandboxed-bootstrap.service.js`, so the sibling
 * `dist/workers/invoice.sandboxed.js` resolves correctly. Under the e2e tier,
 * ts-jest transpiles TypeScript in memory without emitting to `dist/`, so
 * `import.meta.url` points at `src/workers/sandboxed-bootstrap.service.ts`
 * instead; the sibling artifact must exist in `src/` for that same-directory
 * resolution to find it. This script copies the already-built artifact there
 * right before the e2e suite runs; it is never committed (see `.gitignore`).
 * @layer scripts
 */
import console from 'node:console'
import { copyFile, mkdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(apiRoot, 'dist', 'workers', 'invoice.sandboxed.js')
const destination = join(apiRoot, 'src', 'workers', 'invoice.sandboxed.js')

async function main() {
  try {
    await access(source)
  } catch {
    throw new Error(
      `Missing build output at ${source}. Run "pnpm build" before the e2e suite ` +
        'so the sandboxed invoice processor artifact exists.',
    )
  }
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
  console.log(`Sandboxed invoice processor artifact staged at ${destination}`)
}

await main()
