/**
 * @fileoverview E2E: the three boot-time connection failures the library's
 * `ConnectionResolver` raises: a malformed Mode-A client, an unreachable Mode-B
 * host, and a Mode-A client wrapper that defeats the `maxRetriesPerRequest: null`
 * override. Covers the connection-bootstrap half of spec §7 matrix row 67.
 * @layer test/e2e
 */
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import type { Server, Socket } from 'node:net'
import { Test } from '@nestjs/testing'
import { Redis } from 'ioredis'
import { BymaxQueueModule } from '@bymax-one/nest-queue'
import type { BymaxQueueModuleOptions } from '@bymax-one/nest-queue'
import { e2eRedisUrl } from './support/test-app.js'

/**
 * Boot a minimal module and expect either `compile()` or `init()` to reject;
 * the library's `ConnectionResolver` factory runs eagerly during container
 * instantiation, so a connection failure can surface at either step depending
 * on the DI graph shape.
 *
 * @param connection - The module's connection configuration to test.
 * @param connectionReadyTimeoutMs - Overrides the library's Mode-B ready budget
 *   (default 10s) so a deliberately-unreachable-host spec stays fast.
 */
async function expectBootstrapRejection(
  connection: BymaxQueueModuleOptions['connection'],
  connectionReadyTimeoutMs?: number,
): Promise<unknown> {
  let caught: unknown
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BymaxQueueModule.forRoot({
          connection,
          prefix: `e2e-conn-${randomUUID().slice(0, 8)}`,
          ...(connectionReadyTimeoutMs === undefined ? {} : { connectionReadyTimeoutMs }),
        }),
      ],
    }).compile()
    const app = moduleRef.createNestApplication()
    await app.init()
    await app.close()
  } catch (error) {
    caught = error
  }
  return caught
}

/**
 * Once the client has had time to time out and reject on its own (the
 * library's outer race timer), reset the connection from the server side so
 * the client's socket errors out and its handle is released. Without this,
 * ioredis has no built-in timeout for "TCP connected but the handshake never
 * arrives", so an abandoned socket would otherwise sit half-open forever.
 */
const RESET_AFTER_MS = 1200

/**
 * Start a bare TCP server that accepts connections but never speaks the Redis
 * protocol, so a client that connects to it can complete the TCP handshake yet
 * never reach `ready`; a deterministic, network-independent way to provoke the
 * library's `connection_timeout` path without depending on a real unreachable host.
 *
 * @returns The listening server, the port it bound to, and a `stop` that tears
 *   down the server and any sockets it accepted.
 */
async function startSilentServer(): Promise<{ server: Server; port: number; stop: () => void }> {
  const openSockets = new Set<Socket>()
  const server = createServer((socket) => {
    openSockets.add(socket)
    socket.on('error', () => undefined)
    const resetTimer = setTimeout(() => {
      socket.destroy()
    }, RESET_AFTER_MS)
    socket.on('close', () => {
      clearTimeout(resetTimer)
      openSockets.delete(socket)
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('expected a bound TCP address')
  }
  // Destroy every accepted socket before closing the server: `server.close()`
  // alone keeps live sockets open until their own reset timer fires, so an
  // abandoned half-open connection could otherwise hold the process open and
  // defeat the contract this `stop` documents.
  const stop = (): void => {
    for (const socket of openSockets) {
      socket.destroy()
    }
    server.close()
  }
  return { server, port: address.port, stop }
}

describe('connection (e2e)', () => {
  it('fails fast with connection_invalid for a Mode-A client that is not ready or connecting', async () => {
    // Scenario: Mode A with a lazily-connected (not-yet-connecting) client.
    // Rule it protects: the resolver checks client.status before adopting it,
    // failing fast with queue.connection_invalid rather than a later crash.
    const client = new Redis(e2eRedisUrl(), { lazyConnect: true })
    try {
      const caught = await expectBootstrapRejection({ client })
      expect(caught).toMatchObject({ response: { error: { code: 'queue.connection_invalid' } } })
    } finally {
      client.disconnect()
    }
  })

  it('fails fast with connection_timeout when Mode B never reaches ready within the budget', async () => {
    // Scenario: Mode B against a host that completes the TCP handshake but
    // never speaks the Redis protocol.
    // Rule it protects: the library's own connectionReadyTimeoutMs race fires
    // queue.connection_timeout rather than hanging bootstrap forever.
    const { port, stop } = await startSilentServer()
    try {
      const caught = await expectBootstrapRejection(
        {
          url: `redis://127.0.0.1:${String(port)}`,
          // A single connect attempt: the silent server never completes the
          // Redis handshake, so a retrying client would reconnect forever. The
          // library's own `connectionReadyTimeoutMs` (below) is what the assert
          // actually races against.
          options: { connectTimeout: 500, retryStrategy: () => null, maxRetriesPerRequest: 0 },
        },
        1000,
      )
      expect(caught).toMatchObject({ response: { error: { code: 'queue.connection_timeout' } } })
    } finally {
      stop()
    }
  }, 15000)

  it('fails fast with connection_requires_null_retries when a client wrapper defeats the duplicate() override', async () => {
    // Scenario: Mode A with a client whose duplicate() ignores the library's
    // requested maxRetriesPerRequest: null override.
    // Rule it protects: onModuleInit probes the duplicated worker connection and
    // fails fast with queue.connection_requires_null_retries rather than letting
    // BullMQ crash later at Worker construction.
    const real = new Redis(e2eRedisUrl())
    await new Promise<void>((resolve, reject) => {
      real.once('ready', resolve)
      real.once('error', reject)
    })
    // A minimal Mode-A client stand-in: `status` reports ready so the resolver
    // adopts it, but `duplicate()` ignores the null override the library
    // requests, mimicking a wrapper client that does not honor it.
    const wrapper = {
      status: 'ready',
      duplicate: () => real.duplicate({ maxRetriesPerRequest: 20 }),
    } as unknown as Redis
    try {
      const caught = await expectBootstrapRejection({ client: wrapper })
      expect(caught).toMatchObject({
        response: { error: { code: 'queue.connection_requires_null_retries' } },
      })
    } finally {
      await real.quit().catch(() => undefined)
    }
  })
})
