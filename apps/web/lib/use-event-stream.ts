/**
 * @fileoverview `useEventStream` - consumes the API's `GET /events/stream`
 * Server-Sent Events feed via the native `EventSource`. Caps the retained
 * feed at 200 entries client-side and always closes the connection on
 * unmount, so navigating away never leaks an open SSE connection.
 * @layer lib/use-event-stream
 */
'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from './constants'
import type { FeedEntry } from './api-types'

/** Maximum feed entries retained client-side; older entries are dropped first. */
const MAX_FEED_ENTRIES = 200

/** Connection state of the underlying `EventSource`. */
export type EventStreamStatus = 'connecting' | 'open' | 'error'

/** Result returned by {@link useEventStream}. */
export interface EventStreamResult {
  /** Feed entries, newest first, capped at {@link MAX_FEED_ENTRIES}. */
  entries: FeedEntry[]
  /** Current connection state. */
  status: EventStreamStatus
}

/**
 * Safely parses one SSE message payload as a `FeedEntry`.
 *
 * @param raw - The raw `MessageEvent.data` string.
 * @returns The parsed entry, or `null` when the payload is not valid JSON.
 */
function parseEntry(raw: string): FeedEntry | null {
  try {
    return JSON.parse(raw) as FeedEntry
  } catch {
    return null
  }
}

/**
 * Subscribes to the live event feed over SSE. The browser's `EventSource`
 * reconnects automatically after a transient error; this hook only reports
 * the connection state, it never re-creates the source itself.
 *
 * @returns The retained feed entries and the current connection status.
 */
export function useEventStream(): EventStreamResult {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [status, setStatus] = useState<EventStreamStatus>('connecting')

  useEffect(() => {
    setStatus('connecting')
    setEntries([])
    const source = new EventSource(`${API_BASE_URL}/events/stream`)

    const handleOpen = (): void => {
      setStatus('open')
    }
    const handleMessage = (event: MessageEvent<string>): void => {
      const entry = parseEntry(event.data)
      if (entry === null) return
      setEntries((previous) => [entry, ...previous].slice(0, MAX_FEED_ENTRIES))
    }
    const handleError = (): void => {
      setStatus('error')
    }

    source.addEventListener('open', handleOpen)
    source.addEventListener('message', handleMessage)
    source.addEventListener('error', handleError)

    return () => {
      source.removeEventListener('open', handleOpen)
      source.removeEventListener('message', handleMessage)
      source.removeEventListener('error', handleError)
      source.close()
    }
  }, [])

  return { entries, status }
}
