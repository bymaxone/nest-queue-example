#!/usr/bin/env node
/**
 * @fileoverview Runs every e2e spec file as its own, separate Jest process.
 *
 * Each spec boots a full application (or several isolated ones) against real
 * Redis under Node's `--experimental-vm-modules` ESM support. Running all spec
 * files inside one Jest process (even with `maxWorkers: 1`, which still shares
 * a single Node process across files) compounds that experimental VM-module
 * loader's per-module bookkeeping as more application graphs are loaded one
 * after another, and wall time grows sharply after a handful of files. Giving
 * every spec file its own fresh Node process resets that state between files
 * and keeps each run's cost proportional to that one file, matching the
 * per-file timing already verified when specs run individually or in small
 * groups.
 * @layer scripts
 */
import { spawnSync } from 'node:child_process'
import console from 'node:console'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const testDir = join(apiRoot, 'test')

const specFiles = readdirSync(testDir)
  .filter((name) => name.endsWith('.e2e-spec.ts'))
  .sort()
  .map((name) => join('test', name))

if (specFiles.length === 0) {
  throw new Error(`No *.e2e-spec.ts files found under ${testDir}`)
}

let failures = 0
for (const specFile of specFiles) {
  console.log(`\n--- e2e: ${specFile} ---`)
  // `NODE_OPTIONS` (including `--experimental-vm-modules`) is already set by
  // the `test:e2e` script and inherited here via `process.env`.
  const result = spawnSync('pnpm', ['exec', 'jest', '--config', 'jest.e2e.config.cjs', specFile], {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    failures += 1
  }
}

if (failures > 0) {
  console.error(`\n${String(failures)} of ${String(specFiles.length)} e2e spec file(s) failed.`)
  process.exit(1)
}
console.log(`\nAll ${String(specFiles.length)} e2e spec files passed.`)
