/**
 * Unit tests for MailerStub.
 *
 * Layer: unit.
 * Goal: sends are recorded with a timestamp, a synthetic id is returned, and the
 * ring buffer stays bounded by evicting the oldest record.
 * Mocks: Date#toISOString pinned for a deterministic timestamp.
 */
import { jest } from '@jest/globals'
import { MailerStub } from './mailer.stub.js'

describe('MailerStub (unit)', () => {
  it('records a send with a timestamp and returns a synthetic message id', () => {
    /*
     * Scenario: a single send.
     * Rule it protects: the record captures `{ to, template, at }` and the
     * returned message id is a non-empty string standing in for a provider id.
     */
    const mailer = new MailerStub()
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-09T00:00:00.000Z')

    const result = mailer.send('user@example.com', 'send-receipt')

    expect(result.messageId).toEqual(expect.any(String))
    expect(result.messageId.length).toBeGreaterThan(0)
    expect(mailer.list()).toEqual([
      { to: 'user@example.com', template: 'send-receipt', at: '2026-07-09T00:00:00.000Z' },
    ])
  })

  it('returns a distinct message id per send', () => {
    /*
     * Scenario: two sends.
     * Rule it protects: each send mints its own provider id so callers can
     * correlate a specific dispatch.
     */
    const mailer = new MailerStub()

    const first = mailer.send('a@example.com', 'send-welcome')
    const second = mailer.send('b@example.com', 'send-welcome')

    expect(first.messageId).not.toEqual(second.messageId)
  })

  it('returns an independent snapshot from list', () => {
    /*
     * Scenario: a snapshot is taken, then another send happens.
     * Rule it protects: `list` returns a copy, so an earlier snapshot never
     * reflects later sends and callers cannot mutate the internal buffer.
     */
    const mailer = new MailerStub()
    mailer.send('a@example.com', 'send-welcome')

    const snapshot = mailer.list()
    mailer.send('b@example.com', 'send-welcome')

    expect(snapshot).toHaveLength(1)
    expect(mailer.list()).toHaveLength(2)
  })

  it('evicts the oldest record once capacity is exceeded', () => {
    /*
     * Scenario: more than the buffer capacity (500) of sends.
     * Rule it protects: memory stays bounded; the buffer keeps the newest 500 and
     * the very first record is evicted.
     */
    const mailer = new MailerStub()
    for (let index = 0; index <= 500; index += 1) {
      mailer.send(`user-${String(index)}@example.com`, 'send-receipt')
    }

    const records = mailer.list()

    expect(records).toHaveLength(500)
    expect(records[0]?.to).toBe('user-1@example.com')
    expect(records.at(-1)?.to).toBe('user-500@example.com')
  })
})
