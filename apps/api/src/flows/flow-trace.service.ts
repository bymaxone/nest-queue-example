/**
 * @fileoverview In-memory execution trace for the fulfillment flow: a bounded
 * ring buffer that each node processor appends to as it runs. Because a parent
 * only runs after every descendant completes, reading the trace back shows the
 * BullMQ ordering guarantee (grandchildren, then children, then the root).
 * Demo-only state; no database, no secrets (only node names and timestamps).
 * @layer app/flows
 */
import { Injectable } from '@nestjs/common'
import { BoundedRingBuffer } from '../common/bounded-ring-buffer.js'

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
  private readonly entries = new BoundedRingBuffer<FlowTraceEntry>(TRACE_CAPACITY)

  /**
   * Record a node execution in order.
   *
   * @param node - The flow node (job) name that executed.
   */
  record(node: string): void {
    this.entries.push({ node, at: Date.now() })
  }

  /**
   * Return a snapshot of the recorded executions, oldest first.
   *
   * @returns A copy of the current entries; mutating it never affects the trace.
   */
  list(): readonly FlowTraceEntry[] {
    return this.entries.snapshot()
  }
}
