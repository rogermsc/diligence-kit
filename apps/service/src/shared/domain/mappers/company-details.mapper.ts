import { CompanyWithAutomations } from "@/shared/repository/company-repository.interface"
import {
    CompanyDetailsResponseDTO,
    CompletedAutomationResultDTO,
} from "@/features/company/data/dtos/company-details.schema"
import { CompanyMapper } from "./company.mapper"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"
import { CompanyStatusHelper } from "@/features/company/domain/helpers/company-status.helper"
import { OutputSector } from "@prisma/client"

export class CompanyDetailsMapper {
    static toResponse(data: CompanyWithAutomations): CompanyDetailsResponseDTO {
        const automations = data.automations.map((automation) => {
            const baseAutomation = {
                id: automation.id,
                companyId: automation.companyId,
                status: automation.status as AutomationStatus,
                stage: automation.stage,
                documents: automation.documents,
                output_documents: automation.output_documents,
                reports: automation.reports || [],
                onePagerSummary: automation.onePagerSummary || null,
                parentAutomationId: automation.parentAutomationId,
                createdAt: automation.createdAt,
                updatedAt: automation.updatedAt,
            }

            // Adicionar campo result apenas se status = COMPLETED e há output_documents
            if (
                automation.status === "COMPLETED" &&
                automation.output_documents.length > 0
            ) {
                const result = this.buildCompletedAutomationResult(
                    automation.output_documents[0],
                    automation.onePagerSummary,
                )
                return {
                    ...baseAutomation,
                    result,
                }
            }

            return baseAutomation
        })

        const companyStatus = CompanyStatusHelper.calculateStatus(automations)

        return {
            ...CompanyMapper.toResponse(data.company, companyStatus),
            automations,
        }
    }

    private static buildCompletedAutomationResult(
        result: any,
        onePagerSummary?: string | null,
    ): CompletedAutomationResultDTO {
        // Inicializar estrutura básica
        const automationResult: CompletedAutomationResultDTO = {
            company_summary_documents: [],
            team_documents: [],
            corporate_documents: [],
            clients_documents: [],
            investment_documents: [],
            legal_documents: [],
            financial_documents: [],
        }

        // Agrupar documentos por setor
        result.documents.forEach((doc: any) => {
            const documentData = {
                id: doc.documentId,
                name: doc.name,
                status: doc.status,
            }

            switch (doc.sector) {
                case OutputSector.COMPANY_SUMMARY:
                    automationResult.company_summary_documents.push(
                        documentData,
                    )
                    break
                case OutputSector.TEAM:
                    automationResult.team_documents.push(documentData)
                    break
                case OutputSector.CORPORATE:
                    automationResult.corporate_documents.push(documentData)
                    break
                case OutputSector.CLIENTS:
                    automationResult.clients_documents.push(documentData)
                    break
                case OutputSector.INVESTMENT:
                    automationResult.investment_documents.push(documentData)
                    break
                case OutputSector.LEGAL:
                    automationResult.legal_documents.push(documentData)
                    break
                case OutputSector.FINANCIAL:
                    automationResult.financial_documents.push(documentData)
                    break
            }
        })

        return automationResult
    }
}
