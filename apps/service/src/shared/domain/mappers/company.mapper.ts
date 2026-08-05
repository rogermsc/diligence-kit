import { Company as PrismaCompany } from "@prisma/client"
import { Company } from "@/shared/domain/entities/company.entity"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"
import { CompanyFactory } from "@/shared/domain/factories/company.factory"
import { CompanyWithAutomations } from "@/shared/repository/company-repository.interface"
import { CompanyStatusHelper } from "@/features/company/domain/helpers/company-status.helper"

export type CompanyResponseDTO = {
    id: string
    name: string
    status: AutomationStatus
    createdAt: Date
    updatedAt: Date
}

export type CompanyListResponseDTO = CompanyResponseDTO[]

export class CompanyMapper {
    static toDomain(raw: PrismaCompany): Company {
        return CompanyFactory.createFromPrisma({
            id: raw.id,
            name: raw.name,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        })
    }

    static toPersistence(company: Company) {
        return {
            id: company.id,
            name: company.name,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
        }
    }

    static toResponse(company: Company, status: AutomationStatus = AutomationStatus.PENDING): CompanyResponseDTO {
        return {
            id: company.id,
            name: company.name,
            status,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
        }
    }

    static toResponseWithAutomations(companyWithAutomations: CompanyWithAutomations): CompanyResponseDTO {
        const status = CompanyStatusHelper.calculateStatus(companyWithAutomations.automations)
        return CompanyMapper.toResponse(companyWithAutomations.company, status)
    }

    static toResponseList(companies: Company[]): CompanyListResponseDTO {
        return companies.map(company => CompanyMapper.toResponse(company))
    }

    static toResponseListWithAutomations(companiesWithAutomations: CompanyWithAutomations[]): CompanyListResponseDTO {
        return companiesWithAutomations.map(CompanyMapper.toResponseWithAutomations)
    }
}
