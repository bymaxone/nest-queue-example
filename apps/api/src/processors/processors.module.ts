/**
 * @fileoverview Registers the queue processors and the in-memory audit trail.
 * The processor is discovered by the globally-registered queue library; the
 * trail is exported so read surfaces (the smoke controller) can inspect it.
 * @layer app/processors
 */
import { Module } from '@nestjs/common'
import { AuditTrail } from './audit-trail.service.js'
import { AuditProcessor } from './audit.processor.js'

/** Module holding the audit processor and its trail. */
@Module({
  providers: [AuditTrail, AuditProcessor],
  exports: [AuditTrail],
})
export class ProcessorsModule {}
