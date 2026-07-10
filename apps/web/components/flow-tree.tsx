/**
 * @fileoverview `FlowTree` - recursively renders a `FlowTreeNode`: a status
 * dot + name + queue for the node, a connecting line down to its children.
 * Node status is a raw BullMQ job state (e.g. `waiting-children`), so colors
 * come from `paletteVisual`'s status-or-neutral fallback rather than the
 * strict `JobStatus` palette.
 * @layer components/flow-tree
 */

import type { FlowTreeNode } from '@/lib/api-types'
import { paletteVisual } from '@/lib/queue-status'
import { cn } from '@/lib/utils'

export interface FlowTreeProps {
  /** The root (or any subtree) node to render. */
  node: FlowTreeNode
  /** Nesting depth, used only to vary the connector indentation. */
  depth?: number
}

/**
 * Recursively renders one flow node and its children, connected by a left
 * border line that visually groups a parent with its descendants.
 *
 * @param props - Tree props.
 * @param props.node - The node to render.
 * @param props.depth - Nesting depth (defaults to 0 for the root call).
 * @returns The rendered node and its subtree.
 */
export function FlowTree({ node, depth = 0 }: FlowTreeProps) {
  const visual = paletteVisual(node.status)
  const Icon = visual.icon
  const hasChildren = node.children.length > 0

  return (
    <div className={cn(depth > 0 && 'ml-4 border-l border-white/10 pl-4')}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs',
          visual.className,
        )}
      >
        <Icon
          className={cn('h-3 w-3', visual.isPulsing && 'animate-isPulsing')}
          aria-hidden="true"
        />
        <span className="font-semibold">{node.name}</span>
        <span className="text-white/40">{node.queue}</span>
        <span className="ml-auto">{node.status}</span>
      </div>
      {hasChildren ? (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <FlowTree key={child.id ?? child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
