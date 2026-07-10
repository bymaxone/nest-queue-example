/**
 * @fileoverview Unit tests for the SSE event-stream hook, using a fake
 * `EventSource` since jsdom does not implement the real one.
 * @layer lib/use-event-stream.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useEventStream } from './use-event-stream'

/** Minimal fake EventSource capturing listeners so tests can fire events manually. */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly url: string
  closed = false
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, callback: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(callback)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, callback: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(callback)
  }

  close(): void {
    this.closed = true
  }

  emit(type: string, event: unknown): void {
    for (const callback of this.listeners.get(type) ?? []) callback(event)
  }
}

describe('useEventStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts in the connecting state and opens the stream against the API origin', () => {
    // Scenario: the hook must point EventSource at the configured API base URL.
    const { result } = renderHook(() => useEventStream())
    expect(result.current.status).toBe('connecting')
    expect(FakeEventSource.instances[0]?.url).toBe('http://localhost:3080/events/stream')
  })

  it('transitions to open when the source fires its open event', () => {
    // Scenario: a successful connection must flip the status to open.
    const { result } = renderHook(() => useEventStream())
    const source = FakeEventSource.instances[0]
    act(() => source?.emit('open', {}))
    expect(result.current.status).toBe('open')
  })

  it('prepends parsed feed entries, newest first', () => {
    // Scenario: entries arrive newest-last over the wire but must render newest-first.
    const { result } = renderHook(() => useEventStream())
    const source = FakeEventSource.instances[0]
    act(() => {
      source?.emit('message', {
        data: JSON.stringify({
          source: 'worker',
          queue: 'email',
          event: 'active',
          jobId: '1',
          at: 't1',
        }),
      })
      source?.emit('message', {
        data: JSON.stringify({
          source: 'worker',
          queue: 'email',
          event: 'completed',
          jobId: '1',
          at: 't2',
        }),
      })
    })
    expect(result.current.entries[0]?.event).toBe('completed')
    expect(result.current.entries[1]?.event).toBe('active')
  })

  it('ignores a malformed message payload instead of throwing', () => {
    // Scenario: a corrupted SSE frame must not crash the feed.
    const { result } = renderHook(() => useEventStream())
    const source = FakeEventSource.instances[0]
    act(() => source?.emit('message', { data: 'not json' }))
    expect(result.current.entries).toHaveLength(0)
  })

  it('caps the retained entries at 200, dropping the oldest', () => {
    // Scenario: a long-running session must not grow the feed unbounded.
    const { result } = renderHook(() => useEventStream())
    const source = FakeEventSource.instances[0]
    act(() => {
      for (let i = 0; i < 205; i += 1) {
        source?.emit('message', {
          data: JSON.stringify({
            source: 'global',
            queue: 'email',
            event: 'progress',
            jobId: String(i),
            at: 't',
          }),
        })
      }
    })
    expect(result.current.entries).toHaveLength(200)
    expect(result.current.entries[0]?.jobId).toBe('204')
  })

  it('reports the error state when the source fires an error event', () => {
    // Scenario: a dropped connection must surface as 'error' so the UI can show it.
    const { result } = renderHook(() => useEventStream())
    const source = FakeEventSource.instances[0]
    act(() => source?.emit('error', {}))
    expect(result.current.status).toBe('error')
  })

  it('closes the EventSource on unmount, leaving no open connection', () => {
    // Scenario: navigating away from the events page must not leak a connection.
    const { unmount } = renderHook(() => useEventStream())
    const source = FakeEventSource.instances[0]
    expect(source?.closed).toBe(false)
    unmount()
    expect(source?.closed).toBe(true)
  })

  it('resets entries and status when re-subscribing after a prior mount', async () => {
    // Scenario: mounting the hook again (e.g. remounting the events page) must
    // start from a clean slate rather than carrying over stale entries.
    const first = renderHook(() => useEventStream())
    act(() => {
      FakeEventSource.instances[0]?.emit('message', {
        data: JSON.stringify({
          source: 'worker',
          queue: 'email',
          event: 'active',
          jobId: '1',
          at: 't',
        }),
      })
    })
    await waitFor(() => {
      expect(first.result.current.entries).toHaveLength(1)
    })
    first.unmount()

    const second = renderHook(() => useEventStream())
    expect(second.result.current.entries).toHaveLength(0)
    expect(second.result.current.status).toBe('connecting')
  })
})
