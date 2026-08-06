import { OutputSector } from "@prisma/client"

export interface OutputDocumentCreateInput {
    name: string
    status: "OK" | "MISSING" | "OPTIONAL"
    sector: OutputSector
    documentId?: string
    resultId: string
}

export interface IOutputDocumentRepository {
    createMany(documents: OutputDocumentCreateInput[]): Promise<void>
}
