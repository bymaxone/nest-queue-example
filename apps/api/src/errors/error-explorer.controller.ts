/**
 * @fileoverview Error-explorer HTTP surface. `GET /errors/catalog` lists every
 * `QUEUE_ERROR_CODES` member with its status and reproducibility; `POST
 * /errors/trigger/:code` provokes a reproducible code for real and lets the
 * library's stable envelope propagate. Non-reproducible codes are rejected with a
 * pointer to where they are covered, never echoing raw request input.
 * @layer app/errors
 */
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import type { HttpException } from '@nestjs/common'
import { z } from 'zod'
import { parseRequest } from '../http/validation.js'
import { isReproducibleCode } from './error-catalog.js'
import type { CatalogEntry } from './error-catalog.js'
import { ErrorExplorerService } from './error-explorer.service.js'

/** Highest supported `invalid_repeat_options` variant index. */
const MAX_VARIANT = 3

/** Query accepted by the trigger route: an optional variant selector. */
const triggerQuerySchema = z.object({
  variant: z.coerce.number().int().min(0).max(MAX_VARIANT).default(0),
})

/** Inspectable error catalog and reproducible-code triggers. */
@Controller('errors')
export class ErrorExplorerController {
  constructor(private readonly explorer: ErrorExplorerService) {}

  /**
   * GET /errors/catalog - the full catalog with statuses and reproducibility flags.
   *
   * @returns One entry per `QUEUE_ERROR_CODES` member.
   */
  @Get('catalog')
  catalog(): CatalogEntry[] {
    return this.explorer.catalog()
  }

  /**
   * POST /errors/trigger/:code - provoke a reproducible code for real. The thrown
   * `QueueException` renders the library's stable envelope with the correct status.
   *
   * @param code - The catalog code to trigger.
   * @param query - Unvalidated query; the optional `variant` selects a sub-case.
   * @returns Never resolves; a reproducible code always throws.
   * @throws {NotFoundException} When the code is not in the catalog.
   * @throws {BadRequestException} When the code exists but is not reproducible here.
   * @throws {QueueException} The library's stable envelope for a reproducible code.
   */
  @Post('trigger/:code')
  trigger(@Param('code') code: string, @Query() query: unknown): Promise<never> {
    if (isReproducibleCode(code)) {
      const { variant } = parseRequest(triggerQuerySchema, query)
      return this.explorer.trigger(code, variant)
    }
    throw this.rejectNonReproducible(code)
  }

  /**
   * Reject a non-reproducible request without echoing raw input: report a known
   * catalog code and where it is covered, or a generic not-found for an unknown one.
   *
   * @param code - The requested code (looked up in the catalog, never reflected raw).
   * @returns The exception to throw for the rejected request.
   */
  private rejectNonReproducible(code: string): HttpException {
    const entry = this.explorer.catalog().find((candidate) => candidate.code === code)
    if (entry === undefined) {
      return new NotFoundException({
        error: { code: 'errors.unknown_code', message: 'Unknown error code', details: null },
      })
    }
    return new BadRequestException({
      error: {
        code: 'errors.not_reproducible',
        message: 'This code is covered outside the error explorer',
        details: { code: entry.code, coveredBy: entry.coveredBy },
      },
    })
  }
}
