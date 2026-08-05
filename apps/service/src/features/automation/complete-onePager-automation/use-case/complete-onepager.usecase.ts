import { Injectable, Inject, Logger } from '@nestjs/common';
import { Usecase } from '@/shared/interfaces/usecase';
import { AutomationRepository } from '@/features/automation/start-automation/domain/repository/automation-repository.interface';
import { AutomationNotFoundError } from '@/features/automation/start-automation/domain/errors/automation-errors';
import { CompleteOnePagerRequest } from '../data/dtos/complete-onepager.schema';
import { CompanyRepository } from '@/shared/repository/company-repository.interface';
import { AutomationNotCompletedError, CompanyNotFoundError } from '@/features/company/domain/errors/company-errors';
import { AutomationStageDomain, AutomationStatus } from '@/shared/domain/entities/automation.entity';
import { IResultRepository } from '@/features/automation/domain/repository/result-repository.interface';
import { OutputSector } from '@prisma/client';

interface CompleteOnePagerInput {
    automationId: string;
    data: CompleteOnePagerRequest;
}

export interface CompleteOnePagerOutput {
    message: string;
    automationId: string;
    onePagerSaved: boolean;
}

/**
 * Maps agent information types to OutputSector categories for the frontend display.
 */
const INFO_TYPE_TO_SECTOR: Record<string, OutputSector> = {
    one_pager: OutputSector.COMPANY_SUMMARY,
    deck: OutputSector.COMPANY_SUMMARY,
    case_study: OutputSector.COMPANY_SUMMARY,
    advisors: OutputSector.TEAM,
    contracts_esop: OutputSector.TEAM,
    structure_incorporation: OutputSector.CORPORATE,
    shareholder_agreements: OutputSector.CORPORATE,
    additional_agreements: OutputSector.CORPORATE,
    client_contracts: OutputSector.CLIENTS,
    pipeline: OutputSector.CLIENTS,
    usage_data: OutputSector.CLIENTS,
    reference_list: OutputSector.CLIENTS,
    cap_table: OutputSector.INVESTMENT,
    investment_docs: OutputSector.INVESTMENT,
    technology_security_agreements: OutputSector.LEGAL,
    patents_trademarks: OutputSector.LEGAL,
    insurance: OutputSector.LEGAL,
    policies: OutputSector.LEGAL,
    quality_of_earnings: OutputSector.FINANCIAL,
    working_capital: OutputSector.FINANCIAL,
    revenue_analysis: OutputSector.FINANCIAL,
    financial_forecasts: OutputSector.FINANCIAL,
    market_research: OutputSector.FINANCIAL,
    go_to_market_strategy: OutputSector.FINANCIAL,
}

const INFO_TYPE_DISPLAY_NAMES: Record<string, string> = {
    one_pager: 'One Pager',
    deck: 'Pitch Deck',
    case_study: 'Case Study',
    advisors: 'Advisors',
    contracts_esop: 'ESOP / Employment Contracts',
    structure_incorporation: 'Structure & Incorporation',
    shareholder_agreements: 'Shareholder Agreements',
    additional_agreements: 'Additional Agreements',
    client_contracts: 'Client Contracts',
    pipeline: 'Sales Pipeline',
    usage_data: 'Usage Data',
    reference_list: 'Reference List',
    cap_table: 'Cap Table',
    investment_docs: 'Investment Documents',
    technology_security_agreements: 'Technology & Security Agreements',
    patents_trademarks: 'Patents & Trademarks',
    insurance: 'Insurance',
    policies: 'Policies',
    quality_of_earnings: 'Quality of Earnings',
    working_capital: 'Working Capital',
    revenue_analysis: 'Revenue Analysis',
    financial_forecasts: 'Financial Forecasts',
    market_research: 'Market Research',
    go_to_market_strategy: 'Go-to-Market Strategy',
}

@Injectable()
export class CompleteOnePagerUseCase implements Usecase<CompleteOnePagerInput, CompleteOnePagerOutput> {
    private readonly logger = new Logger(CompleteOnePagerUseCase.name);

    constructor(
        @Inject('AutomationRepository')
        private readonly automationRepository: AutomationRepository,
        @Inject('CompanyRepository')
        private readonly companyRepository: CompanyRepository,
        @Inject('IResultRepository')
        private readonly resultRepository: IResultRepository,
    ) { }

    async execute({ automationId, data }: CompleteOnePagerInput): Promise<CompleteOnePagerOutput> {

        const automation = await this.automationRepository.findById(automationId);

        if (!automation) {
            throw new AutomationNotFoundError();
        }

        const isValidAutomationToReceiveOnePager = automation.stage === AutomationStageDomain.TRIAGE;

        if (!isValidAutomationToReceiveOnePager) {
            throw new AutomationNotCompletedError('Automation must be in TRIAGE stage to receive one pager');
        }

        const companyId = await this.automationRepository.getCompanyIdByAutomationId(automationId);

        if (!companyId) {
            throw new AutomationNotFoundError();
        }

        // Criar ou atualizar registro na tabela OnePager
        await this.automationRepository.createOrUpdateOnePager({
            automationId,
            companyId,
            url: data.onePagerUrl,
        });

        // Create Result + OutputDocuments from coverage/missing data
        if (data.coverage?.length || data.missing?.length) {
            try {
                const outputDocuments = [
                    ...(data.coverage || []).map(infoType => ({
                        name: INFO_TYPE_DISPLAY_NAMES[infoType] || infoType,
                        status: 'OK' as const,
                        sector: INFO_TYPE_TO_SECTOR[infoType] || OutputSector.COMPANY_SUMMARY,
                        resultId: '', // filled by repository
                    })),
                    ...(data.missing || []).map(infoType => ({
                        name: INFO_TYPE_DISPLAY_NAMES[infoType] || infoType,
                        status: 'MISSING' as const,
                        sector: INFO_TYPE_TO_SECTOR[infoType] || OutputSector.COMPANY_SUMMARY,
                        resultId: '', // filled by repository
                    })),
                ];

                const hasMissing = (data.missing?.length || 0) > 0;

                await this.resultRepository.createResultWithDocuments({
                    resultData: {
                        automationId,
                        status: hasMissing ? 'MISSING_DOCS' : 'OK',
                    },
                    outputDocuments,
                });

                this.logger.log(
                    `Created Result with ${data.coverage?.length || 0} OK + ${data.missing?.length || 0} MISSING output documents`
                );
            } catch (error) {
                this.logger.error(`Failed to create Result/OutputDocuments: ${error.message}`);
            }
        }

        await this.automationRepository.updateStatus(automationId, AutomationStatus.COMPLETED);

        return {
            message: 'OnePager created or updated successfully',
            automationId,
            onePagerSaved: true,
        };
    }
}
