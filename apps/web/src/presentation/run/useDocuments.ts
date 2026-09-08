"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { DocumentRepositoryImpl } from "@/data/documents/documentRepositoryImpl"
import type { Document } from "@/domain/documents/models/document"
import { DownloadDocumentUseCase } from "@/domain/documents/usecases/downloadDocument"
import { GetDocumentsByAutomationIdUseCase } from "@/domain/documents/usecases/getDocumentsByAutomationId"

/**
 * The uploaded documents for one run.
 *
 * `downloadingIds` is a Set rather than a boolean on purpose: the report and
 * memorandum downloads elsewhere shared a single flag, so pressing one put
 * every button on the screen into a spinner. Per-item state is the only kind
 * that can be honest about which item is busy.
 */
export function useDocuments(automationId?: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  const fetch = useCallback(async () => {
    if (!automationId) return
    setLoading(true)
    setError(null)
    try {
      const useCase = new GetDocumentsByAutomationIdUseCase(
        new DocumentRepositoryImpl(),
      )
      const response = await useCase.execute(automationId)
      setDocuments(response.documents)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The documents could not be listed.",
      )
    } finally {
      setLoading(false)
    }
  }, [automationId])

  const download = useCallback(async (document: Document) => {
    if (!document.id) return
    setDownloadingIds((ids) => new Set(ids).add(document.id!))
    try {
      const useCase = new DownloadDocumentUseCase(new DocumentRepositoryImpl())
      await useCase.execute(document.id, document.name)
      toast.success(`Downloaded ${document.name}`)
    } catch (err) {
      // This used to be a console.error beside a comment wondering whether a
      // toast system existed.
      toast.error(
        err instanceof Error
          ? err.message
          : `${document.name} could not be downloaded`,
      )
    } finally {
      setDownloadingIds((ids) => {
        const next = new Set(ids)
        next.delete(document.id!)
        return next
      })
    }
  }, [])

  return { documents, loading, error, downloadingIds, fetch, download }
}
