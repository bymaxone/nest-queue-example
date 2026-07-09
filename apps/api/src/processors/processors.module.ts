/**
 * @fileoverview Registers the queue processors and their in-memory state. The
 * processor classes are discovered by the globally-registered queue library; the
 * audit trail and mailer stub are exported so read surfaces can inspect them.
 * @layer app/processors
 */
import { Module } from '@nestjs/common'
import { AuditTrail } from './audit-trail.service.js'
import { AuditProcessor } from './audit.processor.js'
import { EmailProcessor } from './email.processor.js'
import { MailerStub } from './mailer.stub.js'

/** Module holding the queue processors and their inspectable in-memory state. */
@Module({
  providers: [AuditTrail, AuditProcessor, MailerStub, EmailProcessor],
  exports: [AuditTrail, MailerStub],
})
export class ProcessorsModule {}
