/**
 * Integration test for bullmq-otel span propagation.
 *
 * Layer: integration.
 * Goal: with telemetry attached, an enqueue-process cycle produces at least one
 * OpenTelemetry span, captured by an in-memory exporter.
 * Mocks: none - a real BullMQ Queue/Worker against Redis. Skips (soft) when Redis
 * is unreachable so the Docker-free unit tier and CI stay green. Imports no app
 * source, so it does not affect coverage; bullmq-otel is loaded dynamically to
 * honour the no-top-level-import gate.
 */
import 'reflect-metadata'
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import type { RedisOptions } from 'ioredis'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

/** Connection target parsed from REDIS_URL, defaulting to the compose Redis. */
function redisTarget(): { host: string; port: number } {
  const parsed = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379')
  return { host: parsed.hostname, port: parsed.port === '' ? 6379 : Number(parsed.port) }
}

/** Probe Redis with a short timeout so an unreachable backend skips fast. */
async function isRedisReachable(): Promise<boolean> {
  const client = new Redis({
    ...redisTarget(),
    lazyConnect: true,
    connectTimeout: 800,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  })
  try {
    await client.connect()
    return true
  } catch {
    return false
  } finally {
    client.disconnect()
  }
}

const QUEUE_NAME = 'errors-otel-probe'
const WAIT_MS = 5000

describe('bullmq-otel span propagation (integration)', () => {
  let redisUp = false

  beforeAll(async () => {
    redisUp = await isRedisReachable()
  })

  it('records at least one span across an enqueue-process cycle', async () => {
    /*
     * Scenario: a job enqueued and processed with telemetry attached.
     * Rule it protects: BullMQ, given a bullmq-otel Telemetry instance, emits spans
     * that reach the in-memory exporter, proving trace context propagates.
     */
    if (!redisUp) {
      return
    }
    const exporter = new InMemorySpanExporter()
    const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
    provider.register()
    const { BullMQOtel } = await import('bullmq-otel')
    const telemetry = new BullMQOtel('nest-queue-example-otel-test')
    const connection: RedisOptions = { ...redisTarget(), maxRetriesPerRequest: null }
    const queue = new Queue(QUEUE_NAME, { connection, telemetry, prefix: 'nqex-otel' })
    const worker = new Worker(QUEUE_NAME, () => Promise.resolve('done'), {
      connection,
      telemetry,
      prefix: 'nqex-otel',
    })

    try {
      const completed = new Promise<void>((resolve, reject) => {
        worker.on('completed', () => {
          resolve()
        })
        setTimeout(() => {
          reject(new Error('job did not complete within the budget'))
        }, WAIT_MS)
      })
      await queue.add('probe', { at: Date.now() })
      await completed
      await provider.forceFlush()

      expect(exporter.getFinishedSpans().length).toBeGreaterThan(0)
    } finally {
      await worker.close()
      await queue.obliterate({ force: true })
      await queue.close()
      await provider.shutdown()
    }
  }, 15000)
})
