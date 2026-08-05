import { z } from 'zod';
import { AgentType } from '@/features/onePager-agent/agent/domain/agent-type';
import { ReportStatus } from '@/shared/domain/entities/report.entity';

// Enum values for validation
const AgentTypeEnum = z.nativeEnum(AgentType);
const ReportStatusEnum = z.nativeEnum(ReportStatus);

export const reportPayloadSchema = z.object({
    automationId: z.string().uuid('Automation ID must be a valid UUID'),
    reportUrl: z.string().url('Report URL must be a valid URL').optional(),
    domain: AgentTypeEnum,
    status: ReportStatusEnum
});

export type ReportPayloadSchema = z.infer<typeof reportPayloadSchema>;
