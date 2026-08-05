import { Injectable } from '@nestjs/common';
import { ITokenManager, UserJwt } from '@/features/auth/domain/interfaces/token-manager.interface';
import { SignOptions, Secret } from 'jsonwebtoken';
import * as jwt from 'jsonwebtoken';
import { User } from '@/shared/domain/entities/user.entity';

type JwtCustomPayload = {
    sub: string;
    email: string;
    name: string;
}

@Injectable()
export class JwtTokenManagerAdapter implements ITokenManager {
    private readonly secret: Secret;
    private readonly defaultExpiresIn: string;

    constructor() {
        this.secret = process.env.JWT_SECRET!;
        this.defaultExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    }

    async generate(user: User, expire?: string): Promise<string> {
        const payload: JwtCustomPayload = {
            sub: user.id,
            email: user.email,
            name: user.name || '',
        };

        const options = {
            algorithm: 'HS256' as const,
            expiresIn: expire || this.defaultExpiresIn,
        } as SignOptions;

        return jwt.sign(payload, this.secret, options);
    }

    async verify(token: string): Promise<UserJwt | null> {
        try {
            const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as JwtCustomPayload;

            return {
                id: decoded.sub,
                name: decoded.name,
                email: decoded.email,
            };
        } catch {
            return null;
        }
    }

    async generateRefreshToken(refreshTokenId: string, expire?: string): Promise<string> {
        const payload = { refreshTokenId };
        const options = {
            algorithm: 'HS256' as const,
            expiresIn: expire || this.defaultExpiresIn,
        } as SignOptions;
        return jwt.sign(payload, this.secret, options);
    }

    async verifyAccessToken(token: string): Promise<UserJwt | null> {
        try {
            const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as JwtCustomPayload & { refreshTokenId?: string };
            return {
                id: decoded.sub,
                name: decoded.name,
                email: decoded.email,
                refreshTokenId: decoded.refreshTokenId,
            };
        } catch {
            return null;
        }
    }

    async verifyRefreshToken(token: string): Promise<{ refreshTokenId: string } | null> {
        try {
            const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as { refreshTokenId?: string };
            if (!decoded.refreshTokenId) return null;
            return { refreshTokenId: decoded.refreshTokenId };
        } catch {
            return null;
        }
    }
} 