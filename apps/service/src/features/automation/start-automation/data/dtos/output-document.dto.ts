import { OutputDocumentStatus, OutputSector } from "@prisma/client"

export interface OutputDocumentDto {
    id?: string
    name: string
    status: OutputDocumentStatus
}

export interface GroupedOutputDocumentsDto {
    company_summary_documents: OutputDocumentDto[]
    team_documents: OutputDocumentDto[]
    corporate_documents: OutputDocumentDto[]
    clients_documents: OutputDocumentDto[]
    investment_documents: OutputDocumentDto[]
    legal_documents: OutputDocumentDto[]
    financial_documents: OutputDocumentDto[]
}

export interface OutputDocumentWithSector extends OutputDocumentDto {
    sector: OutputSector
}

export function groupOutputDocumentsBySector(
    documents: OutputDocumentWithSector[],
): GroupedOutputDocumentsDto {
    const initialGroups: GroupedOutputDocumentsDto = {
        company_summary_documents: [],
        team_documents: [],
        corporate_documents: [],
        clients_documents: [],
        investment_documents: [],
        legal_documents: [],
        financial_documents: [],
    }

    return documents.reduce((groups, document) => {
        const sectorKey =
            `${document.sector.toLowerCase()}_documents` as keyof GroupedOutputDocumentsDto

        const documentDto: OutputDocumentDto = {
            id: document.id,
            name: document.name,
            status: document.status,
        }

        groups[sectorKey].push(documentDto)
        return groups
    }, initialGroups)
}
