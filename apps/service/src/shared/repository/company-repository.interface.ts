import { Company } from "@/shared/domain/entities/company.entity"
import { AutomationStatus, OutputDocumentStatus, OutputSector, ResultStatus } from "@prisma/client"
import { ReportStatus } from "@/shared/domain/entities/report.entity"
import { AutomationStageDomain } from "@/shared/domain/entities/automation.entity"

export interface CreateCompanyData {
    name: string
}

export interface UpdateCompanyData {
    name?: string
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

export interface CompanyRepository {
    create(data: CreateCompanyData): Promise<Company>
    findById(id: string): Promise<Company | null>
    findByIdWithAutomations(id: string): Promise<CompanyWithAutomations | null>
    findByName(name: string): Promise<Company | null>
    findAll(): Promise<Company[]>
    findAllWithAutomations(): Promise<CompanyWithAutomations[]>
    update(id: string, data: UpdateCompanyData): Promise<Company>
    delete(id: string): Promise<void>
    exists(id: string): Promise<boolean>
    existsByName(name: string): Promise<boolean>
}
