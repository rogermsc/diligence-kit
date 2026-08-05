import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
    private readonly secret: Buffer;

    constructor() {
        this.secret = Buffer.from(process.env.WEBHOOK_SECRET!, 'utf-8');
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

        const signature = request.headers['x-webhook-signature'] as string | undefined;
        if (!signature?.startsWith('sha256=')) {
            throw new UnauthorizedException('Missing or malformed webhook signature');
        }

        const rawBody = request.rawBody;
        if (!rawBody?.length) {
            throw new UnauthorizedException('Raw body unavailable for signature verification');
        }

        const expected = Buffer.from(
            'sha256=' + createHmac('sha256', this.secret).update(rawBody).digest('hex'),
            'utf-8',
        );
        const received = Buffer.from(signature, 'utf-8');

        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        return true;
    }
}
