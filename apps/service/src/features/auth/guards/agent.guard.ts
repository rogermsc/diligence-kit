import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AgentGuard implements CanActivate {
    private readonly secret: string;

    constructor() {
        this.secret = process.env.AGENT_SECRET!;
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('Missing authorization header');
        }

        const [, token] = authHeader.split(' ');

        if (!token) {
            throw new UnauthorizedException('Invalid token format');
        }

        try {
            jwt.verify(token, this.secret, { algorithms: ['HS256'] });
            return true;
        } catch {
            throw new UnauthorizedException('Invalid agent token');
        }
    }
}
