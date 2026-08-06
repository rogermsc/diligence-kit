import { OutputSector } from "@prisma/client"

export const jsonKeyToSectorEnum: Record<string, OutputSector> = {
    company_summary_documents: OutputSector.COMPANY_SUMMARY,
    team_documents: OutputSector.TEAM,
    corporate_documents: OutputSector.CORPORATE,
    clients_documents: OutputSector.CLIENTS,
    investment_documents: OutputSector.INVESTMENT,
    legal_documents: OutputSector.LEGAL,
    financial_documents: OutputSector.FINANCIAL,
}

export const sectorEnumToJsonKey: Record<OutputSector, string> = {
    [OutputSector.COMPANY_SUMMARY]: "company_summary_documents",
    [OutputSector.TEAM]: "team_documents",
    [OutputSector.CORPORATE]: "corporate_documents",
    [OutputSector.CLIENTS]: "clients_documents",
    [OutputSector.INVESTMENT]: "investment_documents",
    [OutputSector.LEGAL]: "legal_documents",
    [OutputSector.FINANCIAL]: "financial_documents",
}
