/**
 * @fileoverview In-memory execution trace for the fulfillment flow: a bounded
 * ring buffer that each node processor appends to as it runs. Because a parent
 * only runs after every descendant completes, reading the trace back shows the
 * BullMQ ordering guarantee (grandchildren, then children, then the root).
 * Demo-only state; no database, no secrets (only node names and timestamps).
 * @layer app/flows
 */
import { Injectable } from '@nestjs/common'

/** Maximum number of trace entries retained; older entries are evicted first. */
const TRACE_CAPACITY = 500

/** A single recorded node execution: which node ran and when. */
export interface FlowTraceEntry {
  /** The flow node (job) name that executed. */
  node: string
  /** Epoch milliseconds when the node was recorded. */
  at: number
}

/** Bounded, in-memory record of flow-node executions in the order they occurred. */
@Injectable()
export class FlowTrace {
  private readonly entries: FlowTraceEntry[] = []

  /**
   * Append a node execution, evicting the oldest entry once capacity is exceeded
   * so memory stays bounded no matter how many flows run.
   *
   * @param node - The flow node (job) name that executed.
   */
  record(node: string): void {
    this.entries.push({ node, at: Date.now() })
    if (this.entries.length > TRACE_CAPACITY) {
      this.entries.shift()
    }
  }

  /**
   * Return a snapshot of the recorded executions, oldest first.
   *
   * @returns A copy of the current entries; mutating it never affects the trace.
   */
  list(): readonly FlowTraceEntry[] {
    return [...this.entries]
  }
}
