import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Req,
} from "@nestjs/common"
import { Request } from "express"
import { ApiTags } from "@nestjs/swagger"
import { LoginUseCase } from "@/features/auth/use-case/login.usecase"
import { loginSchema } from "@/features/auth/data/dtos/login.schema"
import { RequestValidator } from "@/shared/validators/request-validator"
import {
    RefreshTokenUseCase,
    RefreshTokenOutput,
} from "@/features/auth/use-case/refresh-token.usecase"
import { refreshTokenSchema } from "@/features/auth/data/dtos/refresh-token.schema"
import { ApiLogin, ApiRefreshToken } from "@/shared/decorators"

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshTokenUseCase: RefreshTokenUseCase,
    ) {}

    @Post("login")
    @HttpCode(HttpStatus.OK)
    @ApiLogin()
    async login(@Body() body: unknown, @Req() req: Request) {
        const validatedData = RequestValidator.validate(body, loginSchema)

        const result = await this.loginUseCase.execute({
            email: validatedData.email,
            password: validatedData.password,
            ip: req.ip,
        })

        return {
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
        }
    }

    @Post("refresh-token")
    @HttpCode(HttpStatus.OK)
    @ApiRefreshToken()
    async refreshToken(@Body() body: unknown): Promise<RefreshTokenOutput> {
        const validatedData = RequestValidator.validate(
            body,
            refreshTokenSchema,
        )

        return this.refreshTokenUseCase.execute({
            refresh_token: validatedData.refreshToken,
        })
    }
}
