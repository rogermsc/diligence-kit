import { Request } from 'express';
import { UserJwt } from '@/features/auth/domain/interfaces/token-manager.interface';

export interface AutomationRequest extends Request {
    automationId?: string;
    user?: UserJwt;
}