/**
 * Unit tests for OrdersRepository.
 *
 * Layer: unit.
 * Goal: orders are stored and retrieved; the store is bounded, evicting the
 * oldest entry past capacity; re-saving an existing id updates in place without
 * eviction.
 * Mocks: none (pure in-memory store).
 */
import 'reflect-metadata'
import { OrdersRepository } from './orders.repository.js'
import type { StoredOrder } from './orders.repository.js'

/** The repository's fixed capacity, mirrored here to drive the eviction test. */
const CAPACITY = 500

/**
 * Build a stored order with a deterministic id.
 *
 * @param id - The order id.
 * @returns A stored order fixture.
 */
function order(id: string): StoredOrder {
  return {
    id,
    to: `${id}@example.com`,
    total: 10,
    vip: false,
    createdAt: '2026-07-09T00:00:00.000Z',
  }
}

describe('OrdersRepository (unit)', () => {
  it('stores an order and reads it back by id', () => {
    /*
     * Scenario: save then find.
     * Rule it protects: a saved order is retrievable by its id and list reflects it.
     */
    const repo = new OrdersRepository()

    const saved = repo.save(order('a'))

    expect(saved.id).toBe('a')
    expect(repo.find('a')).toEqual(order('a'))
    expect(repo.list()).toHaveLength(1)
  })

  it('returns undefined for an unknown id', () => {
    /*
     * Scenario: find a missing order.
     * Rule it protects: the repository reports absence rather than throwing.
     */
    expect(new OrdersRepository().find('missing')).toBeUndefined()
  })

  it('evicts the oldest order once capacity is exceeded', () => {
    /*
     * Scenario: insert one more than the capacity.
     * Rule it protects: the store stays bounded and drops the oldest entry so a
     * long-running demo cannot grow without limit.
     */
    const repo = new OrdersRepository()
    for (let index = 0; index < CAPACITY + 1; index += 1) {
      repo.save(order(`id-${String(index)}`))
    }

    expect(repo.list()).toHaveLength(CAPACITY)
    expect(repo.find('id-0')).toBeUndefined()
    expect(repo.find(`id-${String(CAPACITY)}`)).toBeDefined()
  })

  it('updates an existing order in place without evicting', () => {
    /*
     * Scenario: fill to capacity, then re-save an existing id.
     * Rule it protects: overwriting an existing key is not a growth event, so it
     * must not evict a different entry.
     */
    const repo = new OrdersRepository()
    for (let index = 0; index < CAPACITY; index += 1) {
      repo.save(order(`id-${String(index)}`))
    }

    repo.save({ ...order('id-0'), total: 99 })

    expect(repo.list()).toHaveLength(CAPACITY)
    expect(repo.find('id-0')?.total).toBe(99)
  })
})
