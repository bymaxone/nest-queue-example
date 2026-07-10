/**
 * @fileoverview Typed navigation table for the queue dashboard sidebar.
 *
 * Nine routes, one flat group: every documented dashboard surface (spec §13.2)
 * gets a nav entry with its route `href` and a `lucide-react` icon.
 *
 * @layer components/layout/nav-items
 */

import {
  LayoutDashboard,
  Layers,
  Workflow,
  CalendarClock,
  Cpu,
  FlaskConical,
  Activity,
  TriangleAlert,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react'

/** A single navigation entry: visible label, route, and its icon. */
export interface NavItem {
  /** Human-readable label shown in the rail. */
  label: string
  /** App Router route the item links to. */
  href: string
  /** Lucide icon rendered beside the label. */
  icon: LucideIcon
}

/** The flat nav model for the queue dashboard, in sidebar display order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Queues', href: '/queues', icon: Layers },
  { label: 'Flows', href: '/flows', icon: Workflow },
  { label: 'Schedulers', href: '/schedulers', icon: CalendarClock },
  { label: 'Workers', href: '/workers', icon: Cpu },
  { label: 'Playground', href: '/playground', icon: FlaskConical },
  { label: 'Events', href: '/events', icon: Activity },
  { label: 'Errors', href: '/errors', icon: TriangleAlert },
  { label: 'Health', href: '/health', icon: HeartPulse },
]
