import { Injectable, Inject } from '@nestjs/common';
import { IRefreshTokenRepository } from '@/shared/repository/refresh-token-repository.interface';
import { IUserRepository } from '@/shared/repository/user-repository.interface';
import { IAuthService } from '@/features/auth/domain/interfaces/auth-service.interface';
import { UnauthorizedError } from '@/features/auth/domain/errors/auth.errors';
import { RefreshToken } from '@/shared/domain/entities/refresh-token.entity';
import { randomUUID } from 'crypto';

export interface RefreshTokenInput {
    refresh_token: string;
}

export interface RefreshTokenOutput {
    access_token: string;
    refresh_token: string;
}

@Injectable()
export class RefreshTokenUseCase {
    constructor(
        @Inject('IRefreshTokenRepository')
        private readonly refreshTokenRepository: IRefreshTokenRepository,
        @Inject('IUserRepository')
        private readonly userRepository: IUserRepository,
        @Inject('IAuthService')
        private readonly authService: IAuthService
    ) { }

    async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
        // Verifica se o refresh token é válido
        const payload = await this.authService.verifyRefreshToken(input.refresh_token);

        if (!payload) {
            throw new UnauthorizedError('Invalid refresh token');
        }

        // Busca o refresh token no banco
        const storedRefreshToken = await this.refreshTokenRepository.findById(payload.refreshTokenId);
        if (!storedRefreshToken) {
            throw new UnauthorizedError('Refresh token not found');
        }

        // Verifica se o refresh token expirou
        if (storedRefreshToken.expiresAt < new Date()) {
            await this.refreshTokenRepository.deleteById(storedRefreshToken.id);
            throw new UnauthorizedError('Refresh token expired');
        }

        const user = await this.userRepository.findById(storedRefreshToken.userId);
        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        // Invalida o token antigo antes de emitir o novo (token rotation segura)
        await this.refreshTokenRepository.deleteById(storedRefreshToken.id);

        const newRefreshTokenId = randomUUID();
        const accessToken = await this.authService.generateToken(user, "1d");
        const refreshToken = await this.authService.generateRefreshToken(newRefreshTokenId);

        const newRefreshToken = new RefreshToken({
            id: newRefreshTokenId,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date()
        });

        await this.refreshTokenRepository.create(newRefreshToken);

        return {
            access_token: accessToken,
            refresh_token: refreshToken
        };
    }
} 