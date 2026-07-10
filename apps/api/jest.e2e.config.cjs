'use strict'

/**
 * Jest configuration for the API e2e tier.
 *
 * Specs under `test/**\/*.e2e-spec.ts` boot the real `AppModule` against a real
 * Redis (no mocks) and drive it over real HTTP, so this tier uses the app's
 * actual `tsconfig.json` (decorator metadata ON) rather than the unit tier's
 * `tsconfig.spec.json` (metadata OFF); Nest's DI container needs the emitted
 * `design:paramtypes` to resolve constructor dependencies on real, DI-managed
 * classes such as processors and services.
 *
 * `pnpm test:e2e` runs `scripts/run-e2e.mjs`, which invokes this config once
 * PER SPEC FILE (a fresh Node process each time) rather than pointing Jest at
 * the whole `test/` directory in one process. Several specs boot the entire
 * `AppModule` (a dozen-plus BullMQ workers each); loading that many full
 * application graphs back-to-back inside one process under Node's experimental
 * `--experimental-vm-modules` ESM loader compounds that loader's per-module
 * bookkeeping and makes wall time grow sharply after a handful of files, even
 * though each file alone (or a small group) runs in single-digit seconds. A
 * fresh process per file keeps every run's cost proportional to that one file.
 * `maxWorkers: 1` and `forceExit: true` remain as safe defaults for direct,
 * single-file invocations during local iteration (`jest --config
 * jest.e2e.config.cjs test/orders.e2e-spec.ts`), where `forceExit` guards the
 * one documented ioredis gap `connection.e2e-spec.ts` deliberately provokes: a
 * client that completes a TCP handshake against a server which never speaks
 * the Redis protocol has no ioredis-side timeout once connected (`connectTimeout`
 * only guards the TCP-connect phase and self-clears the instant it succeeds),
 * so its socket can outlive the library's own (correctly-rejecting) timeout.
 *
 * `isolatedModules: true` skips full type-checking during transform: e2e specs
 * import the whole `AppModule` graph plus the library's `ConfigurableModuleBuilder`
 * generated option types, which are expensive for `tsc` to re-derive per file.
 * Type correctness is already a dedicated, project-wide gate (`pnpm typecheck`),
 * so re-deriving it inside every e2e transform would be redundant as well as slow.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.json',
        ignoreCoverageForAllDecorators: true,
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  // Every spec file boots its own full application and closes it in `afterAll`;
  // a generous default keeps timing-sensitive specs (stall margins, shutdown
  // drain budgets) comfortably inside the window without per-spec overrides.
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
  forceExit: true,
}
