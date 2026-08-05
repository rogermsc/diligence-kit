import { Module } from '@nestjs/common';
import { AuthService } from '@/features/auth/services/auth.service';
import { BcryptPasswordHasherAdapter } from '@/features/auth/infra/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenManagerAdapter } from '@/features/auth/infra/adapters/jwt-token-manager.adapter';
import { LoginUseCase } from '@/features/auth/use-case/login.usecase';
import { PrismaUserRepositoryAdapter } from '@/shared/infra/adapters/prisma-user-repository.adapter';
import { AuthController } from '@/features/auth/presentation/auth.controller';
import { RequestValidator } from '@/shared/validators/request-validator';
import { AuthGuard } from '@/features/auth/guards/auth.guard';
import { PrismaRefreshTokenRepositoryAdapter } from '@/shared/infra/adapters/prisma-refresh-token-repository.adapter';
import { RefreshTokenUseCase } from '@/features/auth/use-case/refresh-token.usecase';
import { LoginRateLimiterService } from '@/features/auth/infra/services/login-rate-limiter.service';

@Module({
    controllers: [AuthController],
    providers: [
        AuthService,
        LoginUseCase,
        RefreshTokenUseCase,
        RequestValidator,
        AuthGuard,
        LoginRateLimiterService,
        {
            provide: 'IPasswordHasher',
            useClass: BcryptPasswordHasherAdapter,
        },
        {
            provide: 'ITokenManager',
            useClass: JwtTokenManagerAdapter,
        },
        {
            provide: 'IUserRepository',
            useClass: PrismaUserRepositoryAdapter,
        },
        {
            provide: 'IRefreshTokenRepository',
            useClass: PrismaRefreshTokenRepositoryAdapter,
        },
        {
            provide: 'IAuthService',
            useClass: AuthService,
        }
    ],
    exports: [AuthService, AuthGuard],
})
export class AuthModule { } 