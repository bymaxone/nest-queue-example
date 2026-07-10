/**
 * @fileoverview `EnvelopeViewer` - pretty-prints the library's stable error
 * envelope (`{ error: { code, message, details } }`). The code is rendered in
 * mono orange alongside an HTTP status chip, so the shape of every catalog
 * error is visually recognizable at a glance.
 * @layer components/envelope-viewer
 */

export interface EnvelopeViewerProps {
  /** The stable error code, e.g. `queue.job_not_found`. */
  code: string
  /** The human-readable message from the library's message catalog. */
  message: string
  /** The HTTP status the envelope was served with. */
  httpStatus: number
  /** Optional structured details attached to the error. */
  details?: Record<string, unknown> | null | undefined
}

/**
 * Pretty-prints one error envelope: status chip, mono orange code, message,
 * and (when present) a formatted details block.
 *
 * @param props - Viewer props.
 * @returns The rendered envelope.
 */
export function EnvelopeViewer({ code, message, httpStatus, details }: EnvelopeViewerProps) {
  return (
    <div className="rounded-xl border border-(--glass-border) bg-black/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-xs text-white/70">
          {httpStatus}
        </span>
        <span className="font-mono text-sm font-semibold text-brand-500">{code}</span>
      </div>
      <p className="text-sm text-white/80">{message}</p>
      {details !== null && details !== undefined ? (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/60 p-3 font-mono text-xs text-white/60">
          {JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
