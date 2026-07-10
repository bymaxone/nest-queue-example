/**
 * Unit tests for ErrorExplorerController.
 *
 * Layer: unit.
 * Goal: the catalog is served, reproducible codes are dispatched with a validated
 * variant, and non-reproducible or unknown codes are rejected without echoing raw
 * input.
 * Mocks: a spyable ErrorExplorerService.
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { QUEUE_ERROR_CODES, QueueException } from '@bymax-one/nest-queue'
import { ErrorExplorerController } from './error-explorer.controller.js'
import { ErrorExplorerService } from './error-explorer.service.js'
import { buildCatalog } from './error-catalog.js'
import type { CatalogEntry } from './error-catalog.js'

/**
 * Build the controller with a spyable service.
 *
 * @returns The controller and the catalog/trigger spies.
 */
function setup() {
  const catalog = jest.fn<ErrorExplorerService['catalog']>()
  const trigger = jest.fn<ErrorExplorerService['trigger']>()
  const service: Partial<ErrorExplorerService> = { catalog, trigger }
  const controller = new ErrorExplorerController(service as ErrorExplorerService)
  return { controller, catalog, trigger }
}

describe('ErrorExplorerController (unit)', () => {
  it('serves the catalog', () => {
    /*
     * Scenario: GET /errors/catalog.
     * Rule it protects: the controller returns the service catalog untouched.
     */
    const entries: CatalogEntry[] = [
      {
        code: QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED,
        message: 'Bulk enqueue failed',
        httpStatus: 500,
        reproducibleHere: true,
        raisedBy: 'library',
        coveredBy: 'POST /errors/trigger/queue.bulk_enqueue_failed',
      },
    ]
    const { controller, catalog } = setup()
    catalog.mockReturnValue(entries)
    expect(controller.catalog()).toBe(entries)
  })

  it('dispatches a reproducible code with the default variant', async () => {
    /*
     * Scenario: triggering a reproducible code with no variant.
     * Rule it protects: the controller validates the query (defaulting variant to 0)
     * and delegates to the service, whose rejection propagates.
     */
    const { controller, trigger } = setup()
    const raised = new QueueException(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED, 500, {})
    trigger.mockRejectedValue(raised)

    await expect(controller.trigger(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED, {})).rejects.toBe(raised)
    expect(trigger).toHaveBeenCalledWith(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED, 0)
  })

  it('coerces and forwards the variant selector', async () => {
    /*
     * Scenario: triggering invalid_repeat_options with a variant query.
     * Rule it protects: the string query is coerced to a bounded integer and passed
     * through to the service.
     */
    const { controller, trigger } = setup()
    trigger.mockRejectedValue(new QueueException(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, 400, {}))

    await controller
      .trigger(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, { variant: '2' })
      .catch(() => undefined)
    expect(trigger).toHaveBeenCalledWith(QUEUE_ERROR_CODES.INVALID_REPEAT_OPTIONS, 2)
  })

  it('rejects an out-of-range variant at the boundary', () => {
    /*
     * Scenario: a variant beyond the supported range.
     * Rule it protects: validation fails closed with a 400 before the service runs.
     */
    const { controller, trigger } = setup()
    expect(() =>
      controller.trigger(QUEUE_ERROR_CODES.BULK_ENQUEUE_FAILED, { variant: '9' }),
    ).toThrow(BadRequestException)
    expect(trigger).not.toHaveBeenCalled()
  })

  it('rejects a known but non-reproducible code with a coverage pointer', () => {
    /*
     * Scenario: triggering a boot-time code.
     * Rule it protects: a known-but-not-reproducible code returns a 400 naming where
     * it is covered, and never reaches the service.
     */
    const { controller, catalog, trigger } = setup()
    catalog.mockReturnValue(buildCatalog())
    try {
      // Non-reproducible codes throw synchronously; `void` marks the never-returned
      // promise as intentionally ignored for the floating-promise rule.
      void controller.trigger(QUEUE_ERROR_CODES.CONNECTION_TIMEOUT, {})
      throw new Error('expected a rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: {
          code: 'errors.not_reproducible',
          message: 'This code is covered outside the error explorer',
          details: { code: QUEUE_ERROR_CODES.CONNECTION_TIMEOUT },
        },
      })
    }
    expect(trigger).not.toHaveBeenCalled()
  })

  it('rejects an unknown code without echoing the raw input', () => {
    /*
     * Scenario: triggering a code that is not in the catalog.
     * Rule it protects: an unknown code returns a generic 404 that never reflects the
     * raw request string back to the client.
     */
    const { controller, catalog, trigger } = setup()
    catalog.mockReturnValue(buildCatalog())
    try {
      // Unknown codes also throw synchronously; ignore the never-returned promise.
      void controller.trigger('totally.unknown', {})
      throw new Error('expected a rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException)
      expect((error as NotFoundException).getResponse()).toEqual({
        error: { code: 'errors.unknown_code', message: 'Unknown error code', details: null },
      })
      expect(JSON.stringify((error as NotFoundException).getResponse())).not.toContain(
        'totally.unknown',
      )
    }
    expect(trigger).not.toHaveBeenCalled()
  })
})
