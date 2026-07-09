/**
 * @fileoverview Single source of truth for API configuration. Reads
 * `process.env` exactly once, validates it against a zod schema (every variable
 * has a safe default), freezes the result, and exposes it as an injectable value
 * under the {@link APP_ENV} token. No other module touches `process.env`.
 * @layer app/config
 */
import { z } from 'zod'
import type { FactoryProvider } from '@nestjs/common'

/**
 * Parses a boolean-ish environment string without `z.coerce.boolean`, whose
 * `Boolean('false') === true` would silently flip a disabled flag on. Only a
 * real `true`, `'true'`, or `'1'` enables the flag; everything else is `false`.
 */
const booleanFlag = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((value) => value === true || value === 'true' || value === '1')

/**
 * Zod schema for every API environment variable (see spec section 9), each with
 * a demo-friendly default so the app boots with zero configuration against a
 * local Redis.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3080),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379/0'),
  QUEUE_CONNECTION_STYLE: z.enum(['url', 'options']).default('url'),
  QUEUE_CONNECTION_MODE: z.enum(['own', 'shared']).default('own'),
  QUEUE_PREFIX: z.string().min(1).default('nqex'),
  QUEUE_DRAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  QUEUE_DRAIN_ON_SHUTDOWN: booleanFlag,
  QUEUE_OTEL: booleanFlag,
  WEBHOOK_FAILURES: z.coerce.number().int().min(0).default(2),
  REMINDER_DELAY_MS: z.coerce.number().int().positive().default(60000),
  // Normalize to the URL origin (scheme + host + port). A configured value with a
  // path or query would pass URL validation yet never match the browser's `Origin`
  // header, silently breaking CORS.
  WEB_ORIGIN: z
    .url()
    .default('http://localhost:3000')
    .transform((value) => new URL(value).origin),
})

/**
 * Fully-typed, validated environment. Read-only: the shape is flat, so a shallow
 * freeze in {@link parseEnv} is a complete freeze.
 */
export type AppEnv = Readonly<z.infer<typeof envSchema>>

/** Injection token for the parsed, frozen {@link AppEnv}. */
export const APP_ENV: unique symbol = Symbol('APP_ENV')

/**
 * Validate and freeze the environment, failing fast with a readable message that
 * names the offending variable. Reads `process.env` by default; accepts an
 * explicit source so tests never mutate the real environment.
 *
 * @param source - Raw environment record to parse. Defaults to `process.env`.
 * @returns The frozen, typed environment.
 * @throws {Error} When any variable fails validation; the message names each
 *   invalid variable and never echoes a secret value.
 */
export function parseEnv(source: Record<string, unknown> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`)
  }
  return Object.freeze(parsed.data)
}

/** Provider that parses the environment once and exposes it under {@link APP_ENV}. */
export const appEnvProvider: FactoryProvider = {
  provide: APP_ENV,
  useFactory: (): AppEnv => parseEnv(),
}
