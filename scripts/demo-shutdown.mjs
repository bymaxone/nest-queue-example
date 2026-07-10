/**
 * @fileoverview Graceful-shutdown demonstration. Boots the built API as a child
 * process, enqueues a slow report job, sends SIGTERM mid-job, and asserts the
 * process drains the in-flight work and exits cleanly within the drain budget.
 *
 * Prerequisites: `pnpm --filter @nest-queue-example/api build` has produced
 * `apps/api/dist/main.js`, and a Redis is reachable at REDIS_URL. Prints PASS or
 * FAIL and exits non-zero on failure so it can gate a pipeline.
 *
 * Overridable via env: DEMO_PORT, REDIS_URL, QUEUE_PREFIX.
 */
import { spawn } from 'node:child_process'
import { request } from 'node:http'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const API_ENTRY = resolve(REPO_ROOT, 'apps', 'api', 'dist', 'main.js')

const PORT = process.env.DEMO_PORT ?? '3091'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0'
const QUEUE_PREFIX = process.env.QUEUE_PREFIX ?? 'nqex-shutdown-demo'
const DRAIN_TIMEOUT_MS = 30_000
const EXIT_MARGIN_MS = 10_000
const READY_TIMEOUT_MS = 20_000
const SIGTERM_DELAY_MS = 1_000
const POLL_INTERVAL_MS = 250
const REQUEST_TIMEOUT_MS = 2_000
const FLUSH_DELAY_MS = 300
const SHUTDOWN_LINE = /shutdown|drain|stalled|terminating/i
// The library logs this once every in-flight worker drained without a forced close.
const GRACEFUL_DRAIN_LINE = /shutdown complete.*forced 0 worker/i

/**
 * Write a line to stdout.
 *
 * @param {string} message - The line to print.
 */
function log(message) {
  process.stdout.write(`${message}\n`)
}

/**
 * Issue a request to the child API and resolve with its status code.
 *
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @returns {Promise<number>} The response status code.
 */
function httpStatus(method, path) {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request(
      { host: '127.0.0.1', port: PORT, path, method, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        res.resume()
        res.on('end', () => {
          resolvePromise(res.statusCode ?? 0)
        })
      },
    )
    req.on('error', rejectPromise)
    req.on('timeout', () => {
      req.destroy(new Error('request timeout'))
    })
    req.end()
  })
}

/**
 * Poll the readiness endpoint until it reports healthy or the timeout elapses.
 *
 * @returns {Promise<void>} Resolves once the API is ready.
 */
async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      if ((await httpStatus('GET', '/health/ready')) === 200) {
        return
      }
    } catch {
      /* API not accepting connections yet; keep polling. */
    }
    await delay(POLL_INTERVAL_MS)
  }
  throw new Error('API did not become ready in time')
}

/**
 * Forward the child's shutdown-relevant log lines with a prefix and report
 * whether the library logged a graceful (zero-forced) drain.
 *
 * @param {import('node:child_process').ChildProcessByStdio<null, import('node:stream').Readable, import('node:stream').Readable>} child - The spawned API process.
 * @returns {{ drainedGracefully: () => boolean }} A probe for the graceful-drain signal.
 */
function forwardShutdownLogs(child) {
  let hasDrained = false
  const relay = (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (SHUTDOWN_LINE.test(line)) {
        log(`[api] ${line.trim()}`)
      }
      if (GRACEFUL_DRAIN_LINE.test(line)) {
        hasDrained = true
      }
    }
  }
  child.stdout.on('data', relay)
  child.stderr.on('data', relay)
  return { drainedGracefully: () => hasDrained }
}

/**
 * Spawn the built API as a child process with the demo environment.
 *
 * @returns {import('node:child_process').ChildProcessByStdio<null, import('node:stream').Readable, import('node:stream').Readable>} The spawned process.
 */
function spawnApi() {
  return spawn(process.execPath, [API_ENTRY], {
    env: {
      ...process.env,
      PORT,
      REDIS_URL,
      QUEUE_PREFIX,
      QUEUE_DRAIN_TIMEOUT_MS: String(DRAIN_TIMEOUT_MS),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * Resolve once the child process exits, with its exit code and signal.
 *
 * @param {import('node:child_process').ChildProcess} child - The spawned process.
 * @returns {Promise<{ code: number | null, signal: NodeJS.Signals | null }>} The exit outcome.
 */
function awaitExit(child) {
  return new Promise((resolvePromise) => {
    child.on('exit', (code, signal) => {
      resolvePromise({ code, signal })
    })
  })
}

/**
 * Report PASS/FAIL for a completed shutdown. Nest runs its drain hooks then
 * re-raises the signal, so a graceful shutdown exits via SIGTERM (or code 0),
 * not a forced kill; success is a zero-forced drain plus that prompt exit.
 *
 * @param {{ code: number | null, signal: NodeJS.Signals | null }} outcome - The exit outcome.
 * @param {number} elapsed - Milliseconds from SIGTERM to exit.
 * @param {boolean} drainedGracefully - Whether the library logged a zero-forced drain.
 * @returns {number} 0 on success, 1 otherwise.
 */
function reportOutcome(outcome, elapsed, drainedGracefully) {
  const isHandledSignalExit = outcome.code === 0 || outcome.signal === 'SIGTERM'
  const suffix = `code ${String(outcome.code)} / signal ${String(outcome.signal)}`
  if (drainedGracefully && isHandledSignalExit) {
    log(
      `PASS: drained in-flight work with zero forced workers and exited in ${String(elapsed)}ms (${suffix})`,
    )
    return 0
  }
  log(
    `FAIL: graceful drain not confirmed (${suffix}, drained=${String(drainedGracefully)}) after ${String(elapsed)}ms`,
  )
  return 1
}

/**
 * Enqueue a slow job, send SIGTERM mid-job, and evaluate the shutdown.
 *
 * @param {import('node:child_process').ChildProcess} child - The spawned process.
 * @param {{ drainedGracefully: () => boolean }} logs - The shutdown-log probe.
 * @param {Promise<{ code: number | null, signal: NodeJS.Signals | null }>} exited - The exit outcome promise.
 * @returns {Promise<number>} 0 on a clean drained shutdown, 1 otherwise.
 */
async function driveShutdown(child, logs, exited) {
  await waitForReady()
  log('API ready; enqueuing a slow report job ...')
  await httpStatus('POST', '/reports')
  await delay(SIGTERM_DELAY_MS)
  log('Sending SIGTERM mid-job ...')
  const sentAt = Date.now()
  child.kill('SIGTERM')

  const timedOut = Symbol('timed-out')
  const outcome = await Promise.race([exited, delay(DRAIN_TIMEOUT_MS + EXIT_MARGIN_MS, timedOut)])
  const elapsed = Date.now() - sentAt
  if (outcome === timedOut) {
    log(`FAIL: process did not exit within ${String(DRAIN_TIMEOUT_MS + EXIT_MARGIN_MS)}ms`)
    return 1
  }
  await delay(FLUSH_DELAY_MS)
  return reportOutcome(outcome, elapsed, logs.drainedGracefully())
}

/**
 * Run the demonstration and return a process exit code, force-killing the child
 * if it is somehow still alive when the run ends.
 *
 * @returns {Promise<number>} 0 on a clean drained shutdown, 1 otherwise.
 */
async function run() {
  log(`Starting API on port ${PORT} (drain budget ${String(DRAIN_TIMEOUT_MS)}ms) ...`)
  const child = spawnApi()
  const logs = forwardShutdownLogs(child)
  const exited = awaitExit(child)
  try {
    return await driveShutdown(child, logs, exited)
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
  }
}

try {
  process.exitCode = await run()
} catch (error) {
  log(`FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
