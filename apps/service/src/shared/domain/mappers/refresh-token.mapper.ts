import { RefreshToken } from "@/shared/domain/entities/refresh-token.entity"
import { RefreshToken as PrismaRefreshToken } from "@prisma/client"

export class RefreshTokenMapper {
    static toDomain(prismaRefreshToken: PrismaRefreshToken): RefreshToken {
        return new RefreshToken({
            id: prismaRefreshToken.id,
            userId: prismaRefreshToken.userId,
            expiresAt: prismaRefreshToken.expiresAt,
            createdAt: prismaRefreshToken.createdAt,
        })
    }

    static toPrisma(refreshToken: RefreshToken): PrismaRefreshToken {
        return {
            id: refreshToken.id,
            userId: refreshToken.userId,
            expiresAt: refreshToken.expiresAt,
            createdAt: refreshToken.createdAt || new Date(),
        }
    }
}
