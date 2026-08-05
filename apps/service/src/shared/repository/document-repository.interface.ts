import { Document } from "@/shared/domain/entities/document.entity"

export interface CreateDocumentData {
    automationId: string
    name: string
    bucketPath: string
}

export interface UpdateOpenaiFileIdData {
    id: string
    openaiFileId: string
}

export interface DocumentRepository {
    create(data: CreateDocumentData): Promise<Document>
    createMany(data: CreateDocumentData[]): Promise<Document[]>
    findById(id: string): Promise<Document | null>
    findByAutomationId(automationId: string): Promise<Document[]>
    updateOpenaiFileIds(updates: UpdateOpenaiFileIdData[]): Promise<void>
}
