/**
 * @fileoverview Server-Sent Events client for e2e specs, built on the platform
 * `fetch` streaming body reader. Consumes real SSE frames off the real HTTP
 * response (no mocked `EventSource`), matching how a browser client sees
 * `GET /events/stream`.
 * @layer test/support
 */

/** One decoded SSE `data:` frame, parsed as JSON. */
export type SseEvent = Record<string, unknown>

/**
 * Split a buffered SSE byte stream into complete frames (separated by a blank
 * line) and the remaining partial tail.
 *
 * @param buffer - Text accumulated so far.
 * @returns The complete frames found and the unconsumed remainder.
 */
function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = []
  let rest = buffer
  let separatorIndex = rest.indexOf('\n\n')
  while (separatorIndex !== -1) {
    frames.push(rest.slice(0, separatorIndex))
    rest = rest.slice(separatorIndex + 2)
    separatorIndex = rest.indexOf('\n\n')
  }
  return { frames, rest }
}

/**
 * Extract the JSON payload from a single SSE frame's `data:` line.
 *
 * @param frame - One complete SSE frame (no trailing blank line).
 * @returns The parsed payload, or `undefined` when the frame carries no data.
 */
function parseFrame(frame: string): SseEvent | undefined {
  const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
  if (dataLine === undefined) {
    return undefined
  }
  return JSON.parse(dataLine.slice('data:'.length).trim()) as SseEvent
}

/**
 * Connect to an SSE endpoint and collect events until `count` have arrived or
 * the timeout elapses, then close the connection.
 *
 * @param url - The absolute SSE endpoint URL.
 * @param count - Number of events to collect before returning.
 * @param timeoutMs - Maximum time to wait for `count` events. Default: 5000.
 * @returns The collected events, in arrival order.
 * @throws {Error} When the stream ends or the timeout elapses before `count`
 *   events arrive.
 */
export async function collectSseEvents(
  url: string,
  count: number,
  timeoutMs = 5000,
): Promise<SseEvent[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    })
    if (response.body === null) {
      throw new Error('SSE response carried no body')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const events: SseEvent[] = []
    let buffer = ''
    try {
      while (events.length < count) {
        const { value, done } = await reader.read()
        if (done) {
          throw new Error(`SSE stream ended after ${String(events.length)}/${String(count)} events`)
        }
        buffer += decoder.decode(value, { stream: true })
        const { frames, rest } = splitFrames(buffer)
        buffer = rest
        for (const frame of frames) {
          const event = parseFrame(frame)
          if (event !== undefined) {
            events.push(event)
          }
          if (events.length >= count) {
            break
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    return events
  } finally {
    clearTimeout(timer)
  }
}
