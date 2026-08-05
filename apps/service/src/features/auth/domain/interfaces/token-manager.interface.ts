import { User } from '@/shared/domain/entities/user.entity';

export interface UserJwt {
    id?: string;
    email?: string;
    name?: string;
    refreshTokenId?: string;
}

export interface RefreshTokenJwtPayload {
    refreshTokenId: string;
}

export interface ITokenManager {
    generate(user: User, expire?: string): Promise<string>;
    generateRefreshToken(refreshTokenId: string, expire?: string): Promise<string>;
    verify(token: string): Promise<UserJwt | null>;
    verifyAccessToken(token: string): Promise<UserJwt | null>;
    verifyRefreshToken(token: string): Promise<RefreshTokenJwtPayload | null>;
} 