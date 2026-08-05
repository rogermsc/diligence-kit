import { z } from "zod"

export const AutomationStatusSchema = z.enum([
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
])

export const OutputDocumentStatusSchema = z.enum([
    "OK",
    "MISSING",
    "OPTIONAL",
])

export const OutputSectorSchema = z.enum([
    "COMPANY_SUMMARY",
    "TEAM",
    "CORPORATE",
    "CLIENTS",
    "INVESTMENT",
    "LEGAL",
    "FINANCIAL",
])

export const ResultStatusSchema = z.enum([
    "OK",
    "MISSING_DOCS",
])

export const ReportStatusSchema = z.enum([
    "COMPLETED",
    "FAILED",
    "UNTRACKED"
])

export const AutomationStageSchema = z.enum([
    "TRIAGE",
    "DILLIGENCE_OPERATIONAL",
    "DILLIGENCE_COMMERCIAL",
    "DILLIGENCE_FINANCIAL",
    "DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW"
])

export const DocumentSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    bucketPath: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const ReportSchema = z.object({
    id: z.string().uuid(),
    automationId: z.string().uuid(),
    companyId: z.string().uuid(),
    domain: AutomationStageSchema,
    status: ReportStatusSchema,
    reportUrl: z.string().url(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const OutputDocumentSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: OutputDocumentStatusSchema,
    sector: OutputSectorSchema,
    documentId: z.string().uuid().nullable(),
    document: DocumentSchema.nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const ResultSchema = z.object({
    id: z.string().uuid(),
    status: ResultStatusSchema,
    documents: z.array(OutputDocumentSchema),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const OnePagerSchema = z.object({
    id: z.string().uuid(),
    automationId: z.string().uuid(),
    companyId: z.string().uuid(),
    url: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

// Schema para o resultado completo da automação (usado quando status = COMPLETED)
export const CompletedAutomationResultSchema = z.object({
    company_summary_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
    team_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
    corporate_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
    clients_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
    investment_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
    legal_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
    financial_documents: z.array(z.object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        status: OutputDocumentStatusSchema,
    })),
})

export const AutomationResponseSchema = z.object({
    id: z.string().uuid(),
    companyId: z.string(),
    status: AutomationStatusSchema,
    stage: z.string(),
    documents: z.array(DocumentSchema),
    output_documents: z.array(ResultSchema),
    reports: z.array(ReportSchema),
    onePagerSummary: z.string().nullable(),
    parentAutomationId: z.string().uuid().nullable(),
    result: CompletedAutomationResultSchema.optional(), // Campo result quando status = COMPLETED
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const CompanyDetailsResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: AutomationStatusSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
    automations: z.array(AutomationResponseSchema),
})

export const OnePagerResponseSchema = z.object({
    one_pager_summary: z.string().optional(),
})

export type AutomationResponseDTO = z.infer<typeof AutomationResponseSchema>
export type CompanyDetailsResponseDTO = z.infer<typeof CompanyDetailsResponseSchema>
export type DocumentDTO = z.infer<typeof DocumentSchema>
export type OutputDocumentDTO = z.infer<typeof OutputDocumentSchema>
export type ResultDTO = z.infer<typeof ResultSchema>
export type CompletedAutomationResultDTO = z.infer<typeof CompletedAutomationResultSchema>
export type OnePagerResponseDTO = z.infer<typeof OnePagerResponseSchema>
export type OnePagerDTO = z.infer<typeof OnePagerSchema>