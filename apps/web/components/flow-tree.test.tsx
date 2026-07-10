/**
 * @fileoverview Unit tests for the recursive flow-tree visualization.
 * @layer components/flow-tree.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { FlowTreeNode } from '@/lib/api-types'
import { FlowTree } from './flow-tree'

const leaf: FlowTreeNode = {
  id: 'child-1',
  name: 'reserve-stock',
  queue: 'stock',
  status: 'completed',
  children: [],
}

const root: FlowTreeNode = {
  id: 'root-1',
  name: 'ship-order',
  queue: 'fulfillment',
  status: 'waiting-children',
  children: [leaf],
}

describe('FlowTree', () => {
  it('renders the node name, queue, and status', () => {
    // Scenario: every node must show its identity and current BullMQ state.
    render(<FlowTree node={leaf} />)
    expect(screen.getByText('reserve-stock')).toBeInTheDocument()
    expect(screen.getByText('stock')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('recursively renders every child node', () => {
    // Scenario: a parent with children must render the whole subtree, not
    // just the root row.
    render(<FlowTree node={root} />)
    expect(screen.getByText('ship-order')).toBeInTheDocument()
    expect(screen.getByText('reserve-stock')).toBeInTheDocument()
  })

  it('falls back to the neutral palette for a non-JobStatus BullMQ state', () => {
    // Scenario: 'waiting-children' is not one of the six JobStatus values;
    // it must still render without crashing.
    render(<FlowTree node={root} />)
    expect(screen.getByText('waiting-children')).toBeInTheDocument()
  })

  it('indents nested levels with a connecting border', () => {
    // Scenario: depth > 0 must apply the connector classes; the root (depth 0) must not.
    const { container } = render(<FlowTree node={root} />)
    const nested = container.querySelector('.ml-4')
    expect(nested).not.toBeNull()
  })

  it('renders no subtree container for a leaf node', () => {
    // Scenario: a childless node must not render an empty children wrapper.
    const { container } = render(<FlowTree node={leaf} />)
    expect(container.querySelector('.space-y-2')).toBeNull()
  })

  it('pulses the icon for an active node', () => {
    // Scenario: an in-flight node (status 'active') gets the same pulsing
    // treatment as JobStatusBadge, so the tree reads as "live" too.
    const { container } = render(<FlowTree node={{ ...leaf, status: 'active' }} />)
    expect(container.querySelector('svg')).toHaveClass('animate-isPulsing')
  })

  it('falls back to the child name as the React key when a child has no id', () => {
    // Scenario: BullMQ can omit a job id in edge cases; the tree must still
    // render every child using its name as the key fallback.
    const childWithoutId: FlowTreeNode = { ...leaf, id: undefined }
    render(<FlowTree node={{ ...root, children: [childWithoutId] }} />)
    expect(screen.getByText('reserve-stock')).toBeInTheDocument()
  })
})
