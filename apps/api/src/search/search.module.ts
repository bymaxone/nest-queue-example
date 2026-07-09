/**
 * @fileoverview Search feature module exposing the deduplication laboratory.
 * Injects the globally-registered `QueueService` without importing the queue
 * module.
 * @layer app/search
 */
import { Module } from '@nestjs/common'
import { ReindexController } from './reindex.controller.js'
import { ReindexService } from './reindex.service.js'

/** Module exposing the search reindex endpoint. */
@Module({
  controllers: [ReindexController],
  providers: [ReindexService],
})
export class SearchModule {}
