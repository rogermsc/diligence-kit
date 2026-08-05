import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@/shared/infra/prisma';
import { IRefreshTokenRepository } from '@/shared/repository/refresh-token-repository.interface';
import { RefreshToken } from '@/shared/domain/entities/refresh-token.entity';
import { DatabaseAccessError } from '@/shared/errors/db/data-base-error';

@Injectable()
export class PrismaRefreshTokenRepositoryAdapter implements IRefreshTokenRepository {
    async create(token: RefreshToken): Promise<void> {
        try {
            await prisma.$transaction([
                prisma.refreshToken.deleteMany({ where: { userId: token.userId } }),
                prisma.refreshToken.create({
                    data: {
                        id: token.id,
                        userId: token.userId,
                        expiresAt: token.expiresAt,
                        createdAt: token.createdAt ?? new Date(),
                    },
                })
            ]);
        } catch (error) {
            Logger.error(error);

            throw new DatabaseAccessError();
        }
    }

    async findById(id: string): Promise<RefreshToken | null> {
        try {
            const data = await prisma.refreshToken.findUnique({ where: { id } });
            if (!data) return null;
            return new RefreshToken({
                id: data.id,
                userId: data.userId,
                expiresAt: data.expiresAt,
                createdAt: data.createdAt,
            });
        } catch (error) {
            Logger.error(error);

            throw new DatabaseAccessError();
        }
    }

    async findByUserId(userId: string): Promise<RefreshToken | null> {
        try {
            const data = await prisma.refreshToken.findFirst({
                where: { userId },
                orderBy: { createdAt: 'desc' }
            });
            if (!data) return null;
            return new RefreshToken({
                id: data.id,
                userId: data.userId,
                expiresAt: data.expiresAt,
                createdAt: data.createdAt,
            });
        } catch (error) {
            Logger.error(error);
            throw new DatabaseAccessError();
        }
    }

    async deleteById(id: string): Promise<void> {
        try {
            await prisma.refreshToken.delete({ where: { id } });
        } catch (error) {
            Logger.error(error);
            throw new DatabaseAccessError();
        }
    }
} 