/**
 * @fileoverview Registers the queue processors and their in-memory state. The
 * processor classes are discovered by the globally-registered queue library; the
 * audit trail and mailer stub are exported so read surfaces can inspect them.
 * @layer app/processors
 */
import { Module } from '@nestjs/common'
import { EventsModule } from '../events/events.module.js'
import { AuditTrail } from './audit-trail.service.js'
import { AuditProcessor } from './audit.processor.js'
import { EmailProcessor } from './email.processor.js'
import { MailerStub } from './mailer.stub.js'
import { ReportProcessor } from './report.processor.js'
import { StallProcessor } from './stall.processor.js'
import { WebhookLog } from './webhook-log.service.js'
import { WebhookProcessor } from './webhook.processor.js'

/**
 * Module holding the queue processors and their inspectable in-memory state.
 * Imports the events module so the processors can bridge worker-local and global
 * queue events into the shared feed.
 */
@Module({
  imports: [EventsModule],
  providers: [
    AuditTrail,
    AuditProcessor,
    MailerStub,
    EmailProcessor,
    WebhookLog,
    WebhookProcessor,
    ReportProcessor,
    StallProcessor,
  ],
  exports: [AuditTrail, MailerStub, WebhookLog],
})
export class ProcessorsModule {}
