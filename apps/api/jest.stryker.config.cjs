'use strict'

/**
 * Stryker-scoped Jest configuration for the API.
 *
 * Reuses the unit config (co-located `src/**\/*.spec.ts`, the metadata-off
 * `tsconfig.spec.json` transform, and the `.js`-specifier mapper) but strips the
 * coverage collection and the 100% threshold gate: Stryker instruments the code
 * itself and drives per-test mutant coverage, so a Jest coverage pass would only
 * duplicate work and its threshold would fail spuriously on the mutant runs.
 *
 * @type {import('jest').Config}
 */
const base = { ...require('./jest.config.cjs') }
delete base.coverageThreshold
base.collectCoverage = false

module.exports = base
