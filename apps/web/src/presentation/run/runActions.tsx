"use client"

import { useState } from "react"
import { Download, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddAutomationModal } from "@/components/add-automation-modal"
import { StartStage2Button } from "@/components/start-stage2-button"
import { ViewDocumentsModal } from "@/components/view-documents-modal"
import { AutomationRepositoryImpl } from "@/data/automations/automationRepositoryImpl"
import { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl"
import { DownloadOnePagerUseCase } from "@/domain/automations/usecases/downloadOnePager"
import { DeleteCompanyUseCase } from "@/domain/companies/usecases/deleteCompany"
import { StartAutomationStage2UseCase } from "@/domain/automations/usecases/startAutomationStage2"
import { DomainProgress } from "./runHeader"
import { useDocuments } from "./useDocuments"
import { useRun } from "./runContext"

/**
 * What you can do with this run.
 *
 * Every one of these actions already existed and reported its outcome with a
 * toast — into a portal the app never mounted, so a failed download was
 * indistinguishable from a slow one. The portal is mounted now; these say what
 * happened.
 */
export function RunActions() {
  const router = useRouter()
  const { company, companyId, state, reload } = useRun()
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const docs = useDocuments(state.triage?.id)

  if (!company) return null

  const triage = state.triage
  const canUpload = !state.active && state.phase === "not_started"
  const canStartReports =
    state.phase === "triage_done" && state.domains.length === 0

  const startReports = async (cid: string, aid: string) => {
    try {
      await new StartAutomationStage2UseCase(
        new AutomationRepositoryImpl(),
      ).execute(cid, aid)
      toast.success("Domain reports started")
      reload()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The reports could not be started",
      )
    }
  }

  const downloadMemo = async () => {
    if (!triage) return
    setDownloading(true)
    try {
      const useCase = new DownloadOnePagerUseCase(new AutomationRepositoryImpl())
      const fileName = `one_pager_${company.name}_${triage.id}.pdf`.replace(
        /[^a-zA-Z0-9._-]/g,
        "_",
      )
      await useCase.execute(triage.id, fileName)
      toast.success("Memorandum downloaded")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The download did not complete",
      )
    } finally {
      setDownloading(false)
    }
  }

  const retry = async () => {
    if (!triage) return
    setRetrying(true)
    try {
      await new AutomationRepositoryImpl().retryAutomation(triage.id)
      toast.success("Analysis restarted")
      reload()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The run could not be restarted",
      )
    } finally {
      setRetrying(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      const useCase = new DeleteCompanyUseCase(new CompanyRepositoryImpl())
      const response = await useCase.execute(companyId)
      if (!response.success) throw new Error(response.message)
      toast.success(response.message)
      // router.push, not window.location. A full page load here threw away
      // every other piece of client state to reach a route the router owns.
      router.push("/dashboard")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The company could not be deleted",
      )
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canUpload && (
          <AddAutomationModal companyId={companyId} onSuccess={reload} />
        )}

        {canStartReports && triage && (
          <StartStage2Button
            companyId={companyId}
            automationId={triage.id}
            onStart={startReports}
          />
        )}

        {triage && (
          <ViewDocumentsModal
            automationId={triage.id}
            documents={docs.documents}
            documentsLoading={docs.loading}
            documentsError={docs.error}
            downloadingIds={docs.downloadingIds}
            onFetchDocuments={() => void docs.fetch()}
            onDownloadDocument={docs.download}
          />
        )}

        {state.phase !== "not_started" && state.phase !== "triage_running" && (
          <Button
            variant="outline"
            size="sm"
            onClick={downloadMemo}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Memorandum PDF
          </Button>
        )}

        {state.phase === "triage_failed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Run it again
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="ml-auto text-destructive hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <DomainProgress />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {company.name}?</DialogTitle>
            <DialogDescription>
              This removes the company, its runs, and every document uploaded to
              it. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
