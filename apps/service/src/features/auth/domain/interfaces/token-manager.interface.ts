import { User } from "@/shared/domain/entities/user.entity"

/**
 * An authenticated caller. Every field is required: an optional `id` is what let a
 * refresh token authenticate as user `undefined`. Refresh-token state deliberately
 * does not live here — see RefreshTokenJwtPayload.
 */
export interface UserJwt {
    id: string
    email: string
    name: string
}

export interface RefreshTokenJwtPayload {
    refreshTokenId: string
}

export interface ITokenManager {
    generate(user: User, expire?: string): Promise<string>
    generateRefreshToken(
        refreshTokenId: string,
        expire?: string,
    ): Promise<string>
    verifyAccessToken(token: string): Promise<UserJwt | null>
    verifyRefreshToken(token: string): Promise<RefreshTokenJwtPayload | null>
}
