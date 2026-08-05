import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/infra/prisma';
import { IOutputDocumentRepository, OutputDocumentCreateInput } from '@/features/automation/domain/repository/output-document-repository.interface';

@Injectable()
export class PrismaOutputDocumentRepositoryAdapter implements IOutputDocumentRepository {

    async createMany(documents: OutputDocumentCreateInput[]): Promise<void> {
        await prisma.outputDocument.createMany({
            data: documents,
        });
    }
} 