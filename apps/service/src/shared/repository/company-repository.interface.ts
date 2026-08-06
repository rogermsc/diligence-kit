import { Company } from "@/shared/domain/entities/company.entity"
import {
    AutomationStatus,
    OutputDocumentStatus,
    OutputSector,
    ResultStatus,
} from "@prisma/client"
import { ReportStatus } from "@/shared/domain/entities/report.entity"
import { AutomationStageDomain } from "@/shared/domain/entities/automation.entity"

export interface CreateCompanyData {
    name: string
    ownerId: string
}

export interface DocumentData {
    id: string
    name: string
    bucketPath: string
    createdAt: Date
    updatedAt: Date
}

export interface OnePagerData {
    id: string
    automationId: string
    companyId: string
    url: string
    createdAt: Date
    updatedAt: Date
}

export interface ReportData {
    id: string
    automationId: string
    companyId: string
    domain: AutomationStageDomain
    status: ReportStatus
    reportUrl: string
    createdAt: Date
    updatedAt: Date
}

export interface CompanyWithAutomations {
    company: Company
    automations: Array<{
        id: string
        companyId: string
        status: AutomationStatus
        stage: string
        parentAutomationId: string | null
        documents: Array<DocumentData>
        output_documents: Array<{
            id: string
            status: ResultStatus
            documents: Array<{
                id: string
                name: string
                status: OutputDocumentStatus
                sector: OutputSector
                documentId: string | null
                document: DocumentData | null
                createdAt: Date
                updatedAt: Date
            }>
            createdAt: Date
            updatedAt: Date
        }>
        reports: Array<ReportData>
        onePagerSummary: string | null
        createdAt: Date
        updatedAt: Date
    }>
}

/**
 * Every read and write is scoped to an owner, and `ownerId` is a required
 * argument rather than an optional filter on purpose: a caller that forgets it
 * fails to compile instead of silently returning another tenant's data.
 */
export interface CompanyRepository {
    create(data: CreateCompanyData): Promise<Company>
    findById(id: string, ownerId: string): Promise<Company | null>
    /**
     * Bypasses tenancy. Only for paths with no calling user — background jobs and
     * agent webhooks — or paths that have already authorized the caller against
     * this company. Never call this to serve a user-supplied id directly.
     */
    findByIdAsSystem(id: string): Promise<Company | null>
    /**
     * Does this owner already have a company by this name?
     *
     * Scoped, deliberately. The cross-tenant version this replaces answered
     * "does anyone have this name", which is how creating a company told you
     * another tenant's company names — you learned one existed by being refused
     * it. Storage paths are keyed on the company id now, so nothing needs the
     * global answer.
     */
    findByNameForOwner(name: string, ownerId: string): Promise<Company | null>
    findByIdWithAutomations(
        id: string,
        ownerId: string,
    ): Promise<CompanyWithAutomations | null>
    findAllWithAutomations(ownerId: string): Promise<CompanyWithAutomations[]>
    delete(id: string, ownerId: string): Promise<void>
}
