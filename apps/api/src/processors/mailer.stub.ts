/**
 * @fileoverview In-memory mailer stub injected into the email processor. It
 * stands in for a real mail provider so the example never sends a live message:
 * every "send" is recorded into a bounded ring buffer and returns a synthetic
 * provider message id. The stub is deliberately synchronous and side-effect-free
 * beyond its own buffer, keeping the processor handlers pure and testable.
 * @layer app/processors
 */
import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'

/** Maximum number of send records retained; older records are evicted first. */
const SENT_BUFFER_CAPACITY = 500

/** A single recorded send: who it went to, which template, and when. */
export interface MailRecord {
  /** Recipient identifier or address the message was addressed to. */
  to: string
  /** Template (job name) that produced the message. */
  template: string
  /** ISO 8601 timestamp of when the send was recorded. */
  at: string
}

/** Result returned by {@link MailerStub.send}: the synthetic provider id. */
export interface MailResult {
  /** Synthetic provider message id for the recorded send. */
  messageId: string
}

/** Records simulated email sends in memory for inspection by the demo. */
@Injectable()
export class MailerStub {
  private readonly sent: MailRecord[] = []

  /**
   * Record a simulated send and return a synthetic provider message id. No real
   * message is dispatched: the record is appended to a bounded buffer so memory
   * stays flat regardless of how many jobs run.
   *
   * @param to - Recipient identifier or address for the message.
   * @param template - Template (job name) that produced the message.
   * @returns The synthetic provider message id.
   */
  send(to: string, template: string): MailResult {
    this.sent.push({ to, template, at: new Date().toISOString() })
    if (this.sent.length > SENT_BUFFER_CAPACITY) {
      this.sent.shift()
    }
    return { messageId: randomUUID() }
  }

  /**
   * Return a snapshot of the recorded sends, newest last.
   *
   * @returns A copy of the current send records; mutating it never affects the stub.
   */
  list(): readonly MailRecord[] {
    return [...this.sent]
  }
}
