import { Injectable, Inject, Logger } from "@nestjs/common"
import { IUserRepository } from "@/shared/repository/user-repository.interface"
import { IAuthService } from "@/features/auth/domain/interfaces/auth-service.interface"
import { InvalidCredentialsError } from "@/features/auth/domain/errors/auth.errors"
import { IRefreshTokenRepository } from "@/shared/repository/refresh-token-repository.interface"
import { RefreshToken } from "@/shared/domain/entities/refresh-token.entity"
import { LoginRateLimiterService } from "@/features/auth/infra/services/login-rate-limiter.service"
import { randomUUID } from "crypto"

interface LoginInput {
    email: string
    password: string
    ip?: string
}

interface LoginOutput {
    accessToken: string
    refreshToken: string
}

@Injectable()
export class LoginUseCase {
    private readonly logger = new Logger(LoginUseCase.name)

    constructor(
        @Inject("IUserRepository")
        private readonly userRepository: IUserRepository,
        @Inject("IAuthService")
        private readonly authService: IAuthService,
        @Inject("IRefreshTokenRepository")
        private readonly refreshTokenRepository: IRefreshTokenRepository,
        private readonly rateLimiter: LoginRateLimiterService,
    ) {}

    async execute(input: LoginInput): Promise<LoginOutput> {
        const { email, ip } = input

        await this.rateLimiter.assertNotBlocked(email)

        const user = await this.userRepository.findByEmail(email)

        if (!user) {
            await this.rateLimiter.recordFailure(email)
            this.logger.warn({
                event: "login.failure",
                reason: "user_not_found",
                email,
                ip,
                timestamp: new Date().toISOString(),
            })
            throw new InvalidCredentialsError()
        }

        const isValidPassword = await this.authService.verifyPassword(
            input.password,
            user.password,
        )

        if (!isValidPassword) {
            await this.rateLimiter.recordFailure(email)
            this.logger.warn({
                event: "login.failure",
                reason: "invalid_password",
                email,
                ip,
                timestamp: new Date().toISOString(),
            })
            throw new InvalidCredentialsError()
        }

        const refreshTokenId = randomUUID()
        const accessToken = await this.authService.generateToken(user, "1d")
        const refreshToken =
            await this.authService.generateRefreshToken(refreshTokenId)

        const newRefreshToken = new RefreshToken({
            id: refreshTokenId,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
        })

        await this.refreshTokenRepository.create(newRefreshToken)

        await this.rateLimiter.resetAttempts(email)
        this.logger.log({
            event: "login.success",
            userId: user.id,
            email,
            ip,
            timestamp: new Date().toISOString(),
        })

        return {
            accessToken,
            refreshToken,
        }
    }
}
