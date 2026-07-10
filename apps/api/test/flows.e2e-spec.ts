/**
 * @fileoverview E2E: the fulfillment flow (fan-out/fan-in, nested children) and
 * the three failure-propagation variants. Covers spec §12 scenario 4 and matrix
 * rows 50 to 56.
 * @layer test/e2e
 */
import { createTestApp } from './support/test-app.js'
import type { TestApp } from './support/test-app.js'
import { getJson, postJson } from './support/http.js'
import { waitFor } from './support/wait-for.js'

/** Projected flow-tree node returned by `GET /flows/:rootId/tree`. */
interface FlowTreeNode {
  id: string | undefined
  name: string
  queue: string
  status: string
  children: FlowTreeNode[]
}

/**
 * Find a node by job name anywhere in the tree (depth-first).
 *
 * @param node - The tree root to search.
 * @param name - The job name to find.
 * @returns The matching node, or `undefined`.
 */
function findNode(node: FlowTreeNode, name: string): FlowTreeNode | undefined {
  if (node.name === name) {
    return node
  }
  for (const child of node.children) {
    const found = findNode(child, name)
    if (found) {
      return found
    }
  }
  return undefined
}

/**
 * Fetch the flow tree once and assert the root has reached a terminal (or
 * expected) status, retrying until `predicate` is satisfied.
 *
 * @param baseUrl - The test app's base URL.
 * @param rootId - The flow root job id.
 * @param predicate - Returns true once the tree is in the awaited shape.
 */
async function waitForTree(
  baseUrl: string,
  rootId: string,
  predicate: (tree: FlowTreeNode) => boolean,
): Promise<FlowTreeNode> {
  return waitFor(
    async () => {
      const response = await getJson<FlowTreeNode>(`${baseUrl}/flows/${rootId}/tree`)
      return response.status === 200 && predicate(response.body) ? response.body : false
    },
    { timeoutMs: 10000, label: `flow tree ${rootId}` },
  )
}

describe('flows (e2e)', () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp('flows')
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('runs the happy-path flow to completion: fan-out, fan-in, and nested children (rows 50, 51)', async () => {
    // Scenario: the default fulfillment flow with no injected failure.
    // Rule it protects: the root only completes once every fan-out child and
    // nested grandchild has completed (FlowService.add's fan-out/fan-in guarantee).
    const launch = await postJson<{ rootId: string; orderId: string; variant: string }>(
      `${testApp.baseUrl}/flows/fulfillment`,
      { orderId: 'order-happy-1', variant: 'default' },
    )
    expect(launch.status).toBe(201)
    const tree = await waitForTree(
      testApp.baseUrl,
      launch.body.rootId,
      (root) => root.status === 'completed',
    )
    expect(tree.name).toBe('ship-order')
    expect(findNode(tree, 'reserve-stock')?.status).toBe('completed')
    expect(findNode(tree, 'charge-payment')?.status).toBe('completed')
    expect(findNode(tree, 'render-invoice')?.status).toBe('completed')
    expect(findNode(tree, 'fetch-lines')?.status).toBe('completed')
    expect(findNode(tree, 'fetch-customer')?.status).toBe('completed')
  })

  it('leaves the parent stuck waiting on children when a child fails without a propagation flag (row 52)', async () => {
    // Scenario: the `stuck` variant fails charge-payment with no propagation flag.
    // Rule it protects: the waiting-children pitfall: a failed child with neither
    // failParentOnFailure nor ignoreDependencyOnFailure leaves the parent stuck.
    const launch = await postJson<{ rootId: string }>(`${testApp.baseUrl}/flows/fulfillment`, {
      orderId: 'fail-stuck-1',
      variant: 'stuck',
    })
    await waitFor(
      async () => {
        const response = await getJson<FlowTreeNode>(
          `${testApp.baseUrl}/flows/${launch.body.rootId}/tree`,
        )
        const payment = findNode(response.body, 'charge-payment')
        return payment?.status === 'failed' ? response.body : false
      },
      { timeoutMs: 10000, label: 'charge-payment failure (stuck variant)' },
    )
    const tree = await getJson<FlowTreeNode>(`${testApp.baseUrl}/flows/${launch.body.rootId}/tree`)
    // The pitfall: no `failParentOnFailure`, so the root never runs and never
    // fails either; it stays waiting on a child that will not retry (single
    // attempt) and will not complete.
    expect(tree.body.status).toBe('waiting-children')
  })

  it('propagates a child failure to the parent with failParentOnFailure (row 53)', async () => {
    // Scenario: the `failParent` variant fails charge-payment with the flag set.
    // Rule it protects: failParentOnFailure propagates a child failure up, so the
    // root itself transitions to failed instead of staying stuck.
    const launch = await postJson<{ rootId: string }>(`${testApp.baseUrl}/flows/fulfillment`, {
      orderId: 'fail-parent-1',
      variant: 'failParent',
    })
    const tree = await waitForTree(
      testApp.baseUrl,
      launch.body.rootId,
      (root) => root.status === 'failed',
    )
    expect(tree.status).toBe('failed')
  })

  it('lets the parent proceed despite a child failure with ignoreDependencyOnFailure (row 54)', async () => {
    // Scenario: the `ignoreDependency` variant fails charge-payment with the flag set.
    // Rule it protects: ignoreDependencyOnFailure lets the parent complete despite
    // an optional child's failure, contrasting with the stuck and failParent variants.
    const launch = await postJson<{ rootId: string }>(`${testApp.baseUrl}/flows/fulfillment`, {
      orderId: 'fail-ignore-1',
      variant: 'ignoreDependency',
    })
    const tree = await waitForTree(
      testApp.baseUrl,
      launch.body.rootId,
      (root) => root.status === 'completed',
    )
    expect(tree.status).toBe('completed')
    expect(findNode(tree, 'charge-payment')?.status).toBe('failed')
  })

  it('launches several flows in one addBulk roundtrip, preserving input order (row 55)', async () => {
    // Scenario: launching three fulfillment flows via the bulk endpoint.
    // Rule it protects: FlowService.addBulk creates one flow per input order id,
    // in one Redis roundtrip, preserving input order in the response.
    const orderIds = ['order-bulk-1', 'order-bulk-2', 'order-bulk-3']
    const response = await postJson<{
      roots: { rootId: string; orderId: string }[]
      variant: string
    }>(`${testApp.baseUrl}/flows/fulfillment/bulk`, { orderIds, variant: 'default' })
    expect(response.status).toBe(201)
    expect(response.body.roots.map((root) => root.orderId)).toEqual(orderIds)
    for (const root of response.body.roots) {
      expect(root.rootId).toEqual(expect.any(String))
    }
  })

  it('reads the live tree through the producer escape hatch (row 56) and 404s a missing flow', async () => {
    // Scenario: reading the tree for a root job id that was never launched.
    // Rule it protects: the producer escape hatch (getFlow) resolves to null for
    // a missing flow, surfaced as the stable queue.job_not_found envelope.
    const missing = await getJson<{ error: { code: string } }>(
      `${testApp.baseUrl}/flows/does-not-exist/tree`,
    )
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('queue.job_not_found')
  })

  it('records the execution trace with children before the parent', async () => {
    // Scenario: a completed default flow's recorded execution trace.
    // Rule it protects: BullMQ's ordering guarantee is observable: a child
    // (reserve-stock) always records before its parent (ship-order).
    const launch = await postJson<{ rootId: string }>(`${testApp.baseUrl}/flows/fulfillment`, {
      orderId: 'order-trace-1',
      variant: 'default',
    })
    await waitForTree(testApp.baseUrl, launch.body.rootId, (root) => root.status === 'completed')
    const trace = await getJson<{ entries: { node: string; at: number }[] }>(
      `${testApp.baseUrl}/flows/trace`,
    )
    const nodeNames = trace.body.entries.map((entry) => entry.node)
    const shipIndex = nodeNames.lastIndexOf('ship-order')
    const reserveIndex = nodeNames.lastIndexOf('reserve-stock')
    expect(shipIndex).toBeGreaterThan(-1)
    expect(reserveIndex).toBeGreaterThan(-1)
    expect(reserveIndex).toBeLessThan(shipIndex)
  })

  it('rejects a malformed flow launch payload', async () => {
    // Scenario: an empty order id fails the request schema.
    // Rule it protects: boundary validation rejects the request before any
    // flow is launched.
    const response = await postJson(`${testApp.baseUrl}/flows/fulfillment`, { orderId: '' })
    expect(response.status).toBe(400)
  })
})
