import { Result, OutputDocument, OutputSector } from "@prisma/client"
/**
 * The rows a result writes. This lived in its own file beside an
 * IOutputDocumentRepository that nothing ever injected — the result repository
 * writes output documents inline.
 */
export interface OutputDocumentCreateInput {
    name: string
    status: "OK" | "MISSING" | "OPTIONAL"
    sector: OutputSector
    documentId?: string
    resultId: string
}

export interface ResultCreateInput {
    automationId: string
    status: "OK" | "MISSING_DOCS"
}

export interface CreateResultWithDocumentsInput {
    resultData: ResultCreateInput
    outputDocuments: OutputDocumentCreateInput[]
}

export interface CreateResultWithDocumentsOutput {
    result: Result
    outputDocuments: OutputDocument[]
}

export interface IResultRepository {
    create(data: ResultCreateInput): Promise<Result>
    createResultWithDocuments(
        data: CreateResultWithDocumentsInput,
    ): Promise<CreateResultWithDocumentsOutput>
}
