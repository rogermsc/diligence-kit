import { Injectable, Inject } from "@nestjs/common"
import { IAuthService } from "@/features/auth/domain/interfaces/auth-service.interface"
import { IPasswordHasher } from "@/features/auth/domain/interfaces/password-hasher.interface"
import { ITokenManager } from "@/features/auth/domain/interfaces/token-manager.interface"
import { User } from "@/shared/domain/entities/user.entity"

@Injectable()
export class AuthService implements IAuthService {
    constructor(
        @Inject("IPasswordHasher")
        private readonly passwordHasher: IPasswordHasher,
        @Inject("ITokenManager")
        private readonly tokenManager: ITokenManager,
    ) {}

    async hashPassword(password: string): Promise<string> {
        return this.passwordHasher.hash(password)
    }

    async verifyPassword(
        password: string,
        hashedPassword: string,
    ): Promise<boolean> {
        return this.passwordHasher.verify(password, hashedPassword)
    }

    async generateToken(user: User, expire?: string): Promise<string> {
        return this.tokenManager.generate(user, expire)
    }

    async generateRefreshToken(
        refreshTokenId: string,
        expire?: string,
    ): Promise<string> {
        return this.tokenManager.generateRefreshToken(refreshTokenId, expire)
    }

    async verifyAccessToken(token: string) {
        return this.tokenManager.verifyAccessToken(token)
    }

    async verifyRefreshToken(token: string) {
        return this.tokenManager.verifyRefreshToken(token)
    }
}
