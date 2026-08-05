export type DocumentStatus = "OK" | "MISSING" | "OPTIONAL"

export interface Document {
    id: string
    name: string
    status: DocumentStatus
}

export interface DocumentSections {
    company_summary_documents: Document[]
    team_documents: Document[]
    corporate_documents: Document[]
    clients_documents: Document[]
    investment_documents: Document[]
    legal_documents: Document[]
    financial_documents: Document[]
}
