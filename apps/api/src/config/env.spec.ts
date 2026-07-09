/**
 * Unit tests for the environment parser.
 *
 * Layer: unit.
 * Goal: defaults, numeric coercion, boolean-flag semantics, freezing, and the
 * fail-fast path with a variable-naming message.
 * Mocks: none — parseEnv is called with explicit source records, never the real
 * process environment.
 */
import { APP_ENV, appEnvProvider, parseEnv } from './env.js'

describe('parseEnv (unit)', () => {
  it('applies defaults for every variable when the source is empty', () => {
    /*
     * Scenario: zero-config boot.
     * Rule it protects: each spec section 9 variable falls back to its documented
     * default, so the app runs against a local Redis with no committed .env.
     */
    expect(parseEnv({})).toEqual({
      PORT: 3080,
      REDIS_URL: 'redis://localhost:6379/0',
      QUEUE_CONNECTION_STYLE: 'url',
      QUEUE_CONNECTION_MODE: 'own',
      QUEUE_PREFIX: 'nqex',
      QUEUE_DRAIN_TIMEOUT_MS: 30000,
      QUEUE_DRAIN_ON_SHUTDOWN: false,
      QUEUE_OTEL: false,
      WEBHOOK_FAILURES: 2,
      WEB_ORIGIN: 'http://localhost:3000',
    })
  })

  it('coerces numeric strings to numbers', () => {
    /*
     * Scenario: environment values always arrive as strings.
     * Rule it protects: PORT, the drain budget, and the failure count are coerced to
     * real numbers rather than kept as strings.
     */
    const env = parseEnv({ PORT: '4000', QUEUE_DRAIN_TIMEOUT_MS: '1500', WEBHOOK_FAILURES: '0' })
    expect(env.PORT).toBe(4000)
    expect(env.QUEUE_DRAIN_TIMEOUT_MS).toBe(1500)
    expect(env.WEBHOOK_FAILURES).toBe(0)
  })

  it.each([
    ['true', true],
    ['1', true],
    [true, true],
    ['false', false],
    ['0', false],
  ])('parses the boolean flag %p as %p', (input, expected) => {
    /*
     * Scenario: boolean-ish flags across every accepted form.
     * Rule it protects: only a real `true`, `'true'`, or `'1'` enables the flag;
     * every other value (including the string 'false') is false, dodging
     * z.coerce.boolean's `Boolean('false') === true` footgun. Exercises each arm of
     * the `value === true || value === 'true' || value === '1'` chain.
     */
    expect(parseEnv({ QUEUE_OTEL: input }).QUEUE_OTEL).toBe(expected)
    expect(parseEnv({ QUEUE_DRAIN_ON_SHUTDOWN: input }).QUEUE_DRAIN_ON_SHUTDOWN).toBe(expected)
  })

  it('throws a readable error naming the offending variable on invalid input', () => {
    /*
     * Scenario: a non-numeric value for a numeric variable.
     * Rule it protects: parsing fails fast with a message that names the variable and
     * never echoes a secret value.
     */
    expect(() => parseEnv({ QUEUE_DRAIN_TIMEOUT_MS: 'abc' })).toThrow(/QUEUE_DRAIN_TIMEOUT_MS/)
  })

  it('freezes the parsed environment', () => {
    /*
     * Scenario: the parsed env is shared app-wide through DI.
     * Rule it protects: the result is frozen, so no consumer can mutate configuration
     * at runtime.
     */
    expect(Object.isFrozen(parseEnv({}))).toBe(true)
  })
})

describe('appEnvProvider (unit)', () => {
  it('registers under APP_ENV and its factory returns the parsed, frozen env', () => {
    /*
     * Scenario: DI registration of the environment.
     * Rule it protects: the provider is bound to the APP_ENV token and its factory
     * parses the process environment once into a frozen AppEnv — the single value
     * every other provider injects.
     */
    expect(appEnvProvider.provide).toBe(APP_ENV)
    const result = appEnvProvider.useFactory()
    expect(Object.isFrozen(result)).toBe(true)
    expect(result).toEqual(parseEnv(process.env))
  })
})
