'use client'

import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

type ImportLocalAgentsSuccess = {
  success: true
  publisherId: string
  agents: Array<{
    id: string
    version: string
    displayName: string
  }>
}

type ImportLocalAgentsError = {
  error: string
  details?: string
}

type ImportLocalAgentsResponse = ImportLocalAgentsSuccess | ImportLocalAgentsError

/**
 * Button that imports the nearest local `.agents/` directory into the given publisher.
 *
 * @param props - Component props.
 * @param props.publisherId - Target publisher ID.
 * @returns A small action UI with progress + status messaging.
 */
export function ImportLocalAgentsButton(props: { publisherId: string }) {
  const { publisherId } = props

  const router = useRouter()
  const [isImporting, setIsImporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onImport = useCallback(async () => {
    setIsImporting(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(
        `/api/publishers/${publisherId}/import-local-agents`,
        {
          method: 'POST',
        },
      )

      const data: ImportLocalAgentsResponse | null = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        const details = data && 'details' in data ? data.details : undefined
        const error = data && 'error' in data ? data.error : 'Import failed'
        setErrorMessage(details ? `${error}: ${details}` : error)
        return
      }

      const importedCount =
        data && 'agents' in data && Array.isArray(data.agents)
          ? data.agents.length
          : 0

      setStatusMessage(
        importedCount === 0
          ? 'Import completed'
          : `Imported ${importedCount} agent${importedCount === 1 ? '' : 's'}`,
      )
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsImporting(false)
    }
  }, [publisherId, router])

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onImport}
        disabled={isImporting}
      >
        {isImporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importing local .agents
          </>
        ) : (
          'Import local .agents'
        )}
      </Button>
      {statusMessage ? (
        <p className="text-xs text-muted-foreground">{statusMessage}</p>
      ) : null}
      {errorMessage ? <p className="text-xs text-red-500">{errorMessage}</p> : null}
    </div>
  )
}
