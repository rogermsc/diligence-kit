import { Module } from '@nestjs/common';
import { CompleteOnePagerController } from './complete-onePager-automation/presentation/complete-onepager.controller';
import { CompleteOnePagerUseCase } from './complete-onePager-automation/use-case/complete-onepager.usecase';
import { PrismaResultRepositoryAdapter } from '@/shared/infra/adapters/prisma-result-repository.adapter';
import { PrismaOutputDocumentRepositoryAdapter } from '@/shared/infra/adapters/prisma-output-document-repository.adapter';
import { PrismaAutomationRepositoryAdapter } from '@/shared/infra/adapters/prisma-automation-repository.adapter';
import { AutomationModule as StartAutomationModule } from './start-automation/automation.module';
import { EmailNotificationProvider, NodemailerEmailProvider } from '@/shared/services/email';
import { GetCompanyByIdUseCase } from './start-automation/use-case/get-company-by-id.usecase';
import { PrismaCompanyRepositoryAdapter } from '@/shared/infra/adapters/prisma-company-repository.adapter';
import { PrismaDocumentRepositoryAdapter } from '@/shared/infra/adapters/prisma-document-repository.adapter';
import { AuthModule } from '@/features/auth/auth.module';

@Module({
    controllers: [CompleteOnePagerController],
    imports: [
        StartAutomationModule,
        AuthModule,
    ],
    providers: [
        // Use cases
        CompleteOnePagerUseCase,
        GetCompanyByIdUseCase,
        {
            provide: EmailNotificationProvider,
            useFactory: () => {
                const emailProvider = new NodemailerEmailProvider();
                return new EmailNotificationProvider(emailProvider);
            }
        },
        {
            provide: 'IResultRepository',
            useClass: PrismaResultRepositoryAdapter,
        },
        {
            provide: 'IOutputDocumentRepository',
            useClass: PrismaOutputDocumentRepositoryAdapter,
        },
        {
            provide: 'IAutomationRepository',
            useClass: PrismaAutomationRepositoryAdapter,
        },
        {
            provide: 'AutomationRepository',
            useClass: PrismaAutomationRepositoryAdapter,
        },
        {
            provide: 'CompanyRepository',
            useClass: PrismaCompanyRepositoryAdapter,
        },
        {
            provide: 'DocumentRepository',
            useClass: PrismaDocumentRepositoryAdapter,
        },
    ],
})
export class AutomationModule { }
