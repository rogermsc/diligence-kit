
import { Injectable, Logger } from '@nestjs/common';
import { Result, AutomationStatus } from '@prisma/client';
import { prisma } from '@/shared/infra/prisma';
import { DatabaseAccessError } from '@/shared/errors/db/data-base-error';
import { CreateResultWithDocumentsInput, CreateResultWithDocumentsOutput, IResultRepository, ResultCreateInput } from '@/features/automation/domain/repository/result-repository.interface';

@Injectable()
export class PrismaResultRepositoryAdapter implements IResultRepository {
    private readonly logger = new Logger(PrismaResultRepositoryAdapter.name);

    async create(data: ResultCreateInput): Promise<Result> {
        try {
            return await prisma.result.create({
                data: {
                    automationId: data.automationId,
                    status: data.status,
                },
            });
        } catch (error) {
            this.logger.error(
                `Failed to create result: ${error.message}`,
                error.stack,
            );
            throw new DatabaseAccessError('Failed to create result');
        }
    }

    async createResultWithDocuments(data: CreateResultWithDocumentsInput): Promise<CreateResultWithDocumentsOutput> {
        try {
            // Usar uma única transação para todas as operações
            return await prisma.$transaction(async (tx) => {
                // Criar o resultado
                const result = await tx.result.create({
                    data: {
                        automationId: data.resultData.automationId,
                        status: data.resultData.status,
                    },
                });

                // Criar os documentos de output
                const outputDocuments = await tx.outputDocument.createMany({
                    data: data.outputDocuments.map(doc => ({
                        ...doc,
                        resultId: result.id
                    }))
                });

                // Atualizar o status da automação para COMPLETED
                await tx.automation.update({
                    where: { id: data.resultData.automationId },
                    data: { status: AutomationStatus.COMPLETED },
                });

                return {
                    result,
                    outputDocuments: await tx.outputDocument.findMany({
                        where: { resultId: result.id }
                    })
                };
            });
        } catch (error) {
            this.logger.error(
                `Failed to create result with documents: ${error.message}`,
                error.stack,
            );

            // Em caso de erro, atualizar o status da automação para FAILED
            try {
                await prisma.automation.update({
                    where: { id: data.resultData.automationId },
                    data: { status: AutomationStatus.FAILED },
                });
            } catch (updateError) {
                this.logger.error(
                    `Failed to update automation status to FAILED: ${updateError.message}`,
                    updateError.stack,
                );
            }

            throw new DatabaseAccessError('Failed to create result with documents');
        }
    }


}