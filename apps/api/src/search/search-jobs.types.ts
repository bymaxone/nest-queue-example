/**
 * @fileoverview Typed job-data and job-result contracts for the `search` queue
 * family (index rebuilds). Kept per queue family so DTOs and the web app can
 * mirror these shapes without importing server code.
 * @layer app/search
 */

/** Payload of a `reindex` job on the `search` queue. */
export interface ReindexJobData {
  /** The search term whose index is being rebuilt. */
  term: string
}

/** Result returned by the `reindex` handler once the index is rebuilt. */
export interface ReindexJobResult {
  /** Number of documents reindexed. */
  documentCount: number
}
