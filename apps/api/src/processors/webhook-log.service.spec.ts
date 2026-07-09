/**
 * Unit tests for WebhookLog.
 *
 * Layer: unit.
 * Goal: successful deliveries are recorded and the ring buffer stays bounded.
 * Mocks: none.
 */
import { WebhookLog } from './webhook-log.service.js'

describe('WebhookLog (unit)', () => {
  it('records a delivery and returns it in a snapshot', () => {
    /*
     * Scenario: a single successful delivery.
     * Rule it protects: the record is retained verbatim and surfaced by `list`.
     */
    const log = new WebhookLog()

    log.record({ orderId: 'o1', attempts: 3, at: '2026-07-09T00:00:00.000Z' })

    expect(log.list()).toEqual([{ orderId: 'o1', attempts: 3, at: '2026-07-09T00:00:00.000Z' }])
  })

  it('returns an independent snapshot from list', () => {
    /*
     * Scenario: a snapshot is taken, then another delivery is recorded.
     * Rule it protects: `list` returns a copy, so callers cannot mutate the buffer.
     */
    const log = new WebhookLog()
    log.record({ orderId: 'o1', attempts: 1, at: 'a' })

    const snapshot = log.list()
    log.record({ orderId: 'o2', attempts: 1, at: 'b' })

    expect(snapshot).toHaveLength(1)
    expect(log.list()).toHaveLength(2)
  })

  it('evicts the oldest record once capacity is exceeded', () => {
    /*
     * Scenario: more than the buffer capacity (500) of deliveries.
     * Rule it protects: memory stays bounded; the buffer keeps the newest 500 and
     * the first record is evicted.
     */
    const log = new WebhookLog()
    for (let index = 0; index <= 500; index += 1) {
      log.record({ orderId: `o-${String(index)}`, attempts: 1, at: 'x' })
    }

    const records = log.list()

    expect(records).toHaveLength(500)
    expect(records[0]?.orderId).toBe('o-1')
    expect(records.at(-1)?.orderId).toBe('o-500')
  })
})
