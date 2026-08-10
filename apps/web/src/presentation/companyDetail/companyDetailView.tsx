"use client"

import {useState, useEffect} from "react"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {
    Building2,
    RefreshCw,
    AlertCircle,
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    ArrowLeft,
    Download,
    AlertTriangle,
    Sparkles,
    Trash2
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import {useCompanyDetailViewModel} from "./companyDetailViewModel"
import {AddAutomationModal} from "@/components/add-automation-modal"
import {ViewDocumentsModal} from "@/components/view-documents-modal"
import {OnePager} from "@/components/one-pager"
import {AutomationStatus, AutomationStage, ReportStatus} from "@/domain/automations/models/automation"
import Link from "next/link"
import {useLongPolling} from "@/presentation/hooks/useLongPolling"
import {StartStage2Button} from "@/components/start-stage2-button"
import {useCompanyContext} from "@/components/chat/chat-company-context"
import {formatDate} from "@/lib/formatDate"
import {StatusChip} from "@/presentation/shared/statusChip"

/**
 * Document status display component
 */
interface Document {
    id: string | null;
    name: string;
    status: 'OK' | 'MISSING';
}

interface AutomationResult {
    company_summary_documents?: Document[];
    team_documents?: Document[];
    corporate_documents?: Document[];
    clients_documents?: Document[];
    investment_documents?: Document[];
    legal_documents?: Document[];
    financial_documents?: Document[];
    one_pager_summary?: string;
    one_pager_markdown?: string;

    [key: string]: Document[] | string | undefined;
}

interface DocumentsStatusDisplayProps {
    result: AutomationResult;
}

const DocumentsStatusDisplay = ({result}: DocumentsStatusDisplayProps) => {
    const sectionNames: Record<string, string> = {
        company_summary_documents: "Company Summary",
        team_documents: "Team",
        corporate_documents: "Corporate",
        clients_documents: "Clients",
        investment_documents: "Investment",
        legal_documents: "Legal",
        financial_documents: "Financial"
    };

    const documentSections = Object.entries(result).filter(([key]) =>
        key.endsWith('_documents') && Array.isArray(result[key])
    );

    if (documentSections.length === 0) {
        return (
            <div className="bg-muted/50 dark:bg-muted/80 rounded-lg p-3 border border-border">
                <div className="text-xs text-muted-foreground text-center">
                    No document structure found in result
                </div>
            </div>
        );
    }

    return (
        <div className="bg-muted/50 dark:bg-muted/80 rounded-lg p-3 border border-border space-y-4">
            {documentSections.map(([sectionKey, documents]) => {
                // Deduplicate documents by name - keep first occurrence
                const uniqueDocuments = (documents as Document[]).filter((doc, index, self) => 
                    index === self.findIndex((d) => d.name === doc.name)
                );
                
                return (
                    <div key={sectionKey} className="space-y-2">
                        <h6 className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">
                            {sectionNames[sectionKey] || sectionKey.replace('_documents', '').replace('_', ' ')}
                        </h6>
                        <div className="space-y-1.5">
                            {uniqueDocuments.map((doc, index) => (
                                <div key={`${doc.name}-${index}`}
                                     className="flex items-center justify-between py-1.5 px-2 bg-background/60 dark:bg-background/40 rounded border border-border/50">
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                        {doc.status === 'OK' ? (
                                            <CheckCircle
                                                className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0"/>
                                        ) : (
                                            <AlertTriangle
                                                className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                                        )}
                                        <span className="text-xs text-foreground/80 truncate"
                                              title={doc.name}>{doc.name}</span>
                                    </div>
                                    <span
                                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${doc.status === 'OK'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                      {doc.status}
                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const getStageLabel = (stage?: AutomationStage): string => {
    if (!stage) return ''
    switch (stage) {
        case AutomationStage.TRIAGE:
            return 'Triage'
        case AutomationStage.DILLIGENCE_OPERATIONAL:
            return 'Due Diligence - Operational'
        case AutomationStage.DILLIGENCE_COMMERCIAL:
            return 'Due Diligence - Commercial'
        case AutomationStage.DILLIGENCE_FINANCIAL:
            return 'Due Diligence - Financial'
        case AutomationStage.DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW:
            return 'Due Diligence - Cap Table & Legal'
        default:
            return stage
    }
}

const getStageColor = (stage?: AutomationStage): string => {
    if (!stage) return ''
    switch (stage) {
        case AutomationStage.TRIAGE:
            return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
        case AutomationStage.DILLIGENCE_OPERATIONAL:
            return 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
        case AutomationStage.DILLIGENCE_COMMERCIAL:
            return 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
        case AutomationStage.DILLIGENCE_FINANCIAL:
            return 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
        case AutomationStage.DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW:
            return 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
        default:
            return ''
    }
}

interface CompanyDetailViewProps {
    id: string;
}

export function CompanyDetailView({id}: CompanyDetailViewProps) {

    const {
        company, loading, error, refetch, handleAutomationSuccess,
        documents, documentsLoading, documentsError, downloadingIds,
        fetchDocuments, downloadDocument, downloadingOnePager, downloadOnePager, downloadingReport, downloadReport,
        onePagerMarkdown, startStage2, isPollingActive, pollCompanyData, deleteCompany, retryAutomation
    } = useCompanyDetailViewModel(id)

    const { setCompany: setCompanyContext } = useCompanyContext()

    useEffect(() => {
        if (company) {
            setCompanyContext({ id: company.id, name: company.name })
        }
        return () => setCompanyContext(null)
    }, [company, setCompanyContext])

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [retryingAutomationId, setRetryingAutomationId] = useState<string | null>(null)

    const handleDownloadOnePager = (triageAutomationId: string) => {
        downloadOnePager(triageAutomationId)
    }

    const handleRetryAutomation = async (automationId: string) => {
        setRetryingAutomationId(automationId)
        try {
            await retryAutomation(automationId)
        } catch (err) {
            console.error('Error retrying automation:', err)
        } finally {
            setRetryingAutomationId(null)
        }
    }

    const handleDeleteCompany = async () => {
        if (!company) return

        setIsDeleting(true)
        try {
            await deleteCompany(company.id)
            setIsDeleteDialogOpen(false)
            window.location.href = '/dashboard'
        } catch (err) {
            console.error('Error deleting company:', err)
        } finally {
            setIsDeleting(false)
        }
    }

    useLongPolling({
        callback: pollCompanyData,
        isPollingActive: isPollingActive,
        interval: 10000,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin"/>
                    <span>Loading company details...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="flex items-center space-x-2 text-destructive">
                    <AlertCircle className="h-5 w-5"/>
                    <span>{error}</span>
                </div>
                <Button onClick={refetch} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2"/>
                    Try Again
                </Button>
            </div>
        )
    }

    if (!company) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Building2 className="h-5 w-5"/>
                    <span>Company not found</span>
                </div>
            </div>
        )
    }

    const getStatusIcon = (status: AutomationStatus) => {
        switch (status) {
            case AutomationStatus.PENDING:
                return <Clock className="h-4 w-4 text-yellow-500"/>
            case AutomationStatus.PROCESSING:
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin"/>
            case AutomationStatus.STAGE2_PROCESSING:
                return <Sparkles className="h-4 w-4 text-purple-500 animate-pulse"/>
            case AutomationStatus.COMPLETED:
                return <CheckCircle className="h-4 w-4 text-green-500"/>
            case AutomationStatus.STAGE2_COMPLETED:
                return <CheckCircle className="h-4 w-4 text-teal-500"/>
            case AutomationStatus.FAILED:
            case AutomationStatus.STAGE2_FAILED:
                return <XCircle className="h-4 w-4 text-red-500"/>
            default:
                return <Clock className="h-4 w-4 text-gray-500"/>
        }
    }

    const getStatusColor = (status: AutomationStatus) => {
        switch (status) {
            case AutomationStatus.PENDING:
                return "text-yellow-800 bg-yellow-100 border-yellow-300 dark:text-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800"
            case AutomationStatus.PROCESSING:
                return "text-blue-800 bg-blue-100 border-blue-300 dark:text-blue-200 dark:bg-blue-900/30 dark:border-blue-800"
            case AutomationStatus.STAGE2_PROCESSING:
                return "text-purple-800 bg-purple-100 border-purple-300 dark:text-purple-200 dark:bg-purple-900/30 dark:border-purple-800"
            case AutomationStatus.COMPLETED:
                return "text-green-800 bg-green-100 border-green-300 dark:text-green-200 dark:bg-green-900/30 dark:border-green-800"
            case AutomationStatus.STAGE2_COMPLETED:
                return "text-teal-800 bg-teal-100 border-teal-300 dark:text-teal-200 dark:bg-teal-900/30 dark:border-teal-800"
            case AutomationStatus.FAILED:
            case AutomationStatus.STAGE2_FAILED:
                return "text-red-800 bg-red-100 border-red-300 dark:text-red-200 dark:bg-red-900/30 dark:border-red-800"
            default:
                return "text-muted-foreground bg-muted border-border"
        }
    }

    const hasActiveAutomation = company?.automations.some(
        automation => [
            AutomationStatus.PENDING,
            AutomationStatus.PROCESSING,
            AutomationStatus.STAGE2_PROCESSING
        ].includes(automation.status)
    ) || false

    const hasCompletedTriageAutomation =
        company?.automations.some((automation) =>
            automation.status === AutomationStatus.COMPLETED &&
            automation.stage === AutomationStage.TRIAGE
        ) || false

    const hasDiligenceAutomations =
        company?.automations.some((automation) =>
            automation.parentAutomationId &&
            automation.stage !== AutomationStage.TRIAGE
        ) || false

    const shouldShowStartAutomation = !hasCompletedTriageAutomation
    const shouldShowStartStage2 = hasCompletedTriageAutomation && !hasDiligenceAutomations

    const getActiveAutomationMessage = () => {
        if (!hasActiveAutomation && !hasDiligenceAutomations) return ""
        if (hasDiligenceAutomations) return "Due diligence automations are already created. Start Stage 2 is no longer available."
        const activeAutomation = company?.automations.find(
            automation => [AutomationStatus.PENDING, AutomationStatus.PROCESSING, AutomationStatus.STAGE2_PROCESSING].includes(automation.status)
        )
        if (activeAutomation?.status === AutomationStatus.PENDING) return "Another automation is pending. Wait for it to complete."
        if (activeAutomation?.status === AutomationStatus.PROCESSING || activeAutomation?.status === AutomationStatus.STAGE2_PROCESSING) return "Another automation is currently processing. Wait for it to complete."
        return "Another automation is active. Wait for it to complete."
    }

    const getCompletedTriageAutomationId = () => {
        return company?.automations.find((automation) =>
            automation.status === AutomationStatus.COMPLETED &&
            automation.stage === AutomationStage.TRIAGE
        )?.id || ""
    }

    const renderStage2Cards = () => {
        const stage2Automations =
            company?.automations.filter((automation) => {
                return [
                    AutomationStatus.STAGE2_PROCESSING,
                    AutomationStatus.STAGE2_FAILED,
                    AutomationStatus.STAGE2_COMPLETED,
                ].includes(automation.status)
            }) || []

        return stage2Automations.map((automation, index) => {
            if (automation.status === AutomationStatus.STAGE2_PROCESSING) {
                return (
                    <div
                        key={`stage2-${automation.id}-${index}`}
                        className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-blue-300 dark:border-blue-800">
                            <div className="flex items-center space-x-3">
                                <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin"/>
                                <div>
                                    <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-200">Stage 2</h4>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">Stage2 Processing</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10">
                            <div className="space-y-3">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    Generating final report with domain-specific agents...
                                </p>
                                {/* `progress-slide` was never defined in any
                                    stylesheet and the bar had no width, so this
                                    rendered as an empty track and has never
                                    animated. An indeterminate pulse is honest
                                    about not knowing the progress. */}
                                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                                    <div className="h-full w-full animate-pulse rounded-full bg-blue-600 dark:bg-blue-400"></div>
                                </div>
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    Processing in parallel with specialized AI agents
                                </p>
                            </div>
                        </div>
                    </div>
                )
            }

            if (automation.status === AutomationStatus.STAGE2_FAILED) {
                return (
                    <div key={`stage2-${automation.id}-${index}`} className="space-y-4">
                        <div
                            className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 overflow-hidden">
                            <div className="px-4 py-3 border-b border-red-300 dark:border-red-800">
                                <div className="flex items-center space-x-3">
                                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400"/>
                                    <div>
                                        <h4 className="font-semibold text-sm text-red-800 dark:text-red-200">Stage
                                            2</h4>
                                        <p className="text-xs text-red-700 dark:text-red-300">Stage2 Failed</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div
                            className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
                            <div className="flex items-center space-x-3">
                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0"/>
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    Final report generation failed. Use the &quot;Start Stage 2&quot; button above to
                                    try again.
                                </p>
                            </div>
                        </div>
                    </div>
                )
            }

            if (automation.status === AutomationStatus.STAGE2_COMPLETED) {
                return (
                    <div
                        key={`stage2-${automation.id}-${index}`}
                        className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-green-300 dark:border-green-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400"/>
                                    <div>
                                        <h4 className="font-semibold text-sm text-green-800 dark:text-green-200">Stage
                                            2</h4>
                                        <p className="text-xs text-green-700 dark:text-green-300">Stage2 Completed</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 px-3 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 border-green-300 dark:border-green-700"
                                >
                                    <Download className="h-3 w-3 mr-1"/>
                                    Documents
                                </Button>
                            </div>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/10">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center space-x-1.5">
                                        <Calendar className="h-3 w-3"/>
                                        <span>Created</span>
                                    </p>
                                    <p className="text-xs mt-1 text-green-800 dark:text-green-200">{formatDate(automation.createdAt)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center space-x-1.5">
                                        <Clock className="h-3 w-3"/>
                                        <span>Last Updated</span>
                                    </p>
                                    <p className="text-xs mt-1 text-green-800 dark:text-green-200">{formatDate(automation.updatedAt)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            return null
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4 mr-2"/>
                        Back to Companies
                    </Button>
                </Link>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Building2 className="h-8 w-8 text-primary"/>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
                        <p className="text-muted-foreground">Company Details</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={refetch} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2"/>
                        Refresh
                    </Button>
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-2"/>
                                Delete
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Company</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete &quot;{company.name}&quot;? This action cannot be undone and will delete all related data including automations, documents, and reports.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteCompany}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2"/>
                                            Delete Company
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Building2 className="h-5 w-5 text-primary"/>
                            <span>Company Information</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                            <p className="font-medium mt-1">{company.name}</p>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                            <StatusChip status={company.status} className="text-muted-foreground" />
                        </div>
                        {company.automations?.some(
                            (a) =>
                                a.stage === AutomationStage.TRIAGE &&
                                a.status === AutomationStatus.COMPLETED,
                        ) && (
                            <Button asChild variant="outline" size="sm" className="w-full">
                                <Link href={`/dashboard/company/${company.id}/conflicts`}>
                                    <AlertTriangle className="h-4 w-4" />
                                    Where the documents disagree
                                </Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Clock className="h-5 w-5 text-primary"/>
                            <span>Timeline</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                                <Calendar className="h-4 w-4"/>
                                <span>Created At</span>
                            </label>
                            <p className="text-sm mt-1">{formatDate(company.createdAt)}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                                <Clock className="h-4 w-4"/>
                                <span>Last Updated</span>
                            </label>
                            <p className="text-sm mt-1">{formatDate(company.updatedAt)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <RefreshCw className="h-5 w-5 text-primary"/>
                            <span>Automations</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {shouldShowStartStage2 && (
                                <StartStage2Button
                                    companyId={company.id}
                                    automationId={getCompletedTriageAutomationId()}
                                    onStart={() => startStage2(company.id, getCompletedTriageAutomationId())}
                                />
                            )}
                            {shouldShowStartAutomation && (
                                <AddAutomationModal
                                    companyId={id}
                                    onSuccess={handleAutomationSuccess}
                                    disabled={hasActiveAutomation || hasDiligenceAutomations}
                                    disabledReason={getActiveAutomationMessage()}
                                />
                            )}
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {company.automations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50"/>
                            <p>No automations started</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {renderStage2Cards()}

                            {company.automations
                                .filter(
                                    (automation) =>
                                        ![
                                            AutomationStatus.STAGE2_PROCESSING,
                                            AutomationStatus.STAGE2_FAILED,
                                            AutomationStatus.STAGE2_COMPLETED,
                                        ].includes(automation.status),
                                )
                                .sort((a, b) => {
                                    // TRIAGE automations first
                                    if (a.stage === AutomationStage.TRIAGE && b.stage !== AutomationStage.TRIAGE) return -1
                                    if (b.stage === AutomationStage.TRIAGE && a.stage !== AutomationStage.TRIAGE) return 1
                                    // Then by creation date (newest first)
                                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                                })
                                .map((automation, index) => {
                                    const isEligibleForOnePager = automation.status === AutomationStatus.COMPLETED && automation.stage === AutomationStage.TRIAGE

                                    return (
                                        <div key={automation.id || index}
                                             className={`rounded-lg border overflow-hidden ${automation.stage ? getStageColor(automation.stage) : getStatusColor(automation.status)}`}>
                                            <div className="px-4 py-3 border-b border-current border-opacity-20">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        {getStatusIcon(automation.status)}
                                                        <div>
                                                            <h4 className="font-semibold text-sm">
                                                                {automation.stage ? getStageLabel(automation.stage) : `Automation #${automation.id}`}
                                                            </h4>
                                                            <p className="text-xs opacity-80 capitalize">{automation.status.toLowerCase().replace(/_/g, ' ')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-xs opacity-80">
                                                        <ViewDocumentsModal
                                                            automationId={automation.id}
                                                            disabled={false}
                                                            documents={documents}
                                                            documentsLoading={documentsLoading}
                                                            documentsError={documentsError}
                                                            downloadingIds={downloadingIds}
                                                            onFetchDocuments={fetchDocuments}
                                                            onDownloadDocument={downloadDocument}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-4 bg-background/80 dark:bg-background/60">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground flex items-center space-x-1.5">
                                                            <Calendar className="h-3 w-3"/><span>Created</span></p>
                                                        <p className="text-xs mt-1">{formatDate(automation.createdAt)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground flex items-center space-x-1.5">
                                                            <Clock className="h-3 w-3"/><span>Last Updated</span></p>
                                                        <p className="text-xs mt-1">{formatDate(automation.updatedAt)}</p>
                                                    </div>
                                                </div>

                                                {automation.status === AutomationStatus.FAILED && automation.stage === AutomationStage.TRIAGE && (
                                                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                                        <div className="flex items-center space-x-2 text-sm text-red-800 dark:text-red-200">
                                                            <AlertCircle className="h-4 w-4"/>
                                                            <span>Automation failed.</span>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRetryAutomation(automation.id)}
                                                            disabled={hasActiveAutomation || retryingAutomationId === automation.id}
                                                            className="text-xs h-7 px-3 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 border-red-300 dark:border-red-700"
                                                        >
                                                            {retryingAutomationId === automation.id ? (
                                                                <Loader2 className="h-3 w-3 mr-1 animate-spin"/>
                                                            ) : (
                                                                <RefreshCw className="h-3 w-3 mr-1"/>
                                                            )}
                                                            Retry
                                                        </Button>
                                                    </div>
                                                )}

                                                {isEligibleForOnePager && onePagerMarkdown && (
                                                    <div className="space-y-3 pt-2">
                                                        <h5 className="text-sm font-medium text-muted-foreground">One
                                                            Pager Summary</h5>
                                                        <OnePager
                                                            title="One Pager"
                                                            markdown={onePagerMarkdown}
                                                            collapsedSize={{height: "40vh"}}
                                                            classNameCollapsed="border border-green-500/80 rounded-xl"
                                                        />
                                                    </div>
                                                )}

                                                {automation.status === AutomationStatus.COMPLETED &&
                                                    automation.stage === AutomationStage.TRIAGE &&
                                                    !onePagerMarkdown &&
                                                    (automation.onePagerSummary || automation.result?.onePagerSummary || automation.result?.one_pager_summary) && (
                                                        <div
                                                            className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                                            <div
                                                                className="flex items-center space-x-2 text-sm text-green-800 dark:text-green-200">
                                                                <CheckCircle className="h-4 w-4"/>
                                                                <span>One Pager Summary is ready for download.</span>
                                                            </div>
                                                            <Button
                                                                variant="outline" size="sm"
                                                                onClick={() => handleDownloadOnePager(automation.id)}
                                                                disabled={downloadingOnePager}
                                                                className="text-xs h-7 px-3 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 border-green-300 dark:border-green-700">
                                                                {downloadingOnePager ? (<Loader2
                                                                    className="h-3 w-3 mr-1 animate-spin"/>) : (
                                                                    <Download className="h-3 w-3 mr-1"/>)}
                                                                Download
                                                            </Button>
                                                        </div>
                                                    )}

                                                {/* Report Section for non-triage automations */}
                                                {automation.stage !== AutomationStage.TRIAGE && automation.reports && automation.reports.length > 0 && (
                                                    <div className="space-y-2 pt-2">
                                                        <h5 className="text-sm font-medium text-muted-foreground">Report
                                                            Status</h5>
                                                        {automation.reports.map((report) => {
                                                            const isCompleted = report.status === ReportStatus.COMPLETED && report.reportUrl;

                                                            return (
                                                                <div key={report.id}
                                                                     className={`flex items-center justify-between p-3 rounded-lg border ${
                                                                         isCompleted
                                                                             ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                                                             : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                                                     }`}>
                                                                    <div
                                                                        className={`flex items-center space-x-2 text-sm ${
                                                                            isCompleted
                                                                                ? 'text-green-800 dark:text-green-200'
                                                                                : 'text-yellow-800 dark:text-yellow-200'
                                                                        }`}>
                                                                        {isCompleted ? (
                                                                            <CheckCircle className="h-4 w-4"/>
                                                                        ) : (
                                                                            <AlertTriangle className="h-4 w-4"/>
                                                                        )}
                                                                        <span>
                                      {isCompleted
                                          ? `${report.domain} Report is ready for download.`
                                          : `${report.domain} Report is not completed yet.`
                                      }
                                    </span>
                                                                    </div>
                                                                    {isCompleted && (
                                                                        <Button
                                                                            variant="outline" size="sm"
                                                                            onClick={() => downloadReport(automation.id, report.domain)}
                                                                            disabled={downloadingReport}
                                                                            className={`text-xs h-7 px-3 ${
                                                                                isCompleted
                                                                                    ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 border-green-300 dark:border-green-700'
                                                                                    : ''
                                                                            }`}>
                                                                            {downloadingReport ? (
                                                                                <Loader2
                                                                                    className="h-3 w-3 mr-1 animate-spin"/>
                                                                            ) : (
                                                                                <Download className="h-3 w-3 mr-1"/>
                                                                            )}
                                                                            Download
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Show message when no reports are available for non-triage automations */}
                                                {automation.stage !== AutomationStage.TRIAGE && (!automation.reports || automation.reports.length === 0) && (
                                                    <div
                                                        className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                                        <div
                                                            className="flex items-center space-x-2 text-sm text-yellow-800 dark:text-yellow-200">
                                                            <AlertTriangle className="h-4 w-4"/>
                                                            <span>Report has not been completed yet.</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {automation.result && Object.keys(automation.result).some((k) => k.endsWith("_documents")) && (
                                                    <div className="space-y-2 pt-4 border-t border-border/50">
                                                        <h5 className="text-sm font-medium text-muted-foreground">Documents
                                                            Status</h5>
                                                        <DocumentsStatusDisplay result={automation.result}/>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}