/**
 * @fileoverview Errors (`/errors`) - the error catalog table with per-code
 * trigger buttons (reproducible codes only) and an `EnvelopeViewer` showing
 * the last triggered code's stable envelope.
 * @layer app/errors/page
 */

'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { EnvelopeViewer } from '@/components/envelope-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useErrorCatalog, useTriggerError } from '@/hooks/use-errors'
import { ApiError } from '@/lib/api-client'
import type { CatalogEntry } from '@/lib/api-types'

/** One catalog row: code, status, reproducibility badge, and a trigger button. */
function CatalogRow({
  entry,
  isTriggering,
  onTrigger,
}: {
  entry: CatalogEntry
  isTriggering: boolean
  onTrigger: (code: string) => void
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-brand-500">{entry.code}</TableCell>
      <TableCell className="font-mono">{entry.httpStatus}</TableCell>
      <TableCell>
        <Badge variant={entry.reproducibleHere ? 'default' : 'outline'}>
          {entry.reproducibleHere ? 'reproducible' : entry.coveredBy}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          disabled={!entry.reproducibleHere || isTriggering}
          onClick={() => {
            onTrigger(entry.code)
          }}
        >
          Trigger
        </Button>
      </TableCell>
    </TableRow>
  )
}

/** The full error-code catalog table. */
function CatalogTable({
  isTriggering,
  onTrigger,
}: {
  isTriggering: boolean
  onTrigger: (code: string) => void
}) {
  const { data: catalog, isPending } = useErrorCatalog()

  return (
    <Card className="mb-6">
      <CardHeader accent>
        <CardTitle className="text-base">Error catalog</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reproducible</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              catalog?.map((entry) => (
                <CatalogRow
                  key={entry.code}
                  entry={entry}
                  isTriggering={isTriggering}
                  onTrigger={onTrigger}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** The last triggered code's envelope, or a hint before anything has been triggered. */
function LastEnvelopeCard({ last }: { last: ApiError | undefined }) {
  return (
    <Card>
      <CardHeader accent>
        <CardTitle className="text-base">Last triggered envelope</CardTitle>
      </CardHeader>
      <CardContent>
        {last === undefined ? (
          <p className="text-sm text-muted-foreground">
            Trigger a reproducible code above to see its envelope.
          </p>
        ) : (
          <EnvelopeViewer
            code={last.code}
            message={last.message}
            httpStatus={last.status}
            details={last.details}
          />
        )}
      </CardContent>
    </Card>
  )
}

/** Errors page: catalog table plus the last triggered envelope. */
export default function ErrorsPage() {
  const trigger = useTriggerError()
  const [last, setLast] = useState<ApiError>()

  function fire(code: string): void {
    trigger.mutate(code, {
      onError: (error) => {
        if (error instanceof ApiError) setLast(error)
      },
    })
  }

  return (
    <AppShell wide>
      <h1 className="mb-6 text-2xl font-bold">Errors</h1>
      <CatalogTable isTriggering={trigger.isPending} onTrigger={fire} />
      <LastEnvelopeCard last={last} />
    </AppShell>
  )
}
