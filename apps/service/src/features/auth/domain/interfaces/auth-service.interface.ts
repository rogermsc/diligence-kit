import { RefreshTokenJwtPayload, UserJwt } from '@/features/auth/domain/interfaces/token-manager.interface';
import { User } from '@/shared/domain/entities/user.entity';

export interface IAuthService {
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    generateToken(user: User, expire?: string, refreshTokenId?: string): Promise<string>;
    generateRefreshToken(refreshTokenId: string, expire?: string): Promise<string>;
    verifyAccessToken(token: string): Promise<UserJwt | null>;
    verifyRefreshToken(token: string): Promise<RefreshTokenJwtPayload | null>;
} 